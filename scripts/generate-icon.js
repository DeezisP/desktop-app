/**
 * Generates resources/icon.ico from resources/perfect-logo.png (or a fallback).
 * Embeds the source PNG as-is inside a minimal ICO container.
 * Run: node scripts/generate-icon.js
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PNG } from 'pngjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const OUT_DIR  = path.join(__dirname, '..', 'resources')
const LOGO_SRC = path.join(OUT_DIR, 'perfect-logo.png')

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function createFallbackPNG(size) {
  const png = new PNG({ width: size, height: size, filterType: -1 })
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) * 4
      png.data[idx]     = 15
      png.data[idx + 1] = 23
      png.data[idx + 2] = 42
      png.data[idx + 3] = 255
    }
  }
  return PNG.sync.write(png)
}

function buildIco(pngBuffer) {
  const HEADER_SIZE   = 6
  const ENTRY_SIZE    = 16
  const imageOffset   = HEADER_SIZE + ENTRY_SIZE
  const buf = Buffer.alloc(imageOffset + pngBuffer.length)

  // ICONDIR
  buf.writeUInt16LE(0,   0)  // Reserved
  buf.writeUInt16LE(1,   2)  // Type = ICO
  buf.writeUInt16LE(1,   4)  // Count = 1

  // ICONDIRENTRY
  buf.writeUInt8(0,      6)  // Width  (0 = 256)
  buf.writeUInt8(0,      7)  // Height (0 = 256)
  buf.writeUInt8(0,      8)  // Color count
  buf.writeUInt8(0,      9)  // Reserved
  buf.writeUInt16LE(1,  10)  // Planes
  buf.writeUInt16LE(32, 12)  // Bit count
  buf.writeUInt32LE(pngBuffer.length,  14)
  buf.writeUInt32LE(imageOffset,        18)

  pngBuffer.copy(buf, imageOffset)
  return buf
}

function resizePNG(srcBuffer, targetSize) {
  const src = PNG.sync.read(srcBuffer)
  if (src.width === targetSize && src.height === targetSize) {
    return srcBuffer  // already the right size
  }

  const dst = new PNG({ width: targetSize, height: targetSize, filterType: -1 })
  const scaleX = src.width  / targetSize
  const scaleY = src.height / targetSize

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const srcX = Math.min(Math.floor(x * scaleX), src.width  - 1)
      const srcY = Math.min(Math.floor(y * scaleY), src.height - 1)
      const si   = (src.width * srcY + srcX) * 4
      const di   = (targetSize * y + x) * 4
      dst.data[di]     = src.data[si]
      dst.data[di + 1] = src.data[si + 1]
      dst.data[di + 2] = src.data[si + 2]
      dst.data[di + 3] = src.data[si + 3]
    }
  }
  return PNG.sync.write(dst)
}

async function main() {
  ensureDir(OUT_DIR)

  let src512
  if (fs.existsSync(LOGO_SRC)) {
    console.log('Using source logo:', LOGO_SRC)
    src512 = fs.readFileSync(LOGO_SRC)
  } else {
    console.log('Logo not found — generating placeholder')
    src512 = createFallbackPNG(512)
    fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), src512)
  }

  // For ICO: embed a 256×256 version of the logo
  const png256 = resizePNG(src512, 256)
  const icoBuf = buildIco(png256)
  fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), icoBuf)
  console.log('  → resources/icon.ico (256×256 from perfect-logo.png)')
  console.log('Done.')
}

main().catch((e) => { console.error(e); process.exit(1) })
