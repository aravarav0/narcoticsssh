import { CLIP_HI, CLIP_LO, THRESHOLDS } from "./constants"
import type { KitStats, PatchId, PatchStats, PixelBuffer, RectNorm, Rgb8 } from "./types"

export function rectToPixels(rect: RectNorm, width: number, height: number) {
  const x0 = Math.max(0, Math.floor(rect.x * width))
  const y0 = Math.max(0, Math.floor(rect.y * height))
  const x1 = Math.min(width, Math.ceil((rect.x + rect.w) * width))
  const y1 = Math.min(height, Math.ceil((rect.y + rect.h) * height))
  return { x0, y0, x1, y1 }
}

export function sampleRect(image: PixelBuffer, rect: RectNorm): {
  pixelCount: number
  meanRgb: Rgb8
  medianRgb: Rgb8
  clipFraction: number
  glareFraction: number
  channelSpread: number
} {
  const { x0, y0, x1, y1 } = rectToPixels(rect, image.width, image.height)
  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []
  let clip = 0
  let glare = 0

  // Shrink 15% so the overlay border / fingers are less likely to leak in.
  const mx = Math.floor((x1 - x0) * 0.15)
  const my = Math.floor((y1 - y0) * 0.15)
  const xa = x0 + mx
  const xb = x1 - mx
  const ya = y0 + my
  const yb = y1 - my

  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      const i = (y * image.width + x) * 4
      const r = image.data[i]
      const g = image.data[i + 1]
      const b = image.data[i + 2]
      rs.push(r)
      gs.push(g)
      bs.push(b)
      if (isClipped(r) || isClipped(g) || isClipped(b)) clip++
      if (r >= THRESHOLDS.glareChannel && g >= THRESHOLDS.glareChannel && b >= THRESHOLDS.glareChannel) glare++
    }
  }

  const pixelCount = rs.length
  if (pixelCount === 0) {
    return {
      pixelCount: 0,
      meanRgb: { r: 0, g: 0, b: 0 },
      medianRgb: { r: 0, g: 0, b: 0 },
      clipFraction: 1,
      glareFraction: 1,
      channelSpread: 255,
    }
  }

  return {
    pixelCount,
    meanRgb: mean3(rs, gs, bs),
    medianRgb: { r: median(rs), g: median(gs), b: median(bs) },
    clipFraction: clip / pixelCount,
    glareFraction: glare / pixelCount,
    channelSpread: Math.max(percentile(rs, 0.9) - percentile(rs, 0.1), percentile(gs, 0.9) - percentile(gs, 0.1), percentile(bs, 0.9) - percentile(bs, 0.1)),
  }
}

export function samplePatch(image: PixelBuffer, id: PatchId, rect: RectNorm): PatchStats {
  return { id, ...sampleRect(image, rect) }
}

export function sampleKit(image: PixelBuffer, rect: RectNorm): KitStats {
  return sampleRect(image, rect)
}

function isClipped(c: number): boolean {
  return c <= CLIP_LO || c >= CLIP_HI
}

function mean3(rs: number[], gs: number[], bs: number[]): Rgb8 {
  const n = rs.length
  let r = 0,
    g = 0,
    b = 0
  for (let i = 0; i < n; i++) {
    r += rs[i]
    g += gs[i]
    b += bs[i]
  }
  return { r: r / n, g: g / n, b: b / n }
}

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function percentile(values: number[], q: number): number {
  const s = values.slice().sort((a, b) => a - b)
  if (s.length === 0) return 0
  const pos = (s.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return s[lo] + (s[hi] - s[lo]) * (pos - lo)
}
