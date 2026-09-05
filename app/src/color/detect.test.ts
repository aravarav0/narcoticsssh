import { describe, expect, it } from "vitest"
import { CARD_SRGB } from "./card"
import { classifyImage } from "./classify"
import { DEFAULT_LAYOUT } from "./constants"
import { detectCard } from "./detect"
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

/** A card laid out at the default positions, but with a kit we place ourselves. */
function frameWithCardAt(
  kit: Rgb8,
  shift: { dx: number; dy: number } = { dx: 0, dy: 0 },
): PixelBuffer {
  const width = 300
  const height = 400
  const data = new Uint8ClampedArray(width * height * 4)
  data.fill(30)
  for (let i = 3; i < data.length; i += 4) data[i] = 255
  const image: PixelBuffer = { data, width, height }
  const move = (r: RectNorm): RectNorm => ({ x: r.x + shift.dx, y: r.y + shift.dy, w: r.w, h: r.h })
  fillRect(image, move(DEFAULT_LAYOUT.kit), kit)
  for (const id of Object.keys(DEFAULT_LAYOUT.patches) as (keyof typeof DEFAULT_LAYOUT.patches)[]) {
    fillRect(image, move(DEFAULT_LAYOUT.patches[id]), CARD_SRGB[id])
  }
  return image
}

describe("card auto-detection", () => {
  it("finds the card and reconstructs all six squares near the truth", () => {
    const det = detectCard(frameWithCardAt({ r: 198, g: 130, b: 176 }))
    expect(det).not.toBeNull()
    const p = det!.layout.patches
    // red should be top-right, black bottom-left, roughly at the default cells
    expect(p.red.x).toBeGreaterThan(0.55)
    expect(p.red.y).toBeLessThan(0.55)
    expect(p.black.x).toBeLessThan(0.4)
    expect(p.black.y).toBeGreaterThan(0.55)
  })

  it("auto-detects a coloured kit above the card", () => {
    const det = detectCard(frameWithCardAt({ r: 198, g: 130, b: 176 }))
    expect(det?.kitAutoFound).toBe(true)
    expect(det!.layout.kit.y).toBeLessThan(0.45)
  })

  it("classifies a purple kit positive using the detected layout", () => {
    const image = frameWithCardAt({ r: 198, g: 130, b: 176 })
    const det = detectCard(image)
    const out = classifyImage(image, { layout: det!.layout })
    expect(out.result).toBe("positive")
    expect(out.debug.kitColour.vsExpected).toBe("positive")
  })

  it("still works when the whole card is shifted off-centre", () => {
    const image = frameWithCardAt({ r: 198, g: 130, b: 176 }, { dx: -0.12, dy: -0.04 })
    const det = detectCard(image)
    expect(det).not.toBeNull()
    const out = classifyImage(image, { layout: det!.layout })
    expect(out.result).toBe("positive")
  })

  it("returns null when there is no card (blank frame)", () => {
    const width = 120
    const height = 160
    const data = new Uint8ClampedArray(width * height * 4)
    data.fill(200)
    for (let i = 3; i < data.length; i += 4) data[i] = 255
    expect(detectCard({ data, width, height })).toBeNull()
  })
})
