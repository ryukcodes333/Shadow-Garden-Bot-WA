const sharp = require('sharp')

const PACK_NAME   = 'Atomic'
const PACK_AUTHOR = 'Shadow Garden'

// ─── PUBLIC ENTRY POINT ──────────────────────────────────────────────────────
async function makeSticker(inputBuffer) {
  // Lossy 512×512 WebP, no alpha (simpler RIFF structure, no ALPH chunk)
  const webp = await sharp(inputBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0 } })
    .webp({ quality: 90, alphaQuality: 0 })
    .toBuffer()

  return injectMetadata(webp, PACK_NAME, PACK_AUTHOR)
}

// ─── STEP 1 — parse every chunk out of the RIFF container ────────────────────
function parseChunks(webpBuf) {
  const chunks = []
  let pos = 12  // skip RIFF(4) + filesize(4) + WEBP(4)
  while (pos + 8 <= webpBuf.length) {
    const id   = webpBuf.subarray(pos, pos + 4).toString('binary')
    const size = webpBuf.readUInt32LE(pos + 4)
    const data = Buffer.from(webpBuf.subarray(pos + 8, pos + 8 + size))
    chunks.push({ id, data })
    pos += 8 + size + (size & 1)  // every chunk pads to even length
  }
  return chunks
}

// ─── STEP 2 — extract canvas size from VP8 or VP8L chunk ─────────────────────
function getCanvasSize(chunks) {
  const vp8x = chunks.find(c => c.id === 'VP8X')
  if (vp8x && vp8x.data.length >= 10) {
    return {
      w: vp8x.data.readUIntLE(4, 3) + 1,
      h: vp8x.data.readUIntLE(7, 3) + 1,
    }
  }
  const vp8 = chunks.find(c => c.id === 'VP8 ')
  if (vp8 && vp8.data.length >= 10) {
    return {
      w: (vp8.data[6] | (vp8.data[7] << 8)) & 0x3FFF,
      h: (vp8.data[8] | (vp8.data[9] << 8)) & 0x3FFF,
    }
  }
  const vp8l = chunks.find(c => c.id === 'VP8L')
  if (vp8l && vp8l.data.length >= 5) {
    const bits = vp8l.data.readUInt32LE(1)
    return {
      w: (bits & 0x3FFF) + 1,
      h: ((bits >> 14) & 0x3FFF) + 1,
    }
  }
  return { w: 512, h: 512 }
}

// ─── STEP 3 — build the EXIF payload (Exif\0\0 + TIFF wrapper + JSON) ────────
//
//  WhatsApp reads the EXIF chunk as:
//    "Exif\x00\x00"  – 6-byte EXIF app marker
//    TIFF-LE header  – II (0x4949) + magic 0x002A + IFD offset
//    IFD             – entry count + entries + next-IFD pointer
//    Data section    – ASCII JSON string (null-terminated)
//
function buildExifPayload(packName, author) {
  const json     = JSON.stringify({
    'sticker-pack-id':        'com.shadowgarden.atomic',
    'sticker-pack-name':       packName,
    'sticker-pack-publisher':  author,
    'emojis':                 ['🖤'],
  })
  const jsonBuf = Buffer.from(json, 'utf8')

  // TIFF offsets (all relative to start of TIFF section, i.e. after Exif\0\0)
  const TIFF_HDR   = 8   // "II" + 0x002A + ifdOffset(4)
  const IFD_COUNT  = 2   // number of IFD entries (uint16)
  const IFD_ENTRY  = 12  // tag(2) + type(2) + count(4) + value/offset(4)
  const NUM_FIELDS = 1
  const NEXT_IFD   = 4   // next IFD pointer = 0

  // The JSON data starts right after the IFD block
  const dataOffset = TIFF_HDR + IFD_COUNT + NUM_FIELDS * IFD_ENTRY + NEXT_IFD

  const tiff = Buffer.alloc(dataOffset + jsonBuf.length + 1, 0)
  let p = 0

  // TIFF-LE header
  tiff[p++] = 0x49; tiff[p++] = 0x49          // "II" (little-endian)
  tiff.writeUInt16LE(0x002A, p); p += 2         // TIFF magic
  tiff.writeUInt32LE(TIFF_HDR, p); p += 4       // IFD at offset 8

  // IFD entry count
  tiff.writeUInt16LE(NUM_FIELDS, p); p += 2

  // IFD entry: tag 0x010E (ImageDescription), type ASCII (2)
  tiff.writeUInt16LE(0x010E, p); p += 2          // tag
  tiff.writeUInt16LE(2, p);      p += 2          // type: ASCII
  tiff.writeUInt32LE(jsonBuf.length + 1, p); p += 4 // count (with null term)
  tiff.writeUInt32LE(dataOffset, p); p += 4      // offset to JSON from TIFF start

  // Next IFD pointer
  tiff.writeUInt32LE(0, p); p += 4

  // JSON payload (null-terminated)
  jsonBuf.copy(tiff, p)
  // remaining byte is already 0 (null terminator)

  return Buffer.concat([Buffer.from('Exif\x00\x00', 'binary'), tiff])
}

// ─── STEP 4 — serialize one chunk back to binary ──────────────────────────────
function serializeChunk(id, data) {
  const idBuf  = Buffer.from(id, 'binary')
  const szBuf  = Buffer.alloc(4)
  szBuf.writeUInt32LE(data.length, 0)
  const pad    = data.length & 1 ? Buffer.from([0]) : Buffer.alloc(0)
  return Buffer.concat([idBuf, szBuf, data, pad])
}

// ─── STEP 5 — rebuild as Extended WebP with VP8X + EXIF ──────────────────────
function injectMetadata(webpBuf, packName, author) {
  if (
    webpBuf.subarray(0, 4).toString() !== 'RIFF' ||
    webpBuf.subarray(8, 12).toString() !== 'WEBP'
  ) {
    return webpBuf  // not a WebP — return as-is
  }

  const chunks    = parseChunks(webpBuf)
  const { w, h }  = getCanvasSize(chunks)
  const exifData  = buildExifPayload(packName, author)

  // ── build VP8X chunk ──────────────────────────────────────────────────────
  // flags (4 bytes): bit 3 = EXIF present
  // Existing VP8X flags (if any) are preserved and EXIF bit is OR-ed in
  let flags = 0x08  // EXIF_FLAG
  const existing = chunks.find(c => c.id === 'VP8X')
  if (existing && existing.data.length >= 4) {
    flags |= existing.data.readUInt32LE(0)
  }

  const vp8xData = Buffer.alloc(10, 0)
  vp8xData.writeUInt32LE(flags, 0)
  vp8xData.writeUIntLE(Math.max(0, w - 1), 4, 3)
  vp8xData.writeUIntLE(Math.max(0, h - 1), 7, 3)

  // ── assemble chunks in the required order ─────────────────────────────────
  //   VP8X → ICCP (if present) → ANIM (if present) → VP8/VP8L/ANMF → EXIF
  const ORDER = ['ICCP', 'ANIM', 'VP8 ', 'VP8L', 'ANMF', 'ALPH']
  const imageChunks = ORDER
    .map(id => chunks.find(c => c.id === id))
    .filter(Boolean)

  const exifChunkBuf = serializeChunk('EXIF', exifData)
  const vp8xChunkBuf = serializeChunk('VP8X', vp8xData)

  const body = Buffer.concat([
    Buffer.from('WEBP'),
    vp8xChunkBuf,
    ...imageChunks.map(c => serializeChunk(c.id, c.data)),
    exifChunkBuf,
  ])

  const riffSz = Buffer.alloc(4)
  riffSz.writeUInt32LE(body.length, 0)

  return Buffer.concat([Buffer.from('RIFF'), riffSz, body])
}

module.exports = { makeSticker, PACK_NAME, PACK_AUTHOR }
