"""S2b - Classic pix2pix (U-Net + PatchGAN) RGB->IR, with an optional *task-aware* L1 that up-weights person boxes.

Why: at step 1001 the pix2pix-turbo generator (100 pairs) rendered pedestrians grey and parked cars bright,
i.e. "grey RGB" rather than thermal. The pixel losses are dominated by the background, while pedestrians
(the hottest objects, and the only class we detect) cover a few % of the image.
Box weighting uses the labels the scenario already has (N labelled pairs) -> no extra supervision.

Input : data/p2p/N<n>/{train_A,train_B}/*.png (512x512), labels data/yolo/ir/labels/train/<stem>.txt
Output: ckpt/p2p_<tag>/G_<step>.pt (+ G_last.pt)
"""
import argparse
import json
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from torch.utils.data import DataLoader, Dataset

BSA = Path("/workspace/bsa")


# ---------------------------------------------------------------- models
def down(i, o, norm=True):
    layers = [nn.Conv2d(i, o, 4, 2, 1, bias=not norm)]
    if norm:
        layers.append(nn.InstanceNorm2d(o, affine=True))
    layers.append(nn.LeakyReLU(0.2, True))
    return nn.Sequential(*layers)


def up(i, o, drop=False):
    layers = [nn.ConvTranspose2d(i, o, 4, 2, 1, bias=False), nn.InstanceNorm2d(o, affine=True), nn.ReLU(True)]
    if drop:
        layers.append(nn.Dropout(0.5))
    return nn.Sequential(*layers)


class UNet(nn.Module):
    """pix2pix U-Net, 8 levels (512 -> 2)."""

    def __init__(self, cin=3, cout=1, f=64):
        super().__init__()
        ch = [f, f * 2, f * 4, f * 8, f * 8, f * 8, f * 8, f * 8]
        self.downs = nn.ModuleList([down(cin, ch[0], norm=False)] + [down(ch[i], ch[i + 1]) for i in range(7)])
        self.ups = nn.ModuleList([up(ch[7], ch[6], True)] +
                                 [up(ch[7 - i] * 2, ch[6 - i], drop=i < 3) for i in range(1, 7)])
        self.out = nn.Sequential(nn.ConvTranspose2d(ch[0] * 2, cout, 4, 2, 1), nn.Tanh())

    def forward(self, x):
        skips = []
        for d in self.downs:
            x = d(x); skips.append(x)
        skips = skips[:-1][::-1]
        for u, s in zip(self.ups, skips):
            x = torch.cat([u(x), s], 1)
        return self.out(x)


class PatchD(nn.Module):
    def __init__(self, cin=4, f=64):
        super().__init__()
        self.net = nn.Sequential(down(cin, f, norm=False), down(f, f * 2), down(f * 2, f * 4),
                                 nn.Conv2d(f * 4, f * 8, 4, 1, 1, bias=False), nn.InstanceNorm2d(f * 8, affine=True),
                                 nn.LeakyReLU(0.2, True), nn.Conv2d(f * 8, 1, 4, 1, 1))

    def forward(self, a, b):
        return self.net(torch.cat([a, b], 1))


# ---------------------------------------------------------------- data
class Pairs(Dataset):
    def __init__(self, root, box_weight, size=512):
        self.a = sorted((root / "train_A").glob("*.png"))
        self.root, self.bw, self.size = root, box_weight, size

    def __len__(self):
        return len(self.a)

    def __getitem__(self, i):
        pa = self.a[i]
        a = torch.from_numpy(np.array(Image.open(pa).convert("RGB"))).permute(2, 0, 1).float() / 127.5 - 1
        b = torch.from_numpy(np.array(Image.open(self.root / "train_B" / pa.name).convert("L"))).float()[None] / 127.5 - 1
        w = torch.ones(1, self.size, self.size)
        if self.bw > 1:
            for line in (BSA / "data/yolo/ir/labels/train" / f"{pa.stem}.txt").read_text().splitlines():
                _, cx, cy, bw, bh = map(float, line.split())
                x1, x2 = int((cx - bw / 2) * self.size), int((cx + bw / 2) * self.size) + 1
                y1, y2 = int((cy - bh / 2) * self.size), int((cy + bh / 2) * self.size) + 1
                w[:, max(y1, 0):y2, max(x1, 0):x2] = self.bw
        if torch.rand(1) < 0.5:  # paired horizontal flip
            a, b, w = a.flip(-1), b.flip(-1), w.flip(-1)
        return a, b, w


# ---------------------------------------------------------------- train
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", required=True, help="100 | 1000 | full")
    ap.add_argument("--steps", type=int, default=6000)
    ap.add_argument("--box_weight", type=float, default=10.0, help="L1 weight inside person boxes (1 = plain pix2pix)")
    ap.add_argument("--lambda_l1", type=float, default=100.0)
    ap.add_argument("--bs", type=int, default=8)
    ap.add_argument("--lr", type=float, default=2e-4)
    args = ap.parse_args()
    tag = f"N{args.n}_bw{args.box_weight:g}"
    out = BSA / "ckpt" / f"p2p_{tag}"; out.mkdir(parents=True, exist_ok=True)
    torch.manual_seed(0)
    dl = DataLoader(Pairs(BSA / "data/p2p" / f"N{args.n}", args.box_weight), batch_size=args.bs, shuffle=True,
                    num_workers=8, drop_last=True, pin_memory=True, persistent_workers=True)
    G, D = UNet().cuda(), PatchD().cuda()
    oG = torch.optim.Adam(G.parameters(), args.lr, betas=(0.5, 0.999))
    oD = torch.optim.Adam(D.parameters(), args.lr, betas=(0.5, 0.999))
    sched = lambda o: torch.optim.lr_scheduler.LambdaLR(o, lambda s: 1.0 if s < args.steps // 2 else 2 * (1 - s / args.steps))
    sG, sD = sched(oG), sched(oD)
    bce = nn.BCEWithLogitsLoss()
    step, t0, log = 0, time.time(), []
    while step < args.steps:
        for a, b, w in dl:
            a, b, w = a.cuda(non_blocking=True), b.cuda(non_blocking=True), w.cuda(non_blocking=True)
            with torch.autocast("cuda", dtype=torch.bfloat16):
                fake = G(a)
                # D
                pr, pf = D(a, b), D(a, fake.detach())
                lD = 0.5 * (bce(pr, torch.ones_like(pr)) + bce(pf, torch.zeros_like(pf)))
            oD.zero_grad(set_to_none=True); lD.backward(); oD.step()
            with torch.autocast("cuda", dtype=torch.bfloat16):
                pf = D(a, fake)
                l1 = ((fake.float() - b).abs() * w).sum() / w.sum()
                lG = bce(pf, torch.ones_like(pf)) + args.lambda_l1 * l1
            oG.zero_grad(set_to_none=True); lG.backward(); oG.step()
            sG.step(); sD.step(); step += 1
            if step % 100 == 0:
                rec = {"step": step, "lD": lD.item(), "lG": lG.item(), "l1w": l1.item(), "it_s": step / (time.time() - t0)}
                log.append(rec); print(json.dumps(rec), flush=True)
            if step % 2000 == 0 or step == args.steps:
                torch.save(G.state_dict(), out / f"G_{step}.pt")
            if step >= args.steps:
                break
    torch.save(G.state_dict(), out / "G_last.pt")
    (out / "log.json").write_text(json.dumps(log))
    print("TRAIN_DONE", tag)


if __name__ == "__main__":
    main()
