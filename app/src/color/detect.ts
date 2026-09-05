import type { Layout, PatchId, PixelBuffer, RectNorm } from "./types"

/**
 * Auto-locate the six-square card and the kit square in a photo, with no
 * fixed overlay. The card layout is fixed (2×3), so we:
 *   1. find the always-saturated squares (red, yellow, and card purple),
 *   2. reconstruct the full grid geometrically from those anchors,
 *   3. place the kit box above the card (a coloured kit is found directly; an
 *      unused/white kit falls back to a box over the paper, which reads white).
 *
 * This runs on a small downsampled copy so the connected-components pass is
 * cheap, then returns everything in normalised (0–1) coordinates.
 */

type Vec = { x: number; y: number }

/** grid cell (col, row): col 0..2 left→right, row 0..1 top→bottom. */
const CELL: Record<PatchId, [number, number]> = {
  white: [0, 0],
  gray: [1, 0],
  red: [2, 0],
  black: [0, 1],
  yellow: [1, 1],
  purple: [2, 1],
}

type Blob = {
  cx: number
  cy: number
  area: number
  hue: number
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function detectCard(image: PixelBuffer): { layout: Layout; kitAutoFound: boolean } | null {
  const sw = Math.min(image.width, 360)
  const scale = sw / image.width
  const sh = Math.max(2, Math.round(image.height * scale))
  const n = sw * sh

  const sat = new Float32Array(n)
  const val = new Float32Array(n)
  const hueRad = new Float32Array(n)
  const mask = new Uint8Array(n)

  for (let sy = 0; sy < sh; sy++) {
    const srcY = Math.min(image.height - 1, Math.floor(sy / scale))
    for (let sx = 0; sx < sw; sx++) {
      const srcX = Math.min(image.width - 1, Math.floor(sx / scale))
      const si = (srcY * image.width + srcX) * 4
      const r = image.data[si]
      const g = image.data[si + 1]
      const b = image.data[si + 2]
      const mx = Math.max(r, g, b)
      const mn = Math.min(r, g, b)
      const i = sy * sw + sx
      val[i] = mx / 255
      sat[i] = mx > 0 ? (mx - mn) / mx : 0
      hueRad[i] = hueRadOf(r, g, b, mx, mn)
      mask[i] = sat[i] > 0.22 && val[i] > 0.22 && val[i] < 0.99 ? 1 : 0
    }
  }

  const blobs = components(mask, hueRad, sw, sh)
  if (blobs.length === 0) return null

  const red = pickBiggest(blobs, (h) => h < 20 || h >= 335)
  const yellow = pickBiggest(blobs, (h) => h >= 40 && h < 80)
  const purples = blobs.filter((b) => b.hue >= 255 && b.hue < 330).sort((a, b) => b.area - a.area)
  if (!red || !yellow) return null

  const grid = solveGrid(red, yellow, purples)
  if (!grid) return null
  const { origin, ex, ey } = grid
  const unit = Math.hypot(ex.x, ex.y)
  if (unit < 4) return null
  const half = 0.3 * unit

  const patches = {} as Record<PatchId, RectNorm>
  for (const id of Object.keys(CELL) as PatchId[]) {
    const [c, r] = CELL[id]
    const cx = origin.x + c * ex.x + r * ey.x
    const cy = origin.y + c * ex.y + r * ey.y
    patches[id] = boxNorm(cx, cy, half, sw, sh)
  }

  const kit = findKit(blobs, origin, ex, ey)
  const kitRect = boxNorm(kit.center.x, kit.center.y, half, sw, sh)

  return { layout: { kit: kitRect, patches }, kitAutoFound: kit.autoFound }
}

function hueRadOf(r: number, g: number, b: number, mx: number, mn: number): number {
  const d = mx - mn
  if (d < 1e-6) return 0
  let h: number
  if (mx === r) h = ((g - b) / d) % 6
  else if (mx === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return (h * 60 * Math.PI) / 180
}

function components(mask: Uint8Array, hueRad: Float32Array, w: number, h: number): Blob[] {
  const labels = new Int32Array(w * h)
  const stack = new Int32Array(w * h)
  const area = w * h
  const out: Blob[] = []
  let label = 0
  for (let start = 0; start < area; start++) {
    if (!mask[start] || labels[start]) continue
    label++
    let sp = 0
    stack[sp++] = start
    labels[start] = label
    let count = 0
    let sumX = 0
    let sumY = 0
    let sumSin = 0
    let sumCos = 0
    let minX = w
    let minY = h
    let maxX = 0
    let maxY = 0
    while (sp > 0) {
      const p = stack[--sp]
      const px = p % w
      const py = (p / w) | 0
      count++
      sumX += px
      sumY += py
      sumSin += Math.sin(hueRad[p])
      sumCos += Math.cos(hueRad[p])
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (py < minY) minY = py
      if (py > maxY) maxY = py
      if (px > 0 && mask[p - 1] && !labels[p - 1]) (labels[p - 1] = label), (stack[sp++] = p - 1)
      if (px < w - 1 && mask[p + 1] && !labels[p + 1]) (labels[p + 1] = label), (stack[sp++] = p + 1)
      if (py > 0 && mask[p - w] && !labels[p - w]) (labels[p - w] = label), (stack[sp++] = p - w)
      if (py < h - 1 && mask[p + w] && !labels[p + w]) (labels[p + w] = label), (stack[sp++] = p + w)
    }
    if (count < 0.0009 * area || count > 0.2 * area) continue
    const bw = maxX - minX + 1
    const bh = maxY - minY + 1
    const fill = count / (bw * bh)
    const ar = bw / bh
    if (fill < 0.55 || ar < 0.5 || ar > 2.0) continue
    let hueDeg = (Math.atan2(sumSin, sumCos) * 180) / Math.PI
    if (hueDeg < 0) hueDeg += 360
    out.push({ cx: sumX / count, cy: sumY / count, area: count, hue: hueDeg, minX, minY, maxX, maxY })
  }
  return out
}

function pickBiggest(blobs: Blob[], hueTest: (h: number) => boolean): Blob | null {
  let best: Blob | null = null
  for (const b of blobs) {
    if (hueTest(b.hue) && (!best || b.area > best.area)) best = b
  }
  return best
}

/** center(col,row) = origin + col*ex + row*ey. */
function solveGrid(red: Blob, yellow: Blob, purples: Blob[]): { origin: Vec; ex: Vec; ey: Vec } | null {
  const anchors: { c: number; r: number; x: number; y: number }[] = [
    { c: 2, r: 0, x: red.cx, y: red.cy },
    { c: 1, r: 1, x: yellow.cx, y: yellow.cy },
  ]
  if (purples.length) {
    const cardPurple = purples.reduce((a, b) => (a.cx + a.cy >= b.cx + b.cy ? a : b))
    anchors.push({ c: 2, r: 1, x: cardPurple.cx, y: cardPurple.cy })
  }

  if (anchors.length >= 3) {
    const rows = anchors.slice(0, 3).map((a) => [a.c, a.r, 1])
    const inv = invert3(rows)
    if (!inv) return null
    const bx = anchors.slice(0, 3).map((a) => a.x)
    const by = anchors.slice(0, 3).map((a) => a.y)
    const px = matVec(inv, bx)
    const py = matVec(inv, by)
    return {
      ex: { x: px[0], y: py[0] },
      ey: { x: px[1], y: py[1] },
      origin: { x: px[2], y: py[2] },
    }
  }

  // axis-aligned two-anchor fallback (red col2/row0, yellow col1/row1)
  const ex: Vec = { x: red.cx - yellow.cx, y: 0 }
  const ey: Vec = { x: 0, y: yellow.cy - red.cy }
  const origin: Vec = { x: yellow.cx - ex.x, y: red.cy }
  if (Math.abs(ex.x) < 4 || Math.abs(ey.y) < 4) return null
  return { origin, ex, ey }
}

function findKit(
  blobs: Blob[],
  origin: Vec,
  ex: Vec,
  ey: Vec,
): { center: Vec; autoFound: boolean } {
  const topMid: Vec = { x: origin.x + ex.x, y: origin.y + ex.y }
  const unit = Math.hypot(ex.x, ex.y)
  let best: Blob | null = null
  for (const b of blobs) {
    const dx = Math.abs(b.cx - topMid.x)
    const dy = topMid.y - b.cy
    if (dy > 0.4 * unit && dy < 6 * unit && dx < 2 * unit) {
      if (!best || b.area > best.area) best = b
    }
  }
  if (best) return { center: { x: best.cx, y: best.cy }, autoFound: true }
  return {
    center: { x: origin.x + ex.x - 1.4 * ey.x, y: origin.y + ex.y - 1.4 * ey.y },
    autoFound: false,
  }
}

function boxNorm(cx: number, cy: number, half: number, w: number, h: number): RectNorm {
  const x = clamp01((cx - half) / w)
  const y = clamp01((cy - half) / h)
  const rx = clamp01((cx + half) / w)
  const ry = clamp01((cy + half) / h)
  return { x, y, w: Math.max(0.01, rx - x), h: Math.max(0.01, ry - y) }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function matVec(m: number[][], v: number[]): number[] {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ]
}

function invert3(m: number[][]): number[][] | null {
  const [a, b, c] = m[0]
  const [d, e, f] = m[1]
  const [g, h, i] = m[2]
  const A = e * i - f * h
  const B = f * g - d * i
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  if (Math.abs(det) < 1e-9) return null
  const inv = 1 / det
  return [
    [A * inv, (c * h - b * i) * inv, (b * f - c * e) * inv],
    [B * inv, (a * i - c * g) * inv, (c * d - a * f) * inv],
    [C * inv, (b * g - a * h) * inv, (a * e - b * d) * inv],
  ]
}
