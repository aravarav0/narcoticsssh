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

/** Class call. Optical failure never becomes positive/negative. */
export type ResultLabel = "positive" | "negative" | "inconclusive"

/**
 * Measurement status shown in the UI.
 * `valid` — optics and card checks passed; a class call may still be inconclusive.
 * `retake` — poor optical quality or card inconsistency; do not use the colour.
 * `inconclusive` — capture is usable but the colour cannot be named (calibration, overlap, range).
 */
export type MeasurementStatus = "valid" | "retake" | "inconclusive"

/** Capture/card quality only. A valid capture may still yield an inconclusive class call. */
export type QualityStatus = "valid" | "retake"

export type ClassName = "positive" | "negative" | "muddy"

export type QualityFlag =
  | "card_missing"
  | "card_alignment"
  | "patch_too_small"
  | "patch_uneven"
  | "kit_blur"
  | "clipping"
  | "glare"
  | "ccm_unstable"
  | "classes_too_close"
  | "far_from_all_refs"
  | "outside_trained_range"
  | "calibration_incomplete"

export type RoiStats = {
  pixelCount: number
  meanRgb: Rgb8
  medianRgb: Rgb8
  /** Median after MAD-style outlier rejection. */
  robustRgb: Rgb8
  clipFraction: number
  glareFraction: number
  /** Mean of per-channel sRGB standard deviations. */
  rgbStddev: number
  /** Inlier pixels that are not clipped or glared, as a fraction of the ROI. */
  usableFraction: number
  /** Variance of a 4-neighbour Laplacian on Rec.709 luminance. */
  laplacianVariance: number
}

export type PatchStats = RoiStats & { id: PatchId }

export type KitStats = RoiStats

export type ClassifyDebug = {
  method: "ccm" | "von_kries" | "none"
  kitLab: Lab | null
  kitHsv: Hsv | null
  kitRgb: Rgb8
  kitClipFraction: number
  kitGlareFraction: number
  kitRgbStddev: number
  kitUsableFraction: number
  kitLaplacianVariance: number
  overlayLaplacianVariance: number
  chroma: number | null
  chromaticity: { r: number; g: number } | null
  deltaE: { negative: number; positive: number; muddy: number } | null
  classRadii: { negative: number; positive: number; muddy: number | null } | null
  qualityFlags: QualityFlag[]
  patchLabs: Record<PatchId, Lab>
  patchRgb: Record<PatchId, Rgb8>
  ccmResidual: number | null
  classModelReady: boolean
  correctionNote: string | null
}

export type ClassifyOutput = {
  result: ResultLabel
  status: MeasurementStatus
  qualityStatus: QualityStatus
  reasons: string[]
  presumptive: true
  debug: ClassifyDebug
}
