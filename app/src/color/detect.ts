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

  const yellow = pickBiggest(blobs, (h) => h >= 40 && h < 80)
  if (!yellow) return null

  const grid = solveGrid(blobs, yellow)
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

/**
 * center(col,row) = origin + col*ex + row*ey.
 *
 * Robust reconstruction that survives lighting shifts: anchor on YELLOW (c1,r1)
 * and the card PURPLE (c2,r1) — the two hues the kit can never be confused with —
 * then derive the row axis. Any blob that is much larger than a card patch or far
 * from the card cluster (i.e. the coloured kit, which can drift into red/magenta
 * outdoors) is rejected as an anchor. RED, when it is a genuine card patch, only
 * refines the row vector; otherwise we assume a regular grid and rotate ex.
 */
function solveGrid(blobs: Blob[], yellow: Blob): { origin: Vec; ex: Vec; ey: Vec } | null {
  const near = (a: Blob | Vec, b: Blob | Vec) => Math.hypot(anyX(a) - anyX(b), anyY(a) - anyY(b))
  const sizeOk = (b: Blob) => b.area >= 0.22 * yellow.area && b.area <= 3.5 * yellow.area

  // card PURPLE (c2,r1): purple/violet hue, card-sized, closest to yellow (adjacent cell)
  const purple = blobs
    .filter((b) => b !== yellow && b.hue >= 255 && b.hue < 340 && sizeOk(b))
    .sort((a, b) => near(a, yellow) - near(b, yellow))[0]
  if (!purple) return null

  const ex: Vec = { x: purple.cx - yellow.cx, y: purple.cy - yellow.cy }
  const unit = Math.hypot(ex.x, ex.y)
  if (unit < 4) return null

  // card RED (c2,r0): red/pink, card-sized, closest to the purple directly below it
  const red = blobs
    .filter((b) => b !== yellow && b !== purple && (b.hue < 20 || b.hue >= 335) && sizeOk(b))
    .sort((a, b) => near(a, purple) - near(b, purple))[0]

  let ey: Vec | null = null
  if (red) {
    // red(c2,r0) sits one row above purple(c2,r1): ey ≈ purple − red
    const cand: Vec = { x: purple.cx - red.cx, y: purple.cy - red.cy }
    const mag = Math.hypot(cand.x, cand.y)
    const perp = Math.abs(cand.x * ex.x + cand.y * ex.y) < 0.5 * unit * mag
    if (mag > 0.5 * unit && mag < 2 * unit && perp) ey = cand
  }
  if (!ey) {
    // regular grid: row axis is ex rotated 90°; pick the sense pointing "down" the card
    const rotA: Vec = { x: -ex.y, y: ex.x }
    ey = rotA.y >= 0 ? rotA : { x: ex.y, y: -ex.x }
  }

  // origin = c0,r0; yellow is c1,r1
  const origin: Vec = { x: yellow.cx - ex.x - ey.x, y: yellow.cy - ex.y - ey.y }
  return { origin, ex, ey }
}

function anyX(p: Blob | Vec): number {
  return "cx" in p ? p.cx : p.x
}
function anyY(p: Blob | Vec): number {
  return "cy" in p ? p.cy : p.y
}

function findKit(
  blobs: Blob[],
  origin: Vec,
  ex: Vec,
  ey: Vec,
): { center: Vec; autoFound: boolean } {
  const topMid: Vec = { x: origin.x + ex.x, y: origin.y + ex.y } // c1,r0 (top-middle patch)
  const unit = Math.hypot(ex.x, ex.y)
  const eyLen = Math.hypot(ey.x, ey.y) || unit
  const uy: Vec = { x: -ey.x / eyLen, y: -ey.y / eyLen } // toward the kit (away from card body)
  const ux: Vec = { x: ex.x / unit, y: ex.y / unit }
  let best: Blob | null = null
  for (const b of blobs) {
    const dx = b.cx - topMid.x
    const dy = b.cy - topMid.y
    const along = dx * uy.x + dy * uy.y // distance out past the top row
    const perp = dx * ux.x + dy * ux.y // sideways offset
    if (along > 0.4 * unit && along < 6 * unit && Math.abs(perp) < 2 * unit) {
      if (!best || b.area > best.area) best = b
    }
  }
  if (best) return { center: { x: best.cx, y: best.cy }, autoFound: true }
  return {
    center: { x: topMid.x + 1.4 * uy.x * unit, y: topMid.y + 1.4 * uy.y * unit },
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

