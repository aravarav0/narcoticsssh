# Sample median RGB from the daylight benchmark JPEGs.
# Baked into app/src/color/card.ts as CARD_SRGB / POSITIVE_SRGB / NEGATIVE_SRGB.
from PIL import Image
import statistics
from pathlib import Path

ROOT = Path(r"c:\Users\shama\OneDrive\Documents\smartindiahackathon")

# Inner centres of the 2x3 card on the 830x1106 daylight shots
PATCHES = {
    "white":  (160, 610, 240, 700),
    "gray":   (330, 610, 420, 700),
    "red":    (560, 610, 660, 700),
    "black":  (150, 860, 240, 960),
    "yellow": (340, 860, 440, 960),
    "purple": (540, 860, 650, 960),
}

KITS = {
    "01-card-only-daylight (1).jpg": None,
    "03-positive-card-daylight.jpg": (180, 80, 650, 280),  # magenta sheet
    "02-negative-card-daylight.jpg": (280, 80, 520, 280),  # pale square
}

def median_rgb(im, box):
    x0, y0, x1, y1 = box
    # shrink 20%
    mx = int((x1 - x0) * 0.2)
    my = int((y1 - y0) * 0.2)
    x0, x1 = x0 + mx, x1 - mx
    y0, y1 = y0 + my, y1 - my
    px = im.load()
    rs, gs, bs = [], [], []
    for y in range(y0, y1, 2):
        for x in range(x0, x1, 2):
            r, g, b = px[x, y]
            rs.append(r); gs.append(g); bs.append(b)
    return int(statistics.median(rs)), int(statistics.median(gs)), int(statistics.median(bs)), len(rs)

for name, kit_box in KITS.items():
    im = Image.open(ROOT / name).convert("RGB")
    print("\n===", name, im.size, "===")
    for pid, box in PATCHES.items():
        r, g, b, n = median_rgb(im, box)
        print(f"  card {pid:7s}  {r:3d},{g:3d},{b:3d}  n={n}")
    if kit_box:
        r, g, b, n = median_rgb(im, kit_box)
        print(f"  KIT            {r:3d},{g:3d},{b:3d}  n={n}")
