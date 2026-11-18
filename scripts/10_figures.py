"""S6 - Figures and tables for the video / slides. Robust to missing results (plots what exists).

Input : results/det/*.json, results/gap/metrics.json, results/multimodal/robustness.json, results/latency.json
Output: results/figures/{map_vs_n.png, robustness.png, gap_vs_gain.png}, results/tables.md
"""
import json
import re
from collections import defaultdict
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

BSA = Path("/workspace/bsa")
R = BSA / "results"
FIG = R / "figures"; FIG.mkdir(parents=True, exist_ok=True)
METRIC = "map50_95"
plt.rcParams.update({"font.size": 11, "axes.spines.top": False, "axes.spines.right": False})
C = {"pl": "#EBCB8B", "plf": "#88C0D0", "chain": "#B48EAD", "real": "#4C566A", "ft": "#D08770", "mix": "#5E81AC", "synth": "#A3BE8C", "rgb": "#BF616A", "ir_full": "#2E3440"}


# runs launched by queue_synth/queue_recover carry no generator suffix: make it explicit
ALIAS = {"ft_N100_s0": "ft_N100_s0_T100", "mix_N100_s0": "mix_N100_s0_T100",
         "ft_N1000_s0": "ft_N1000_s0_T1000", "mix_N1000_s0": "mix_N1000_s0_T1000"}


def load_det():
    d = {}
    for p in (R / "det").glob("*.json"):
        j = json.loads(p.read_text())
        if "ir" in j["eval"]:
            d[ALIAS.get(p.stem, p.stem)] = j["eval"]["ir"]
    return d


def series(det, prefix, suffix=""):
    """name pattern <prefix>_N<n>_s<seed><suffix> -> {n: [values]}"""
    out = defaultdict(list)
    for k, v in det.items():
        m = re.fullmatch(rf"{prefix}_N(\d+)_s(\d+){suffix}", k)
        if m:
            out[int(m.group(1))].append(v[METRIC])
    return dict(sorted(out.items()))


MAIN = [("real", "real IR only", "real", "", "o-"),
        ("ft", "synthetic IR (100 pairs) pre-train → fine-tune", "ft", "_T100", "o-"),
        ("ft", "synthetic IR (1000 pairs) pre-train → fine-tune", "ft", "_T1000", "s--"),
        ("rgb", "real RGB pre-train → fine-tune", "ft", "_RGB", "^-"),
        ("chain", "real RGB → synthetic IR (1000 pairs) → fine-tune", "ft", "_RGBT1000", "D:"),
        ("mix", "real + synthetic mixed (100 / 1000 pairs)", "mix", "_T1000?0?0?", "o-")]
PL = [("real", "real IR only", "real", "", "o-"),
      ("ft", "synthetic IR (100 pairs) pre-train → fine-tune", "ft", "_T100", "o-"),
      ("rgb", "real RGB pre-train → fine-tune", "ft", "_RGB", "^-"),
      ("pl", "pseudo-labelled real IR (COCO on RGB, 1000 pairs) → fine-tune", "ft", "_PL", "v-"),
      ("plf", "pseudo-labelled real IR (COCO on RGB+IR, 1000 pairs) → fine-tune", "ft", "_PLf", "P-"),
      ("pl", "pseudo-labelled real IR (COCO on RGB, 100 pairs) → fine-tune", "ft", "_PL100", "v:"),
      ("chain", "real RGB → pseudo-labelled IR → fine-tune", "ft", "_RGBPL", "D:")]
HL_MAIN = [("ir_full", "real IR, all 12k labels", "ir_full", "--"), ("synth_T1000", "synthetic only, 0 IR label (1000 pairs)", "synth", "-."),
           ("synth_T100", "synthetic only, 0 IR label (100 pairs)", "synth", "--"), ("rgb_full", "RGB detector applied to IR, 0 IR label", "rgb", ":")]
HL_PL = [("ir_full", "real IR, all 12k labels", "ir_full", "--"), ("rgb_full", "RGB detector applied to IR, 0 IR label", "rgb", ":"),
         ("pl_P1000", "pseudo-labels only (RGB), 0 IR label", "pl", "-."), ("pl_P1000f", "pseudo-labels only (RGB+IR), 0 IR label", "plf", "-.")]


def fig_map_vs_n(det, lines, spec=MAIN, hl=HL_MAIN, fname="map_vs_n.png", title="Thermal pedestrian detection vs IR label budget (LLVIP)"):
    fig, ax = plt.subplots(figsize=(7.5, 4.8), dpi=160)
    for key, label, pre, suf, mk in spec:
        s = series(det, pre, suf)
        if not s:
            continue
        x = np.array(list(s)); m = np.array([np.mean(v) for v in s.values()]); e = np.array([np.std(v) for v in s.values()])
        ax.plot(x, m, mk, color=C[key], label=label, lw=2, alpha=0.95)
        if key in ("real", "rgb") or suf == "_T100":
            ax.fill_between(x, m - e, m + e, color=C[key], alpha=0.12)
    for name, label, ck, ls in hl:
        if name in det:
            ax.axhline(det[name][METRIC], color=C[ck], ls=ls, lw=1.4, label=label)
            if fname == "map_vs_n.png" or name.startswith("pl_"):
                lines.append(f"| {name} | {det[name]['map50']:.3f} | {det[name][METRIC]:.3f} |")
    ax.set_xscale("log"); ax.set_xlabel("labelled real IR images (N)"); ax.set_ylabel("mAP50-95 on real IR test")
    ax.set_title(title)
    ax.legend(fontsize=8, frameon=False, loc="center left", bbox_to_anchor=(1.01, 0.5))
    fig.savefig(FIG / fname, bbox_inches="tight")


def fig_robustness(lines):
    p = R / "multimodal/robustness.json"
    if not p.exists():
        return
    r = json.loads(p.read_text())
    scen = list(r); cfg = sorted({c for s in r.values() for c in s}, key=["rgb", "ir", "late_wbf", "early_drop", "early_nodrop"].index)
    M = np.array([[r[s].get(c, {}).get(METRIC, np.nan) for c in cfg] for s in scen])
    fig, ax = plt.subplots(figsize=(1.4 * len(cfg) + 2, 0.6 * len(scen) + 1.5), dpi=160)
    ax.imshow(M, cmap="viridis", vmin=0, vmax=np.nanmax(M))
    ax.set_xticks(range(len(cfg)), cfg, rotation=20); ax.set_yticks(range(len(scen)), scen)
    for i in range(len(scen)):
        for j in range(len(cfg)):
            if not np.isnan(M[i, j]):
                ax.text(j, i, f"{M[i, j]:.2f}", ha="center", va="center", color="w" if M[i, j] < 0.6 * np.nanmax(M) else "k")
    ax.set_title("mAP50-95 per sensor scenario")
    fig.savefig(FIG / "robustness.png", bbox_inches="tight")
    lines += ["", "## Robustness (mAP50-95)", "", "| scenario | " + " | ".join(cfg) + " |", "|---" * (len(cfg) + 1) + "|"]
    lines += [f"| {s} | " + " | ".join(f"{v:.3f}" for v in M[i]) + " |" for i, s in enumerate(scen)]


def gap_tables(det, lines):
    p = R / "gap/metrics.json"
    if not p.exists():
        return
    g = json.loads(p.read_text())
    keys = ["fid", "kid_x1000", "fd_dinov2", "precision", "recall", "density", "coverage"]
    lines += ["", "## Gap to real IR (test split, same scene pool)", "",
              "| set | " + " | ".join(keys) + " | L1 | SSIM | LPIPS |", "|---" * (len(keys) + 4) + "|"]
    for s, m in g.items():
        pt = m.get("paired_test", {})
        lines.append(f"| {s} | " + " | ".join(f"{m[k]:.3f}" for k in keys) + " | "
                     + " | ".join(f"{pt[k]:.3f}" if k in pt else "-" for k in ("l1", "ssim", "lpips")) + " |")
    # gap vs downstream: each training set (12,025 images, same boxes) -> detector scored on real IR test.
    # RGB is included: it is the "farthest" set by every metric, yet trains the best IR detector (P21).
    trained_on = {"rgb": "rgb_full", "T100": "synth_T100", "T1000": "synth_T1000"}
    names = {"rgb": "real RGB", "T100": "synthetic IR\n(100 pairs)", "T1000": "synthetic IR\n(1000 pairs)"}
    pts = [(g[s]["fid"], g[s]["fd_dinov2"], det[r][METRIC], s) for s, r in trained_on.items() if s in g and r in det]
    if pts:
        fig, axs = plt.subplots(1, 2, figsize=(9.5, 3.8), dpi=160)
        for ax, idx, name in [(axs[0], 0, "FID to real IR (lower = closer)"), (axs[1], 1, "FD-DINOv2 to real IR (lower = closer)")]:
            for p_ in pts:
                col = C["rgb"] if p_[3] == "rgb" else C["synth"]
                ax.scatter(p_[idx], p_[2], s=70, color=col)
                ax.annotate(names[p_[3]], (p_[idx], p_[2]), xytext=(6, -4), textcoords="offset points", fontsize=9)
            ax.set_xlabel(name); ax.set_ylabel("detector trained on it:\nmAP50-95 on real IR")
            ax.margins(x=0.35, y=0.15)
        fig.suptitle("Closer to real IR by image metrics ≠ more useful for detection")
        fig.savefig(FIG / "gap_vs_gain.png", bbox_inches="tight")


def main():
    det = load_det()
    lines = ["# Results", "", f"Main metric: {METRIC} on the real IR LLVIP test set (3463 images, unseen scenes).", "",
             "## All detectors", "", "| run | mAP50 | mAP50-95 |", "|---|---|---|"]
    lines += [f"| {k} | {v['map50']:.3f} | {v[METRIC]:.3f} |" for k, v in sorted(det.items())]
    lines += ["", "## References", "", "| run | mAP50 | mAP50-95 |", "|---|---|---|"]
    fig_map_vs_n(det, lines)
    fig_map_vs_n(det, lines, PL, HL_PL, "map_vs_n_pl.png", "Which source of 'free' supervision helps most? (LLVIP)")
    gap_tables(det, lines)
    fig_robustness(lines)
    lat = R / "latency.json"
    if lat.exists():
        L = json.loads(lat.read_text())
        lines += ["", "## Latency (batch 1, " + L["gpu"] + ")", "", "| backend | pre | infer | post | e2e p50 | e2e p95 | FPS |", "|---|---|---|---|---|---|---|"]
        for k in ("pytorch_fp32", "pytorch_fp16", "tensorrt_fp16"):
            if k in L:
                v = L[k]
                lines.append(f"| {k} | {v['pre_ms']['p50']:.2f} | {v['infer_ms']['p50']:.2f} | {v['post_ms']['p50']:.2f} | "
                             f"{v['e2e_ms']['p50']:.2f} | {v['e2e_ms']['p95']:.2f} | {v['fps_e2e_p50']:.0f} |")
        if "translator_pix2pix_turbo" in L:
            lines.append(f"\nRGB→IR generator: {L['translator_pix2pix_turbo']['p50_ms']:.1f} ms p50 (512², fp16)")
    (R / "tables.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
