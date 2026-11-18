"""E4 - Cross-modal pseudo-labelling: the "no generator" baseline for the pair budget.

Idea: the N unlabelled RGB/IR pairs are pixel-aligned. Run an off-the-shelf RGB person detector on the RGB half
of each pair and copy its boxes onto the REAL IR half -> N real IR images with (noisy) labels, no generator.
The RGB detector is YOLO11s pre-trained on COCO (class person): it has never seen LLVIP, so no label leaks
(rgb_full would leak: it was trained on these very images). Offline -> native resolution (imgsz 1280).
The confidence threshold (0.25, Ultralytics default) is fixed a priori, never tuned on the test set.

Input : splits/rgb_train_N{n}_s0.txt (the translator pairs: same images as translator_N{n}), weights/yolo11s.pt
Output: data/pl/P{n}/images/train/*.jpg  (symlinks to the real IR images)
        data/pl/P{n}/labels/train/*.txt  (pseudo-labels, YOLO format)
        results/pl/quality_P{n}.json     pseudo-label quality vs the hidden GT (analysis only)
"""
import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np

os.environ.setdefault("YOLO_CONFIG_DIR", "/workspace/bsa/.ultralytics")
sys.path.insert(0, str(Path(__file__).parent))
from ultralytics import YOLO  # noqa: E402

from det_eval import evaluate, iou_matrix  # noqa: E402

BSA = Path("/workspace/bsa")
Y = BSA / "data/yolo"


def gt(stem, w=1280, h=1024):
    p = Y / "ir/labels/train" / f"{stem}.txt"
    a = np.loadtxt(p, ndmin=2) if p.exists() and p.stat().st_size else np.zeros((0, 5))
    if not len(a):
        return np.zeros((0, 4))
    c, bw, bh = a[:, 1:3] * [w, h], a[:, 3] * w, a[:, 4] * h
    return np.stack([c[:, 0] - bw / 2, c[:, 1] - bh / 2, c[:, 0] + bw / 2, c[:, 1] + bh / 2], 1)


def run(det, paths, conf):
    out = []
    for i in range(0, len(paths), 32):
        for r in det.predict(paths[i:i + 32], imgsz=1280, conf=conf, classes=[0], verbose=False, half=True):
            b = r.boxes
            out.append(np.concatenate([b.xyxy.cpu().numpy(), b.conf.cpu().numpy()[:, None]], 1))
    return out


def quality(preds, gts, thr=0.25):
    tp = fp = fn = 0
    for p, g in zip(preds, gts):
        p = p[p[:, 4] >= thr]
        iou = iou_matrix(p[:, :4], g)
        m = 0
        used = set()
        for i in np.argsort(-p[:, 4]):
            c = [j for j in np.argsort(-iou[i]) if j not in used and iou[i, j] >= 0.5] if len(g) else []
            if c:
                used.add(c[0]); m += 1
        tp += m; fp += len(p) - m; fn += len(g) - m
    e = evaluate(preds, gts)
    return {"precision@0.25": tp / max(tp + fp, 1), "recall@0.25": tp / max(tp + fn, 1),
            "ap50": e["map50"], "ap50_95": e["map50_95"], "n_boxes_pl": tp + fp, "n_boxes_gt": tp + fn}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, nargs="+", default=[1000, 100])
    ap.add_argument("--conf", type=float, default=0.25)
    ap.add_argument("--fused", action="store_true",
                    help="labels = union of COCO detections on RGB AND on IR (NMS 0.5) -> data/pl/P{n}f")
    args = ap.parse_args()
    det = YOLO(str(BSA / "weights/yolo11s.pt"))
    for n in args.n:
        stems = [Path(l).stem for l in (BSA / f"splits/rgb_train_N{n}_s0.txt").read_text().split()]
        gts = [gt(s) for s in stems]
        q, pr = {}, {}
        for src in ("rgb", "ir"):  # IR column = same COCO detector applied directly on IR
            pr[src] = run(det, [str(Y / src / "images/train" / f"{s}.jpg") for s in stems], 0.001)
            q[f"from_{src}"] = quality(pr[src], gts, args.conf)
        keep = pr["rgb"]
        if args.fused:  # multimodal pseudo-labels: a pedestrian missed in the dark RGB may be seen in IR
            import torch
            from torchvision.ops import nms
            keep = []
            for a, b in zip(pr["rgb"], pr["ir"]):
                c = torch.from_numpy(np.concatenate([a, b]).astype(np.float32))
                keep.append(c[nms(c[:, :4], c[:, 4], 0.5)].numpy() if len(c) else np.zeros((0, 5)))
            q["fused"] = quality(keep, gts, args.conf)
        root = BSA / f"data/pl/P{n}{'f' if args.fused else ''}"
        (root / "images/train").mkdir(parents=True, exist_ok=True); (root / "labels/train").mkdir(parents=True, exist_ok=True)
        for s, p in zip(stems, keep):
            img = root / "images/train" / f"{s}.jpg"
            if not img.exists():
                img.symlink_to(Y / "ir/images/train" / f"{s}.jpg")
            p = p[p[:, 4] >= args.conf]
            x1, y1, x2, y2 = p[:, 0], p[:, 1], p[:, 2], p[:, 3]
            lines = [f"0 {(a + c) / 2560:.6f} {(b + d) / 2048:.6f} {(c - a) / 1280:.6f} {(d - b) / 1024:.6f}" for a, b, c, d in zip(x1, y1, x2, y2)]
            (root / "labels/train" / f"{s}.txt").write_text("\n".join(lines) + ("\n" if lines else ""))
        (BSA / "results/pl").mkdir(parents=True, exist_ok=True)
        (BSA / f"results/pl/quality_P{n}{'f' if args.fused else ''}.json").write_text(json.dumps(q, indent=2))
        print(n, json.dumps(q, indent=2), flush=True)


if __name__ == "__main__":
    main()
