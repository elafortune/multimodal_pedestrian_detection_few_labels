"""E2 - Image metrics restricted to the pedestrian boxes, next to the global ones, for every image set.

Why: global metrics (FID, DINOv2) are dominated by the ~97 % of background pixels and ranked RGB as the worst
set although it trains the best IR detector (P21). Here every metric is computed (a) on the whole image and
(b) only inside the GT boxes (identical in RGB / IR / synthetic: LLVIP is pixel-aligned), with three
extractors: Inception (ImageNet), DINOv2 (self-supervised, natural images) and the backbone of the detector
trained on REAL IR (ir_full) -> task- and modality-specific features.

Protocol (same halves as 04_gap_metrics.py): reference = real IR test half A; each set = its version of test
half B. Paired metrics compare each set's half-B image with the real IR image of the same frame.

Input : data/synth/<set>/images/test (half B), data/yolo/{ir,rgb}/images/test, runs/det/ir_full/weights/last.pt
Output: results/boxmetrics/metrics.json  {set: {metric: value}}
        results/boxmetrics/boxes_<set>.npz  per-box paired stats (contrast real / set), for 14_pedestrian_analysis
"""
import argparse
import importlib
import json
import os
import shutil
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as Fnn
from PIL import Image
from torchvision.ops import roi_align

os.environ.setdefault("HF_HOME", "/workspace/hf")
os.environ.setdefault("YOLO_CONFIG_DIR", "/workspace/bsa/.ultralytics")
sys.path.insert(0, str(Path(__file__).parent))
gap = importlib.import_module("04_gap_metrics")
from det_eval import evaluate  # noqa: E402

BSA = Path("/workspace/bsa")
Y = BSA / "data/yolo"
OUT = BSA / "results/boxmetrics"
TMP = Path("/tmp/boxcrops")
W, H = 1280, 1024


def set_dir(name):
    return {"ir": Y / "ir/images/test", "rgb": Y / "rgb/images/test"}.get(name, BSA / "data/synth" / name / "images/test")


def gt_boxes(stem):
    p = Y / "ir/labels/test" / f"{stem}.txt"
    a = np.loadtxt(p, ndmin=2) if p.exists() and p.stat().st_size else np.zeros((0, 5))
    if not len(a):
        return np.zeros((0, 4))
    c, w, h = a[:, 1:3] * [W, H], a[:, 3] * W, a[:, 4] * H
    return np.stack([c[:, 0] - w / 2, c[:, 1] - h / 2, c[:, 0] + w / 2, c[:, 1] + h / 2], 1).clip(0, [W, H, W, H])


def gray(path):
    return np.asarray(Image.open(path).convert("L").resize((W, H)), np.float32) / 255


def contrast(g, b):
    """mean(box) - mean(ring around the box, ring = box enlarged x1.5 minus the box)."""
    x1, y1, x2, y2 = b.astype(int)
    bw, bh = x2 - x1, y2 - y1
    X1, Y1, X2, Y2 = max(0, x1 - bw // 4), max(0, y1 - bh // 4), min(W, x2 + bw // 4), min(H, y2 + bh // 4)
    inner = g[y1:y2, x1:x2]
    outer = g[Y1:Y2, X1:X2]
    ring = (outer.sum() - inner.sum()) / max(outer.size - inner.size, 1)
    return float(inner.mean() - ring) if inner.size else np.nan


class YoloFeats:
    """Neck feature maps (P3/P4/P5, the inputs of the Detect head) of the real-IR detector."""

    def __init__(self, weights):
        from ultralytics import YOLO
        self.net = YOLO(str(weights)).model.cuda().eval().half()
        self.maps = None
        self.net.model[-1].register_forward_pre_hook(lambda m, inp: setattr(self, "maps", inp[0]))

    @torch.no_grad()
    def __call__(self, path, boxes):
        im = np.asarray(Image.open(path).convert("RGB").resize((640, 512)))
        x = torch.from_numpy(im).permute(2, 0, 1)[None].cuda().half() / 255
        self.net(x)
        b = torch.from_numpy(boxes * 0.5).float().cuda()  # 1280 -> 640
        roi, glob = [], []
        for f, s in zip(self.maps, (8, 16, 32)):
            f = f.float()
            glob.append(f.mean((2, 3))[0])
            if len(b):
                roi.append(roi_align(f, [b], output_size=2, spatial_scale=1 / s, aligned=True).mean((2, 3)))
        return torch.cat(glob).cpu().numpy(), (torch.cat(roi, 1).cpu().numpy() if len(b) else np.zeros((0, sum(m.shape[1] for m in self.maps))))


@torch.no_grad()
def dino_files(paths, model, proc):
    import torchvision.transforms as T
    tf = T.Compose([T.Resize((224, 224), interpolation=T.InterpolationMode.BICUBIC), T.ToTensor(), T.Normalize(proc.image_mean, proc.image_std)])
    out = []
    for x in torch.utils.data.DataLoader(gap.Imgs(paths, tf), batch_size=256, num_workers=16):
        out.append(model(pixel_values=x.cuda().half()).pooler_output.float().cpu())
    return torch.cat(out).numpy()


def crops(name, stems, min_h=24):
    """Save GT-box crops (+10 % context) of one set; the same boxes for every set."""
    d = TMP / name
    shutil.rmtree(d, ignore_errors=True); d.mkdir(parents=True)
    out = []
    for s in stems:
        im = Image.open(set_dir(name) / f"{s}.jpg").convert("RGB").resize((W, H))
        for k, (x1, y1, x2, y2) in enumerate(gt_boxes(s)):
            if y2 - y1 < min_h:
                continue
            mx, my = 0.1 * (x2 - x1), 0.1 * (y2 - y1)
            p = d / f"{s}_{k}.png"
            im.crop((max(0, x1 - mx), max(0, y1 - my), min(W, x2 + mx), min(H, y2 + my))).save(p)
            out.append(p)
    return out


def detectability(name, stems, det):
    """mAP of the REAL-IR detector applied to the set's images: does the set 'show' pedestrians as IR does?"""
    preds, gts = [], []
    paths = [str(set_dir(name) / f"{s}.jpg") for s in stems]
    for i in range(0, len(paths), 64):
        for r in det.predict(paths[i:i + 64], imgsz=640, conf=0.001, iou=0.7, verbose=False, half=True):
            b = r.boxes
            preds.append(np.concatenate([b.xyxy.cpu().numpy(), b.conf.cpu().numpy()[:, None]], 1))
    gts = [gt_boxes(s) for s in stems]
    return evaluate(preds, gts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sets", nargs="+", required=True)
    ap.add_argument("--limit", type=int, default=0, help="smoke test: first k images of each half")
    args = ap.parse_args()
    global OUT
    if args.limit:
        OUT = OUT.parent / "boxmetrics_smoke"
    OUT.mkdir(parents=True, exist_ok=True)
    from ultralytics import YOLO
    from cleanfid.fid import kernel_distance
    from transformers import AutoImageProcessor, AutoModel

    test = sorted(p.stem for p in (Y / "ir/images/test").glob("*.jpg"))
    half_a, half_b = sorted(test[: len(test) // 2]), sorted(test[len(test) // 2:])
    if args.limit:
        half_a, half_b = half_a[: args.limit], half_b[: args.limit]
    dino = AutoModel.from_pretrained("facebook/dinov2-base").cuda().half().eval()
    proc = AutoImageProcessor.from_pretrained("facebook/dinov2-base")
    yf = YoloFeats(BSA / "runs/det/ir_full/weights/last.pt")
    det = YOLO(str(BSA / "runs/det/ir_full/weights/last.pt"))

    def feats(name, stems):
        paths = [set_dir(name) / f"{s}.jpg" for s in stems]
        g, r = zip(*[yf(p, gt_boxes(s)) for p, s in zip(paths, stems)])
        cp = crops(name, stems)
        return {"inc": gap.inception_feats(paths), "dino": gap.dinov2_feats(paths, dino, proc), "yolo": np.stack(g),
                "inc_box": gap.inception_feats(cp), "dino_box": dino_files(cp, dino, proc), "yolo_box": np.concatenate(r)}

    ref = feats("ir", half_a)  # reference: real IR, half A
    res_p = OUT / "metrics.json"
    res = json.loads(res_p.read_text()) if res_p.exists() else {}
    real_b = {s: gray(Y / "ir/images/test" / f"{s}.jpg") for s in half_b}
    for name in args.sets:
        if not set_dir(name).exists() or not all((set_dir(name) / f"{s}.jpg").exists() for s in half_b):
            print(f"skip {name}: half B missing", flush=True)
            continue
        f = feats(name, half_b)
        m = {"fid": gap.frechet(ref["inc"], f["inc"]), "kid_x1000": float(kernel_distance(ref["inc"], f["inc"])) * 1000,
             "fd_dinov2": gap.frechet(ref["dino"], f["dino"]), "fd_yolo": gap.frechet(ref["yolo"], f["yolo"]),
             "fid_box": gap.frechet(ref["inc_box"], f["inc_box"]),
             "kid_box_x1000": float(kernel_distance(ref["inc_box"], f["inc_box"])) * 1000,
             "fd_dinov2_box": gap.frechet(ref["dino_box"], f["dino_box"]),
             "fd_yolo_box": gap.frechet(ref["yolo_box"], f["yolo_box"]), "n_box": int(len(f["yolo_box"]))}
        # paired, per box: thermal contrast and pixel error inside vs outside the boxes
        cr, cs, l1_in, l1_out, sgn_in = [], [], [], [], []
        for s in half_b:
            gr, gs, bx = real_b[s], gray(set_dir(name) / f"{s}.jpg"), gt_boxes(s)
            mask = np.zeros_like(gr, bool)
            for b in bx:
                x1, y1, x2, y2 = b.astype(int)
                mask[y1:y2, x1:x2] = True
                cr.append(contrast(gr, b)); cs.append(contrast(gs, b))
            d = gs - gr
            if mask.any():
                l1_in.append(np.abs(d[mask]).mean()); sgn_in.append(d[mask].mean())
            l1_out.append(np.abs(d[~mask]).mean())
        cr, cs = np.array(cr), np.array(cs)
        np.savez(OUT / f"boxes_{name}.npz", contrast_real=cr, contrast_set=cs)
        ok = ~(np.isnan(cr) | np.isnan(cs))
        m.update({"contrast_mean": float(np.nanmean(cs)), "contrast_real_mean": float(np.nanmean(cr)),
                  "contrast_err": float(np.abs(cs - cr)[ok].mean()), "contrast_corr": float(np.corrcoef(cr[ok], cs[ok])[0, 1]),
                  "l1_box": float(np.mean(l1_in)), "l1_bg": float(np.mean(l1_out)), "bias_box": float(np.mean(sgn_in))})
        dt = detectability(name, half_b, det)
        m.update({"detect_map50_95": dt["map50_95"], "detect_map50": dt["map50"], "detect_recall50": dt["recall50"]})
        res[name] = m
        res_p.write_text(json.dumps(res, indent=2))
        print(name, json.dumps({k: round(v, 3) for k, v in m.items()}), flush=True)


if __name__ == "__main__":
    main()
