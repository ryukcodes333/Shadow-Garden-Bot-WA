'use strict'
const sharp = require('sharp')
const { execFile } = require('child_process')
const path = require('path')
const os = require('os')
const fs = require('fs')

const PACK_NAME   = 'Aqua'
const PACK_AUTHOR = '𝐊𝚯𝐍𝚯𝐒𝐔𝐁𝚫'

function buildExif(packname, author) {
  const json = JSON.stringify({
    'sticker-pack-id':       'com.aqua.stickers',
    'sticker-pack-name':      packname,
    'sticker-pack-publisher': author,
    'emojis':                ['🎴'],
  })
  const data = Buffer.from(json, 'utf8')
  const buf = Buffer.alloc(26 + data.length)
  buf.write('II', 0, 'binary')
  buf.writeUInt16LE(42,          2)
  buf.writeUInt32LE(8,           4)
  buf.writeUInt16LE(1,           8)
  buf.writeUInt16LE(0x5741,     10)
  buf.writeUInt16LE(7,          12)
  buf.writeUInt32LE(data.length, 14)
  buf.writeUInt32LE(26,         18)
  buf.writeUInt32LE(0,          22)
  data.copy(buf, 26)
  return buf
}

async function injectExif(webpBuf) {
  try {
    const webp = require('node-webpmux')
    const ImageClass = webp.Image || webp
    const img = new ImageClass()
    await img.load(webpBuf)
    img.exif = buildExif(PACK_NAME, PACK_AUTHOR)
    const raw = await img.save(null)
    if (!raw) return webpBuf
    // node-webpmux may return Uint8Array instead of Buffer — convert
    const result = Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
    if (result.length > 4 && result.slice(0, 4).toString('binary') === 'RIFF') return result
  } catch {}
  return webpBuf
}

// Static image (JPEG/PNG/WebP/etc.) → 512×512 cropped sticker
async function makeSticker(inputBuffer) {
  const webpBuf = await sharp(inputBuffer)
    .resize(512, 512, {
      fit:      'cover',
      position: 'centre',
    })
    .webp({ quality: 80, effort: 4 })
    .toBuffer()
  return injectExif(webpBuf)
}

// Video or GIF → animated WebP 512×512 sticker via ffmpeg
async function makeStickerFromVideo(inputBuffer) {
  return new Promise((resolve, reject) => {
    const ext    = 'tmp'
    const tmpIn  = path.join(os.tmpdir(), `stk_in_${Date.now()}.${ext}`)
    const tmpOut = path.join(os.tmpdir(), `stk_out_${Date.now()}.webp`)
    fs.writeFileSync(tmpIn, inputBuffer)
    execFile('ffmpeg', [
      '-y', '-i', tmpIn,
      '-vf', 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512,setsar=1',
      '-vcodec', 'libwebp',
      '-loop', '0',
      '-lossless', '0',
      '-quality', '80',
      '-preset', 'default',
      '-an',
      '-t', '6',
      tmpOut,
    ], { timeout: 30000 }, async (err) => {
      try { fs.unlinkSync(tmpIn) } catch {}
      if (err) {
        try { fs.unlinkSync(tmpOut) } catch {}
        return reject(new Error('Video sticker failed: ' + err.message))
      }
      try {
        const buf = fs.readFileSync(tmpOut)
        try { fs.unlinkSync(tmpOut) } catch {}
        const result = await injectExif(buf)
        resolve(result)
      } catch (e) { reject(e) }
    })
  })
}

module.exports = { makeSticker, makeStickerFromVideo, PACK_NAME, PACK_AUTHOR }
