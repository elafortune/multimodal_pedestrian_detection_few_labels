"""Minimal COCO-style box mAP (single class) used to compare every multimodal configuration with the SAME evaluator.

preds: list (per image) of arrays [K, 5] = x1, y1, x2, y2, score (pixels)
gts  : list (per image) of arrays [M, 4] = x1, y1, x2, y2 (pixels)
"""
import numpy as np

IOU_THRS = np.linspace(0.5, 0.95, 10)


def iou_matrix(a, b):
    if len(a) == 0 or len(b) == 0:
        return np.zeros((len(a), len(b)))
    x1 = np.maximum(a[:, None, 0], b[None, :, 0]); y1 = np.maximum(a[:, None, 1], b[None, :, 1])
    x2 = np.minimum(a[:, None, 2], b[None, :, 2]); y2 = np.minimum(a[:, None, 3], b[None, :, 3])
    inter = np.clip(x2 - x1, 0, None) * np.clip(y2 - y1, 0, None)
    area_a = (a[:, 2] - a[:, 0]) * (a[:, 3] - a[:, 1]); area_b = (b[:, 2] - b[:, 0]) * (b[:, 3] - b[:, 1])
    return inter / (area_a[:, None] + area_b[None, :] - inter + 1e-9)


def average_precision(recall, precision):
    """101-point interpolated AP (COCO)."""
    mrec = np.concatenate([[0.0], recall, [1.0]])
    mpre = np.concatenate([[1.0], precision, [0.0]])
    mpre = np.flip(np.maximum.accumulate(np.flip(mpre)))
    x = np.linspace(0, 1, 101)
    return float(np.mean(np.interp(x, mrec, mpre)))


def evaluate(preds, gts):
    scores, tps, n_gt = [], [], 0
    for p, g in zip(preds, gts):
        n_gt += len(g)
        if len(p) == 0:
            continue
        p = p[np.argsort(-p[:, 4])]
        iou = iou_matrix(p[:, :4], g)
        tp = np.zeros((len(p), len(IOU_THRS)), bool)
        for t, thr in enumerate(IOU_THRS):
            taken = np.zeros(len(g), bool)
            for i in range(len(p)):  # greedy, by decreasing score
                if len(g) == 0:
                    break
                cand = np.where(~taken & (iou[i] >= thr))[0]
                if len(cand):
                    j = cand[np.argmax(iou[i, cand])]
                    taken[j] = True
                    tp[i, t] = True
        scores.append(p[:, 4]); tps.append(tp)
    if not scores:
        return {"map50": 0.0, "map50_95": 0.0, "recall50": 0.0}
    s = np.concatenate(scores); tp = np.concatenate(tps)
    order = np.argsort(-s); tp = tp[order]
    ctp = np.cumsum(tp, 0); cfp = np.cumsum(~tp, 0)
    rec = ctp / max(n_gt, 1); prec = ctp / (ctp + cfp)
    aps = [average_precision(rec[:, t], prec[:, t]) for t in range(len(IOU_THRS))]
    return {"map50": aps[0], "map50_95": float(np.mean(aps)), "recall50": float(rec[-1, 0])}
