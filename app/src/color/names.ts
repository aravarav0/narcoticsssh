import { CARD_SRGB, POSITIVE_SRGB } from "./card"
import { THRESHOLDS } from "./constants"
import { chroma, deltaE76, rgb8ToLab } from "./srgb"
import type { KitColourInfo, Lab, Rgb8 } from "./types"

export type NamedColourId =
  | "white"
  | "gray"
  | "black"
  | "red"
  | "yellow"
  | "purple"
  | "magenta"
  | "orange"
  | "green"
  | "blue"
  | "brown"

export type NamedHit = {
  id: NamedColourId
  label: string
  deltaE: number
}

type NamedSwatch = {
  id: NamedColourId
  label: string
  rgb: Rgb8
  chromatic: boolean
}

/** Names the kit by nearest measured daylight swatch, plus a few extra hues. */
const SWATCHES: NamedSwatch[] = [
  { id: "white", label: "WHITE", rgb: CARD_SRGB.white, chromatic: false },
  { id: "gray", label: "GRAY", rgb: CARD_SRGB.gray, chromatic: false },
  { id: "black", label: "BLACK", rgb: CARD_SRGB.black, chromatic: false },
  { id: "red", label: "RED", rgb: CARD_SRGB.red, chromatic: true },
  { id: "yellow", label: "YELLOW", rgb: CARD_SRGB.yellow, chromatic: true },
  { id: "purple", label: "PURPLE", rgb: CARD_SRGB.purple, chromatic: true },
  { id: "magenta", label: "MAGENTA", rgb: POSITIVE_SRGB, chromatic: true },
  { id: "orange", label: "ORANGE", rgb: { r: 230, g: 120, b: 40 }, chromatic: true },
  { id: "green", label: "GREEN", rgb: { r: 46, g: 160, b: 70 }, chromatic: true },
  { id: "blue", label: "BLUE", rgb: { r: 50, g: 90, b: 190 }, chromatic: true },
  { id: "brown", label: "BROWN", rgb: { r: 140, g: 90, b: 50 }, chromatic: true },
]

const LABS = SWATCHES.map((s) => ({ ...s, lab: rgb8ToLab(s.rgb) }))

/** Low-chroma colours are named white / gray / black by lightness, not by a faint tint. */
const ACHRO_CHROMA = 10

export function nameLab(lab: Lab): NamedHit {
  const pool = chroma(lab) < ACHRO_CHROMA ? LABS.filter((s) => !s.chromatic) : LABS
  let best = pool[0]
  let bestD = deltaE76(lab, best.lab)
  for (let i = 1; i < pool.length; i++) {
    const d = deltaE76(lab, pool[i].lab)
    if (d < bestD) {
      best = pool[i]
      bestD = d
    }
  }
  return { id: best.id, label: best.label, deltaE: bestD }
}

export function describeKitColour(
  kitLab: Lab,
  classLabs: { negative: Lab; positive: Lab },
): KitColourInfo {
  const observed = nameLab(kitLab)
  const expectedPositive = nameLab(classLabs.positive).label
  const expectedNegative = nameLab(classLabs.negative).label
  const dPos = deltaE76(kitLab, classLabs.positive)
  const dNeg = deltaE76(kitLab, classLabs.negative)
  const cap = THRESHOLDS.deltaEMax
  const margin = THRESHOLDS.deltaEMargin
  let vsExpected: KitColourInfo["vsExpected"] = "neither"
  if (dPos <= cap && dPos + margin < dNeg) vsExpected = "positive"
  else if (dNeg <= cap && dNeg + margin < dPos) vsExpected = "negative"
  return { ...observed, expectedPositive, expectedNegative, vsExpected }
}
