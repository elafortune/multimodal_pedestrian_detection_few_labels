"""E6 - Fully-GPU detection pipeline vs the Ultralytics TensorRT pipeline (batch 1, ir_full).

Why: with TensorRT the network takes 1.6 ms but the end-to-end frame takes 5.9 ms: letterbox/normalise run in
numpy on the CPU and NMS + rescaling sync with the CPU (60 % of the time, see results/latency.json).
Here, after ONE host->device copy of the raw frame (a camera frame lands in host memory):
  pre  : BGR->RGB, resize 1280x1024 -> 640x512, pad to 640x640 (114), /255   -> torch on GPU
  infer: TensorRT FP16 engine exported with NMS inside (EfficientNMS-style, Ultralytics nms=True)
  post : rescale boxes + confidence filter on GPU, then one small device->host copy (<= 300 x 6 floats)
Variant "graph": the whole pre+infer+post captured in a CUDA graph (one launch per frame, no Python per layer).

Input : runs/det/ir_full/weights/last.pt, real IR test images
Output: deploy/ir_full_fp16_nms.engine, results/latency_gpu.json (+ mAP check of every pipeline on the full test)
"""
import importlib
import json
import os
import shutil
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import tensorrt as trt
import torch
import torch.nn.functional as F

os.environ.setdefault("YOLO_CONFIG_DIR", "/workspace/bsa/.ultralytics")
sys.path.insert(0, str(Path(__file__).parent))
from ultralytics import YOLO  # noqa: E402

from det_eval import evaluate  # noqa: E402

BSA = Path("/workspace/bsa")
TEST = BSA / "data/yolo/ir/images/test"
TORCH_DT = {trt.DataType.FLOAT: torch.float32, trt.DataType.HALF: torch.float16, trt.DataType.INT32: torch.int32}


def load_engine(path):
    """Ultralytics .engine = 4-byte metadata length + json metadata + serialized engine."""
    with open(path, "rb") as f:
        n = int.from_bytes(f.read(4), byteorder="little")
        try:
            json.loads(f.read(n).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            f.seek(0)
        blob = f.read()
    return trt.Runtime(trt.Logger(trt.Logger.WARNING)).deserialize_cuda_engine(blob)


class GpuPipeline:
    def __init__(self, engine_path, conf=0.25, H=1024, W=1280):
        self.engine = load_engine(engine_path)
        self.ctx = self.engine.create_execution_context()
        self.stream = torch.cuda.Stream()
        names = [self.engine.get_tensor_name(i) for i in range(self.engine.num_io_tensors)]
        self.bufs = {}
        for n in names:
            shape = tuple(self.engine.get_tensor_shape(n))
            self.bufs[n] = torch.empty(shape, dtype=TORCH_DT[self.engine.get_tensor_dtype(n)], device="cuda")
            self.ctx.set_tensor_address(n, self.bufs[n].data_ptr())
        self.inp = [n for n in names if self.engine.get_tensor_mode(n) == trt.TensorIOMode.INPUT][0]
        self.out = [n for n in names if self.engine.get_tensor_mode(n) == trt.TensorIOMode.OUTPUT][0]
        self.conf = conf
        self.host = torch.empty((H, W, 3), dtype=torch.uint8).pin_memory()
        self.host_np = self.host.numpy()
        self.dev = torch.empty((H, W, 3), dtype=torch.uint8, device="cuda")
        s = 640 / max(H, W); self.s = s
        self.nh, self.nw = round(H * s), round(W * s)
        self.top, self.left = (640 - self.nh) // 2, (640 - self.nw) // 2
        self.res = torch.empty((300, 6), dtype=torch.float32, device="cuda")
        self.offset = torch.tensor([self.left, self.top, self.left, self.top], device="cuda", dtype=torch.float32)  # static: graph-safe
        self.graph = None

    def _gpu_work(self):
        self.dev.copy_(self.host, non_blocking=True)                              # H2D, the only input copy
        x = self.dev.permute(2, 0, 1)[None].flip(1).float()                        # BGR->RGB, CHW
        x = F.interpolate(x, size=(self.nh, self.nw), mode="bilinear", align_corners=False)
        inp = self.bufs[self.inp]
        inp.fill_(114 / 255)
        inp[:, :, self.top:self.top + self.nh, self.left:self.left + self.nw] = (x / 255).to(inp.dtype)
        self.ctx.execute_async_v3(torch.cuda.current_stream().cuda_stream)        # TRT: network + NMS
        d = self.bufs[self.out][0].float()                                        # [300, 6] x1 y1 x2 y2 conf cls
        self.res[:, :4] = (d[:, :4] - self.offset) / self.s
        self.res[:, 4:] = d[:, 4:]

    def capture(self):
        with torch.cuda.stream(self.stream):
            for _ in range(3):
                self._gpu_work()
        torch.cuda.synchronize()
        self.graph = torch.cuda.CUDAGraph()
        with torch.cuda.graph(self.graph, stream=self.stream):
            self._gpu_work()
        torch.cuda.synchronize()

    def __call__(self, frame, timings=None):
        t0 = time.perf_counter()
        np.copyto(self.host_np, frame)  # into pinned memory; NOT torch copy_ (128 OpenMP threads: 98 ms, B12)
        with torch.cuda.stream(self.stream):
            if self.graph is not None:
                self.graph.replay()
            else:
                self._gpu_work()
            r = self.res[self.res[:, 4] >= self.conf].cpu()                       # one small D2H copy (sync)
        if timings is not None:
            timings.append((time.perf_counter() - t0) * 1000)
        return r.numpy()


def stage_times(pipe, frames, n=200):
    """GPU time of each stage with CUDA events (eager mode)."""
    ev = [torch.cuda.Event(enable_timing=True) for _ in range(4)]
    acc = {"pre": [], "infer": [], "post": []}
    for f in frames[:n]:
        np.copyto(pipe.host_np, f)
        with torch.cuda.stream(pipe.stream):
            ev[0].record()
            pipe.dev.copy_(pipe.host, non_blocking=True)
            x = F.interpolate(pipe.dev.permute(2, 0, 1)[None].flip(1).float(), size=(pipe.nh, pipe.nw), mode="bilinear", align_corners=False)
            inp = pipe.bufs[pipe.inp]; inp.fill_(114 / 255)
            inp[:, :, pipe.top:pipe.top + pipe.nh, pipe.left:pipe.left + pipe.nw] = (x / 255).to(inp.dtype)
            ev[1].record()
            pipe.ctx.execute_async_v3(torch.cuda.current_stream().cuda_stream)
            ev[2].record()
            d = pipe.bufs[pipe.out][0].float(); r = d[d[:, 4] >= pipe.conf].cpu()
            ev[3].record()
        torch.cuda.synchronize()
        for k, (a, b) in zip(acc, zip(ev[:-1], ev[1:])):
            acc[k].append(a.elapsed_time(b))
    return {k: float(np.median(v)) for k, v in acc.items()}


def gt_boxes(stem, W=1280, H=1024):
    p = BSA / "data/yolo/ir/labels/test" / f"{stem}.txt"
    a = np.loadtxt(p, ndmin=2) if p.exists() and p.stat().st_size else np.zeros((0, 5))
    if not len(a):
        return np.zeros((0, 4))
    c, w, h = a[:, 1:3] * [W, H], a[:, 3] * W, a[:, 4] * H
    return np.stack([c[:, 0] - w / 2, c[:, 1] - h / 2, c[:, 0] + w / 2, c[:, 1] + h / 2], 1)


def main():
    lat08 = importlib.import_module("08_export_trt")
    pt = BSA / "runs/det/ir_full/weights/last.pt"
    eng = BSA / "deploy/ir_full_fp16_nms.engine"
    if not eng.exists():
        e = YOLO(str(pt)).export(format="engine", half=True, imgsz=640, batch=1, device=0, workspace=8, simplify=True,
                                 nms=True, conf=0.001, iou=0.7)
        shutil.move(e, eng)
    paths = sorted(TEST.glob("*.jpg"))
    frames = [cv2.imread(str(p)) for p in paths[:500]]
    out = {"gpu": torch.cuda.get_device_name(0), "frames": len(frames)}

    base = YOLO(str(BSA / "deploy/ir_full_fp16.engine"), task="detect")
    out["ultralytics_trt_fp16"] = lat08.bench(base, frames, imgsz=640)  # same run, same GPU state: fair comparison

    pipe = GpuPipeline(eng, conf=0.25)

    def run(mode):
        for f in frames[:30]:
            pipe(f)
        t = []
        for f in frames:
            pipe(f, t)
        out[f"gpu_pipeline_{mode}"] = {"e2e_ms": {"p50": float(np.percentile(t, 50)), "p95": float(np.percentile(t, 95)),
                                                  "p99": float(np.percentile(t, 99))}, "fps_e2e_p50": 1000 / float(np.percentile(t, 50))}
        print(mode, out[f"gpu_pipeline_{mode}"], flush=True)

    run("eager")
    out["gpu_pipeline_stage_gpu_ms"] = stage_times(pipe, frames)

    # accuracy check on the full test set, same evaluator for both pipelines (conf 0.001)
    gts = [gt_boxes(p.stem) for p in paths]
    pipe.conf = 0.001
    pg = [pipe(cv2.imread(str(p))) for p in paths]
    pb = []
    for r in base.predict(str(TEST), imgsz=640, conf=0.001, verbose=False, stream=True):  # dir: sorted, streamed (a 3463-path list opens every file, B13)
        pb.append(np.concatenate([r.boxes.xyxy.cpu().numpy(), r.boxes.conf.cpu().numpy()[:, None]], 1))
    out["map_check"] = {"ultralytics_trt": evaluate(pb, gts), "gpu_pipeline": evaluate([p[:, :5] for p in pg], gts)}
    dst = BSA / "results/latency_gpu.json"
    dst.write_text(json.dumps(out, indent=2))
    # CUDA graph last: a failed capture can leave the CUDA context unusable
    pipe.conf = 0.25
    try:
        pipe.capture()
        run("graph")
    except Exception as e:  # noqa: BLE001
        out["gpu_pipeline_graph_error"] = str(e).splitlines()[0]
    dst.write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
