/** Writes PNG demo frames. Run: node scripts/make-demo-frames.mjs */
import { writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { deflateSync, crc32 } from "node:zlib"

const __dir = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dir, "..", "public")
mkdirSync(outDir, { recursive: true })

const W = 360
const H = 480
const CARD = {
  white: [250, 250, 252],
  gray: [214, 211, 218],
  red: [249, 113, 86],
  black: [92, 90, 93],
  yellow: [247, 243, 91],
  purple: [209, 163, 211],
}
const MAGENTA = [198, 130, 176]
const WHITE_KIT = [239, 249, 247]
const LAYOUT = {
  kit: [0.36, 0.08, 0.28, 0.34],
  white: [0.06, 0.5, 0.28, 0.2],
  gray: [0.36, 0.5, 0.28, 0.2],
  red: [0.66, 0.5, 0.28, 0.2],
  black: [0.06, 0.74, 0.28, 0.2],
  yellow: [0.36, 0.74, 0.28, 0.2],
  purple: [0.66, 0.74, 0.28, 0.2],
}

function raster(kit) {
  const px = Buffer.alloc(W * H * 4)
  px.fill(36)
  for (let i = 3; i < px.length; i += 4) px[i] = 255
  const fill = (rect, rgb) => {
    const [x, y, w, h] = rect
    const x0 = Math.floor(x * W)
    const y0 = Math.floor(y * H)
    const x1 = Math.ceil((x + w) * W)
    const y1 = Math.ceil((y + h) * H)
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = (yy * W + xx) * 4
        px[i] = rgb[0]
        px[i + 1] = rgb[1]
        px[i + 2] = rgb[2]
        px[i + 3] = 255
      }
    }
  }
  fill(LAYOUT.kit, kit)
  for (const id of Object.keys(CARD)) fill(LAYOUT[id], CARD[id])
  return png32(px, W, H)
}

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
  const chunks = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]
  return Buffer.concat(chunks)
}

function chunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0)
  return Buffer.concat([len, t, data, crc])
}

writeFileSync(join(outDir, "demo-positive.png"), raster(MAGENTA))
writeFileSync(join(outDir, "demo-negative.png"), raster(WHITE_KIT))
writeFileSync(join(outDir, "demo-black.png"), raster(CARD.black))
console.log("wrote public/demo-positive.png, demo-negative.png, demo-black.png")
