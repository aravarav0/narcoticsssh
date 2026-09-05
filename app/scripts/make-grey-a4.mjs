/** A4 page filled with card gray RGB 128,128,128. Run: node scripts/make-grey-a4.mjs */
import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { deflateSync, crc32 } from "node:zlib"

const __dir = dirname(fileURLToPath(import.meta.url))
const root = join(__dir, "..", "..")

/** A4 at 150 dpi — enough for a flat colour, small enough to email. */
const W = 1240
const H = 1754
const R = 128
const G = 128
const B = 128

const rgba = Buffer.alloc(W * H * 4)
for (let i = 0; i < W * H; i++) {
  const o = i * 4
  rgba[o] = R
  rgba[o + 1] = G
  rgba[o + 2] = B
  rgba[o + 3] = 255
}

writeFileSync(join(root, "grey-a4.png"), png32(rgba, W, H))
console.log("wrote grey-a4.png", W, "x", H)

function png32(rgba, width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

function chunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0)
  return Buffer.concat([len, t, data, crc])
}
