"""E5 - Does an image metric predict how useful a set is for training a detector?

For each image set (real IR, RGB, naive transforms, generator checkpoints, VAE-reconstructed IR) we have
  x = image metrics (12_box_metrics.py, computed on test half B)
  y = mAP50-95 on the real IR test set of a YOLO11s trained ONLY on that set (proxy protocol: 3000 train
      images, 30 epochs, same boxes for every set -> runs proxy_<set>)
Rank correlation (Spearman rho, Kendall tau) = monotonic, possibly non-linear relation; Pearson r on top.
Sign convention: distances are negated so that "rho > 0" always means "the metric ranks sets like their usefulness".
Robustness: leave-one-out min/max rho, and rho on generator sets only (no RGB / naive sets).

Input : results/boxmetrics/metrics.json, results/det/proxy_*.json, results/det/{rgb_full,synth_T100,synth_T1000}.json
Output: results/boxmetrics/correlation.json, results/boxmetrics/correlation.md, results/figures/metric_vs_usefulness.png
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from scipy import stats  # noqa: E402

BSA = Path("/workspace/bsa")
R = BSA / "results"
# metric -> (label, higher_is_better)
METRICS = {"fid": ("FID (global)", False), "kid_x1000": ("KID (global)", False), "fd_dinov2": ("FD-DINOv2 (global)", False),
           "fd_yolo": ("FD-YOLO-IR (global)", False), "fid_box": ("FID (boxes)", False), "kid_box_x1000": ("KID (boxes)", False),
           "fd_dinov2_box": ("FD-DINOv2 (boxes)", False), "fd_yolo_box": ("FD-YOLO-IR (boxes)", False),
           "l1_box": ("paired L1 (boxes)", False), "contrast_err": ("contrast error (boxes)", False),
           "contrast_corr": ("contrast corr. (boxes)", True), "detect_map50_95": ("real-IR detector on set (mAP)", True)}
GEN_ONLY = lambda s: s.startswith("T") or s == "p2p"  # noqa: E731


def main():
    m = json.loads((R / "boxmetrics/metrics.json").read_text())
    y = {}
    for s in m:
        p = R / "det" / f"proxy_{s}.json"
        if p.exists():
            y[s] = json.loads(p.read_text())["eval"]["ir"]["map50_95"]
    sets = sorted(y, key=y.get)
    out = {"n_sets": len(sets), "usefulness": {s: y[s] for s in sets}, "metrics": {}}
    yy = np.array([y[s] for s in sets])
    for k, (lab, hib) in METRICS.items():
        x = np.array([m[s].get(k, np.nan) for s in sets]) * (1 if hib else -1)
        ok = ~np.isnan(x)
        if ok.sum() < 4:
            continue
        rho, p_rho = stats.spearmanr(x[ok], yy[ok]); tau, p_tau = stats.kendalltau(x[ok], yy[ok]); r, p_r = stats.pearsonr(x[ok], yy[ok])
        loo = [stats.spearmanr(np.delete(x[ok], i), np.delete(yy[ok], i))[0] for i in range(ok.sum())]
        g = np.array([GEN_ONLY(s) for s in sets]) & ok
        rho_g = stats.spearmanr(x[g], yy[g])[0] if g.sum() >= 4 else np.nan
        out["metrics"][k] = {"label": lab, "spearman": rho, "p_spearman": p_rho, "kendall": tau, "p_kendall": p_tau,
                             "pearson": r, "p_pearson": p_r, "loo_min": min(loo), "loo_max": max(loo),
                             "spearman_generators_only": rho_g, "n_generators": int(g.sum())}
    # sanity check of the proxy protocol against the full 12k trainings
    full = {"rgb": "rgb_full", "T100": "synth_T100", "T1000": "synth_T1000"}
    out["proxy_vs_full"] = {s: [y.get(s), json.loads((R / "det" / f"{f}.json").read_text())["eval"]["ir"]["map50_95"]]
                            for s, f in full.items() if (R / "det" / f"{f}.json").exists()}
    (R / "boxmetrics/correlation.json").write_text(json.dumps(out, indent=2, default=float))

    lines = [f"# Image metric vs usefulness ({len(sets)} sets)", "", "| metric | Spearman ρ (p) | Kendall τ | Pearson r | LOO ρ min–max | ρ generators only (n) |", "|---|---|---|---|---|---|"]
    for k, v in sorted(out["metrics"].items(), key=lambda kv: -kv[1]["spearman"]):
        lines.append(f"| {v['label']} | {v['spearman']:.2f} ({v['p_spearman']:.3f}) | {v['kendall']:.2f} | {v['pearson']:.2f} | "
                     f"{v['loo_min']:.2f}–{v['loo_max']:.2f} | {v['spearman_generators_only']:.2f} ({v['n_generators']}) |")
    lines += ["", "| set | proxy mAP50-95 | " + " | ".join(METRICS) + " |", "|---" * (len(METRICS) + 2) + "|"]
    for s in sets:
        lines.append(f"| {s} | {y[s]:.3f} | " + " | ".join(f"{m[s].get(k, np.nan):.3g}" for k in METRICS) + " |")
    (R / "boxmetrics/correlation.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))

    ks = list(out["metrics"])
    nc = 4; nr = int(np.ceil(len(ks) / nc))
    fig, axs = plt.subplots(nr, nc, figsize=(3.3 * nc, 2.9 * nr), dpi=150)
    for ax, k in zip(axs.flat, ks):
        x = np.array([m[s].get(k, np.nan) for s in sets])
        col = ["#BF616A" if s == "rgb" else "#2E3440" if s in ("ir", "vae512") else "#EBCB8B" if s in ("gray", "invgray") else "#A3BE8C" for s in sets]
        ax.scatter(x, yy, c=col, s=28)
        for s, a, b in zip(sets, x, yy):
            ax.annotate(s, (a, b), fontsize=5.5, xytext=(2, 2), textcoords="offset points")
        v = out["metrics"][k]
        ax.set_title(f"{v['label']}\nρ={v['spearman']:.2f}  (gen. only {v['spearman_generators_only']:.2f})", fontsize=8)
        ax.tick_params(labelsize=7)
    for ax in list(axs.flat)[len(ks):]:
        ax.axis("off")
    fig.supylabel("detector trained on the set: mAP50-95 on real IR", fontsize=9)
    fig.tight_layout(); fig.savefig(R / "figures/metric_vs_usefulness.png", bbox_inches="tight")


if __name__ == "__main__":
    main()
