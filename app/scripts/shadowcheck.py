"""Is there really a shadow over the SAMPLED part of the 3576 kit, or is the
whole frame just dimmer (which the card corrects)? Measure the kit box:
its spread (std / L-range) and a 3x3 grid of sub-cells to reveal any gradient.

Run: python scripts/shadowcheck.py
"""
from pathlib import Path
import numpy as np
from bench import load, anchors, grid, find_kit, CELL, lin, M_RGB2XYZ, WHITE, lab_of_xyz

ROOT = Path(__file__).resolve().parents[2]


def rgb2lab(rgb):
    return lab_of_xyz(lin(rgb) @ M_RGB2XYZ.T)


def kit_region(path):
    rgb = load(ROOT / path)
    red, yellow, purples, cand = anchors(rgb)
    origin, ex, ey = grid(red, yellow, purples)
    half = 0.30 * np.hypot(*ex)
    kc = find_kit(cand, origin, ex, ey, rgb, half)
    H, W, _ = rgb.shape
    x0, x1 = int(kc[0] - half), int(kc[0] + half)
    y0, y1 = int(kc[1] - half), int(kc[1] + half)
    box = rgb[y0:y1, x0:x1]
    return box


def report(path):
    box = kit_region(path)
    flat = box.reshape(-1, 3)
    med = np.median(flat, 0)
    std = flat.std(0)
    L = rgb2lab(flat.reshape(-1, 1, 3).mean(1))  # per-pixel Lab L via vectorized
    # simpler: L per pixel
    Ls = np.array([rgb2lab(p)[0] for p in flat[:: max(1, len(flat) // 400)]])
    p10, p90 = np.percentile(Ls, [10, 90])
    print(f"\n== {path}")
    print(f"  kit median rgb = {tuple(int(v) for v in med)}")
    print(f"  channel std    = {tuple(round(float(v),1) for v in std)}")
    print(f"  L p10..p90     = {p10:.1f} .. {p90:.1f}  (spread {p90-p10:.1f})")
    # 3x3 sub-cell medians to reveal a gradient (shadow) across the box
    h, w, _ = box.shape
    print("  3x3 sub-cell L (top->bottom rows):")
    for r in range(3):
        row = []
        for c in range(3):
            sub = box[r*h//3:(r+1)*h//3, c*w//3:(c+1)*w//3].reshape(-1, 3)
            row.append(rgb2lab(np.median(sub, 0))[0])
        print("     " + "  ".join(f"{v:5.1f}" for v in row))


report("IMG_3570.PNG")
report("IMG_3576.PNG")
