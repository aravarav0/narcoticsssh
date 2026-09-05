import type { QualityFlag } from "./types"

/** Operator-facing rejection / inconclusive reasons. Not a probability. */
export const FLAG_REASON: Record<QualityFlag, string> = {
  card_missing: "Reference card not visible enough. Please retake the image.",
  card_alignment:
    "Card alignment failed (lightness order or chromatic patches). Line up the overlay and retake.",
  patch_too_small: "A reference patch or the kit region is too small. Please retake the image.",
  patch_uneven: "A reference patch is uneven — possible border, label, finger, or mis-framing. Please retake.",
  kit_blur: "Image is too blurred for a reliable reading. Please retake the image.",
  clipping: "Too many clipped pixels (over- or underexposure). Please retake the image.",
  glare: "Too much glare on the kit or card. Please retake the image.",
  ccm_unstable: "Colour correction was unstable. Please retake under more even light.",
  classes_too_close: "Colour sits between classes — inconclusive. Laboratory confirmation is required.",
  far_from_all_refs: "Colour is far from every class centre — inconclusive.",
  outside_trained_range:
    "Colour is outside the trained range of the local calibration set — inconclusive.",
  calibration_incomplete:
    "Calibration set incomplete. Capture labelled simulated reference samples.",
}

export const OPTICAL_FLAGS: QualityFlag[] = [
  "card_missing",
  "card_alignment",
  "patch_too_small",
  "patch_uneven",
  "kit_blur",
  "clipping",
  "glare",
  "ccm_unstable",
]
