/** Shared colour types. Values are documented next to the constants we actually ship. */

export type Rgb8 = { r: number; g: number; b: number }
export type RgbLin = { r: number; g: number; b: number }
export type Xyz = { x: number; y: number; z: number }
export type Lab = { L: number; a: number; b: number }
export type Hsv = { h: number; s: number; v: number }

export type PixelBuffer = {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

export type RectNorm = {
  /** Left edge as fraction of image width, 0–1. */
  x: number
  y: number
  w: number
  h: number
}

export type PatchId = "white" | "black" | "gray" | "red" | "yellow" | "purple"

export type Layout = {
  kit: RectNorm
  patches: Record<PatchId, RectNorm>
}

export type ResultLabel = "positive" | "negative" | "inconclusive"

export type QualityFlag =
  | "card_missing"
  | "patch_too_small"
  | "clipping"
  | "glare"
  | "ccm_unstable"
  | "classes_too_close"
  | "far_from_all_refs"
  | "patch_uneven"
  | "kit_uneven"
  | "card_inconsistent"
  | "calibration_incomplete"
  | "outside_calibrated_range"

export type PatchStats = {
  id: PatchId
  pixelCount: number
  meanRgb: Rgb8
  medianRgb: Rgb8
  clipFraction: number
  glareFraction: number
  /** Robust 90th–10th percentile channel spread. Large values suggest mixed pixels. */
  channelSpread: number
}

export type KitStats = {
  pixelCount: number
  meanRgb: Rgb8
  medianRgb: Rgb8
  clipFraction: number
  glareFraction: number
  channelSpread: number
}

export type ClassifyDebug = {
  method: "ccm" | "von_kries"
  kitLab: Lab
  kitHsv: Hsv
  kitRgb: Rgb8
  kitClipFraction: number
  kitGlareFraction: number
  chroma: number
  chromaticity: { r: number; g: number }
  deltaE: { negative: number; positive: number; muddy: number }
  qualityFlags: QualityFlag[]
  patchLabs: Record<PatchId, Lab>
  patchRgb: Record<PatchId, Rgb8>
  ccmResidual: number | null
  /** Capture validity, never a probability or an accuracy claim. */
  measurementQuality: "valid" | "retake" | "inconclusive"
}

export type ClassifyOutput = {
  result: ResultLabel
  presumptive: true
  debug: ClassifyDebug
}
