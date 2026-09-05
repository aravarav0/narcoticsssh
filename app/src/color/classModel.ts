import { THRESHOLDS } from "./constants"
import { deltaE76 } from "./srgb"
import type { ClassName, Lab } from "./types"

export type CalibrationSample = {
  id: string
  label: ClassName
  lab: Lab
  capturedAt: string
  qualityStatus: "valid"
}

export type ClassStats = {
  center: Lab
  /** Empirical 95th-percentile ΔE76 to the centre, floored/capped by named constants. */
  radius: number
  sampleCount: number
}

export type ClassModel = {
  positive: ClassStats | null
  negative: ClassStats | null
  muddy: ClassStats | null
  /** True only when positive and negative both have enough valid samples. */
  ready: boolean
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const s = values.slice().sort((a, b) => a - b)
  const idx = (s.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return s[lo]
  return s[lo] * (hi - idx) + s[hi] * (idx - lo)
}

/** Component-wise median. Not a class model when n < minSamplesPerClass. */
export function robustMedianLab(labs: Lab[]): Lab | null {
  if (labs.length === 0) return null
  return {
    L: median(labs.map((x) => x.L)),
    a: median(labs.map((x) => x.a)),
    b: median(labs.map((x) => x.b)),
  }
}

export function statsFor(labs: Lab[]): ClassStats | null {
  const center = robustMedianLab(labs)
  if (!center) return null
  const distances = labs.map((lab) => deltaE76(lab, center))
  const p95 = percentile(distances, 0.95)
  const radius = Math.min(THRESHOLDS.maxClassRadius, Math.max(THRESHOLDS.minClassRadius, p95))
  return { center, radius, sampleCount: labs.length }
}

export function deriveClassModel(samples: CalibrationSample[]): ClassModel {
  const valid = samples.filter((s) => s.qualityStatus === "valid")
  const by = (label: ClassName) => valid.filter((s) => s.label === label).map((s) => s.lab)
  const positive = statsFor(by("positive"))
  const negative = statsFor(by("negative"))
  const muddyLabs = by("muddy")
  const muddy = muddyLabs.length >= THRESHOLDS.minSamplesPerClass ? statsFor(muddyLabs) : null
  const ready =
    !!positive &&
    !!negative &&
    positive.sampleCount >= THRESHOLDS.minSamplesPerClass &&
    negative.sampleCount >= THRESHOLDS.minSamplesPerClass
  return { positive, negative, muddy, ready }
}

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
