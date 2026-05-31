'use strict'
const sharp = require('sharp')

const PACK_NAME   = 'Konosuba'
const PACK_AUTHOR = 'Shadow Garden'

// Build WhatsApp sticker EXIF (TIFF LE format with WhatsApp's custom tag)
function buildExif(packname, author) {
  const json = JSON.stringify({
    'sticker-pack-id':       'com.konosuba.stickers',
    'sticker-pack-name':      packname,
    'sticker-pack-publisher': author,
    'emojis':                ['🎴'],
  })
  const data = Buffer.from(json, 'utf8')
  // 26-byte TIFF header + IFD + data
  const buf = Buffer.alloc(26 + data.length)
  buf.write('II', 0, 'binary')         // little-endian TIFF
  buf.writeUInt16LE(42,          2)    // TIFF magic
  buf.writeUInt32LE(8,           4)    // offset to first IFD = 8
  buf.writeUInt16LE(1,           8)    // 1 IFD entry
  buf.writeUInt16LE(0x5741,     10)    // tag: 0x5741 "AW" (WhatsApp sticker tag)
  buf.writeUInt16LE(7,          12)    // type: UNDEFINED (raw bytes)
  buf.writeUInt32LE(data.length, 14)   // count = JSON byte length
  buf.writeUInt32LE(26,         18)    // value offset = right after the header
  buf.writeUInt32LE(0,          22)    // next IFD = 0 (none)
  data.copy(buf, 26)
  return buf
}

async function makeSticker(inputBuffer) {
  // 1. Sharp: resize to 512×512 with transparent letterboxing → lossless WebP
  const webpBuf = await sharp(inputBuffer)
    .resize(512, 512, {
      fit:        'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 80, effort: 4 })
    .toBuffer()

  // 2. Inject EXIF via node-webpmux (graceful fallback if not installed)
  try {
    const webp = require('node-webpmux')
    // Support both v2 (default export = Image) and v3 ({ Image })
    const ImageClass = webp.Image || webp
    const img = new ImageClass()
    await img.load(webpBuf)
    img.exif = buildExif(PACK_NAME, PACK_AUTHOR)
    const result = await img.save(null)   // null → return Buffer
    // Verify output is valid RIFF WebP
    if (Buffer.isBuffer(result) && result.slice(0, 4).toString() === 'RIFF') {
      return result
    }
  } catch {
    // node-webpmux not available — return clean WebP (still works as sticker)
  }

  return webpBuf
}

module.exports = { makeSticker, PACK_NAME, PACK_AUTHOR }
