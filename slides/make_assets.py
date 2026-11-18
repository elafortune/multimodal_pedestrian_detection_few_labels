"""Crops and vignettes for the deck (run from the project root: python slides/make_assets.py).
Sources: results/figures/{generators_turbo,generators,demo_modes}.jpg (RGB views already have heads blurred)."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from sensors import fog, low_light  # same degradations as the robustness evaluation  # noqa: E402

FIG = ROOT / "results/figures"
OUT = ROOT / "slides/assets"
OUT.mkdir(exist_ok=True)
CW, CH, HDR = 320, 256, 36  # cell size and header height of the generator grids


def cell(im, col, row):
    return im.crop((col * CW, HDR + row * CH, (col + 1) * CW, HDR + (row + 1) * CH))


def strip(im, cols, row, name):
    out = Image.new("RGB", (CW * len(cols) + 8 * (len(cols) - 1), CH), "white")
    for i, c in enumerate(cols):
        out.paste(cell(im, c, row), (i * (CW + 8), 0))
    out.save(OUT / name, quality=92)
    print(name, out.size)


turbo = Image.open(FIG / "generators_turbo.jpg").convert("RGB")   # cols: RGB, T100, T1000_s1001, T1000, real IR
classic = Image.open(FIG / "generators.jpg").convert("RGB")       # cols: RGB, T100, p2p_bw10, p2p_bw1, p2p1000_bw10, real IR
strip(turbo, [0, 1, 3, 4], 5, "gen_turbo_row_people.jpg")       # pedestrians: grey in T100/T1000, hot in real IR
strip(turbo, [0, 1, 3, 4], 1, "gen_turbo_row_car.jpg")          # headlights become hot blobs
strip(classic, [0, 2, 1, 5], 5, "gen_classic_vs_turbo.jpg")     # RGB | classic pix2pix | turbo | real IR
# privacy: the RGB cell of row 5 has small faces the automatic head blur missed -> blur them here (first cell only)
from PIL import ImageFilter  # noqa: E402
for name in ("gen_turbo_row_people.jpg", "gen_classic_vs_turbo.jpg"):
    im = Image.open(OUT / name)
    for b in [(60, 140, 105, 190), (178, 140, 220, 190), (150, 85, 200, 130)]:
        im.paste(im.crop(b).filter(ImageFilter.GaussianBlur(7)), b)
    im.save(OUT / name, quality=92)

Image.open(OUT / "gen_turbo_row_car.jpg").crop((0, 40, 1304, 200)).save(OUT / "gen_turbo_row_car_crop.jpg", quality=92)  # 1304x160

# sensor-scenario vignettes: a pedestrian-free street area of the demo frame (no detection boxes inside)
demo = Image.open(FIG / "demo_modes.jpg").convert("RGB")
box = (250, 40, 640, 330)
rgb = np.asarray(demo.crop(box))
ir = np.asarray(demo.crop((box[0] + 640, box[1], box[2] + 640, box[3])))
irrec = np.asarray(demo.crop((box[0] + 640, box[1] + 1024, box[2] + 640, box[3] + 1024)))
black = np.zeros_like(rgb)
vign = {"sc_rgb_nominal": rgb, "sc_rgb_fog": fog(rgb[..., ::-1])[..., ::-1], "sc_rgb_dark": low_light(rgb[..., ::-1])[..., ::-1],
        "sc_rgb_dead": black, "sc_ir_nominal": ir, "sc_ir_dead": black, "sc_ir_reconstructed": irrec}
for k, v in vign.items():
    Image.fromarray(np.ascontiguousarray(v)).save(OUT / f"{k}.jpg", quality=92)
print("vignettes", rgb.shape)

# RGB / IR panels of the nominal row, for the pseudo-labelling diagram
Image.fromarray(np.asarray(demo.crop((0, 28, 640, 512)))).save(OUT / "pl_rgb.jpg", quality=92)
Image.fromarray(np.asarray(demo.crop((640, 28, 1280, 512)))).save(OUT / "pl_ir.jpg", quality=92)
Image.open(FIG / "umap.png").save(OUT / "umap.png")
print("done")
