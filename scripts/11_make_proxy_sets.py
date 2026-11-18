"""E1 - Image sets for the metric-validation study and the VAE ceiling test.

Input : LLVIP RGB / IR (data/yolo/{rgb,ir}/images/{train,test})
Output: splits/proxy_train3000.txt   3000 train stems (seed 0) -> small "proxy" detector trainings
        splits/test_halfB.txt        stems of test half B (same halves as 04_gap_metrics.py)
        data/synth/<set>/images/{train,test}/*.jpg + labels symlinks, for
          gray     : RGB -> grayscale                      (naive, no learning)
          invgray  : 255 - grayscale                       (naive "hot = bright" guess)
          vae512   : real IR -> 512x512 -> SD-Turbo VAE encode/decode -> 1280x1024
                     = what a PERFECT translator could output through this latent bottleneck
        data/synth/{resize512,vaefull}/images/test (full test only, for the ceiling test)
          resize512: real IR -> 512x512 -> 1280x1024 (resolution / aspect loss only)
          vaefull  : real IR -> VAE at native 1280x1024 (latent compression only)
"""
import os
import random
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageOps

os.environ.setdefault("HF_HOME", "/workspace/hf")
BSA = Path("/workspace/bsa")
Y = BSA / "data/yolo"


def link_label(set_dir, split, stem):
    dst = set_dir / "labels" / split / f"{stem}.txt"
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists():
        dst.symlink_to(Y / "ir/labels" / split / f"{stem}.txt")


def out_path(name, split, stem):
    d = BSA / "data/synth" / name
    p = d / "images" / split / f"{stem}.jpg"
    p.parent.mkdir(parents=True, exist_ok=True)
    link_label(d, split, stem)
    return p


def naive(stems_by_split):
    for split, stems in stems_by_split.items():
        for s in stems:
            g = ImageOps.grayscale(Image.open(Y / "rgb/images" / split / f"{s}.jpg"))
            for name, im in (("gray", g), ("invgray", ImageOps.invert(g))):
                p = out_path(name, split, s)
                if not p.exists():
                    im.save(p, quality=95)


@torch.no_grad()
def vae_sets(stems_by_split, full_test):
    from diffusers import AutoencoderKL
    vae = AutoencoderKL.from_pretrained("stabilityai/sd-turbo", subfolder="vae").cuda().half().eval()

    from concurrent.futures import ThreadPoolExecutor
    from torch.utils.data import DataLoader, Dataset

    class Load(Dataset):  # loading + resizing in worker processes (the first version did it inline: 1.7 img/s)
        def __init__(self, jobs, size):
            self.jobs, self.size = jobs, size

        def __len__(self):
            return len(self.jobs)

        def __getitem__(self, i):
            split, s = self.jobs[i]
            im = Image.open(Y / "ir/images" / split / f"{s}.jpg").convert("RGB")
            if self.size:
                im = im.resize(self.size, Image.BICUBIC)
            return torch.from_numpy(np.asarray(im).copy()).permute(2, 0, 1), i

    def save(y, p):
        Image.fromarray(y).convert("L").resize((W0, H0), Image.BICUBIC).save(p, quality=95)

    W0, H0 = 1280, 1024
    pool = ThreadPoolExecutor(16)
    # resize512: CPU only
    todo = [("test", s) for s in full_test if not out_path("resize512", "test", s).exists()]
    list(pool.map(lambda j: Image.open(Y / "ir/images" / j[0] / f"{j[1]}.jpg").convert("L").resize((512, 512), Image.BICUBIC)
                  .resize((W0, H0), Image.BICUBIC).save(out_path("resize512", *j), quality=95), todo))
    print("resize512 done", flush=True)
    for name, size, bs, jobs in (("vae512", (512, 512), 16, [(sp, s) for sp, st in stems_by_split.items() for s in st] + [("test", s) for s in full_test]),
                                 ("vaefull", None, 4, [("test", s) for s in full_test])):
        jobs = [j for j in dict.fromkeys(jobs) if not out_path(name, *j).exists()]
        futs = []
        for k, (x, idx) in enumerate(DataLoader(Load(jobs, size), batch_size=bs, num_workers=16)):
            x = x.cuda().half() / 127.5 - 1
            y = vae.decode(vae.encode(x).latent_dist.mode()).sample
            y = ((y.float().clamp(-1, 1) + 1) * 127.5).round().byte().permute(0, 2, 3, 1).cpu().numpy()
            futs += [pool.submit(save, yi, out_path(name, *jobs[i])) for yi, i in zip(y, idx.tolist())]
            if k % 50 == 0:
                print(f"{name} {k * bs}/{len(jobs)}", flush=True)
        [f.result() for f in futs]
        print(f"{name} done", flush=True)


def main():
    train = sorted(p.stem for p in (Y / "ir/images/train").glob("*.jpg"))
    test = sorted(p.stem for p in (Y / "ir/images/test").glob("*.jpg"))
    proxy = sorted(random.Random(0).sample(train, 3000))
    half_b = sorted(test[len(test) // 2:])  # identical to 04_gap_metrics.py halves
    (BSA / "splits/proxy_train3000.txt").write_text("\n".join(proxy) + "\n")
    (BSA / "splits/test_halfB.txt").write_text("\n".join(half_b) + "\n")
    sets = {"train": proxy, "test": half_b}
    naive(sets)
    print("naive sets done", flush=True)
    vae_sets(sets, test)
    print("vae sets done", flush=True)


if __name__ == "__main__":
    main()
