"""E3 - Explainability of the synthesis failure.

(a) VAE ceiling: the real-IR detector (ir_full) is evaluated on REAL IR test images that went through each
    stage of the generator's pipeline, without any translation:
      resize512 : 1280x1024 -> 512x512 -> back        (resolution + aspect ratio)
      vae512    : resize512 + SD-Turbo VAE encode/decode (+ latent bottleneck, 8x downsampling)
      vaefull   : VAE at native resolution            (latent bottleneck alone)
    If mAP already drops here, no translator built on this pipeline can do better: it is a ceiling.
(b) Per-pedestrian error analysis: for every GT pedestrian of the test set, is it found (IoU >= 0.5, conf >= 0.25)
      by ir_full on real IR, on vae512, on synthetic T100/T1000, and by rgb_full on RGB?
    Each pedestrian is described by its height, its RGB luminance / contrast and its real IR contrast.
    -> which pedestrians does the generator lose, and are they visible in the RGB it starts from?
(c) Average pedestrian (anonymous by construction) and mean |synthetic - real| map around the pedestrians.

Input : runs/det/{ir_full,rgb_full}, data/synth/{resize512,vae512,vaefull,T100,T1000}/images/test
Output: results/explain/{ceiling.json, pedestrians.json, pedestrians.csv}, results/figures/{vae_ceiling.png,
        recall_by_height.png, mean_pedestrian.png}
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

os.environ.setdefault("YOLO_CONFIG_DIR", "/workspace/bsa/.ultralytics")
sys.path.insert(0, str(Path(__file__).parent))
import matplotlib  # noqa: E402
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from ultralytics import YOLO  # noqa: E402

from det_eval import iou_matrix  # noqa: E402

BSA = Path("/workspace/bsa")
Y = BSA / "data/yolo"
OUT = BSA / "results/explain"; OUT.mkdir(parents=True, exist_ok=True)
FIG = BSA / "results/figures"
W, H = 1280, 1024
SETS = {"real IR": ("ir_full", Y / "ir/images/test"), "resize512": ("ir_full", BSA / "data/synth/resize512/images/test"),
        "vae512": ("ir_full", BSA / "data/synth/vae512/images/test"), "vaefull": ("ir_full", BSA / "data/synth/vaefull/images/test"),
        "synthetic T100": ("ir_full", BSA / "data/synth/T100/images/test"),
        "synthetic T1000": ("ir_full", BSA / "data/synth/T1000/images/test"),
        "RGB (rgb_full)": ("rgb_full", Y / "rgb/images/test")}


def yaml_for(d):
    p = BSA / "configs/det" / f"ceiling_{d.parent.parent.name}.yaml"
    p.write_text(f"train: {d}\nval: {d}\nnames:\n  0: person\n")
    return p


def gt_boxes(stem):
    p = Y / "ir/labels/test" / f"{stem}.txt"
    a = np.loadtxt(p, ndmin=2) if p.exists() and p.stat().st_size else np.zeros((0, 5))
    if not len(a):
        return np.zeros((0, 4))
    c, w, h = a[:, 1:3] * [W, H], a[:, 3] * W, a[:, 4] * H
    return np.stack([c[:, 0] - w / 2, c[:, 1] - h / 2, c[:, 0] + w / 2, c[:, 1] + h / 2], 1).clip(0, [W, H, W, H])


def found(det, d, stems, gts):
    out = []
    paths = [str(d / f"{s}.jpg") for s in stems]
    k = 0
    for i in range(0, len(paths), 64):
        for r in det.predict(paths[i:i + 64], imgsz=640, conf=0.25, verbose=False, half=True):
            g = gts[k]; k += 1
            p = r.boxes.xyxy.cpu().numpy()
            iou = iou_matrix(g, p)
            hit = np.zeros(len(g), bool)
            used = set()
            for j in np.argsort(-iou.max(1)) if len(p) else []:  # greedy one-to-one
                c = [c for c in np.argsort(-iou[j]) if c not in used and iou[j, c] >= 0.5]
                if c:
                    hit[j] = True; used.add(c[0])
            out.append(hit)
    return np.concatenate(out)


def gray(path):
    return np.asarray(Image.open(path).convert("L").resize((W, H)), np.float32) / 255


def contrast(g, b):
    x1, y1, x2, y2 = b.astype(int)
    bw, bh = x2 - x1, y2 - y1
    X1, Y1, X2, Y2 = max(0, x1 - bw // 4), max(0, y1 - bh // 4), min(W, x2 + bw // 4), min(H, y2 + bh // 4)
    inner, outer = g[y1:y2, x1:x2], g[Y1:Y2, X1:X2]
    if not inner.size:
        return np.nan, np.nan
    return float(inner.mean()), float(inner.mean() - (outer.sum() - inner.sum()) / max(outer.size - inner.size, 1))


def main():
    # works with whatever is available (B17: on the replacement pod, no synthetic sets and no rgb_full)
    det = {n: YOLO(str(BSA / f"runs/det/{n}/weights/last.pt")) for n in ("ir_full", "rgb_full")
           if (BSA / f"runs/det/{n}/weights/last.pt").exists()}
    avail = {k: v for k, v in SETS.items() if v[0] in det and v[1].exists()}
    # (a) ceiling, official Ultralytics metric on the full test set
    ceil = {}
    for name, (dn, d) in avail.items():
        m = det[dn].val(data=str(yaml_for(d)), split="val", imgsz=640, batch=64, plots=False, verbose=False,
                        project=str(BSA / "runs/val"), name=f"ceiling_{d.parent.parent.name}", exist_ok=True)
        ceil[name] = {"map50": float(m.box.map50), "map50_95": float(m.box.map), "recall": float(m.box.mr)}
        print(name, ceil[name], flush=True)
    (OUT / "ceiling.json").write_text(json.dumps(ceil, indent=2))

    # (b) per-pedestrian table
    stems = sorted(p.stem for p in (Y / "ir/images/test").glob("*.jpg"))
    gts = [gt_boxes(s) for s in stems]
    rows = {"h": np.concatenate([g[:, 3] - g[:, 1] for g in gts])}
    feats = {"rgb_lum": [], "rgb_con": [], "ir_lum": [], "ir_con": [], "t1000_con": []}
    has_t = "synthetic T1000" in avail
    for s, g in zip(stems, gts):
        gr, gi = gray(Y / "rgb/images/test" / f"{s}.jpg"), gray(Y / "ir/images/test" / f"{s}.jpg")
        gt = gray(BSA / "data/synth/T1000/images/test" / f"{s}.jpg") if has_t else None
        for b in g:
            (l1, c1), (l2, c2) = contrast(gr, b), contrast(gi, b)
            c3 = contrast(gt, b)[1] if has_t else np.nan
            feats["rgb_lum"].append(l1); feats["rgb_con"].append(c1); feats["ir_lum"].append(l2); feats["ir_con"].append(c2); feats["t1000_con"].append(c3)
    rows.update({k: np.array(v) for k, v in feats.items()})
    # fresh models for predict(): a YOLO object reused after val() raises "Inference tensors do not track version counter" (B19)
    det = {n: YOLO(str(BSA / f"runs/det/{n}/weights/last.pt")) for n in det}
    for name, (dn, d) in avail.items():
        rows[f"found: {name}"] = found(det[dn], d, stems, gts)
    import csv
    with open(OUT / "pedestrians.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(rows); w.writerows(zip(*rows.values()))

    fr = rows["found: real IR"]
    summ = {"n_pedestrians": int(len(fr)), "recall": {k[7:]: float(v.mean()) for k, v in rows.items() if k.startswith("found")}}
    fv = rows.get("found: vae512")
    if fv is not None:  # which pedestrians does the VAE bottleneck lose? (size / contrast of kept vs lost)
        lv = fr & ~fv
        summ["vae512: lost among found on real IR"] = float(lv.sum() / fr.sum())
        summ["median features, kept vs lost (vae512)"] = {k: [float(np.nanmedian(rows[k][fr & fv])), float(np.nanmedian(rows[k][lv]))]
                                                          for k in ("h", "rgb_lum", "ir_con")}
    if not has_t or "found: RGB (rgb_full)" not in rows:
        (OUT / "pedestrians.json").write_text(json.dumps(summ, indent=2))
        print(json.dumps(summ, indent=2), flush=True)
        return figures(rows, ceil, stems, gts, has_t)
    ft, fg = rows["found: synthetic T1000"], rows["found: RGB (rgb_full)"]
    lost = fr & ~ft
    summ["T1000: lost among found on real IR"] = float(lost.sum() / fr.sum())
    summ["T1000 lost: share also found by RGB detector on RGB"] = float((lost & fg).sum() / max(lost.sum(), 1))
    summ["T1000 lost: share also lost by vae512"] = float((lost & ~fv).sum() / max(lost.sum(), 1))
    summ["crosstab RGB-found x T1000-found (among real-IR-found)"] = {
        f"rgb={a},t1000={b}": int((fr & (fg == a) & (ft == b)).sum()) for a in (True, False) for b in (True, False)}
    # median features of lost vs kept pedestrians (among those found on real IR)
    keep = fr & ft
    summ["median features, kept vs lost (T1000)"] = {k: [float(np.nanmedian(rows[k][keep])), float(np.nanmedian(rows[k][lost]))]
                                                     for k in ("h", "rgb_lum", "rgb_con", "ir_con", "t1000_con")}
    # logistic regression: P(lost in T1000 | found on real IR) from standardised features
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import roc_auc_score
    X = np.stack([np.log(rows["h"]), rows["rgb_lum"], rows["rgb_con"], rows["ir_con"]], 1)[fr]
    ok = ~np.isnan(X).any(1); X, yv = X[ok], lost[fr][ok]
    Xs = (X - X.mean(0)) / X.std(0)
    lr = LogisticRegression(max_iter=1000).fit(Xs, yv)
    summ["logit lost~features (standardised coef)"] = dict(zip(["log_height", "rgb_luminance", "rgb_contrast", "ir_contrast"], map(float, lr.coef_[0])))
    summ["logit AUC (in-sample)"] = float(roc_auc_score(yv, lr.predict_proba(Xs)[:, 1]))
    (OUT / "pedestrians.json").write_text(json.dumps(summ, indent=2))
    print(json.dumps(summ, indent=2), flush=True)
    figures(rows, ceil, stems, gts, has_t)


def figures(rows, ceil, stems, gts, has_t):
    # figures: recall by height (quantile bins)
    h = rows["h"]; edges = np.quantile(h, np.linspace(0, 1, 7))
    idx = np.clip(np.digitize(h, edges[1:-1]), 0, 5)
    fig, axs = plt.subplots(1, 2, figsize=(11, 4), dpi=160)
    for name in SETS:
        k = f"found: {name}"
        if k in rows and name not in ("resize512", "vaefull"):
            axs[0].plot([rows[k][idx == i].mean() for i in range(6)], "o-", label=name)
    axs[0].set_xticks(range(6), [f"{edges[i]:.0f}-{edges[i + 1]:.0f}" for i in range(6)], rotation=20)
    axs[0].set_xlabel("pedestrian height (px, 1024-px frame)"); axs[0].set_ylabel("recall (IoU≥0.5, conf≥0.25)")
    axs[0].legend(fontsize=8, frameon=False); axs[0].set_title("Who is lost? recall by pedestrian size")
    lum = rows["rgb_lum"]; le = np.nanquantile(lum, np.linspace(0, 1, 6)); li = np.clip(np.digitize(lum, le[1:-1]), 0, 4)
    for name in [n for n in ("real IR", "vae512", "synthetic T1000", "RGB (rgb_full)") if f"found: {n}" in rows]:
        axs[1].plot([rows[f"found: {name}"][li == i].mean() for i in range(5)], "o-", label=name)
    axs[1].set_xticks(range(5), [f"{le[i]:.2f}-{le[i + 1]:.2f}" for i in range(5)], rotation=20)
    axs[1].set_xlabel("RGB luminance inside the box (0-1)"); axs[1].legend(fontsize=8, frameon=False)
    axs[1].set_title("…and by how lit the pedestrian is in RGB")
    fig.tight_layout(); fig.savefig(FIG / "recall_by_height.png", bbox_inches="tight")

    # ceiling bar chart
    names = [n for n in ("real IR", "resize512", "vaefull", "vae512", "synthetic T1000", "synthetic T100") if n in ceil]
    fig, ax = plt.subplots(figsize=(7.5, 3.6), dpi=160)
    ax.bar(range(len(names)), [ceil[n]["map50_95"] for n in names], color=["#2E3440", "#81A1C1", "#81A1C1", "#5E81AC", "#A3BE8C", "#A3BE8C"][: len(names)])
    for i, n in enumerate(names):
        ax.text(i, ceil[n]["map50_95"] + 0.01, f"{ceil[n]['map50_95']:.3f}", ha="center", fontsize=9)
    ax.set_xticks(range(len(names)), names, rotation=15); ax.set_ylabel("ir_full mAP50-95 on real IR test")
    ax.set_title("How much of the real IR survives the generator's pipeline (no translation)?")
    fig.savefig(FIG / "vae_ceiling.png", bbox_inches="tight")

    # (c) mean pedestrian (average of all crops h>=60 px, resized to 48x112, +25 % context): anonymous by averaging
    srcs = {"RGB (gray)": Y / "rgb/images/test", "real IR": Y / "ir/images/test", "vae512": BSA / "data/synth/vae512/images/test",
            "synthetic T1000": BSA / "data/synth/T1000/images/test"}
    srcs = {k: d for k, d in srcs.items() if d.exists()}
    acc = {k: [] for k in srcs}
    for s, g in zip(stems[::2], gts[::2]):
        ims = {k: Image.open(d / f"{s}.jpg").convert("L").resize((W, H)) for k, d in srcs.items()}
        for x1, y1, x2, y2 in g:
            if y2 - y1 < 60:
                continue
            mx, my = 0.25 * (x2 - x1), 0.25 * (y2 - y1)
            bb = (max(0, x1 - mx), max(0, y1 - my), min(W, x2 + mx), min(H, y2 + my))
            for k in srcs:
                acc[k].append(np.asarray(ims[k].crop(bb).resize((48, 112)), np.float32) / 255)
    mean = {k: np.mean(v, 0) for k, v in acc.items()}
    fig, axs = plt.subplots(1, len(srcs) + 1, figsize=(2.0 * (len(srcs) + 1), 3.6), dpi=160)
    for ax, (k, m) in zip(axs, mean.items()):
        ax.imshow(m, cmap="gray", vmin=0, vmax=1); ax.set_title(k, fontsize=9); ax.axis("off")
    other = "synthetic T1000" if has_t else "vae512"
    err = np.mean([np.abs(a - b) for a, b in zip(acc[other], acc["real IR"])], 0)
    axs[-1].imshow(err, cmap="magma"); axs[-1].set_title(f"mean |{other} - real|", fontsize=9); axs[-1].axis("off")
    fig.suptitle(f"Average pedestrian over {len(acc['real IR'])} test crops", fontsize=10)
    fig.savefig(FIG / "mean_pedestrian.png", bbox_inches="tight")


if __name__ == "__main__":
    main()
