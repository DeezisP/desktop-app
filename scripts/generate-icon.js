/**
 * Generates resources/icon.png (512×512) and resources/icon.ico
 * using pure-JS libraries — no native binaries required.
 * Run: node scripts/generate-icon.js
 */
const fs   = require('fs')
const path = require('path')
const { PNG } = require('pngjs')

const OUT_DIR = path.join(__dirname, '..', 'resources')

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function createPNG(size) {
  const png = new PNG({ width: size, height: size, filterType: -1 })

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) * 4

      // Background: dark navy #0f172a  → rgb(15, 23, 42)
      let r = 15, g = 23, b = 42, a = 255

      // Rounded rectangle: 12% padding on each side
      const pad = Math.round(size * 0.12)
      const inRect =
        x >= pad && x < size - pad &&
        y >= pad && y < size - pad

      if (inRect) {
        // Blue card #2563eb → rgb(37, 99, 235)
        r = 37; g = 99; b = 235
      }

      // Draw a simple "W" shape in white inside the card
      const wLeft   = Math.round(size * 0.25)
      const wRight  = Math.round(size * 0.75)
      const wTop    = Math.round(size * 0.30)
      const wBottom = Math.round(size * 0.70)
      const wMid    = Math.round(size * 0.55)
      const wCenter = Math.round(size * 0.50)
      const stroke  = Math.max(2, Math.round(size * 0.06))

      // Left leg
      const leftLeg   = x >= wLeft && x < wLeft + stroke && y >= wTop && y <= wBottom
      // Right leg
      const rightLeg  = x >= wRight - stroke && x < wRight && y >= wTop && y <= wBottom
      // Left inner
      const leftInner = x >= wCenter - stroke && x < wCenter && y >= wMid && y <= wBottom
      // Right inner
      const rightInner = x >= wCenter && x < wCenter + stroke && y >= wMid && y <= wBottom
      // Bottom connector (V bottom)
      const connLeft  = y >= wBottom - stroke && y < wBottom + stroke
        && x >= wLeft && x < wCenter - stroke
        && y >= wTop + (wBottom - wTop) * (x - wLeft) / (wCenter - wLeft - stroke) - stroke / 2
      const connRight = y >= wBottom - stroke && y < wBottom + stroke
        && x >= wCenter + stroke && x < wRight
        && y >= wTop + (wBottom - wTop) * (wRight - x) / (wRight - wCenter - stroke) - stroke / 2

      if (inRect && (leftLeg || rightLeg || leftInner || rightInner || connLeft || connRight)) {
        r = 255; g = 255; b = 255
      }

      png.data[idx]     = r
      png.data[idx + 1] = g
      png.data[idx + 2] = b
      png.data[idx + 3] = a
    }
  }
  return png
}

function pngToBuffer(png) {
  return PNG.sync.write(png)
}

function buildIco(pngBuffer) {
  // ICO file with a single 256×256 PNG entry
  const HEADER_SIZE    = 6
  const ENTRY_SIZE     = 16
  const imageOffset    = HEADER_SIZE + ENTRY_SIZE
  const fileSize       = imageOffset + pngBuffer.length

  const buf = Buffer.alloc(fileSize)

  // ICONDIR header
  buf.writeUInt16LE(0,    0)  // Reserved
  buf.writeUInt16LE(1,    2)  // Type = ICO
  buf.writeUInt16LE(1,    4)  // Count = 1

  // ICONDIRENTRY
  buf.writeUInt8(0,       6)  // Width  (0 = 256)
  buf.writeUInt8(0,       7)  // Height (0 = 256)
  buf.writeUInt8(0,       8)  // Color count (0 = true color)
  buf.writeUInt8(0,       9)  // Reserved
  buf.writeUInt16LE(1,   10)  // Planes
  buf.writeUInt16LE(32,  12)  // Bit count
  buf.writeUInt32LE(pngBuffer.length, 14)  // Size of image data
  buf.writeUInt32LE(imageOffset,       18) // Offset to image data

  pngBuffer.copy(buf, imageOffset)
  return buf
}

async function main() {
  ensureDir(OUT_DIR)

  console.log('Generating 512×512 icon…')
  const png512 = createPNG(512)
  const buf512 = pngToBuffer(png512)
  fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), buf512)
  console.log('  → resources/icon.png')

  console.log('Building icon.ico (256×256 PNG frame)…')
  const png256 = createPNG(256)
  const buf256 = pngToBuffer(png256)
  const icoBuf = buildIco(buf256)
  fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), icoBuf)
  console.log('  → resources/icon.ico')

  console.log('Done.')
}

main().catch((e) => { console.error(e); process.exit(1) })
