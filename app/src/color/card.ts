import type { Lab, PatchId, Rgb8 } from "./types"
import { rgb8ToLab } from "./srgb"

/**
 * REFERENCE CARD = the six squares exactly as photographed in the positive
 * benchmark shot `IMG_3570.PNG` (median RGB of each detected square). Every
 * other photo's colour-correction matrix maps its own card onto THESE numbers,
 * so IMG_3570 is the ground truth and all lighting is pulled into its space.
 *
 * These are the real printed-sheet values under the demo light — deliberately
 * not the old idealised sRGB (white ≈ 250). Correcting toward 250 over-brightened
 * the kit and turned a clear purple into pale #FFD7FF (false inconclusive).
 */
export const CARD_SRGB: Record<PatchId, Rgb8> = {
  white: { r: 205, g: 207, b: 201 },
  black: { r: 27, g: 30, b: 28 },
  gray: { r: 123, g: 122, b: 127 },
  red: { r: 150, g: 48, b: 46 },
  yellow: { r: 198, g: 196, b: 74 },
  purple: { r: 123, g: 91, b: 131 },
}

/**
 * Positive centre = the kit square as photographed in IMG_3570 (the positive
 * benchmark). Because IMG_3570's card is the reference, its correction is
 * ~identity, so this raw value IS the corrected positive colour. IMG_3576 (same
 * paper) lands ΔE ≈ 5 from here.
 */
export const POSITIVE_SRGB: Rgb8 = { r: 146, g: 114, b: 155 }

/** Unused / colourless kit — white. Corrected negatives land near here. */
export const NEGATIVE_SRGB: Rgb8 = { r: 239, g: 249, b: 247 }

export const PATCH_ORDER: PatchId[] = ["white", "black", "gray", "red", "yellow", "purple"]

/**
 * Default class centres in CIE Lab from the daylight card.
 *
 * negative  — white / unused
 * positive  — lavender paper on the card (same sheet as the loose kit square)
 * muddy     — dull brown-yellow (wrong / mixed / dirty)
 */
export function defaultClassLabs(): { negative: Lab; positive: Lab; muddy: Lab } {
  return {
    negative: rgb8ToLab(NEGATIVE_SRGB),
    positive: rgb8ToLab(POSITIVE_SRGB),
    muddy: { L: 52, a: 8, b: 22 },
  }
}
