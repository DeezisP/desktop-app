/**
 * generate-icon.js
 *
 * Produces resources/icon.ico from resources/perfect-logo.png.
 *
 * The ICO contains all standard Windows icon sizes:
 *   16 × 16   — title bars, small file icons
 *   24 × 24   — toolbars
 *   32 × 32   — desktop, shell (standard)
 *   48 × 48   — desktop (large icons), Windows Explorer
 *   64 × 64   — taskbar, high-DPI 32 px equivalent
 *  128 × 128  — tile previews
 *  256 × 256  — high-DPI desktops, installer
 *
 * Each frame is embedded as a PNG inside the ICO container (supported since
 * Windows Vista).  Full RGBA transparency is preserved in every frame.
 * Alpha-premultiplied area sampling is used so downscaling does not bleed
 * opaque colour into transparent regions.
 *
 * Run:  node scripts/generate-icon.js
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const RESOURCES = path.join(__dirname, '..', 'resources')
const LOGO_SRC  = path.join(RESOURCES, 'perfect-logo.png')
const ICO_OUT   = path.join(RESOURCES, 'icon.ico')

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

// ── Resampling ────────────────────────────────────────────────────────────────
// Alpha-premultiplied weighted area sampling.
// Plain box averaging spreads colour from opaque pixels into transparent
// neighbours ("dark fringe"). Premultiplying before averaging prevents this.

function resizeArea(src, tw, th) {
  const dst    = new PNG({ width: tw, height: th, filterType: -1 })
  const scaleX = src.width  / tw
  const scaleY = src.height / th

  for (let dy = 0; dy < th; dy++) {
    const sy0 = dy       * scaleY
    const sy1 = (dy + 1) * scaleY

    for (let dx = 0; dx < tw; dx++) {
      const sx0 = dx       * scaleX
      const sx1 = (dx + 1) * scaleX

      let pR = 0, pG = 0, pB = 0, pA = 0, totalW = 0

      for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) {
        for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
          // Coverage weight — partial pixels at edges get fractional weight
          const wx = Math.min(sx + 1, sx1) - Math.max(sx, sx0)
          const wy = Math.min(sy + 1, sy1) - Math.max(sy, sy0)
          const w  = wx * wy

          const row = Math.min(sy, src.height - 1)
          const col = Math.min(sx, src.width  - 1)
          const si  = (row * src.width + col) * 4

          const a = src.data[si + 3] / 255   // normalised alpha

          // Accumulate premultiplied values
          pR += src.data[si]     * a * w
          pG += src.data[si + 1] * a * w
          pB += src.data[si + 2] * a * w
          pA += src.data[si + 3]     * w
          totalW += w
        }
      }

      const di      = (dy * tw + dx) * 4
      const avgA    = pA / totalW
      const normA   = avgA / 255

      dst.data[di + 3] = Math.round(avgA)

      if (normA > 0) {
        // De-premultiply
        dst.data[di]     = Math.min(255, Math.round(pR / totalW / normA))
        dst.data[di + 1] = Math.min(255, Math.round(pG / totalW / normA))
        dst.data[di + 2] = Math.min(255, Math.round(pB / totalW / normA))
      } else {
        dst.data[di]     = 0
        dst.data[di + 1] = 0
        dst.data[di + 2] = 0
      }
    }
  }

  return dst
}

// ── ICO builder ───────────────────────────────────────────────────────────────
// Layout:
//   ICONDIR         6 bytes
//   ICONDIRENTRY[]  n × 16 bytes
//   <PNG frame 0>
//   <PNG frame 1>
//   …

function buildIco(frames) {
  const n        = frames.length
  const dirBytes = 6 + n * 16
  const total    = dirBytes + frames.reduce((s, f) => s + f.length, 0)
  const buf      = Buffer.alloc(total)

  // ICONDIR
  buf.writeUInt16LE(0, 0)   // reserved
  buf.writeUInt16LE(1, 2)   // type = ICO (1)
  buf.writeUInt16LE(n, 4)   // image count

  let offset = dirBytes

  frames.forEach((png, i) => {
    // Read dimensions from the embedded PNG IHDR
    const w = (png.readUInt32BE(16) >= 256) ? 0 : png.readUInt32BE(16)
    const h = (png.readUInt32BE(20) >= 256) ? 0 : png.readUInt32BE(20)

    const base = 6 + i * 16
    buf.writeUInt8(w,   base)      // width  (0 = 256)
    buf.writeUInt8(h,   base + 1)  // height (0 = 256)
    buf.writeUInt8(0,   base + 2)  // colour count (0 = true colour)
    buf.writeUInt8(0,   base + 3)  // reserved
    buf.writeUInt16LE(1,  base + 4)  // planes
    buf.writeUInt16LE(32, base + 6)  // bits per pixel (32 = RGBA)
    buf.writeUInt32LE(png.length, base + 8)   // image data byte count
    buf.writeUInt32LE(offset,     base + 12)  // image data offset

    png.copy(buf, offset)
    offset += png.length
  })

  return buf
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(RESOURCES)) fs.mkdirSync(RESOURCES, { recursive: true })

  if (!fs.existsSync(LOGO_SRC)) {
    console.error('ERROR: source logo not found:', LOGO_SRC)
    console.error('Copy the app logo to resources/perfect-logo.png (512×512 RGBA PNG) and re-run.')
    process.exit(1)
  }

  const srcBuf = fs.readFileSync(LOGO_SRC)
  const src    = PNG.sync.read(srcBuf)

  console.log(`Source: ${LOGO_SRC}`)
  console.log(`  ${src.width}×${src.height}  colour_type=RGBA`)

  if (src.width < 256 || src.height < 256) {
    console.warn('  WARNING: source image smaller than 256×256 — icon quality will be reduced')
  }

  // Generate one PNG buffer per ICO size
  const frames = ICO_SIZES.map((size) => {
    const resized = resizeArea(src, size, size)
    const pngBuf  = PNG.sync.write(resized)
    console.log(`  ${String(size).padStart(3)}×${size} → ${pngBuf.length} bytes`)
    return pngBuf
  })

  // Build and write multi-frame ICO
  const ico = buildIco(frames)
  fs.writeFileSync(ICO_OUT, ico)

  console.log(`\n✓ ${ICO_OUT}`)
  console.log(`  ${ico.length} bytes  |  ${frames.length} frames: ${ICO_SIZES.join(', ')} px`)
}

main().catch((e) => { console.error('[generate-icon]', e); process.exit(1) })
