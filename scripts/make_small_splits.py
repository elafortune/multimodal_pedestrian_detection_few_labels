"""N=10 / N=25 subsets, added on the first pod after 01_make_splits.py (doc/avancement.md, 17/11 ~5h50).
Same rule as 01_make_splits.py: nested prefixes of one seeded permutation of the IR train names.
Safety check: the rule must reproduce the existing N=50 files exactly before anything is written."""
import random
from pathlib import Path

BSA = Path("/workspace/bsa")
root = BSA / "data"
names = sorted(p.stem for p in (root / "yolo/ir/images/train").glob("*.jpg"))
for seed in (0, 1):
    perm = names[:]
    random.Random(seed).shuffle(perm)
    ref = [Path(l).stem for l in (BSA / f"splits/ir_train_N50_s{seed}.txt").read_text().split()]
    assert sorted(perm[:50]) == ref, f"rule does not reproduce N50 s{seed}"
    for n in (10, 25):
        sel = sorted(perm[:n])
        for mod in ("ir", "rgb"):
            (BSA / f"splits/{mod}_train_N{n}_s{seed}.txt").write_text(
                "\n".join(str(root / "yolo" / mod / "images/train" / f"{s}.jpg") for s in sel) + "\n")
print("ok: N10/N25 written, N50 reproduced exactly")
