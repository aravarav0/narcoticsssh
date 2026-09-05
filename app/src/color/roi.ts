import { CLIP_HI, CLIP_LO, THRESHOLDS } from "./constants"
import type { KitStats, Layout, PatchId, PatchStats, PixelBuffer, RectNorm, Rgb8, RoiStats } from "./types"

export function rectToPixels(rect: RectNorm, width: number, height: number) {
  const x0 = Math.max(0, Math.floor(rect.x * width))
  const y0 = Math.max(0, Math.floor(rect.y * height))
  const x1 = Math.min(width, Math.ceil((rect.x + rect.w) * width))
  const y1 = Math.min(height, Math.ceil((rect.y + rect.h) * height))
  return { x0, y0, x1, y1 }
}

export function unionRects(rects: RectNorm[]): RectNorm {
  let x0 = 1
  let y0 = 1
  let x1 = 0
  let y1 = 0
  for (const r of rects) {
    x0 = Math.min(x0, r.x)
    y0 = Math.min(y0, r.y)
    x1 = Math.max(x1, r.x + r.w)
    y1 = Math.max(y1, r.y + r.h)
  }
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
}

export function overlayBounds(layout: Layout): RectNorm {
  return unionRects([layout.kit, ...Object.values(layout.patches)])
}

export function sampleRect(image: PixelBuffer, rect: RectNorm): RoiStats {
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
  const laplacianVariance = laplacianVarianceOf(image, xa, ya, xb, yb)
  if (pixelCount === 0) {
    return {
      pixelCount: 0,
      meanRgb: { r: 0, g: 0, b: 0 },
      medianRgb: { r: 0, g: 0, b: 0 },
      robustRgb: { r: 0, g: 0, b: 0 },
      clipFraction: 1,
      glareFraction: 1,
      rgbStddev: 0,
      usableFraction: 0,
      laplacianVariance,
    }
  }

  const medianRgb = { r: median(rs), g: median(gs), b: median(bs) }
  const dists = rs.map((_, i) => l1(rs[i], gs[i], bs[i], medianRgb))
  const centreMad = median(dists)
  const gate = Math.max(THRESHOLDS.outlierAbsRgb, THRESHOLDS.outlierMadK * centreMad)
  const inR: number[] = []
  const inG: number[] = []
  const inB: number[] = []
  let usable = 0
  for (let i = 0; i < pixelCount; i++) {
    const clipped = isClipped(rs[i]) || isClipped(gs[i]) || isClipped(bs[i])
    const glared =
      rs[i] >= THRESHOLDS.glareChannel &&
      gs[i] >= THRESHOLDS.glareChannel &&
      bs[i] >= THRESHOLDS.glareChannel
    const inlier = dists[i] <= gate
    if (inlier && !clipped && !glared) {
      usable++
      inR.push(rs[i])
      inG.push(gs[i])
      inB.push(bs[i])
    }
  }

  const robustSrcR = inR.length ? inR : rs
  const robustSrcG = inG.length ? inG : gs
  const robustSrcB = inB.length ? inB : bs

  return {
    pixelCount,
    meanRgb: mean3(rs, gs, bs),
    medianRgb,
    robustRgb: { r: median(robustSrcR), g: median(robustSrcG), b: median(robustSrcB) },
    clipFraction: clip / pixelCount,
    glareFraction: glare / pixelCount,
    rgbStddev: (stddev(rs) + stddev(gs) + stddev(bs)) / 3,
    usableFraction: usable / pixelCount,
    laplacianVariance,
  }
}

export function samplePatch(image: PixelBuffer, id: PatchId, rect: RectNorm): PatchStats {
  return { id, ...sampleRect(image, rect) }
}

export function sampleKit(image: PixelBuffer, rect: RectNorm): KitStats {
  return sampleRect(image, rect)
}

function laplacianVarianceOf(
  image: PixelBuffer,
  xa: number,
  ya: number,
  xb: number,
  yb: number,
): number {
  const values: number[] = []
  const lum = (x: number, y: number) => {
    const i = (y * image.width + x) * 4
    return 0.2126 * image.data[i] + 0.7152 * image.data[i + 1] + 0.0722 * image.data[i + 2]
  }
  const xStart = xa + 1
  const yStart = ya + 1
  const xEnd = xb - 1
  const yEnd = yb - 1
  if (xEnd - xStart < 1 || yEnd - yStart < 1) return 0
  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const L = lum(x, y - 1) + lum(x - 1, y) + lum(x + 1, y) + lum(x, y + 1) - 4 * lum(x, y)
      values.push(L)
    }
  }
  return variance(values)
}

function isClipped(c: number): boolean {
  return c <= CLIP_LO || c >= CLIP_HI
}

function l1(r: number, g: number, b: number, med: Rgb8): number {
  return Math.abs(r - med.r) + Math.abs(g - med.g) + Math.abs(b - med.b)
}

function mean3(rs: number[], gs: number[], bs: number[]): Rgb8 {
  const n = rs.length
  let r = 0
  let g = 0
  let b = 0
  for (let i = 0; i < n; i++) {
    r += rs[i]
    g += gs[i]
    b += bs[i]
  }
  return { r: r / n, g: g / n, b: b / n }
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = values.slice().sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const m = values.reduce((s, v) => s + v, 0) / values.length
  let acc = 0
  for (const v of values) acc += (v - m) * (v - m)
  return Math.sqrt(acc / values.length)
}

function variance(values: number[]): number {
  if (values.length < 2) return 0
  const m = values.reduce((s, v) => s + v, 0) / values.length
  let acc = 0
  for (const v of values) acc += (v - m) * (v - m)
  return acc / values.length
}
