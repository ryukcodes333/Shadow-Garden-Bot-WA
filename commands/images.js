const axios = require('axios')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')

async function getImgBuffer(sock, msg) {
  const imgMsg =
    msg.message?.imageMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
  if (!imgMsg) return null
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const targetMsg = quoted
    ? { message: quoted, key: { remoteJid: msg.key.remoteJid, id: msg.message.extendedTextMessage.contextInfo.stanzaId, participant: msg.message.extendedTextMessage.contextInfo.participant } }
    : msg
  return downloadMediaMessage(targetMsg, 'buffer', {}, {
    logger: { level: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    reuploadRequest: sock.updateMediaMessage,
  })
}

async function getVidBuffer(sock, msg) {
  const vidMsg =
    msg.message?.videoMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage
  if (!vidMsg) return null
  const fileSize = Number(vidMsg.fileLength || 0)
  if (fileSize > 80 * 1024 * 1024) throw new Error('Video too large (max 80 MB).')
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const targetMsg = quoted
    ? { message: quoted, key: { remoteJid: msg.key.remoteJid, id: msg.message.extendedTextMessage.contextInfo.stanzaId, participant: msg.message.extendedTextMessage.contextInfo.participant } }
    : msg
  return downloadMediaMessage(targetMsg, 'buffer', {}, {
    logger: { level: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    reuploadRequest: sock.updateMediaMessage,
  })
}

module.exports = {
  async removebg({ sock, msg, jid, reply }) {
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Send or reply to an image with .removebg')
    const apiKey = process.env.REMOVE_BG_KEY
    if (!apiKey) return reply('⚠️ .removebg needs a free API key.\n\n1. Sign up at *remove.bg*\n2. Copy your API key\n3. Add it to env as *REMOVE_BG_KEY*\n4. Restart')
    try {
      await reply('✂️ Removing background...')
      const FormData = require('form-data')
      const form = new FormData()
      form.append('image_file', buf, { filename: 'image.jpg', contentType: 'image/jpeg' })
      form.append('size', 'auto')
      const res = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
        headers: { ...form.getHeaders(), 'X-Api-Key': apiKey },
        responseType: 'arraybuffer', timeout: 30000,
      })
      await sock.sendMessage(jid, { image: Buffer.from(res.data), caption: '✅ Background removed' }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.response?.status === 402 ? 'No credits left' : e.message}`) }
  },
  async nobg(ctx) { return module.exports.removebg(ctx) },

  async enhance({ sock, msg, jid, reply }) {
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Reply to an image with .enhance')
    try {
      const sharp = require('sharp')
      const out = await sharp(buf).sharpen({ sigma: 2, m1: 1, m2: 2 }).modulate({ brightness: 1.08, saturation: 1.15 }).toBuffer()
      await sock.sendMessage(jid, { image: out, caption: '✨ Enhanced' }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async remini({ sock, msg, jid, reply }) {
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Reply to an image with .remini')
    try {
      const sharp = require('sharp')
      const meta = await sharp(buf).metadata()
      const out = await sharp(buf)
        .resize(Math.min((meta.width || 512) * 2, 2048), Math.min((meta.height || 512) * 2, 2048), { fit: 'inside', kernel: 'lanczos3' })
        .sharpen({ sigma: 1.5, m1: 0.5, m2: 2 }).modulate({ brightness: 1.05, saturation: 1.1 }).toBuffer()
      await sock.sendMessage(jid, { image: out, caption: '🔍 Remini Restored' }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async upscale({ sock, msg, jid, reply }) {
    // Support both image and video upscaling
    const sharp = require('sharp')

    // Check for video first
    const hasVideo = !!(
      msg.message?.videoMessage ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage
    )

    if (hasVideo) {
      try {
        await reply('🎬 Upscaling video... this may take a moment.')
        const vidBuf = await getVidBuffer(sock, msg)
        if (!vidBuf) return reply('❌ Could not download video.')
        const { execFile } = require('child_process')
        const os   = require('os')
        const path = require('path')
        const fs   = require('fs')
        const tmpIn  = path.join(os.tmpdir(), `upscale_in_${Date.now()}.mp4`)
        const tmpOut = path.join(os.tmpdir(), `upscale_out_${Date.now()}.mp4`)
        fs.writeFileSync(tmpIn, vidBuf)
        await new Promise((resolve, reject) => {
          execFile('ffmpeg', [
            '-y', '-i', tmpIn,
            '-vf', 'scale=iw*2:ih*2:flags=lanczos',
            '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
            '-c:a', 'copy',
            tmpOut,
          ], { timeout: 120000 }, (err, _out, stderr) => {
            if (err) reject(new Error('ffmpeg error: ' + (stderr || err.message).slice(0, 200)))
            else resolve()
          })
        })
        const outBuf = fs.readFileSync(tmpOut)
        try { fs.unlinkSync(tmpIn) } catch {}
        try { fs.unlinkSync(tmpOut) } catch {}
        await sock.sendMessage(jid, { video: outBuf, caption: '🔼 Video upscaled 2×' }, { quoted: msg })
      } catch (e) {
        await reply(`❌ Video upscale failed: ${e.message}`)
      }
      return
    }

    // Image upscaling
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Reply to an image or video with .upscale')
    try {
      const meta = await sharp(buf).metadata()
      const out = await sharp(buf)
        .resize(Math.min((meta.width || 512) * 2, 3000), Math.min((meta.height || 512) * 2, 3000), { fit: 'inside', kernel: 'lanczos3' }).toBuffer()
      await sock.sendMessage(jid, { image: out, caption: `🔼 Upscaled 2×` }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async night({ sock, msg, jid, reply }) {
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Reply to an image with .night')
    try {
      const sharp = require('sharp')
      const out = await sharp(buf).modulate({ brightness: 0.55, saturation: 0.6 }).tint({ r: 20, g: 40, b: 120 }).toBuffer()
      await sock.sendMessage(jid, { image: out, caption: '🌃 Night Filter' }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async sunset({ sock, msg, jid, reply }) {
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Reply to an image with .sunset')
    try {
      const sharp = require('sharp')
      const out = await sharp(buf).modulate({ brightness: 1.1, saturation: 1.5 }).tint({ r: 255, g: 90, b: 20 }).toBuffer()
      await sock.sendMessage(jid, { image: out, caption: '🌅 Sunset Filter' }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async rain({ sock, msg, jid, reply }) {
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Reply to an image with .rain')
    try {
      const sharp = require('sharp')
      const out = await sharp(buf).modulate({ brightness: 0.75, saturation: 0.7 }).tint({ r: 70, g: 110, b: 200 }).blur(0.8).toBuffer()
      await sock.sendMessage(jid, { image: out, caption: '🌧️ Rain Filter' }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },
}
