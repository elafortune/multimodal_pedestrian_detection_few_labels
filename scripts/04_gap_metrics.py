"""S4 - Measure the gap between real IR and other image sets (part A).

Reference set: real IR, LLVIP test split.
Compared sets (unpaired, distribution level):
  ir_train   real IR from other scenes      -> "floor" (intrinsic gap between scenes)
  rgb        RGB test                        -> naive gap (train on RGB, test on IR)
  T*         synthetic IR from each translator (train split)
Paired metrics (pixel level, test split, aligned): L1, SSIM, LPIPS between T*(RGB_test) and IR_test.

Output: results/gap/metrics.json, results/gap/feats_*.npy, results/figures/umap.png
"""
import argparse
import json
import os
import random
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset

os.environ.setdefault("HF_HOME", "/workspace/hf")
BSA = Path("/workspace/bsa")
OUT = BSA / "results" / "gap"


class Imgs(Dataset):
    def __init__(self, paths, tf):
        self.paths, self.tf = paths, tf

    def __len__(self):
        return len(self.paths)

    def __getitem__(self, i):
        return self.tf(Image.open(self.paths[i]).convert("RGB"))


def sample(folder, n, seed=0):
    p = sorted(Path(folder).glob("*.jpg"))
    return sorted(random.Random(seed).sample(p, min(n, len(p))))


@torch.no_grad()
def dinov2_feats(paths, model, proc):
    import torchvision.transforms as T
    tf = T.Compose([T.Resize(256, interpolation=T.InterpolationMode.BICUBIC), T.CenterCrop(224), T.ToTensor(),
                    T.Normalize(proc.image_mean, proc.image_std)])
    out = []
    for x in DataLoader(Imgs(paths, tf), batch_size=128, num_workers=16):
        out.append(model(pixel_values=x.cuda().half()).pooler_output.float().cpu())
    return torch.cat(out).numpy()


def inception_feats(paths):
    from cleanfid.features import build_feature_extractor
    from cleanfid.fid import get_files_features
    model = build_feature_extractor("clean", torch.device("cuda"))
    return get_files_features([str(p) for p in paths], model=model, num_workers=16, batch_size=128,
                              device=torch.device("cuda"), mode="clean", verbose=False)


def frechet(a, b):
    """Frechet distance between Gaussians fitted on a and b.
    tr(sqrt(S1 S2)) computed as sum(sqrt(eig(sqrt(S1) S2 sqrt(S1)))) -> symmetric, stable, no scipy.sqrtm
    (cleanfid's version breaks with recent scipy, see doc/bugs.md B4)."""
    a, b = a.astype(np.float64), b.astype(np.float64)
    mu1, mu2 = a.mean(0), b.mean(0)
    s1, s2 = np.cov(a, rowvar=False), np.cov(b, rowvar=False)
    w, v = np.linalg.eigh(s1)
    sq1 = (v * np.sqrt(np.clip(w, 0, None))) @ v.T
    ev = np.linalg.eigvalsh(sq1 @ s2 @ sq1)
    return float(((mu1 - mu2) ** 2).sum() + np.trace(s1) + np.trace(s2) - 2 * np.sqrt(np.clip(ev, 0, None)).sum())


def paired_metrics(fake_dir, real_dir, n=500):
    import lpips
    from torchmetrics.functional.image import structural_similarity_index_measure as ssim
    import torchvision.transforms.functional as F
    loss = lpips.LPIPS(net="alex", verbose=False).cuda()
    names = [p.name for p in sample(fake_dir, n)]
    l1, ss, lp = [], [], []
    for nm in names:
        f = F.to_tensor(Image.open(Path(fake_dir) / nm).convert("L").resize((640, 512)))[None].cuda()
        r = F.to_tensor(Image.open(Path(real_dir) / nm).convert("L").resize((640, 512)))[None].cuda()
        l1.append((f - r).abs().mean().item())
        ss.append(ssim(f, r, data_range=1.0).item())
        lp.append(loss(f.repeat(1, 3, 1, 1) * 2 - 1, r.repeat(1, 3, 1, 1) * 2 - 1).item())
    return {"l1": float(np.mean(l1)), "ssim": float(np.mean(ss)), "lpips": float(np.mean(lp)), "n": len(names)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tags", nargs="*", default=["T100", "T1000", "Tfull"])
    ap.add_argument("--n", type=int, default=3000)
    ap.add_argument("--k", type=int, default=5)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    from prdc import compute_prdc
    from transformers import AutoImageProcessor, AutoModel

    # Everything on the TEST split (scenes never seen by any translator), split in two halves of images:
    #   ref      = real IR, half A
    #   ir_real  = real IR, half B      -> floor: gap between two samples of the same distribution
    #   rgb / T* = RGB / synthetic IR, half B -> same scene pool as the floor, only the modality changes
    # (comparing to IR train mixes scene gap and modality gap, see doc/problemes_identifies.md P10)
    names = sorted(p.name for p in (BSA / "data/yolo/ir/images/test").glob("*.jpg"))
    random.Random(0).shuffle(names)
    half_a, half_b = sorted(names[: len(names) // 2])[: args.n], sorted(names[len(names) // 2:])[: args.n]
    sets = {"ref_ir_test": [BSA / "data/yolo/ir/images/test" / n for n in half_a],
            "ir_real": [BSA / "data/yolo/ir/images/test" / n for n in half_b],
            "rgb": [BSA / "data/yolo/rgb/images/test" / n for n in half_b]}
    for t in args.tags:
        d = BSA / "data/synth" / t / "images/test"
        if d.exists() and all((d / n).exists() for n in half_b):
            sets[t] = [d / n for n in half_b]
        else:
            print(f"skip {t}: test split not fully generated")

    proc = AutoImageProcessor.from_pretrained("facebook/dinov2-base")
    dino = AutoModel.from_pretrained("facebook/dinov2-base").cuda().half().eval()
    feats = {}
    for name, paths in sets.items():
        fd, fi = OUT / f"feats_dino_{name}.npy", OUT / f"feats_incep_{name}.npy"
        if not fd.exists():
            np.save(fd, dinov2_feats(paths, dino, proc))
        if not fi.exists():
            np.save(fi, inception_feats(paths))
        feats[name] = (np.load(fd), np.load(fi))
        print(f"features {name}: {feats[name][0].shape}", flush=True)

    from cleanfid.fid import kernel_distance
    ref_d, ref_i = feats["ref_ir_test"]
    metrics = {}
    for name, (fd, fi) in feats.items():
        if name == "ref_ir_test":
            continue
        m = {"fid": frechet(ref_i, fi), "kid_x1000": float(kernel_distance(ref_i, fi)) * 1000,
             "fd_dinov2": frechet(ref_d, fd)}
        m.update({k: float(v) for k, v in compute_prdc(ref_d, fd, nearest_k=args.k).items()})
        test_dir = BSA / "data/synth" / name / "images/test"
        if test_dir.exists() and any(test_dir.iterdir()):
            m["paired_test"] = paired_metrics(test_dir, BSA / "data/yolo/ir/images/test")
        metrics[name] = m
        print(name, json.dumps(m), flush=True)
    (OUT / "metrics.json").write_text(json.dumps(metrics, indent=2))

    # UMAP of DINOv2 embeddings
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import umap
    names = list(feats)
    X = np.concatenate([feats[n][0][:1000] for n in names])
    lab = np.concatenate([[n] * min(1000, len(feats[n][0])) for n in names])
    emb = umap.UMAP(n_neighbors=30, min_dist=0.1, random_state=0).fit_transform(X)
    fig, ax = plt.subplots(figsize=(7, 6), dpi=150)
    for n in names:
        s = lab == n
        ax.scatter(emb[s, 0], emb[s, 1], s=3, alpha=0.5, label=n)
    ax.legend(markerscale=4, frameon=False)
    ax.set_title("DINOv2 embeddings (UMAP)")
    ax.set_xticks([]); ax.set_yticks([])
    (BSA / "results/figures").mkdir(parents=True, exist_ok=True)
    fig.savefig(BSA / "results/figures/umap.png", bbox_inches="tight")
    np.save(OUT / "umap_emb.npy", emb); np.save(OUT / "umap_lab.npy", lab)
    print("done")


if __name__ == "__main__":
    main()
