import { describe, expect, it } from "vitest"
import { deriveClassModel, robustMedianLab, statsFor, type CalibrationSample } from "./classModel"
import { THRESHOLDS } from "./constants"
import type { Lab } from "./types"

function sample(label: CalibrationSample["label"], lab: Lab, i: number): CalibrationSample {
  return {
    id: `${label}-${i}`,
    label,
    lab,
    capturedAt: "2026-01-01T00:00:00.000Z",
    qualityStatus: "valid",
  }
}

describe("class model from multiple samples", () => {
  it("uses the robust median, not the first sample, as the centre", () => {
    const labs: Lab[] = [
      { L: 10, a: -4, b: 0 },
      { L: 20, a: 0, b: 0 },
      { L: 90, a: 40, b: 8 },
    ]
    const center = robustMedianLab(labs)!
    expect(center.L).toBe(20)
    expect(center.a).toBe(0)
    expect(statsFor(labs)!.center.L).toBe(20)
    expect(statsFor(labs)!.center.L).not.toBe(labs[0].L)
  })

  it("is not ready until both classes meet the minimum sample count", () => {
    const pos = Array.from({ length: THRESHOLDS.minSamplesPerClass }, (_, i) =>
      sample("positive", { L: 40, a: 20, b: -10 }, i),
    )
    const neg = [sample("negative", { L: 80, a: 0, b: 4 }, 0)]
    expect(deriveClassModel([...pos, ...neg]).ready).toBe(false)
    const neg3 = Array.from({ length: THRESHOLDS.minSamplesPerClass }, (_, i) =>
      sample("negative", { L: 80, a: 0, b: 4 + i }, i),
    )
    const ready = deriveClassModel([...pos, ...neg3])
    expect(ready.ready).toBe(true)
    expect(ready.positive?.sampleCount).toBe(THRESHOLDS.minSamplesPerClass)
    expect(ready.negative?.sampleCount).toBe(THRESHOLDS.minSamplesPerClass)
    expect(ready.positive?.radius).toBeGreaterThanOrEqual(THRESHOLDS.minClassRadius)
  })
})
