import type { Hsv, Rgb8 } from "./types"

/**
 * HSV is computed on *encoded* sRGB (0–1), not linear light.
 * After CCM / von Kries we convert the corrected linear RGB back to sRGB8 first.
 */
export function rgb8ToHsv(rgb: Rgb8): Hsv {
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d > 1e-8) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max < 1e-8 ? 0 : d / max
  return { h, s, v: max }
}
