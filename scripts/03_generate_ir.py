"""S3 - Translate LLVIP RGB images into synthetic IR with a trained pix2pix-turbo checkpoint.

Input : data/yolo/rgb/images/<split>/*.jpg (1280x1024), translator checkpoint (.pkl)
Output: data/synth/<tag>/images/<split>/*.jpg (grayscale IR, 1280x1024)
        data/synth/<tag>/labels/<split>/*.txt (symlinks to the real labels -> boxes are inherited)
"""
import argparse
import os
import sys
import time
from pathlib import Path

import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision.transforms import functional as F

sys.path.insert(0, "/workspace/bsa/img2img-turbo/src")
os.environ.setdefault("HF_HOME", "/workspace/hf")
from pix2pix_turbo import Pix2Pix_Turbo  # noqa: E402

BSA = Path("/workspace/bsa")
PROMPT = "thermal infrared image"


class RGBFolder(Dataset):
    def __init__(self, paths, size):
        self.paths, self.size = paths, size

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, i):
        im = Image.open(self.paths[i]).convert("RGB")
        orig = im.size
        return F.to_tensor(im.resize((self.size, self.size), Image.BICUBIC)), str(self.paths[i]), torch.tensor(orig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--tag", required=True, help="e.g. T100, T1000, Tfull")
    ap.add_argument("--split", default="train")
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--list", default="", help="optional txt of image stems to translate (subset)")
    args = ap.parse_args()

    src = BSA / "data/yolo/rgb/images" / args.split
    out_img = BSA / "data/synth" / args.tag / "images" / args.split
    out_lbl = BSA / "data/synth" / args.tag / "labels" / args.split
    out_img.mkdir(parents=True, exist_ok=True)
    out_lbl.mkdir(parents=True, exist_ok=True)
    paths = sorted(src.glob("*.jpg"))
    if args.list:
        keep = set(Path(args.list).read_text().split())
        paths = [p for p in paths if p.stem in keep]
    paths = [p for p in paths if not (out_img / p.name).exists()]
    if args.limit:
        paths = paths[: args.limit]
    print(f"{len(paths)} images to translate with {args.ckpt}")

    if Path(args.ckpt).suffix == ".pt":  # classic pix2pix U-Net (02b): input [-1,1], 1-channel output
        sys.path.insert(0, str(Path(__file__).parent))
        import importlib
        unet = importlib.import_module("02b_train_pix2pix").UNet().cuda().eval()
        unet.load_state_dict(torch.load(args.ckpt, map_location="cuda"))
        model = lambda x, **_: unet(x.float() * 2 - 1).repeat(1, 3, 1, 1)  # noqa: E731
        tokens = torch.zeros(1, 1, dtype=torch.long, device="cuda")
    else:
        model = Pix2Pix_Turbo(pretrained_path=args.ckpt)
        model.set_eval()
        model.half()
        tokens = model.tokenizer(PROMPT, max_length=model.tokenizer.model_max_length, padding="max_length",
                                 truncation=True, return_tensors="pt").input_ids.cuda()

    dl = DataLoader(RGBFolder(paths, args.size), batch_size=args.batch, num_workers=16, pin_memory=True)
    t0, n = time.time(), 0
    with torch.no_grad():
        for x, names, sizes in dl:
            x = x.cuda().half()
            y = model(x, prompt_tokens=tokens.repeat(x.shape[0], 1), deterministic=True)
            y = ((y.float() * 0.5 + 0.5).clamp(0, 1) * 255).round().byte().cpu()
            for img, name, (w, h) in zip(y, names, sizes.tolist()):
                ir = Image.fromarray(img.permute(1, 2, 0).numpy()).convert("L").resize((w, h), Image.BICUBIC)
                stem = Path(name).stem
                ir.save(out_img / f"{stem}.jpg", quality=95)
                lbl = BSA / "data/yolo/ir/labels" / args.split / f"{stem}.txt"
                if not (out_lbl / f"{stem}.txt").exists():
                    (out_lbl / f"{stem}.txt").symlink_to(lbl)
            n += x.shape[0]
            if n % (args.batch * 50) == 0:
                print(f"{n}/{len(paths)}  {n / (time.time() - t0):.1f} img/s", flush=True)
    print(f"done {n} images in {(time.time() - t0) / 60:.1f} min")


if __name__ == "__main__":
    main()
