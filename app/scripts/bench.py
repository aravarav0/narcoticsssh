"""Measure the six card squares + kit in the real photos, then test the user's
benchmark plan: make IMG_3570's photographed squares the REFERENCE card, set the
positive centre from IMG_3570's kit, correct IMG_3572 (negative) to that same
reference, and check where IMG_3576 (a fresh positive) lands.

Run: python scripts/bench.py
"""
from pathlib import Path
from collections import deque
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ORDER = ["white", "gray", "red", "black", "yellow", "purple"]
CELL = {"white": (0, 0), "gray": (1, 0), "red": (2, 0),
        "black": (0, 1), "yellow": (1, 1), "purple": (2, 1)}


def load(path, maxw=700):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    if w > maxw:
        im = im.resize((maxw, int(h * maxw / w)))
    return np.asarray(im).astype(np.float64)


def sat_of(rgb):
    mx = rgb.max(2); mn = rgb.min(2)
    return np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0.0), mx / 255.0


def hue_deg(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(2); mn = rgb.min(2); d = np.maximum(mx - mn, 1e-6)
    h = np.zeros_like(mx)
    ri = mx == r; gi = (mx == g) & ~ri; bi = (mx == b) & ~ri & ~gi
    h[ri] = ((g[ri] - b[ri]) / d[ri]) % 6
    h[gi] = ((b[gi] - r[gi]) / d[gi]) + 2
    h[bi] = ((r[bi] - g[bi]) / d[bi]) + 4
    return (h * 60) % 360


def components(mask):
    H, W = mask.shape; lab = np.zeros((H, W), np.int32); n = 0
    for y in range(H):
        for x in range(W):
            if mask[y, x] and lab[y, x] == 0:
                n += 1; q = deque([(y, x)]); lab[y, x] = n
                while q:
                    cy, cx = q.popleft()
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = n; q.append((ny, nx))
    return lab, n


def anchors(rgb):
    sat, val = sat_of(rgb); hue = hue_deg(rgb)
    mask = (sat > 0.22) & (val > 0.22) & (val < 0.99)
    lab, n = components(mask); H, W = mask.shape; area = H * W
    cand = []
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i); a = len(xs)
        if a < 0.0009 * area or a > 0.2 * area:
            continue
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        bw, bh = x1 - x0 + 1, y1 - y0 + 1
        if a / (bw * bh) < 0.55 or not (0.5 < bw / bh < 2.0):
            continue
        cand.append(dict(cx=xs.mean(), cy=ys.mean(), a=a, hue=float(np.median(hue[ys, xs]))))
    def pick(pred):
        cs = [c for c in cand if pred(c["hue"])]
        return max(cs, key=lambda c: c["a"]) if cs else None
    red = pick(lambda h: h < 20 or h >= 335)
    yellow = pick(lambda h: 40 <= h < 80)
    purples = sorted([c for c in cand if 255 <= c["hue"] < 330], key=lambda c: -c["a"])
    return red, yellow, purples, cand


def grid(red, yellow, purples):
    A = [(2, 0, red["cx"], red["cy"]), (1, 1, yellow["cx"], yellow["cy"])]
    if purples:
        cp = max(purples, key=lambda c: c["cx"] + c["cy"])
        A.append((2, 1, cp["cx"], cp["cy"]))
    M = np.array([[c, r, 1] for c, r, _, _ in A], float)
    bx = np.array([x for _, _, x, _ in A]); by = np.array([y for _, _, _, y in A])
    sx = np.linalg.lstsq(M, bx, rcond=None)[0]; sy = np.linalg.lstsq(M, by, rcond=None)[0]
    return np.array([sx[2], sy[2]]), np.array([sx[0], sy[0]]), np.array([sx[1], sy[1]])


def sample(rgb, cx, cy, half):
    H, W, _ = rgb.shape
    x0, x1 = max(0, int(cx - half)), min(W, int(cx + half))
    y0, y1 = max(0, int(cy - half)), min(H, int(cy + half))
    return np.median(rgb[y0:y1, x0:x1].reshape(-1, 3), 0)


def find_kit(cand, origin, ex, ey, rgb, half):
    top = origin + ex; unit = np.hypot(*ex); best = None
    for c in cand:
        dx = abs(c["cx"] - top[0]); dy = top[1] - c["cy"]
        if 0.4 * unit < dy < 6 * unit and dx < 2 * unit:
            if best is None or c["a"] > best["a"]:
                best = c
    if best:
        return np.array([best["cx"], best["cy"]])
    return origin + ex - 1.4 * ey


def measure(path):
    rgb = load(ROOT / path)
    red, yellow, purples, cand = anchors(rgb)
    origin, ex, ey = grid(red, yellow, purples)
    half = 0.30 * np.hypot(*ex)
    sq = {n: sample(rgb, *(origin + CELL[n][0] * ex + CELL[n][1] * ey), half) for n in ORDER}
    kitc = find_kit(cand, origin, ex, ey, rgb, half)
    kit = sample(rgb, kitc[0], kitc[1], half)
    return sq, kit


# ---- colour math (mirrors app/src/color/srgb.ts + ccm.ts) ----
def lin(c):
    c = np.asarray(c, float) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


M_RGB2XYZ = np.array([[0.4124, 0.3576, 0.1805],
                      [0.2126, 0.7152, 0.0722],
                      [0.0193, 0.1192, 0.9505]])
WHITE = np.array([0.95047, 1.0, 1.08883])


def xyz_of(rgb):
    return lin(rgb) @ M_RGB2XYZ.T


def lab_of_xyz(xyz):
    t = xyz / WHITE
    f = np.where(t > (216 / 24389), np.cbrt(t), (24389 / 27 * t + 16) / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def fit_ccm(observed6, target6_xyz):
    O = lin(np.array([observed6[n] for n in ORDER]))
    T = np.array([target6_xyz[n] for n in ORDER])
    M, *_ = np.linalg.lstsq(O, T, rcond=None)  # 3x3, obs_lin -> XYZ
    resid = np.sqrt(np.mean((O @ M - T) ** 2))
    return M, resid


def de(a, b):
    return float(np.linalg.norm(a - b))


sq70, kit70 = measure("IMG_3570.PNG")
sq72, kit72 = measure("IMG_3572.png")
sq76, kit76 = measure("IMG_3576.PNG")

print("=== raw sampled squares (700px) ===")
for n in ORDER:
    print(f"  {n:6} 3570={fmt(sq70[n])} 3572={fmt(sq72[n])} 3576={fmt(sq76[n])}" if False else
          f"  {n:6} 3570={tuple(int(v) for v in sq70[n])} 3572={tuple(int(v) for v in sq72[n])} 3576={tuple(int(v) for v in sq76[n])}")
print("  kit    3570=%s 3572=%s 3576=%s" % (
    tuple(int(v) for v in kit70), tuple(int(v) for v in kit72), tuple(int(v) for v in kit76)))

# REFERENCE = IMG_3570 squares (as the user asked)
REF_XYZ = {n: xyz_of(sq70[n]) for n in ORDER}

def corrected_kit_lab(sq, kit):
    M, resid = fit_ccm(sq, REF_XYZ)
    xyz = lin(kit) @ M
    return lab_of_xyz(xyz), resid, xyz

pos_lab, r70, _ = corrected_kit_lab(sq70, kit70)   # positive centre
neg_lab, r72, _ = corrected_kit_lab(sq72, kit72)   # negative centre
test_lab, r76, txyz = corrected_kit_lab(sq76, kit76)

print("\n=== reference = IMG_3570 squares; centres from corrected kits ===")
print("  positive centre (3570 kit) Lab=%s  ccmResid=%.4f" % (tuple(round(v, 1) for v in pos_lab), r70))
print("  negative centre (3572 kit) Lab=%s  ccmResid=%.4f" % (tuple(round(v, 1) for v in neg_lab), r72))
print("\n=== TEST: IMG_3576 (should be POSITIVE) ===")
print("  corrected kit Lab=%s ccmResid=%.4f" % (tuple(round(v, 1) for v in test_lab), r76))
print("  dE -> positive=%.1f   dE -> negative=%.1f  => %s" % (
    de(test_lab, pos_lab), de(test_lab, neg_lab),
    "POSITIVE" if de(test_lab, pos_lab) < de(test_lab, neg_lab) else "NEGATIVE"))
print("  dE positive<->negative separation=%.1f" % de(pos_lab, neg_lab))
