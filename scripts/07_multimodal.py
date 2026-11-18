"""S7 - Sensor robustness matrix: scenario x configuration, all scored with the same evaluator (det_eval.py).

Input : data/fusion/<scenario>/images/test/*.tif (B,G,R,IR at 640x512), shared labels
        runs/det/{rgb_full,ir_full,early_fusion_drop,early_fusion_nodrop}/weights/last.pt
Configs:
  rgb          RGB detector on channels 0-2
  ir           IR detector on channel 3 (replicated to 3 channels)
  late_wbf     Weighted Boxes Fusion of rgb + ir
  early_drop / early_nodrop   4-channel detectors (if trained)
Output: results/multimodal/robustness.json  {scenario: {config: {map50, map50_95, recall50}}}
"""
import json
import os
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
os.environ.setdefault("YOLO_CONFIG_DIR", "/workspace/bsa/.ultralytics")
from det_eval import evaluate  # noqa: E402
from ensemble_boxes import weighted_boxes_fusion  # noqa: E402
from ultralytics import YOLO  # noqa: E402

BSA = Path("/workspace/bsa")
SCEN = ["nominal", "rgb_fog", "rgb_lowlight", "rgb_dead", "ir_dead", "ir_reconstructed"]
W, H = 640, 512


def load_gt(stem):
    p = BSA / "data/yolo/ir/labels/test" / f"{stem}.txt"
    rows = [list(map(float, l.split()))[1:] for l in p.read_text().splitlines() if l.strip()]
    if not rows:
        return np.zeros((0, 4))
    a = np.array(rows)
    return np.stack([(a[:, 0] - a[:, 2] / 2) * W, (a[:, 1] - a[:, 3] / 2) * H,
                     (a[:, 0] + a[:, 2] / 2) * W, (a[:, 1] + a[:, 3] / 2) * H], 1)


def predict(model, arrays, bs=64):
    out = []
    for i in range(0, len(arrays), bs):
        for r in model.predict(arrays[i:i + bs], imgsz=640, conf=0.001, iou=0.7, max_det=300, verbose=False, half=True):
            b = r.boxes
            out.append(np.concatenate([b.xyxy.cpu().numpy(), b.conf.cpu().numpy()[:, None]], 1))
    return out


def wbf(pa, pb):
    out = []
    for a, b in zip(pa, pb):
        # WBF is O(n^2) in pure Python: at conf 0.001 (~300 boxes/model) it costs ~0.7 s/frame -> ~4 h for the matrix.
        # Boxes < 0.01 are dropped before fusion only (conservative for the fusion rows: they lose the AP tail).
        a, b = a[a[:, 4] >= 0.01], b[b[:, 4] >= 0.01]
        norm = np.array([W, H, W, H])
        boxes = [np.clip(a[:, :4] / norm, 0, 1).tolist(), np.clip(b[:, :4] / norm, 0, 1).tolist()]
        scores = [a[:, 4].tolist(), b[:, 4].tolist()]
        labels = [[0] * len(a), [0] * len(b)]
        bx, sc, _ = weighted_boxes_fusion(boxes, scores, labels, iou_thr=0.55, skip_box_thr=0.001)
        out.append(np.concatenate([np.array(bx).reshape(-1, 4) * norm, np.array(sc).reshape(-1, 1)], 1))
    return out


def main():
    models = {k: BSA / "runs/det" / k / "weights/last.pt"
              for k in ("rgb_full", "ir_full", "early_fusion_drop", "early_fusion_nodrop")}
    models = {k: YOLO(str(v)) for k, v in models.items() if v.exists()}
    print("models:", list(models))
    out_p = BSA / "results/multimodal/robustness.json"
    out_p.parent.mkdir(parents=True, exist_ok=True)
    res = json.loads(out_p.read_text()) if out_p.exists() else {}
    for sc in SCEN:
        d = BSA / "data/fusion" / sc / "images/test"
        files = sorted(d.glob("*.tif")) if d.exists() else []
        if len(files) < 3463:
            print(f"skip {sc}: {len(files)} tiffs")
            continue
        arrs = [cv2.imread(str(f), cv2.IMREAD_UNCHANGED) for f in files]
        gts = [load_gt(f.stem) for f in files]
        r = {}
        p_rgb = predict(models["rgb_full"], [a[..., :3].copy() for a in arrs])
        p_ir = predict(models["ir_full"], [np.repeat(a[..., 3:4], 3, 2) for a in arrs])
        r["rgb"], r["ir"], r["late_wbf"] = evaluate(p_rgb, gts), evaluate(p_ir, gts), evaluate(wbf(p_rgb, p_ir), gts)
        for k in ("early_fusion_drop", "early_fusion_nodrop"):
            if k in models:
                r[k.replace("_fusion", "")] = evaluate(predict(models[k], arrs), gts)
        res[sc] = r
        print(sc, json.dumps({k: round(v["map50_95"], 3) for k, v in r.items()}), flush=True)
        out_p.write_text(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
