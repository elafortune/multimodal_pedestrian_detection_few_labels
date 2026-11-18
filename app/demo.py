"""S9 - Demo: "seeing at night without night data".

Pipeline per frame:  RGB (+ real IR if the sensor is up)
   -> [IR sensor down]  pix2pix-turbo RGB->IR reconstruction
   -> RGB detector, IR detector (TensorRT engine if present), Weighted Boxes Fusion
   -> side-by-side view, per-stage latency.
Privacy: the top of every detected person box is blurred on the RGB views (no identifiable faces).

CPU fallback: without a CUDA GPU (or with DEMO_DEVICE=cpu) the detectors and the fusion run on CPU with the
PyTorch weights; the "reconstruct IR" mode is hidden because pix2pix-turbo (img2img-turbo) hard-codes CUDA.

Env: BSA_ROOT (default /workspace/bsa), DEMO_TRANSLATOR (ckpt .pkl), DEMO_PORT (7860), DEMO_DEVICE (cuda|cpu)
"""
import os
import sys
import tempfile
import time
from pathlib import Path

import cv2
import gradio as gr
import numpy as np
import torch

ROOT = Path(os.environ.get("BSA_ROOT", "/workspace/bsa"))
sys.path.insert(0, str(ROOT / "code/scripts"))
sys.path.insert(0, str(ROOT / "img2img-turbo/src"))
os.environ.setdefault("YOLO_CONFIG_DIR", str(ROOT / ".ultralytics"))
os.environ.setdefault("HF_HOME", str(ROOT.parent / "hf"))
from ensemble_boxes import weighted_boxes_fusion  # noqa: E402
from sensors import fog, low_light  # noqa: E402
from ultralytics import YOLO  # noqa: E402

TEST_RGB, TEST_IR = ROOT / "data/yolo/rgb/images/test", ROOT / "data/yolo/ir/images/test"
TEST_LBL = ROOT / "data/yolo/ir/labels/test"
CONF = 0.35
IR_MODES = ["IR ok", "IR dead -> declare missing (fall back to RGB)", "IR dead -> reconstruct IR from RGB"]
DEVICE = os.environ.get("DEMO_DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")
GPU = DEVICE.startswith("cuda") and torch.cuda.is_available()
UI_MODES = IR_MODES if GPU else IR_MODES[:2]  # generator needs CUDA
HW = torch.cuda.get_device_name(0) if GPU else "CPU (generator disabled)"


def sync():
    if GPU:
        torch.cuda.synchronize()


def load_detector(name):
    eng = ROOT / "deploy" / f"{name}_fp16.engine"
    if GPU and eng.exists():  # TensorRT engines only run on the GPU they were built for
        return YOLO(str(eng), task="detect"), "TensorRT FP16"
    return YOLO(str(ROOT / "runs/det" / name / "weights/last.pt")), "PyTorch"


DET_RGB, BACK_RGB = load_detector("rgb_full")
DET_IR, BACK_IR = load_detector("ir_full")

_translator = None


def translator():
    global _translator
    if _translator is None:
        from pix2pix_turbo import Pix2Pix_Turbo
        ck = os.environ.get("DEMO_TRANSLATOR") or sorted(
            (ROOT / "ckpt/translator_N1000/checkpoints").glob("model_*.pkl"), key=lambda p: int(p.stem.split("_")[1]))[-1]
        m = Pix2Pix_Turbo(pretrained_path=str(ck)); m.set_eval(); m.half()
        tok = m.tokenizer("thermal infrared image", max_length=m.tokenizer.model_max_length, padding="max_length",
                          truncation=True, return_tensors="pt").input_ids.cuda()
        _translator = (m, tok)
    return _translator


@torch.no_grad()
def reconstruct_ir(rgb_bgr):
    m, tok = translator()
    h, w = rgb_bgr.shape[:2]
    x = cv2.resize(cv2.cvtColor(rgb_bgr, cv2.COLOR_BGR2RGB), (512, 512), interpolation=cv2.INTER_CUBIC)
    x = torch.from_numpy(x).permute(2, 0, 1)[None].cuda().half() / 255.0
    y = m(x, prompt_tokens=tok, deterministic=True)
    y = ((y[0].float() * 0.5 + 0.5).clamp(0, 1) * 255).byte().permute(1, 2, 0).cpu().numpy()
    return cv2.resize(cv2.cvtColor(y, cv2.COLOR_RGB2GRAY), (w, h), interpolation=cv2.INTER_CUBIC)


def detect(model, img):
    r = model.predict(img, imgsz=640, conf=0.001, iou=0.7, device=DEVICE, verbose=False)[0]
    return np.concatenate([r.boxes.xyxy.cpu().numpy(), r.boxes.conf.cpu().numpy()[:, None]], 1), r.speed["inference"]


def fuse(a, b, w, h, min_conf=0.05):  # pre-filter: WBF is O(n^2) in Python; mAP eval (07) keeps conf 0.001
    a, b = a[a[:, 4] >= min_conf], b[b[:, 4] >= min_conf]
    n = np.array([w, h, w, h])
    bx, sc, _ = weighted_boxes_fusion([np.clip(a[:, :4] / n, 0, 1).tolist(), np.clip(b[:, :4] / n, 0, 1).tolist()],
                                      [a[:, 4].tolist(), b[:, 4].tolist()], [[0] * len(a), [0] * len(b)],
                                      iou_thr=0.55, skip_box_thr=0.001)
    return np.concatenate([np.array(bx).reshape(-1, 4) * n, np.array(sc).reshape(-1, 1)], 1)


def gt_boxes(stem, w, h):
    """Ground-truth person boxes (pixels, score 1). Used for privacy blurring so that faces are hidden
    even when the detectors miss a person (e.g. RGB in fog)."""
    p = TEST_LBL / f"{stem}.txt"
    rows = [list(map(float, l.split()[1:])) for l in p.read_text().splitlines()] if p.exists() else []
    return np.array([[(cx - bw / 2) * w, (cy - bh / 2) * h, (cx + bw / 2) * w, (cy + bh / 2) * h, 1.0]
                     for cx, cy, bw, bh in rows]).reshape(-1, 5)


def blur_heads(img, boxes):
    out = img.copy()
    for x1, y1, x2, y2, s in boxes:
        if s < CONF:
            continue
        bw = x2 - x1  # head = top 35 % of the box, widened by 15 % each side
        x1, y1, x2, y2 = map(int, (x1 - 0.15 * bw, y1 - 0.05 * (y2 - y1), x2 + 0.15 * bw, y1 + 0.35 * (y2 - y1)))
        x1, y1 = max(x1, 0), max(y1, 0)
        if x2 > x1 and y2 > y1:
            out[y1:y2, x1:x2] = cv2.GaussianBlur(out[y1:y2, x1:x2], (0, 0), 12)
    return out


def draw(img, boxes, color, label):
    out = img.copy() if img.ndim == 3 else cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    n = 0
    for x1, y1, x2, y2, s in boxes:
        if s >= CONF:
            n += 1
            cv2.rectangle(out, (int(x1), int(y1)), (int(x2), int(y2)), color, 3)
    cv2.rectangle(out, (0, 0), (out.shape[1], 56), (0, 0, 0), -1)
    cv2.putText(out, f"{label}  |  {n} persons", (16, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.3, (255, 255, 255), 2)
    return out


def process(rgb, ir, ir_down, rgb_degrade, gt=np.zeros((0, 5))):
    t = {}
    if rgb_degrade == "fog / smoke":
        rgb = fog(rgb)
    elif rgb_degrade == "darker + noise":
        rgb = low_light(rgb)
    # ir_down: IR_MODES[0] = IR ok, [1] = IR dead -> declared missing (fusion falls back to RGB),
    #          [2] = IR dead -> reconstructed from RGB by the generator (shown to be worse, see doc P20)
    mode = IR_MODES.index(ir_down) if ir_down in IR_MODES else 0
    if mode == 2 and not GPU:
        raise gr.Error("IR reconstruction needs a CUDA GPU (pix2pix-turbo).")
    if mode == 2:
        sync(); t0 = time.perf_counter()
        ir = reconstruct_ir(rgb)
        sync(); t["RGB->IR generator"] = (time.perf_counter() - t0) * 1000
    ir3 = cv2.cvtColor(ir, cv2.COLOR_GRAY2BGR) if ir.ndim == 2 else ir
    b_rgb, t["RGB detector"] = detect(DET_RGB, rgb)
    if mode == 1:
        ir3 = np.zeros_like(ir3)
        cv2.putText(ir3, "NO SIGNAL", (ir3.shape[1] // 2 - 200, ir3.shape[0] // 2), cv2.FONT_HERSHEY_SIMPLEX, 2.5,
                    (0, 0, 255), 5)
        b_ir = np.zeros((0, 5))
    else:
        b_ir, t["IR detector"] = detect(DET_IR, ir3)
    t0 = time.perf_counter()
    b_fus = fuse(b_rgb, b_ir, rgb.shape[1], rgb.shape[0])
    t["WBF fusion"] = (time.perf_counter() - t0) * 1000
    t["total"] = sum(t.values())
    priv = np.concatenate([gt, b_rgb, b_ir, b_fus])  # blur every known or detected person
    v_rgb = draw(blur_heads(rgb, priv), b_rgb, (0, 200, 255), "RGB camera")
    v_ir = draw(blur_heads(ir3, priv) if mode == 2 else ir3, b_ir, (0, 255, 0),
                ["IR camera", "IR camera (DEAD)", "IR (RECONSTRUCTED from RGB)"][mode])
    v_fus = draw(blur_heads(rgb, priv), b_fus, (255, 0, 255),
                 "Fusion (IR missing -> RGB only)" if mode == 1 else "RGB+IR late fusion")
    return v_rgb, v_ir, v_fus, t


def to_rgb(x):
    return cv2.cvtColor(x, cv2.COLOR_BGR2RGB)


def run_frame(stem, ir_down, rgb_degrade):
    rgb = cv2.imread(str(TEST_RGB / f"{stem}.jpg"))
    ir = cv2.imread(str(TEST_IR / f"{stem}.jpg"), cv2.IMREAD_GRAYSCALE)
    v_rgb, v_ir, v_fus, t = process(rgb, ir, ir_down, rgb_degrade, gt_boxes(stem, rgb.shape[1], rgb.shape[0]))
    lat = "\n".join(f"| {k} | {v:.1f} ms |" for k, v in t.items())
    md = f"| stage | latency |\n|---|---|\n{lat}\n\nDetectors: RGB = {BACK_RGB}, IR = {BACK_IR} · device: {HW}"
    return to_rgb(v_rgb), to_rgb(v_ir), to_rgb(v_fus), md


def run_sequence(start, n, ir_down, rgb_degrade):
    stems = sorted(p.stem for p in TEST_RGB.glob("*.jpg"))
    i0 = stems.index(start) if start in stems else 0
    out = Path(tempfile.mkdtemp()) / "sequence.mp4"
    vw = None
    for s in stems[i0:i0 + int(n)]:
        rgb = cv2.imread(str(TEST_RGB / f"{s}.jpg"))
        ir = cv2.imread(str(TEST_IR / f"{s}.jpg"), cv2.IMREAD_GRAYSCALE)
        t0 = time.perf_counter()
        v_rgb, v_ir, v_fus, _ = process(rgb, ir, ir_down, rgb_degrade, gt_boxes(s, rgb.shape[1], rgb.shape[0]))
        fps = 1 / (time.perf_counter() - t0)
        row = np.concatenate([cv2.resize(v, (640, 512)) for v in (v_rgb, v_ir, v_fus)], 1)
        cv2.putText(row, f"pipeline {fps:.0f} FPS", (1700, 500), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        if vw is None:
            vw = cv2.VideoWriter(str(out), cv2.VideoWriter_fourcc(*"mp4v"), 10, (row.shape[1], row.shape[0]))
        vw.write(row)
    vw.release()
    return str(out)


STEMS = sorted(p.stem for p in TEST_RGB.glob("*.jpg"))
with gr.Blocks(title="Seeing at night without night data") as demo:
    gr.Markdown("## Seeing at night without night data\nRGB→IR generation for data-limited thermal detection, "
                "and multimodal fusion robust to a failed sensor. LLVIP test set (scenes never seen in training).")
    with gr.Row():
        stem = gr.Dropdown(STEMS, value=STEMS[len(STEMS) // 3], label="LLVIP test frame")
        ir_down = gr.Radio(UI_MODES, value=UI_MODES[0], label="IR sensor")
        degrade = gr.Radio(["none", "fog / smoke", "darker + noise"], value="none", label="RGB degradation")
    btn = gr.Button("Run", variant="primary")
    with gr.Row():
        o1, o2, o3 = gr.Image(label="RGB"), gr.Image(label="IR"), gr.Image(label="Fusion")
    lat = gr.Markdown()
    btn.click(run_frame, [stem, ir_down, degrade], [o1, o2, o3, lat])
    with gr.Accordion("Sequence → video", open=False):
        n = gr.Slider(20, 300, 100, step=10, label="frames")
        vbtn = gr.Button("Render sequence")
        vid = gr.Video()
        vbtn.click(run_sequence, [stem, n, ir_down, degrade], vid)

if __name__ == "__main__":
    print(f"device: {HW}")
    if GPU:
        print("warm-up (loads the generator once, ~30 s)"); run_frame(STEMS[0], IR_MODES[2], "none")
    run_frame(STEMS[0], IR_MODES[0], "none")
    demo.launch(server_name="0.0.0.0", server_port=int(os.environ.get("DEMO_PORT", 7860)))
