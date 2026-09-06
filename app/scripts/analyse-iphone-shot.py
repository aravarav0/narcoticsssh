from PIL import Image, ImageDraw
import statistics
from pathlib import Path

path = Path(r"c:\Users\shama\OneDrive\Documents\smartindiahackathon\IMG_3570.PNG")
im = Image.open(path).convert("RGB")
w, h = im.size
px = im.load()
print(f"size {w}x{h} aspect {w/h:.3f}")

LAYOUT = {
    "kit": {"x": 0.36, "y": 0.08, "w": 0.28, "h": 0.22},
    "white": {"x": 0.06, "y": 0.50, "w": 0.28, "h": 0.20},
    "gray": {"x": 0.36, "y": 0.50, "w": 0.28, "h": 0.20},
    "red": {"x": 0.66, "y": 0.50, "w": 0.28, "h": 0.20},
    "black": {"x": 0.06, "y": 0.74, "w": 0.28, "h": 0.20},
    "yellow": {"x": 0.36, "y": 0.74, "w": 0.28, "h": 0.20},
    "purple": {"x": 0.66, "y": 0.74, "w": 0.28, "h": 0.20},
}

def sample(rect, shrink=0.15):
    x0 = int(rect["x"] * w)
    y0 = int(rect["y"] * h)
    x1 = int((rect["x"] + rect["w"]) * w)
    y1 = int((rect["y"] + rect["h"]) * h)
    mx = int((x1 - x0) * shrink)
    my = int((y1 - y0) * shrink)
    xa, xb = x0 + mx, x1 - mx
    ya, yb = y0 + my, y1 - my
    rs, gs, bs = [], [], []
    glare = clip = 0
    for y in range(ya, yb, 2):
        for x in range(xa, xb, 2):
            r, g, b = px[x, y]
            rs.append(r); gs.append(g); bs.append(b)
            if r >= 250 and g >= 250 and b >= 250:
                glare += 1
            if r <= 2 or r >= 253 or g <= 2 or g >= 253 or b <= 2 or b >= 253:
                clip += 1
    n = len(rs) or 1
    med = (int(statistics.median(rs)), int(statistics.median(gs)), int(statistics.median(bs)))
    mean = (sum(rs)//n, sum(gs)//n, sum(bs)//n)
    return {
        "box": (x0, y0, x1, y1),
        "inner": (xa, ya, xb, yb),
        "n": len(rs),
        "med": med,
        "mean": mean,
        "glare": glare / n,
        "clip": clip / n,
    }

dbg = im.copy()
draw = ImageDraw.Draw(dbg)
for name, rect in LAYOUT.items():
    s = sample(rect)
    color = (0, 255, 255) if name == "kit" else (255, 200, 0)
    draw.rectangle(s["box"], outline=color, width=6)
    print(f"{name:7s} box={s['box']} med={s['med']} mean={s['mean']} glare={s['glare']:.2f} clip={s['clip']:.2f} n={s['n']}")

# Scan for purple-like pixels (high R+B, lower G, not white)
cands = []
for y in range(0, h, 8):
    for x in range(0, w, 8):
        r, g, b = px[x, y]
        if r > 140 and b > 140 and g < r - 15 and g < b - 10 and r < 240:
            cands.append((x, y, r, g, b))
if cands:
    xs = [c[0] for c in cands]
    ys = [c[1] for c in cands]
    print(f"purple-like pixels ~ {len(cands)}  x={min(xs)}-{max(xs)} ({min(xs)/w:.2f}-{max(xs)/w:.2f})  y={min(ys)}-{max(ys)} ({min(ys)/h:.2f}-{max(ys)/h:.2f})")
    # two clusters: kit vs card purple
    y_mid = statistics.median(ys)
    top = [c for c in cands if c[1] < y_mid]
    bot = [c for c in cands if c[1] >= y_mid]
    for label, cluster in (("kit-cluster", top), ("card-purple-cluster", bot)):
        if not cluster:
            continue
        xs = [c[0] for c in cluster]; ys = [c[1] for c in cluster]
        print(f"  {label}: x={min(xs)/w:.2f}-{max(xs)/w:.2f} y={min(ys)/h:.2f}-{max(ys)/h:.2f} n={len(cluster)} sample RGB={cluster[len(cluster)//2][2:5]}")
        draw.rectangle((min(xs), min(ys), max(xs), max(ys)), outline=(255, 0, 255), width=4)

out = Path(r"c:\Users\shama\OneDrive\Documents\smartindiahackathon\IMG_3570-overlay-debug.png")
dbg.save(out)
print("wrote", out)
