"""S7 (data) - Build 4-channel RGB+IR TIFFs for early fusion and the per-scenario test variants.

Input : data/yolo/{rgb,ir}/images/{train,test}/*.jpg, data/synth/<rec_tag>/images/test (reconstructed IR)
Output: data/fusion/train/images/train/*.tif  (B,G,R,IR uint8, 640x512, static modality dropout:
                                                70% both, 15% IR zeroed, 15% RGB zeroed)
        data/fusion/<scenario>/images/test/*.tif   for each scenario in sensors.SCENARIOS
        labels/ -> symlinks to the shared YOLO labels
"""
import argparse
import random
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from sensors import SCENARIOS  # noqa: E402

BSA = Path("/workspace/bsa")
D = BSA / "data"
W, H = 640, 512
TIFF = [cv2.IMWRITE_TIFF_COMPRESSION, 5]  # LZW


def load(path, gray=False):
    im = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE if gray else cv2.IMREAD_COLOR)
    return cv2.resize(im, (W, H), interpolation=cv2.INTER_AREA)


def build(job):
    stem, split, out_dir, rgb_tf, ir_tf, rec_dir, seed = job
    dst = out_dir / "images" / split / f"{stem}.tif"
    if dst.exists():
        return
    rgb = load(D / "yolo/rgb/images" / split / f"{stem}.jpg")
    ir = load(D / "yolo/ir/images" / split / f"{stem}.jpg", gray=True)
    if rgb_tf is not None:
        rgb = rgb_tf(rgb, seed=seed) if rgb_tf.__name__ != "dead" else rgb_tf(rgb)
    if ir_tf == "reconstruct":
        ir = load(rec_dir / f"{stem}.jpg", gray=True)
    elif ir_tf is not None:
        ir = ir_tf(ir)
    cv2.imwrite(str(dst), np.dstack([rgb, ir]), TIFF)
    lbl = out_dir / "labels" / split / f"{stem}.txt"
    if not lbl.exists():
        lbl.symlink_to(D / "yolo/ir/labels" / split / f"{stem}.txt")


def zero_ir(x):
    return np.zeros_like(x)


def zero_rgb(x, seed=0):
    return np.zeros_like(x)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rec_tag", default="T1000", help="translator used to reconstruct the missing IR")
    ap.add_argument("--workers", type=int, default=48)
    ap.add_argument("--only", choices=["train", "test", "all"], default="all")
    ap.add_argument("--nodrop", action="store_true", help="ablation: no modality dropout in train")
    args = ap.parse_args()
    jobs = []
    if args.only in ("train", "all"):
        out = D / ("fusion/train_nodrop" if args.nodrop else "fusion/train")
        for s in ("images/train", "labels/train"):
            (out / s).mkdir(parents=True, exist_ok=True)
        rng = random.Random(0)
        for p in sorted((D / "yolo/ir/images/train").glob("*.jpg")):
            u = rng.random()
            rgb_tf, ir_tf = (None, None) if (args.nodrop or u < 0.70) else ((None, zero_ir) if u < 0.85 else (zero_rgb, None))
            jobs.append((p.stem, "train", out, rgb_tf, ir_tf, None, 0))
    if args.only in ("test", "all"):
        rec_dir = D / "synth" / args.rec_tag / "images/test"
        for sc, (rgb_tf, ir_tf) in SCENARIOS.items():
            if ir_tf == "reconstruct" and not rec_dir.exists():
                print(f"skip {sc}: {rec_dir} missing")
                continue
            out = D / "fusion" / sc
            for s in ("images/test", "labels/test"):
                (out / s).mkdir(parents=True, exist_ok=True)
            for i, p in enumerate(sorted((D / "yolo/ir/images/test").glob("*.jpg"))):
                jobs.append((p.stem, "test", out, rgb_tf, ir_tf, rec_dir, i))
    print(f"{len(jobs)} tiffs to build")
    with ProcessPoolExecutor(args.workers) as ex:
        list(ex.map(build, jobs, chunksize=64))
    print("done")


if __name__ == "__main__":
    main()
