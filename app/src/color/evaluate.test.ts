import { describe, expect, it } from "vitest"
import { evaluateManifest, predictedLabel, scoreRows } from "./evaluate"

describe("evaluation split metrics", () => {
  it("builds a confusion matrix and rates without inventing accuracy copy", () => {
    const metrics = scoreRows([
      { actual: "positive", predicted: "positive" },
      { actual: "positive", predicted: "inconclusive" },
      { actual: "negative", predicted: "negative" },
      { actual: "negative", predicted: "retake" },
    ])
    expect(metrics.n).toBe(4)
    expect(metrics.confusion.positive.positive).toBe(1)
    expect(metrics.confusion.positive.inconclusive).toBe(1)
    expect(metrics.recall.positive).toBe(0.5)
    expect(metrics.recall.negative).toBe(0.5)
    expect(metrics.inconclusiveRate).toBe(0.25)
    expect(metrics.retakeRate).toBe(0.25)
  })

  it("splits by session and skips rows with no prediction", () => {
    const report = evaluateManifest([
      {
        imagePath: "a.jpg",
        simulatedLabel: "positive",
        deviceId: "phone-1",
        sessionId: "holdout",
        condition: "daylight",
        predictedResult: "positive",
        predictedStatus: "valid",
      },
      {
        imagePath: "b.jpg",
        simulatedLabel: "negative",
        deviceId: "phone-2",
        sessionId: "tune",
        condition: "yellow",
        predictedResult: null,
        predictedStatus: null,
      },
    ])
    expect(report.skipped).toBe(1)
    expect(report.overall?.n).toBe(1)
    expect(report.bySession.holdout.n).toBe(1)
    expect(report.byDevice["phone-1"].n).toBe(1)
    expect(report.note).toMatch(/hold out/i)
    expect(predictedLabel("inconclusive", "retake")).toBe("retake")
  })
})
