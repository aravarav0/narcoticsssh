import { describe, expect, it } from "vitest"
import { CARD_SRGB, defaultClassLabs } from "./card"
import { classifyImage } from "./classify"
import { deriveClassModel, type CalibrationSample } from "./classModel"
import { DEFAULT_LAYOUT, THRESHOLDS } from "./constants"
import { rgb8ToHsv } from "./hsv"
import { deltaE76, rgb8ToLab, srgb8ToLinear } from "./srgb"
import { fitCcm, intendedPatchXyz, vonKries } from "./ccm"
import { rgb8ToLinear } from "./srgb"
import type { ClassName, Lab, PixelBuffer, RectNorm, Rgb8 } from "./types"

const PALE: Rgb8 = { r: 230, g: 228, b: 220 }

function fillRect(image: PixelBuffer, rect: RectNorm, rgb: Rgb8) {
  const x0 = Math.floor(rect.x * image.width)
  const y0 = Math.floor(rect.y * image.height)
  const x1 = Math.ceil((rect.x + rect.w) * image.width)
  const y1 = Math.ceil((rect.y + rect.h) * image.height)
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * image.width + x) * 4
      image.data[i] = rgb.r
      image.data[i + 1] = rgb.g
      image.data[i + 2] = rgb.b
      image.data[i + 3] = 255
    }
  }
}

function fillChecker(image: PixelBuffer, rect: RectNorm, a: Rgb8, b: Rgb8) {
  const x0 = Math.floor(rect.x * image.width)
  const y0 = Math.floor(rect.y * image.height)
  const x1 = Math.ceil((rect.x + rect.w) * image.width)
  const y1 = Math.ceil((rect.y + rect.h) * image.height)
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const rgb = (x + y) % 2 === 0 ? a : b
      const i = (y * image.width + x) * 4
      image.data[i] = rgb.r
      image.data[i + 1] = rgb.g
      image.data[i + 2] = rgb.b
      image.data[i + 3] = 255
    }
  }
}

function syntheticFrame(kit: Rgb8, patches: Record<string, Rgb8> = CARD_SRGB): PixelBuffer {
  const width = 200
  const height = 200
  const data = new Uint8ClampedArray(width * height * 4)
  data.fill(40)
  const image: PixelBuffer = { data, width, height }
  fillRect(image, DEFAULT_LAYOUT.kit, kit)
  for (const id of Object.keys(DEFAULT_LAYOUT.patches) as (keyof typeof DEFAULT_LAYOUT.patches)[]) {
    fillRect(image, DEFAULT_LAYOUT.patches[id], patches[id])
  }
  return image
}

function applyRgbGain(image: PixelBuffer, gr: number, gg: number, gb: number): PixelBuffer {
  const data = new Uint8ClampedArray(image.data)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, Math.round(data[i] * gr)))
    data[i + 1] = Math.max(0, Math.min(255, Math.round(data[i + 1] * gg)))
    data[i + 2] = Math.max(0, Math.min(255, Math.round(data[i + 2] * gb)))
  }
  return { width: image.width, height: image.height, data }
}

function boxBlur(image: PixelBuffer, radius: number): PixelBuffer {
  const { width, height } = image
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = Math.min(width - 1, Math.max(0, x + dx))
          const yy = Math.min(height - 1, Math.max(0, y + dy))
          const i = (yy * width + xx) * 4
          r += image.data[i]
          g += image.data[i + 1]
          b += image.data[i + 2]
          n++
        }
      }
      const o = (y * width + x) * 4
      data[o] = r / n
      data[o + 1] = g / n
      data[o + 2] = b / n
      data[o + 3] = 255
    }
  }
  return { width, height, data }
}

function samplesAround(lab: Lab, label: ClassName, n = THRESHOLDS.minSamplesPerClass): CalibrationSample[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${label}-${i}`,
    label,
    lab: { L: lab.L, a: lab.a + (i - 1) * 0.8, b: lab.b + (i - 1) * 0.4 },
    capturedAt: "2026-01-01T00:00:00.000Z",
    qualityStatus: "valid" as const,
  }))
}

function readyModel() {
  const pos = rgb8ToLab(CARD_SRGB.purple)
  const neg = rgb8ToLab(PALE)
  return deriveClassModel([...samplesAround(pos, "positive"), ...samplesAround(neg, "negative")])
}

describe("sRGB linearisation", () => {
  it("maps 0 and 255 to 0 and 1", () => {
    expect(srgb8ToLinear(0)).toBe(0)
    expect(srgb8ToLinear(255)).toBeCloseTo(1, 10)
  })

  it("uses the IEC toe, not gamma 2.2", () => {
    expect(srgb8ToLinear(128)).toBeCloseTo(0.21586, 4)
  })
})

describe("Lab / ΔE", () => {
  it("gives ΔE 0 for identical colours", () => {
    const lab = rgb8ToLab({ r: 112, g: 48, b: 160 })
    expect(deltaE76(lab, lab)).toBe(0)
  })

  it("puts middle gray near L* 54, a*~0, b*~0", () => {
    const lab = rgb8ToLab({ r: 128, g: 128, b: 128 })
    expect(lab.L).toBeGreaterThan(50)
    expect(lab.L).toBeLessThan(56)
    expect(Math.abs(lab.a)).toBeLessThan(1)
    expect(Math.abs(lab.b)).toBeLessThan(1)
  })
})

describe("HSV", () => {
  it("reads pure red near hue 0", () => {
    const hsv = rgb8ToHsv({ r: 255, g: 0, b: 0 })
    expect(hsv.h).toBeCloseTo(0, 5)
    expect(hsv.s).toBeCloseTo(1, 5)
  })
})

describe("CCM identity", () => {
  it("recovers the sRGB→XYZ map when the card is perfect", () => {
    const observed = Object.values(CARD_SRGB)
    const target = Object.values(intendedPatchXyz())
    const fit = fitCcm(observed, target)
    expect(fit).not.toBeNull()
    expect(fit!.residualRms).toBeLessThan(1e-6)
  })
})

describe("von Kries", () => {
  it("cancels a yellow illuminant on gray", () => {
    const grayTgt = rgb8ToLinear({ r: 128, g: 128, b: 128 })
    const grayObs = { r: grayTgt.r * 1.2, g: grayTgt.g * 1.0, b: grayTgt.b * 0.6 }
    const corrected = vonKries(grayObs, grayObs, grayTgt)
    expect(corrected.r).toBeCloseTo(grayTgt.r, 5)
    expect(corrected.g).toBeCloseTo(grayTgt.g, 5)
    expect(corrected.b).toBeCloseTo(grayTgt.b, 5)
  })
})

describe("classifyImage", () => {
  it("calls a purple kit positive when the card is in frame and the set is ready", () => {
    const out = classifyImage(syntheticFrame(CARD_SRGB.purple), { classModel: readyModel() })
    expect(out.result).toBe("positive")
    expect(out.status).toBe("valid")
    expect(out.qualityStatus).toBe("valid")
    expect(out.presumptive).toBe(true)
    expect(out.debug.method).toBe("ccm")
    expect(out).not.toHaveProperty("confidenceScore")
  })

  it("calls a pale kit negative", () => {
    const out = classifyImage(syntheticFrame(PALE), { classModel: readyModel() })
    expect(out.result).toBe("negative")
    expect(out.status).toBe("valid")
  })

  it("still names positive/negative under a simulated colour cast the card can correct", () => {
    const model = readyModel()
    const pos = classifyImage(applyRgbGain(syntheticFrame(CARD_SRGB.purple), 1.04, 0.96, 0.72), { classModel: model })
    const neg = classifyImage(applyRgbGain(syntheticFrame(PALE), 1.04, 0.96, 0.72), { classModel: model })
    expect(pos.qualityStatus).toBe("valid")
    expect(neg.qualityStatus).toBe("valid")
    expect(pos.result).toBe("positive")
    expect(neg.result).toBe("negative")
  })

  it("returns retake when a patch is heterogeneous", () => {
    const image = syntheticFrame(CARD_SRGB.purple)
    fillChecker(image, DEFAULT_LAYOUT.patches.yellow, CARD_SRGB.yellow, CARD_SRGB.red)
    const out = classifyImage(image, { classModel: readyModel() })
    expect(out.status).toBe("retake")
    expect(out.result).toBe("inconclusive")
    expect(out.debug.qualityFlags).toContain("patch_uneven")
  })

  it("returns retake when the overlay is blurred", () => {
    const out = classifyImage(boxBlur(syntheticFrame(CARD_SRGB.purple), 6), { classModel: readyModel() })
    expect(out.status).toBe("retake")
    expect(out.result).toBe("inconclusive")
    expect(out.debug.qualityFlags).toContain("kit_blur")
  })

  it("returns retake when card lightness order is inverted", () => {
    const patches = { ...CARD_SRGB, white: CARD_SRGB.black, black: CARD_SRGB.white }
    const out = classifyImage(syntheticFrame(CARD_SRGB.purple, patches), { classModel: readyModel() })
    expect(out.status).toBe("retake")
    expect(out.debug.qualityFlags).toContain("card_alignment")
  })

  it("returns retake when chromatic patches are not separated", () => {
    const gray = CARD_SRGB.gray
    const patches = { ...CARD_SRGB, red: gray, yellow: gray, purple: gray }
    const out = classifyImage(syntheticFrame(PALE, patches), { classModel: readyModel() })
    expect(out.status).toBe("retake")
    expect(out.debug.qualityFlags.some((f) => f === "card_missing" || f === "card_alignment")).toBe(true)
  })

  it("returns retake on kit clipping", () => {
    const out = classifyImage(syntheticFrame({ r: 255, g: 255, b: 255 }), { classModel: readyModel() })
    expect(out.status).toBe("retake")
    expect(out.debug.qualityFlags).toContain("clipping")
  })

  it("returns retake on kit glare", () => {
    const out = classifyImage(syntheticFrame({ r: 252, g: 252, b: 252 }), { classModel: readyModel() })
    expect(out.status).toBe("retake")
    expect(out.debug.qualityFlags).toContain("glare")
  })

  it("returns inconclusive when classes overlap", () => {
    const purple = rgb8ToLab(CARD_SRGB.purple)
    const model = {
      ready: true as const,
      positive: { center: purple, radius: 20, sampleCount: 3 },
      negative: { center: { ...purple, a: purple.a + 1.5 }, radius: 20, sampleCount: 3 },
      muddy: null,
    }
    const out = classifyImage(syntheticFrame(CARD_SRGB.purple), { classModel: model })
    expect(out.qualityStatus).toBe("valid")
    expect(out.status).toBe("inconclusive")
    expect(out.result).toBe("inconclusive")
    expect(out.debug.qualityFlags).toContain("classes_too_close")
  })

  it("returns inconclusive when the calibration set is incomplete", () => {
    const out = classifyImage(syntheticFrame(CARD_SRGB.purple))
    expect(out.qualityStatus).toBe("valid")
    expect(out.status).toBe("inconclusive")
    expect(out.result).toBe("inconclusive")
    expect(out.debug.qualityFlags).toContain("calibration_incomplete")
    expect(out.reasons.some((r) => r.includes("Calibration set incomplete"))).toBe(true)
  })

  it("does not treat a single sample as a class centre", () => {
    const oneEach = deriveClassModel([
      ...samplesAround(rgb8ToLab(CARD_SRGB.purple), "positive", 1),
      ...samplesAround(rgb8ToLab(PALE), "negative", 1),
    ])
    expect(oneEach.ready).toBe(false)
    const out = classifyImage(syntheticFrame(CARD_SRGB.purple), { classModel: oneEach })
    expect(out.result).toBe("inconclusive")
    expect(out.debug.qualityFlags).toContain("calibration_incomplete")
  })

  it("refuses when the card is missing (flat gray frame)", () => {
    const width = 80
    const height = 80
    const data = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 120
      data[i + 1] = 120
      data[i + 2] = 120
      data[i + 3] = 255
    }
    const out = classifyImage({ data, width, height }, { classModel: readyModel() })
    expect(out.status).toBe("retake")
    expect(out.result).toBe("inconclusive")
    expect(out.debug.qualityFlags).toContain("card_missing")
  })

  it("keeps default class centres in a usable ΔE range (documentation Labs only)", () => {
    const c = defaultClassLabs()
    expect(deltaE76(c.positive, c.negative)).toBeGreaterThan(20)
  })

  it("does not emit a numeric confidence percentage on the classify payload", () => {
    const out = classifyImage(syntheticFrame(CARD_SRGB.purple), { classModel: readyModel() })
    expect(JSON.stringify(out)).not.toMatch(/confidenceScore/)
  })
})
