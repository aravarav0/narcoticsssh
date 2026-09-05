import type { Lab, PatchId, Rgb8 } from "./types"
import { rgb8ToLab } from "./srgb"

/**
 * Print these as matte ≥4 cm squares. Hostel printers will miss the numbers;
 * after printing, photograph the card once under controlled light and store that
 * JPEG as a *card baseline* (not a spectrophotometer reading).
 */
export const CARD_SRGB: Record<PatchId, Rgb8> = {
  white: { r: 255, g: 255, b: 255 },
  black: { r: 0, g: 0, b: 0 },
  gray: { r: 128, g: 128, b: 128 },
  red: { r: 224, g: 32, b: 32 },
  yellow: { r: 240, g: 208, b: 32 },
  purple: { r: 112, g: 48, b: 160 },
}

export const PATCH_ORDER: PatchId[] = ["white", "black", "gray", "red", "yellow", "purple"]

/**
 * Intended-sRGB Lab landmarks for documentation and unit tests only.
 * Classification must not use these as a one-shot class model. Build a
 * multi-sample local calibration set instead.
 *
 * negative  — pale / colourless (high L*, low chroma)
 * positive  — intended purple patch (typical “colour developed” stand-in)
 * muddy     — dull brown-yellow (wrong / mixed / dirty)
 */
export function defaultClassLabs(): { negative: Lab; positive: Lab; muddy: Lab } {
  return {
    negative: { L: 86, a: 0.4, b: 4.5 },
    positive: rgb8ToLab(CARD_SRGB.purple),
    muddy: { L: 52, a: 8, b: 22 },
  }
}
