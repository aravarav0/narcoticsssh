import type { Lab, PatchId, Rgb8 } from "./types"
import { rgb8ToLab } from "./srgb"

/**
 * Craft-sheet card photographed in cool indoor daylight
 * (`01-card-only-daylight (1).jpg`). Median RGB of each glued square.
 * Not inkjet sRGB. No yellow-lamp set yet — retake and Save card when you add one.
 */
export const CARD_SRGB: Record<PatchId, Rgb8> = {
  white: { r: 250, g: 250, b: 252 },
  black: { r: 92, g: 90, b: 93 },
  gray: { r: 214, g: 211, b: 218 },
  red: { r: 249, g: 113, b: 86 },
  yellow: { r: 247, g: 243, b: 91 },
  purple: { r: 209, g: 163, b: 211 },
}

/** Magenta/pink dummy held above the card — `03-positive-card-daylight.jpg`. */
export const POSITIVE_SRGB: Rgb8 = { r: 198, g: 130, b: 176 }

/** White/pale dummy held above the card — `02-negative-card-daylight.jpg`. */
export const NEGATIVE_SRGB: Rgb8 = { r: 239, g: 249, b: 247 }

export const PATCH_ORDER: PatchId[] = ["white", "black", "gray", "red", "yellow", "purple"]

/**
 * Default class centres in CIE Lab from the daylight dummy kits.
 *
 * negative  — unused white square
 * positive  — magenta/pink sheet (not the card's lavender square)
 * muddy     — dull brown-yellow (wrong / mixed / dirty)
 */
export function defaultClassLabs(): { negative: Lab; positive: Lab; muddy: Lab } {
  return {
    negative: rgb8ToLab(NEGATIVE_SRGB),
    positive: rgb8ToLab(POSITIVE_SRGB),
    muddy: { L: 52, a: 8, b: 22 },
  }
}
