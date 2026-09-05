import { describe, expect, it } from "vitest"
import { CARD_SRGB, defaultClassLabs } from "./card"
import { classifyImage } from "./classify"
import { DEFAULT_LAYOUT } from "./constants"
import { rgb8ToHsv } from "./hsv"
import { deltaE76, rgb8ToLab, srgb8ToLinear } from "./srgb"
import { fitCcm, intendedPatchXyz, vonKries } from "./ccm"
import { rgb8ToLinear } from "./srgb"
import type { PixelBuffer, RectNorm, Rgb8 } from "./types"

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
  it("calls a purple kit positive when the card is in frame", () => {
    const out = classifyImage(syntheticFrame(CARD_SRGB.purple))
    expect(out.result).toBe("positive")
    expect(out.presumptive).toBe(true)
    expect(out.debug.method).toBe("ccm")
  })

  it("calls a pale kit negative", () => {
    const pale = { r: 230, g: 228, b: 220 }
    const out = classifyImage(syntheticFrame(pale))
    expect(out.result).toBe("negative")
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
    const out = classifyImage({ data, width, height })
    expect(out.result).toBe("inconclusive")
    expect(out.debug.qualityFlags).toContain("card_missing")
  })

  it("keeps default class centres in a usable ΔE range", () => {
    const c = defaultClassLabs()
    expect(deltaE76(c.positive, c.negative)).toBeGreaterThan(20)
  })
})
