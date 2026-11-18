"""S1 - Prepare LLVIP for detection (YOLO format) and RGB->IR translation (paired 512x512).

Input : <root>/LLVIP/{visible,infrared}/{train,test}/*.jpg, <root>/LLVIP/Annotations/*.xml
Output: <root>/yolo/{rgb,ir}/{images,labels}/{train,test}/   (images are symlinks, labels shared)
        <out>/splits/ir_train_N{n}_s{seed}.txt               (nested subsets, image paths)
        <root>/p2p/N{n}/{train_A,train_B,test_A,test_B}/*.png + {train,test}_prompts.json
"""
import argparse
import json
import os
import random
import xml.etree.ElementTree as ET
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image

PROMPT = "thermal infrared image"
SUBSETS = [50, 100, 250, 1000]
TRANSLATOR_SUBSETS = [100, 1000, "full"]
SEEDS = [0, 1]
N_P2P_TEST = 100


def voc_to_yolo(xml_path: Path) -> str:
    root = ET.parse(xml_path).getroot()
    w = float(root.find("size/width").text)
    h = float(root.find("size/height").text)
    lines = []
    for obj in root.findall("object"):
        if obj.find("name").text.strip() != "person":
            continue
        b = obj.find("bndbox")
        x1, y1, x2, y2 = (float(b.find(k).text) for k in ("xmin", "ymin", "xmax", "ymax"))
        x1, x2 = max(0.0, x1), min(w, x2)
        y1, y2 = max(0.0, y1), min(h, y2)
        if x2 <= x1 or y2 <= y1:
            continue
        lines.append(f"0 {(x1 + x2) / 2 / w:.6f} {(y1 + y2) / 2 / h:.6f} {(x2 - x1) / w:.6f} {(y2 - y1) / h:.6f}")
    return "\n".join(lines) + ("\n" if lines else "")


def symlink(src: Path, dst: Path):
    if not dst.exists():
        dst.symlink_to(src.resolve())


def resize_pair(args):
    src_rgb, src_ir, dst_a, dst_b, size = args
    if not dst_a.exists():
        Image.open(src_rgb).convert("RGB").resize((size, size), Image.BICUBIC).save(dst_a)
    if not dst_b.exists():
        Image.open(src_ir).convert("RGB").resize((size, size), Image.BICUBIC).save(dst_b)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="/workspace/bsa/data")
    ap.add_argument("--out", default="/workspace/bsa")
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--workers", type=int, default=64)
    args = ap.parse_args()

    root = Path(args.root)
    llvip = root / "LLVIP"
    stats = {}

    # 1. YOLO structure, one label file shared by RGB / IR (pairs are pixel-aligned)
    for split in ("train", "test"):
        names = sorted(p.stem for p in (llvip / "infrared" / split).glob("*.jpg"))
        missing = [n for n in names if not (llvip / "visible" / split / f"{n}.jpg").exists()]
        assert not missing, f"{len(missing)} RGB images missing in {split}, e.g. {missing[:3]}"
        n_boxes = 0
        for mod, folder in (("ir", "infrared"), ("rgb", "visible")):
            (root / "yolo" / mod / "images" / split).mkdir(parents=True, exist_ok=True)
            (root / "yolo" / mod / "labels" / split).mkdir(parents=True, exist_ok=True)
        for n in names:
            txt = voc_to_yolo(llvip / "Annotations" / f"{n}.xml")
            n_boxes += txt.count("\n")
            for mod, folder in (("ir", "infrared"), ("rgb", "visible")):
                symlink(llvip / folder / split / f"{n}.jpg", root / "yolo" / mod / "images" / split / f"{n}.jpg")
                (root / "yolo" / mod / "labels" / split / f"{n}.txt").write_text(txt)
        stats[split] = {"images": len(names), "boxes": n_boxes}
        print(f"[{split}] {len(names)} pairs, {n_boxes} boxes")

    # 2. Nested subsets of the IR train pool
    train_names = sorted(p.stem for p in (root / "yolo" / "ir" / "images" / "train").glob("*.jpg"))
    splits_dir = Path(args.out) / "splits"
    splits_dir.mkdir(parents=True, exist_ok=True)
    subsets = {}
    for seed in SEEDS:
        perm = train_names[:]
        random.Random(seed).shuffle(perm)
        for n in SUBSETS:
            sel = sorted(perm[:n])
            subsets[(n, seed)] = sel
            for mod in ("ir", "rgb"):
                (splits_dir / f"{mod}_train_N{n}_s{seed}.txt").write_text(
                    "\n".join(str(root / "yolo" / mod / "images" / "train" / f"{s}.jpg") for s in sel) + "\n")
    subsets[("full", 0)] = train_names

    # 3. Paired datasets for the translator (trained ONLY on the N pairs of the scenario)
    test_names = sorted(p.stem for p in (root / "yolo" / "ir" / "images" / "test").glob("*.jpg"))
    p2p_test = sorted(random.Random(123).sample(test_names, N_P2P_TEST))
    jobs = []
    for n in TRANSLATOR_SUBSETS:
        sel = subsets[(n, 0)]
        d = root / "p2p" / f"N{n}"
        for sub in ("train_A", "train_B", "test_A", "test_B"):
            (d / sub).mkdir(parents=True, exist_ok=True)
        for split, names_ in (("train", sel), ("test", p2p_test)):
            prompts = {}
            for s in names_:
                prompts[f"{s}.png"] = PROMPT
                jobs.append((llvip / "visible" / split / f"{s}.jpg", llvip / "infrared" / split / f"{s}.jpg",
                             d / f"{split}_A" / f"{s}.png", d / f"{split}_B" / f"{s}.png", args.size))
            (d / f"{split}_prompts.json").write_text(json.dumps(prompts))
    print(f"resizing {len(jobs)} pairs to {args.size}x{args.size} ...")
    with ProcessPoolExecutor(args.workers) as ex:
        list(ex.map(resize_pair, jobs, chunksize=32))

    stats["subsets"] = {f"N{n}_s{s}": len(v) for (n, s), v in subsets.items()}
    (Path(args.out) / "splits" / "stats.json").write_text(json.dumps(stats, indent=2))
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
