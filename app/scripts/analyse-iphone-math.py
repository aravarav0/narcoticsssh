# Replicate app lighting correction + naming on IMG_3570 samples

def srgb8_to_lin(c):
    s = min(1.0, max(0.0, c / 255.0))
    if s <= 0.04045:
        return s / 12.92
    return ((s + 0.055) / 1.055) ** 2.4

def lin_to_srgb8(c):
    L = max(0.0, c)
    s = 12.92 * L if L <= 0.0031308 else 1.055 * (L ** (1 / 2.4)) - 0.055
    return int(round(min(1, max(0, s)) * 255))

def rgb_to_lin(r, g, b):
    return srgb8_to_lin(r), srgb8_to_lin(g), srgb8_to_lin(b)

def lin_to_xyz(r, g, b):
    x = 0.4124 * r + 0.3576 * g + 0.1805 * b
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = 0.0193 * r + 0.1192 * g + 0.9505 * b
    return x, y, z

D65 = (0.95047, 1.0, 1.08883)

def lab_f(t):
    eps = 216 / 24389
    kappa = 24389 / 27
    if t > eps:
        return t ** (1 / 3)
    return (kappa * t + 16) / 116

def xyz_to_lab(x, y, z):
    fx, fy, fz = lab_f(x / D65[0]), lab_f(y / D65[1]), lab_f(z / D65[2])
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)

def rgb_to_lab(r, g, b):
    return xyz_to_lab(*lin_to_xyz(*rgb_to_lin(r, g, b)))

def de(a, b):
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5

def chroma(lab):
    return (lab[1] ** 2 + lab[2] ** 2) ** 0.5

def hsv(r, g, b):
    r, g, b = r / 255, g / 255, b / 255
    mx, mn = max(r, g, b), min(r, g, b)
    d = mx - mn
    h = 0
    if d > 1e-8:
        if mx == r:
            h = ((g - b) / d) % 6
        elif mx == g:
            h = (b - r) / d + 2
        else:
            h = (r - g) / d + 4
        h *= 60
        if h < 0:
            h += 360
    s = 0 if mx < 1e-8 else d / mx
    return h, s, mx

kit = (146, 115, 155)
gray_obs = (124, 123, 128)
gray_tgt = (214, 211, 218)
pos = (198, 130, 176)
neg = (239, 249, 247)
card_purple = (209, 163, 211)
muddy = (52.0, 8.0, 22.0)

print("RAW kit", kit, "hsv", tuple(round(x, 3) for x in hsv(*kit)), "lab", tuple(round(x, 1) for x in rgb_to_lab(*kit)), "C", round(chroma(rgb_to_lab(*kit)), 1))
print("dE raw kit vs magenta", round(de(rgb_to_lab(*kit), rgb_to_lab(*pos)), 1))
print("dE raw kit vs white/neg", round(de(rgb_to_lab(*kit), rgb_to_lab(*neg)), 1))
print("dE raw kit vs card purple", round(de(rgb_to_lab(*kit), rgb_to_lab(*card_purple)), 1))
print("dE raw kit vs muddy", round(de(rgb_to_lab(*kit), muddy), 1))

ko = rgb_to_lin(*kit)
go = rgb_to_lin(*gray_obs)
gt = rgb_to_lin(*gray_tgt)
gain = tuple(gt[i] / go[i] if go[i] > 1e-5 else 1 for i in range(3))
print("von Kries gains", tuple(round(g, 3) for g in gain))
kc = tuple(ko[i] * gain[i] for i in range(3))
k8 = tuple(lin_to_srgb8(c) for c in kc)
print("corrected kit sRGB", k8, "hsv", tuple(round(x, 3) for x in hsv(*k8)))
klab = xyz_to_lab(*lin_to_xyz(*kc))
print("corrected Lab", tuple(round(x, 1) for x in klab), "C", round(chroma(klab), 1))
print("dE corr vs magenta", round(de(klab, rgb_to_lab(*pos)), 1))
print("dE corr vs neg", round(de(klab, rgb_to_lab(*neg)), 1))
print("dE corr vs card purple", round(de(klab, rgb_to_lab(*card_purple)), 1))
print("dE corr vs muddy", round(de(klab, muddy), 1))
print("white-black L", round(rgb_to_lab(209, 210, 205)[0] - rgb_to_lab(28, 31, 29)[0], 1))
print("red chroma (overlay median is white)", round(chroma(rgb_to_lab(208, 208, 204)), 1))
print("yellow chroma", round(chroma(rgb_to_lab(201, 198, 76)), 1))
print("purple chroma", round(chroma(rgb_to_lab(123, 92, 131)), 1))
