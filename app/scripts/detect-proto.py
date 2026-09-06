"""Prototype: locate the 6-square card by its saturated anchors, reconstruct the
full 2x3 grid geometrically, place the kit box above the card, then relight the
whole frame so the card matches a reference. Pure-numpy -> ports to plain JS.

Run: python scripts/detect-proto.py
"""
from pathlib import Path
from collections import deque
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parents[1] / "public"

REF = {
    "white":  (250, 250, 252),
    "gray":   (214, 211, 218),
    "red":    (249, 113, 86),
    "black":  (92, 90, 93),
    "yellow": (247, 243, 91),
    "purple": (209, 163, 211),
}
# grid cell (col, row) for each patch; col 0..2 left->right, row 0..1 top->bottom
CELL = {"white": (0, 0), "gray": (1, 0), "red": (2, 0),
        "black": (0, 1), "yellow": (1, 1), "purple": (2, 1)}


def load(path, maxw=700):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    if w > maxw:
        im = im.resize((maxw, int(h * maxw / w)))
    return np.asarray(im).astype(np.float64)


def sat_of(rgb):
    mx = rgb.max(axis=2); mn = rgb.min(axis=2)
    return np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0.0), mx / 255.0


def hue_deg(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(axis=2); mn = rgb.min(axis=2)
    d = np.maximum(mx - mn, 1e-6)
    h = np.zeros_like(mx)
    ri = mx == r; gi = (mx == g) & ~ri; bi = (mx == b) & ~ri & ~gi
    h[ri] = ((g[ri] - b[ri]) / d[ri]) % 6
    h[gi] = ((b[gi] - r[gi]) / d[gi]) + 2
    h[bi] = ((r[bi] - g[bi]) / d[bi]) + 4
    return (h * 60) % 360


def components(mask):
    H, W = mask.shape
    lab = np.zeros((H, W), np.int32); n = 0
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


def find_anchors(rgb):
    sat, val = sat_of(rgb)
    hue = hue_deg(rgb)
    mask = (sat > 0.22) & (val > 0.22) & (val < 0.99)
    lab, n = components(mask)
    H, W = mask.shape; area = H * W
    cand = []
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        a = len(xs)
        if a < 0.0009 * area or a > 0.2 * area:
            continue
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        bw, bh = x1 - x0 + 1, y1 - y0 + 1
        if a / (bw * bh) < 0.55 or not (0.5 < bw / bh < 2.0):
            continue
        h = float(np.median(hue[ys, xs]))
        med = np.median(rgb[ys, xs], axis=0)
        cand.append(dict(cx=xs.mean(), cy=ys.mean(), a=a, hue=h, rgb=med,
                         box=(x0, y0, x1, y1)))
    # classify by hue, keep the biggest of each colour
    def pick(pred):
        cs = [c for c in cand if pred(c["hue"])]
        return max(cs, key=lambda c: c["a"]) if cs else None
    red = pick(lambda h: h < 20 or h >= 335)
    yellow = pick(lambda h: 40 <= h < 80)
    purples = [c for c in cand if 255 <= c["hue"] < 330]
    purples.sort(key=lambda c: -c["a"])
    return red, yellow, purples, cand


def solve_grid(red, yellow, purples):
    """Return (origin, ex, ey): center(col,row) = origin + col*ex + row*ey."""
    anchors = []  # (col, row, x, y)
    if red: anchors.append((2, 0, red["cx"], red["cy"]))
    if yellow: anchors.append((1, 1, yellow["cx"], yellow["cy"]))
    # a purple that sits on the card (col2,row1): pick the lowest-right purple
    card_purple = None
    if purples:
        card_purple = max(purples, key=lambda c: c["cx"] + c["cy"])
        anchors.append((2, 1, card_purple["cx"], card_purple["cy"]))
    if len(anchors) >= 3:
        A = np.array([[c, r, 1] for c, r, _, _ in anchors], float)
        bx = np.array([x for _, _, x, _ in anchors], float)
        by = np.array([y for _, _, _, y in anchors], float)
        sx, *_ = np.linalg.lstsq(A, bx, rcond=None)
        sy, *_ = np.linalg.lstsq(A, by, rcond=None)
        origin = np.array([sx[2], sy[2]])
        ex = np.array([sx[0], sy[0]])
        ey = np.array([sx[1], sy[1]])
        return origin, ex, ey, card_purple
    if red and yellow:  # axis-aligned 2-anchor
        ex = np.array([red["cx"] - yellow["cx"], 0.0])
        ey = np.array([0.0, yellow["cy"] - red["cy"]])
        origin = np.array([yellow["cx"], red["cy"]]) - 1 * ex - 0 * ey
        return origin, ex, ey, card_purple
    return None


def sample_box(rgb, cx, cy, half):
    H, W, _ = rgb.shape
    x0 = max(0, int(cx - half)); x1 = min(W, int(cx + half))
    y0 = max(0, int(cy - half)); y1 = min(H, int(cy + half))
    patch = rgb[y0:y1, x0:x1].reshape(-1, 3)
    return np.median(patch, axis=0), (x0, y0, x1, y1)


# ---- sRGB <-> linear <-> XYZ <-> Lab (IEC), matches app/src/color/srgb.ts ----
def lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def delin(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055) * 255


M_RGB2XYZ = np.array([[0.4124, 0.3576, 0.1805],
                      [0.2126, 0.7152, 0.0722],
                      [0.0193, 0.1192, 0.9505]])
WHITE = np.array([0.9505, 1.0, 1.0890])


def rgb2lab(rgb):
    xyz = lin(np.asarray(rgb, float)) @ M_RGB2XYZ.T
    t = xyz / WHITE
    f = np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], -1)


def fit_ccm(observed, target):
    """observed,target: (6,3) linear-RGB. Returns 3x3 mapping obs->target."""
    O = np.asarray(observed); T = np.asarray(target)
    Oa = np.hstack([O, np.ones((len(O), 1))])
    M, *_ = np.linalg.lstsq(Oa, T, rcond=None)
    return M  # 4x3


def find_kit(rgb, cand, origin, ex, ey, half):
    """Kit = a saturated square sitting above the card. Fall back to a box
    centred above the card (a white/unused kit over paper reads white)."""
    top_mid = origin + 1 * ex + 0 * ey
    unit = float(np.hypot(*ex))
    # a coloured kit: saturated blob above the top card row, near card x
    best = None
    for c in cand:
        dx = abs(c["cx"] - top_mid[0]); dy = top_mid[1] - c["cy"]
        if dy > 0.4 * unit and dy < 6 * unit and dx < 2 * unit:
            if best is None or c["a"] > best["a"]:
                best = c
    if best is not None:
        return np.array([best["cx"], best["cy"]]), True
    kitc = origin + 1 * ex + (-1.4) * ey
    return kitc, False


def relight(rgb, observed6, target6, path):
    M = fit_ccm(lin(np.array(observed6)), lin(np.array(target6)))
    H, W, _ = rgb.shape
    flat = lin(rgb.reshape(-1, 3))
    out = np.hstack([flat, np.ones((len(flat), 1))]) @ M
    img = delin(out).reshape(H, W, 3)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(
        OUT / (Path(path).stem + "-relit.png"))
    return M


def run(path, kit_expected):
    print("\n==", Path(path).name, "(kit should be", kit_expected + ")")
    rgb = load(path)
    red, yellow, purples, cand = find_anchors(rgb)
    g = solve_grid(red, yellow, purples)
    if not g:
        print("  GRID FAILED"); return
    origin, ex, ey, card_purple = g
    half = 0.28 * float(np.hypot(*ex))
    im = Image.fromarray(rgb.astype(np.uint8)); dr = ImageDraw.Draw(im)
    observed = []
    for name in ["white", "gray", "red", "black", "yellow", "purple"]:
        c, r = CELL[name]
        p = origin + c * ex + r * ey
        med, box = sample_box(rgb, p[0], p[1], half)
        observed.append(med)
        dr.rectangle(box, outline=(0, 255, 0), width=3)
    target = [REF[n] for n in ["white", "gray", "red", "black", "yellow", "purple"]]
    M = relight(rgb, observed, target, path)
    # kit
    kitc, found = find_kit(rgb, cand, origin, ex, ey, half)
    kmed, kbox = sample_box(rgb, kitc[0], kitc[1], half)
    dr.rectangle(kbox, outline=(255, 0, 255), width=4)
    im.save(OUT / (Path(path).stem + "-grid.png"))
    # corrected kit colour via CCM
    klin = lin(kmed.reshape(1, 3))
    kcorr = delin(np.hstack([klin, [[1]]]) @ M)[0]
    klab = rgb2lab(np.clip(kcorr, 0, 255))
    pos_lab = rgb2lab(REF["purple"]); neg_lab = rgb2lab(REF["white"])
    dpos = float(np.linalg.norm(klab - pos_lab))
    dneg = float(np.linalg.norm(klab - neg_lab))
    call = "positive" if dpos < dneg else "negative"
    print("  kit auto-found=%s raw=(%3d,%3d,%3d) corrected=(%3d,%3d,%3d)" % (
        found, *[int(v) for v in kmed], *[int(v) for v in np.clip(kcorr, 0, 255)]))
    print("  kit Lab=(%.0f,%.0f,%.0f)  dE->purple=%.1f  dE->white=%.1f  => %s" % (
        klab[0], klab[1], klab[2], dpos, dneg, call.upper()))


if __name__ == "__main__":
    run(ROOT / "IMG_3570.PNG", "purple")
    run(ROOT / "IMG_3572.png", "white")
