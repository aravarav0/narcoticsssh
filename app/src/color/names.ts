import { THRESHOLDS } from "./constants"
import { rgb8ToHsv } from "./hsv"
import { chroma, deltaE76, rgb8ToLab } from "./srgb"
import type { KitColourInfo, Lab, Rgb8 } from "./types"

export type NamedHit = {
  id: string
  label: string
  hex: string
  hue: number
}

const ACHRO_CHROMA = 10
const ACHRO_SAT = 0.12

/** HSV hue bands — denser than the 6 card squares so lime is not called yellow. */
const HUE_BANDS: { max: number; id: string; label: string }[] = [
  { max: 12, id: "red", label: "RED" },
  { max: 28, id: "red-orange", label: "RED-ORANGE" },
  { max: 42, id: "orange", label: "ORANGE" },
  { max: 54, id: "amber", label: "AMBER" },
  { max: 68, id: "yellow", label: "YELLOW" },
  { max: 86, id: "lime", label: "LIME" },
  { max: 108, id: "yellow-green", label: "YELLOW-GREEN" },
  { max: 145, id: "green", label: "GREEN" },
  { max: 165, id: "spring-green", label: "SPRING GREEN" },
  { max: 185, id: "teal", label: "TEAL" },
  { max: 205, id: "cyan", label: "CYAN" },
  { max: 230, id: "sky-blue", label: "SKY BLUE" },
  { max: 255, id: "blue", label: "BLUE" },
  { max: 275, id: "indigo", label: "INDIGO" },
  { max: 335, id: "purple", label: "PURPLE" },
  { max: 348, id: "pink", label: "PINK" },
  { max: 361, id: "red", label: "RED" },
]

export function rgbToHex(rgb: Rgb8): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`.toUpperCase()
}

function hueId(h: number): { id: string; label: string } {
  const x = ((h % 360) + 360) % 360
  for (const band of HUE_BANDS) {
    if (x < band.max) return { id: band.id, label: band.label }
  }
  return { id: "red", label: "RED" }
}

/**
 * Name from the sampled sRGB (hue + lightness), not from nearest card square.
 * A lime-green sheet must not snap to the yellow patch.
 */
export function nameColour(rgb: Rgb8): NamedHit {
  const lab = rgb8ToLab(rgb)
  const hsv = rgb8ToHsv(rgb)
  const hex = rgbToHex(rgb)
  const C = chroma(lab)

  if (C < ACHRO_CHROMA || hsv.s < ACHRO_SAT) {
    if (lab.L >= 85) return { id: "white", label: "WHITE", hex, hue: hsv.h }
    if (lab.L <= 42) return { id: "black", label: "BLACK", hex, hue: hsv.h }
    return { id: "gray", label: "GRAY", hex, hue: hsv.h }
  }

  // Dull orange at mid/low L* is brown, not "orange".
  if (hsv.h >= 15 && hsv.h < 50 && lab.L < 52 && C < 42) {
    return { id: "brown", label: "BROWN", hex, hue: hsv.h }
  }

  const hit = hueId(hsv.h)
  let label = hit.label
  if (lab.L < 32) label = `DARK ${label}`
  else if (lab.L >= 84 && C < 32) label = `PALE ${label}`
  return { id: hit.id, label, hex, hue: hsv.h }
}

export function nameLab(lab: Lab): NamedHit {
  return nameColour(labToDisplayRgb(lab))
}

/** Approximate sRGB for naming a Lab centre (saved positive / negative). */
function labToDisplayRgb(lab: Lab): Rgb8 {
  const fy = (lab.L + 16) / 116
  const fx = lab.a / 500 + fy
  const fz = fy - lab.b / 200
  const eps = 216 / 24389
  const kappa = 24389 / 27
  const inv = (t: number) => {
    const t3 = t * t * t
    return t3 > eps ? t3 : (116 * t - 16) / kappa
  }
  const x = inv(fx) * 0.95047
  const y = inv(fy)
  const z = inv(fz) * 1.08883
  const r = 3.2406 * x - 1.5372 * y - 0.4986 * z
  const g = -0.9689 * x + 1.8758 * y + 0.0415 * z
  const b = 0.0557 * x - 0.204 * y + 1.057 * z
  const enc = (c: number) => {
    const L = Math.max(0, c)
    const s = L <= 0.0031308 ? 12.92 * L : 1.055 * L ** (1 / 2.4) - 0.055
    return Math.round(Math.max(0, Math.min(1, s)) * 255)
  }
  return { r: enc(r), g: enc(g), b: enc(b) }
}

export function describeKitColour(
  kitLab: Lab,
  kitRgb: Rgb8,
  classLabs: { negative: Lab; positive: Lab },
): KitColourInfo {
  const observed = nameColour(kitRgb)
  const expectedPositive = nameLab(classLabs.positive).label
  const expectedNegative = nameLab(classLabs.negative).label
  const dPos = deltaE76(kitLab, classLabs.positive)
  const dNeg = deltaE76(kitLab, classLabs.negative)
  const cap = THRESHOLDS.deltaEMax
  const margin = THRESHOLDS.deltaEMargin
  let vsExpected: KitColourInfo["vsExpected"] = "neither"
  if (dPos <= cap && dPos + margin < dNeg) vsExpected = "positive"
  else if (dNeg <= cap && dNeg + margin < dPos) vsExpected = "negative"
  return {
    id: observed.id,
    label: observed.label,
    hex: observed.hex,
    hue: observed.hue,
    deltaE: Math.min(dPos, dNeg),
    expectedPositive,
    expectedNegative,
    vsExpected,
  }
}
