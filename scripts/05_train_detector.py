"""S5 - Train one YOLO11 detector and evaluate it on the real IR test set of LLVIP.

Input : --train  one or more sources (txt lists of image paths, or image dirs), labels resolved
                 by Ultralytics (/images/ -> /labels/)
Output: /workspace/bsa/runs/det/<name>/weights/last.pt
        /workspace/bsa/results/det/<name>.json  {map50, map50_95, precision, recall, ...}

Protocol: no model selection on the test set -> we evaluate the LAST epoch (val=False during training).
"""
import argparse
import json
import os
import time
from pathlib import Path

os.environ.setdefault("YOLO_CONFIG_DIR", "/workspace/bsa/.ultralytics")
from ultralytics import YOLO  # noqa: E402

BSA = Path("/workspace/bsa")
TEST = {"ir": str(BSA / "data/yolo/ir/images/test"), "rgb": str(BSA / "data/yolo/rgb/images/test")}


def write_yaml(name, train_sources, test_dir, channels=3):
    p = BSA / "configs" / "det" / f"{name}.yaml"
    p.parent.mkdir(parents=True, exist_ok=True)
    srcs = "\n".join(f"  - {s}" for s in train_sources)
    p.write_text(f"train:\n{srcs}\nval: {test_dir}\nchannels: {channels}\nnames:\n  0: person\n")
    return p


def test_dir(ev):
    """'ir' / 'rgb' -> standard LLVIP test sets; 'fusion:<scenario>' -> 4-channel scenario variant."""
    if ev.startswith("fusion:"):
        return str(BSA / "data/fusion" / ev.split(":", 1)[1] / "images/test")
    return TEST[ev]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--train", nargs="+", required=True)
    ap.add_argument("--epochs", type=int, required=True)
    ap.add_argument("--eval", nargs="+", default=["ir"], help="test sets to evaluate on: ir, rgb")
    ap.add_argument("--model", default="yolo11s.pt")
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--workers", type=int, default=16)
    ap.add_argument("--cache", default="ram")
    ap.add_argument("--channels", type=int, default=3)
    args = ap.parse_args()

    out_json = BSA / "results" / "det" / f"{args.name}.json"
    if out_json.exists():
        print(f"skip {args.name}: {out_json} exists")
        return

    data = write_yaml(args.name, args.train, test_dir(args.eval[0]), args.channels)
    t0 = time.time()
    model = YOLO(str(BSA / "weights" / args.model) if (BSA / "weights" / args.model).exists() else args.model)
    model.train(data=str(data), epochs=args.epochs, imgsz=args.imgsz, batch=args.batch, seed=args.seed,
                deterministic=False, workers=args.workers, cache=args.cache, val=False, plots=False,
                project=str(BSA / "runs" / "det"), name=args.name, exist_ok=True, verbose=False)
    train_min = (time.time() - t0) / 60

    weights = BSA / "runs" / "det" / args.name / "weights" / "last.pt"
    res = {"name": args.name, "train": args.train, "epochs": args.epochs, "seed": args.seed,
           "model": args.model, "imgsz": args.imgsz, "train_minutes": round(train_min, 1), "eval": {}}
    for ev in args.eval:
        m = YOLO(str(weights)).val(data=str(write_yaml(f"{args.name}_eval_{ev.replace(':', '_')}", args.train, test_dir(ev), args.channels)),
                                    split="val", imgsz=args.imgsz, batch=64, plots=False, verbose=False,
                                    project=str(BSA / "runs" / "val"), name=f"{args.name}_{ev.replace(':', '_')}", exist_ok=True)
        res["eval"][ev] = {"map50": float(m.box.map50), "map50_95": float(m.box.map),
                           "precision": float(m.box.mp), "recall": float(m.box.mr)}
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(res, indent=2))
    print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
