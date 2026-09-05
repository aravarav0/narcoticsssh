import type { Layout } from "./types"

/**
 * Normalised overlay. Physical pose: colour card along the bottom, kit in the upper centre.
 * CSS overlay in CaptureOverlay.tsx MUST use the same numbers.
 */
export const DEFAULT_LAYOUT: Layout = {
  kit: { x: 0.36, y: 0.08, w: 0.28, h: 0.34 },
  patches: {
    white: { x: 0.06, y: 0.50, w: 0.28, h: 0.20 },
    gray: { x: 0.36, y: 0.50, w: 0.28, h: 0.20 },
    red: { x: 0.66, y: 0.50, w: 0.28, h: 0.20 },
    black: { x: 0.06, y: 0.74, w: 0.28, h: 0.20 },
    yellow: { x: 0.36, y: 0.74, w: 0.28, h: 0.20 },
    purple: { x: 0.66, y: 0.74, w: 0.28, h: 0.20 },
  },
}

/**
 * Named gates. Every value requires calibration-dataset validation on held-out
 * sessions/devices. Do not treat these as accuracy, probability, or a UI score.
 */
export const THRESHOLDS = {
  /** Requires calibration-dataset validation. */
  minPatchPixels: 30,
  /** Requires calibration-dataset validation. */
  clipFractionMax: 0.08,
  /** Requires calibration-dataset validation. */
  glareFractionMax: 0.05,
  clipChannel: 250,
  glareChannel: 250,
  /** Requires calibration-dataset validation. */
  minWhiteMinusBlackL: 15,
  /** Requires calibration-dataset validation. */
  minChromaticPatchChroma: 8,
  /**
   * Extra cap on nearest-class ΔE76, on top of the empirical class radius.
   * Requires calibration-dataset validation.
   */
  deltaEMax: 28,
  /** If 2nd-nearest is this close to 1st, refuse a class call. Requires calibration-dataset validation. */
  deltaEMargin: 6,
  /** Residual of CCM fit; above this we fall back to von Kries. Requires calibration-dataset validation. */
  ccmResidualMax: 0.08,

  /**
   * Mean per-channel sRGB stddev (0–255) above this ⇒ ROI is mixed
   * (border, label, finger, background). Requires calibration-dataset validation.
   */
  maxRoiRgbStddev: 22,
  /**
   * Fraction of ROI pixels that are inliers and not clip/glare.
   * Requires calibration-dataset validation.
   */
  minUsableFraction: 0.72,
  /** MAD multiplier for RGB outlier rejection. Requires calibration-dataset validation. */
  outlierMadK: 3,
  /** Absolute L1 RGB gate when MAD is ~0. Requires calibration-dataset validation. */
  outlierAbsRgb: 14,
  /**
   * Laplacian variance on the overlay (card + kit). Below this is treated as
   * defocus / motion blur. Requires calibration-dataset validation.
   */
  minOverlayLaplacianVariance: 12,
  /**
   * white.L − gray.L and gray.L − black.L, after sampling.
   * Requires calibration-dataset validation.
   */
  minLightnessStepL: 8,
  /**
   * Pairwise ΔE76 among red / yellow / purple patches.
   * Requires calibration-dataset validation.
   */
  minChromaticPairDeltaE: 18,

  /**
   * Minimum valid samples per of positive and negative before a class call.
   * One capture is never a class model. Requires calibration-dataset validation.
   */
  minSamplesPerClass: 3,
  /**
   * Floor on the empirical 95th-percentile ΔE76 radius of a class.
   * Requires calibration-dataset validation.
   */
  minClassRadius: 8,
  /**
   * Cap so a scattered calibration set cannot swallow the other class.
   * Requires calibration-dataset validation.
   */
  maxClassRadius: 36,
}

export const CLIP_LO = 2
export const CLIP_HI = 253
