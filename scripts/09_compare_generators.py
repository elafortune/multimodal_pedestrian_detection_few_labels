"""Visual comparison of RGB->IR generators on K test frames spread over the test scenes.

Usage: 09_compare_generators.py --ckpts T100=<pkl> p2p_N100_bw10=<pt> ... --out results/figures/generators.jpg
Columns: RGB (heads blurred via GT boxes) | each generator | real IR
"""
import argparse
import sys
from pathlib import Path

import cv2
import numpy as np
import torch

sys.path.insert(0, "/workspace/bsa/img2img-turbo/src")
sys.path.insert(0, str(Path(__file__).parent))
BSA = Path("/workspace/bsa")
W, H = 320, 256


def load(ck):
    if ck.endswith(".pt"):
        import importlib
        g = importlib.import_module("02b_train_pix2pix").UNet().cuda().eval()
        g.load_state_dict(torch.load(ck, map_location="cuda"))
        return lambda x: g(x * 2 - 1)
    from pix2pix_turbo import Pix2Pix_Turbo
    m = Pix2Pix_Turbo(pretrained_path=ck); m.set_eval(); m.half()
    tok = m.tokenizer("thermal infrared image", max_length=m.tokenizer.model_max_length, padding="max_length",
                      truncation=True, return_tensors="pt").input_ids.cuda()
    return lambda x: m(x.half(), prompt_tokens=tok.repeat(x.shape[0], 1), deterministic=True).float()


def blur_heads(img, stem):
    h, w = img.shape[:2]
    for l in (BSA / "data/yolo/ir/labels/test" / f"{stem}.txt").read_text().splitlines():
        _, cx, cy, bw, bh = map(float, l.split())
        x1, x2, y1 = int((cx - bw / 2) * w), int((cx + bw / 2) * w), int((cy - bh / 2) * h)
        y2 = int(y1 + 0.3 * bh * h)
        x1, y1 = max(x1, 0), max(y1, 0)
        if x2 > x1 and y2 > y1:
            img[y1:y2, x1:x2] = cv2.GaussianBlur(img[y1:y2, x1:x2], (0, 0), 6)
    return img


@torch.no_grad()
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpts", nargs="+", required=True)
    ap.add_argument("--k", type=int, default=6)
    ap.add_argument("--out", default=str(BSA / "results/figures/generators.jpg"))
    args = ap.parse_args()
    stems = sorted(p.stem for p in (BSA / "data/yolo/rgb/images/test").glob("*.jpg"))
    pick = [stems[int(q * (len(stems) - 1))] for q in np.linspace(0.05, 0.95, args.k)]
    rgbs = [cv2.imread(str(BSA / "data/yolo/rgb/images/test" / f"{s}.jpg")) for s in pick]
    x = torch.stack([torch.from_numpy(cv2.resize(cv2.cvtColor(r, cv2.COLOR_BGR2RGB), (512, 512))).permute(2, 0, 1)
                     for r in rgbs]).cuda().float() / 255
    cols = [("RGB", [cv2.resize(blur_heads(r.copy(), s), (W, H)) for r, s in zip(rgbs, pick)])]
    for spec in args.ckpts:
        name, ck = spec.split("=", 1)
        g = load(ck)
        y = ((g(x) * 0.5 + 0.5).clamp(0, 1) * 255).byte().cpu().numpy()
        cols.append((name, [cv2.cvtColor(cv2.resize(im[0], (W, H)), cv2.COLOR_GRAY2BGR) for im in y]))
        del g; torch.cuda.empty_cache()
    cols.append(("real IR", [cv2.resize(cv2.imread(str(BSA / "data/yolo/ir/images/test" / f"{s}.jpg")), (W, H)) for s in pick]))
    header = np.zeros((36, W * len(cols), 3), np.uint8)
    for j, (n, _) in enumerate(cols):
        cv2.putText(header, n, (j * W + 8, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    grid = np.concatenate([header] + [np.concatenate([c[1][i] for c in cols], 1) for i in range(len(pick))], 0)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(args.out, grid, [cv2.IMWRITE_JPEG_QUALITY, 88])
    print("saved", args.out, pick)


if __name__ == "__main__":
    main()
