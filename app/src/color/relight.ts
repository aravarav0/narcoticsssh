import type { Mat3 } from "./ccm"
import { linearToSrgb8, srgb8ToLinear, XYZ_TO_SRGB } from "./srgb"

/**
 * Re-light a whole frame with the SAME colour-correction matrix the classifier
 * used on the kit: sRGB → linear → (CCM) → XYZ → linear sRGB → sRGB. The card
 * squares are what pinned the matrix, so after this the card lands on its
 * reference colours and the rest of the frame is dragged into the same,
 * lighting-neutral space. This is the visual proof of the correction.
 *
 * Runs on a downscaled copy (maxSide) for speed and returns a JPEG data URL.
 */
export function relightCanvas(src: HTMLCanvasElement, M: Mat3, maxSide = 760): string | null {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height))
  const w = Math.max(2, Math.round(src.width * scale))
  const h = Math.max(2, Math.round(src.height * scale))
  const dst = document.createElement("canvas")
  dst.width = w
  dst.height = h
  const ctx = dst.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(src, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const data = img.data

  // sRGB8 → linear lookup (256 entries) keeps the per-pixel cost to matrix mults.
  const lin = new Float64Array(256)
  for (let i = 0; i < 256; i++) lin[i] = srgb8ToLinear(i)

  const x = XYZ_TO_SRGB
  for (let p = 0; p < data.length; p += 4) {
    const lr = lin[data[p]]
    const lg = lin[data[p + 1]]
    const lb = lin[data[p + 2]]
    // linear RGB (row vector) * M -> XYZ
    const X = lr * M[0][0] + lg * M[1][0] + lb * M[2][0]
    const Y = lr * M[0][1] + lg * M[1][1] + lb * M[2][1]
    const Z = lr * M[0][2] + lg * M[1][2] + lb * M[2][2]
    // XYZ -> linear sRGB
    const rr = x[0][0] * X + x[0][1] * Y + x[0][2] * Z
    const gg = x[1][0] * X + x[1][1] * Y + x[1][2] * Z
    const bb = x[2][0] * X + x[2][1] * Y + x[2][2] * Z
    data[p] = linearToSrgb8(rr)
    data[p + 1] = linearToSrgb8(gg)
    data[p + 2] = linearToSrgb8(bb)
  }
  ctx.putImageData(img, 0, 0)
  return dst.toDataURL("image/jpeg", 0.9)
}
