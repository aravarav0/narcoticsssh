import type { Lab, Rgb8, RgbLin, Xyz } from "./types"

/**
 * IEC 61966-2-1 sRGB. Do not use pow(c, 2.2) — the toe is not optional.
 * Input channel is 0–255 encoded.
 */
export function srgb8ToLinear(c: number): number {
  const s = clamp01(c / 255)
  if (s <= 0.04045) return s / 12.92
  return ((s + 0.055) / 1.055) ** 2.4
}

export function linearToSrgb8(c: number): number {
  const L = Math.max(0, c)
  const s = L <= 0.0031308 ? 12.92 * L : 1.055 * L ** (1 / 2.4) - 0.055
  return Math.round(clamp01(s) * 255)
}

export function rgb8ToLinear(rgb: Rgb8): RgbLin {
  return { r: srgb8ToLinear(rgb.r), g: srgb8ToLinear(rgb.g), b: srgb8ToLinear(rgb.b) }
}

export function linearToRgb8(rgb: RgbLin): Rgb8 {
  return { r: linearToSrgb8(rgb.r), g: linearToSrgb8(rgb.g), b: linearToSrgb8(rgb.b) }
}

/**
 * IEC 61966-2-1 matrix, 4 decimal digits, linear RGB → XYZ, D65, Y(white)=1.
 */
export const SRGB_TO_XYZ = [
  [0.4124, 0.3576, 0.1805],
  [0.2126, 0.7152, 0.0722],
  [0.0193, 0.1192, 0.9505],
] as const

export const XYZ_TO_SRGB = [
  [3.2406, -1.5372, -0.4986],
  [-0.9689, 1.8758, 0.0415],
  [0.0557, -0.204, 1.057],
] as const

/** CIE D65 white, Y=1. */
export const D65: Xyz = { x: 0.95047, y: 1, z: 1.08883 }

export function linearToXyz(rgb: RgbLin): Xyz {
  const m = SRGB_TO_XYZ
  return {
    x: m[0][0] * rgb.r + m[0][1] * rgb.g + m[0][2] * rgb.b,
    y: m[1][0] * rgb.r + m[1][1] * rgb.g + m[1][2] * rgb.b,
    z: m[2][0] * rgb.r + m[2][1] * rgb.g + m[2][2] * rgb.b,
  }
}

export function xyzToLinear(xyz: Xyz): RgbLin {
  const m = XYZ_TO_SRGB
  return {
    r: m[0][0] * xyz.x + m[0][1] * xyz.y + m[0][2] * xyz.z,
    g: m[1][0] * xyz.x + m[1][1] * xyz.y + m[1][2] * xyz.z,
    b: m[2][0] * xyz.x + m[2][1] * xyz.y + m[2][2] * xyz.z,
  }
}

export function xyzToLab(xyz: Xyz, white: Xyz = D65): Lab {
  const fx = labF(xyz.x / white.x)
  const fy = labF(xyz.y / white.y)
  const fz = labF(xyz.z / white.z)
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

export function rgb8ToLab(rgb: Rgb8): Lab {
  return xyzToLab(linearToXyz(rgb8ToLinear(rgb)))
}

export function deltaE76(a: Lab, b: Lab): number {
  const dL = a.L - b.L
  const da = a.a - b.a
  const db = a.b - b.b
  return Math.sqrt(dL * dL + da * da + db * db)
}

export function chroma(lab: Lab): number {
  return Math.sqrt(lab.a * lab.a + lab.b * lab.b)
}

export function chromaticity(lin: RgbLin): { r: number; g: number } {
  const sum = lin.r + lin.g + lin.b
  if (sum < 1e-8) return { r: 1 / 3, g: 1 / 3 }
  return { r: lin.r / sum, g: lin.g / sum }
}

function labF(t: number): number {
  const epsilon = 216 / 24389
  const kappa = 24389 / 27
  if (t > epsilon) return Math.cbrt(t)
  return (kappa * t + 16) / 116
}

function clamp01(x: number): number {
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}
