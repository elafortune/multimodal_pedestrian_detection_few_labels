"""S8 - Export the IR detector to TensorRT FP16 and benchmark end-to-end latency (batch 1).

Input : runs/det/<name>/weights/last.pt, real IR test images
Output: deploy/<name>_fp16.engine, results/latency.json
Measured per frame (wall clock, CUDA synchronised by Ultralytics result conversion):
  pre (letterbox + normalise), infer, post (NMS + rescale), e2e = full predict() call
Also: pix2pix-turbo RGB->IR latency (fp16, 512x512) for the "reconstructed IR" pipeline.
"""
import argparse
import json
import os
import shutil
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import torch

os.environ.setdefault("YOLO_CONFIG_DIR", "/workspace/bsa/.ultralytics")
os.environ.setdefault("HF_HOME", "/workspace/hf")
from ultralytics import YOLO  # noqa: E402

BSA = Path("/workspace/bsa")


def bench(model, frames, warmup=30, **kw):
    for f in frames[:warmup]:
        model.predict(f, verbose=False, **kw)
    pre, inf, post, e2e = [], [], [], []
    for f in frames:
        t = time.perf_counter()
        r = model.predict(f, verbose=False, **kw)[0]
        _ = r.boxes.xyxy.cpu()
        e2e.append((time.perf_counter() - t) * 1000)
        pre.append(r.speed["preprocess"]); inf.append(r.speed["inference"]); post.append(r.speed["postprocess"])
    s = lambda a: {"p50": float(np.percentile(a, 50)), "p95": float(np.percentile(a, 95))}
    return {"pre_ms": s(pre), "infer_ms": s(inf), "post_ms": s(post), "e2e_ms": s(e2e),
            "fps_e2e_p50": 1000 / float(np.percentile(e2e, 50))}


def bench_translator(ckpt, n=100):
    sys.path.insert(0, str(BSA / "img2img-turbo/src"))
    from pix2pix_turbo import Pix2Pix_Turbo
    m = Pix2Pix_Turbo(pretrained_path=str(ckpt)); m.set_eval(); m.half()
    tok = m.tokenizer("thermal infrared image", max_length=m.tokenizer.model_max_length, padding="max_length",
                      truncation=True, return_tensors="pt").input_ids.cuda()
    x = torch.rand(1, 3, 512, 512, device="cuda").half()
    ts = []
    with torch.no_grad():
        for i in range(n + 10):
            torch.cuda.synchronize(); t = time.perf_counter()
            m(x, prompt_tokens=tok, deterministic=True)
            torch.cuda.synchronize()
            if i >= 10:
                ts.append((time.perf_counter() - t) * 1000)
    return {"p50_ms": float(np.percentile(ts, 50)), "p95_ms": float(np.percentile(ts, 95)), "res": "512x512 fp16"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default="ir_full")
    ap.add_argument("--n", type=int, default=500)
    ap.add_argument("--translator", default="")
    args = ap.parse_args()

    pt = BSA / "runs/det" / args.name / "weights/last.pt"
    frames = [cv2.imread(str(p)) for p in sorted((BSA / "data/yolo/ir/images/test").glob("*.jpg"))[: args.n]]
    out = {"gpu": torch.cuda.get_device_name(0), "frames": len(frames), "input": "1280x1024 -> imgsz 640"}

    m = YOLO(str(pt))
    out["pytorch_fp32"] = bench(m, frames, imgsz=640, half=False)
    out["pytorch_fp16"] = bench(m, frames, imgsz=640, half=True)

    deploy = BSA / "deploy"; deploy.mkdir(exist_ok=True)
    eng = deploy / f"{args.name}_fp16.engine"
    if not eng.exists():
        e = YOLO(str(pt)).export(format="engine", half=True, imgsz=640, batch=1, device=0, workspace=8, simplify=True)
        shutil.move(e, eng)
    out["tensorrt_fp16"] = bench(YOLO(str(eng), task="detect"), frames, imgsz=640)
    out["tensorrt_fp16"]["engine"] = str(eng)
    if args.translator:
        out["translator_pix2pix_turbo"] = bench_translator(args.translator)
    p = BSA / "results/latency.json"
    p.write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
