import type { Layout } from "./types"

/**
 * Normalised overlay. Physical pose: colour card along the bottom, kit in the upper centre.
 * CSS overlay in Capture.tsx MUST use the same numbers.
 */
export const DEFAULT_LAYOUT: Layout = {
  kit: { x: 0.36, y: 0.08, w: 0.28, h: 0.22 },
  patches: {
    white: { x: 0.06, y: 0.50, w: 0.28, h: 0.20 },
    gray: { x: 0.36, y: 0.50, w: 0.28, h: 0.20 },
    red: { x: 0.66, y: 0.50, w: 0.28, h: 0.20 },
    black: { x: 0.06, y: 0.74, w: 0.28, h: 0.20 },
    yellow: { x: 0.36, y: 0.74, w: 0.28, h: 0.20 },
    purple: { x: 0.66, y: 0.74, w: 0.28, h: 0.20 },
  },
}

/** Tunable. Replace after the 30-photo experiment — do not invent new ones in the UI. */
export const THRESHOLDS = {
  minPatchPixels: 30,
  clipFractionMax: 0.08,
  glareFractionMax: 0.05,
  clipChannel: 250,
  glareChannel: 250,
  minWhiteMinusBlackL: 15,
  minChromaticPatchChroma: 8,
  /** If nearest class is farther than this, refuse. */
  deltaEMax: 28,
  /** If 2nd-nearest is this close to 1st, refuse. */
  deltaEMargin: 6,
  /** Residual of CCM fit; above this we fall back to von Kries. */
  ccmResidualMax: 0.08,
  /** 90–10 channel range. Tune only against a labelled capture set. */
  maxPatchChannelSpread: 36,
  maxKitChannelSpread: 72,
  /** Require at least this much separation among the three chromatic patches. */
  minChromaticPatchSeparation: 12,
}

export const CLIP_LO = 2
export const CLIP_HI = 253
