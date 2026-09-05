import { linearToXyz, rgb8ToLinear } from "./srgb"
import type { Rgb8, RgbLin, Xyz } from "./types"
import { CARD_SRGB } from "./card"

export type Mat3 = [[number, number, number], [number, number, number], [number, number, number]]

/** Diagonal von Kries in linear RGB, using the gray patch as the illuminant estimate. */
export function vonKries(sample: RgbLin, grayObserved: RgbLin, grayTarget: RgbLin): RgbLin {
  return {
    r: sample.r * safeGain(grayTarget.r, grayObserved.r),
    g: sample.g * safeGain(grayTarget.g, grayObserved.g),
    b: sample.b * safeGain(grayTarget.b, grayObserved.b),
  }
}

function safeGain(target: number, observed: number): number {
  if (observed < 1e-5) return 1
  return target / observed
}

/**
 * Row-vector CCM: [R G B] * M = [X Y Z] in linear RGB.
 * M is 3×3 from least squares on the six card patches vs their intended XYZ.
 * Returns null if AᵀA is near-singular (card not really in frame / all patches similar).
 */
export function fitCcm(observedRgb: Rgb8[], targetXyz: Xyz[]): { M: Mat3; residualRms: number } | null {
  if (observedRgb.length < 3 || observedRgb.length !== targetXyz.length) return null
  const A: number[][] = observedRgb.map((rgb) => {
    const lin = rgb8ToLinear(rgb)
    return [lin.r, lin.g, lin.b]
  })
  const B: number[][] = targetXyz.map((xyz) => [xyz.x, xyz.y, xyz.z])
  const AtA = mul(transpose(A), A)
  const AtB = mul(transpose(A), B)
  const inv = invert3(AtA)
  if (!inv) return null
  const M = mul(inv, AtB) as Mat3

  let err = 0
  for (let i = 0; i < A.length; i++) {
    const pred = [dot(A[i], col(M, 0)), dot(A[i], col(M, 1)), dot(A[i], col(M, 2))]
    for (let k = 0; k < 3; k++) err += (pred[k] - B[i][k]) ** 2
  }
  return { M, residualRms: Math.sqrt(err / (A.length * 3)) }
}

export function applyCcm(lin: RgbLin, M: Mat3): Xyz {
  const row = [lin.r, lin.g, lin.b]
  return {
    x: dot(row, col(M, 0)),
    y: dot(row, col(M, 1)),
    z: dot(row, col(M, 2)),
  }
}

export function intendedPatchXyz(): Record<keyof typeof CARD_SRGB, Xyz> {
  const out = {} as Record<keyof typeof CARD_SRGB, Xyz>
  for (const id of Object.keys(CARD_SRGB) as (keyof typeof CARD_SRGB)[]) {
    out[id] = linearToXyz(rgb8ToLinear(CARD_SRGB[id]))
  }
  return out
}

function col(M: Mat3, j: number): [number, number, number] {
  return [M[0][j], M[1][j], M[2][j]]
}

function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function transpose(A: number[][]): number[][] {
  const cols = A[0].length
  const T: number[][] = Array.from({ length: cols }, () => Array(A.length).fill(0))
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < cols; j++) T[j][i] = A[i][j]
  }
  return T
}

function mul(A: number[][], B: number[][]): number[][] {
  const out: number[][] = Array.from({ length: A.length }, () => Array(B[0].length).fill(0))
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < B[0].length; j++) {
      let s = 0
      for (let k = 0; k < B.length; k++) s += A[i][k] * B[k][j]
      out[i][j] = s
    }
  }
  return out
}

function invert3(m: number[][]): Mat3 | null {
  const a = m[0][0],
    b = m[0][1],
    c = m[0][2]
  const d = m[1][0],
    e = m[1][1],
    f = m[1][2]
  const g = m[2][0],
    h = m[2][1],
    i = m[2][2]
  const A = e * i - f * h
  const B = f * g - d * i
  const C = d * h - e * g
  const det = a * A + b * B + c * C
  if (Math.abs(det) < 1e-10) return null
  const invDet = 1 / det
  return [
    [A * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet],
    [B * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet],
    [C * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet],
  ]
}
