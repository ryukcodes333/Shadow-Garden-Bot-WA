const axios = require('axios')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')

async function getImgBuffer(sock, msg) {
  const imgMsg =
    msg.message?.imageMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
  if (!imgMsg) return null
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const targetMsg = quoted
    ? {
        message: quoted,
        key: {
          remoteJid: msg.key.remoteJid,
          id: msg.message.extendedTextMessage.contextInfo.stanzaId,
          participant: msg.message.extendedTextMessage.contextInfo.participant,
        },
      }
    : msg
  return downloadMediaMessage(targetMsg, 'buffer', {}, {
    logger: { level: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    reuploadRequest: sock.updateMediaMessage,
  })
}

async function sharpFilter(buf, transformFn) {
  const sharp = require('sharp')
  return transformFn(sharp(buf))
}

module.exports = {

  async removebg({ sock, msg, jid, reply }) {
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Send or reply to an image with .removebg')
    const apiKey = process.env.REMOVE_BG_KEY
    if (!apiKey) {
      return reply(
        '⚠️ *.removebg* needs a free API key.\n\n' +
        '1. Go to *remove.bg* and sign up\n' +
        '2. Copy your API key\n' +
        '3. Add it to your Render env vars as *REMOVE_BG_KEY*\n' +
        '4. Redeploy the bot'
      )
    }
    try {
      await reply('✂️ Removing background...')
      const FormData = require('form-data')
      const form = new FormData()
      form.append('image_file', buf, { filename: 'image.jpg', contentType: 'image/jpeg' })
      form.append('size', 'auto')
      const res = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
        headers: { ...form.getHeaders(), 'X-Api-Key': apiKey },
        responseType: 'arraybuffer',
        timeout: 30000,
      })
      await sock.sendMessage(jid, { image: Buffer.from(res.data), caption: '✅ Background removed' }, { quoted: msg })
    } catch (e) {
      await reply(`❌ Remove.bg failed: ${e.response?.status === 402 ? 'No credits left' : e.message}`)
    }
  },

  async nobg(ctx) { return module.exports.removebg(ctx) },

  async enhance({ sock, msg, jid, reply }) {
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Reply to an image with .enhance')
    try {
      const sharp = require('sharp')
      const out = await sharp(buf)
        .sharpen({ sigma: 2, m1: 1, m2: 2 })
        .modulate({ brightness: 1.08, saturation: 1.15 })
        .toBuffer()
      await sock.sendMessage(jid, { image: out, caption: '✨ Enhanced' }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async remini({ sock, msg, jid, reply }) {
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Reply to an image with .remini')
    try {
      const sharp = require('sharp')
      const meta = await sharp(buf).metadata()
      const w = Math.min((meta.width || 512) * 2, 2048)
      const h = Math.min((meta.height || 512) * 2, 2048)
      const out = await sharp(buf)
        .resize(w, h, { fit: 'inside', kernel: 'lanczos3' })
        .sharpen({ sigma: 1.5, m1: 0.5, m2: 2 })
        .modulate({ brightness: 1.05, saturation: 1.1 })
        .toBuffer()
      await sock.sendMessage(jid, { image: out, caption: '🔍 Remini Restored' }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async upscale({ sock, msg, jid, reply }) {
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Reply to an image with .upscale')
    try {
      const sharp = require('sharp')
      const meta = await sharp(buf).metadata()
      const w = Math.min((meta.width || 512) * 2, 3000)
      const h = Math.min((meta.height || 512) * 2, 3000)
      const out = await sharp(buf)
        .resize(w, h, { fit: 'inside', kernel: 'lanczos3' })
        .toBuffer()
      await sock.sendMessage(jid, { image: out, caption: `🔼 Upscaled 2× (${w}px)` }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async night({ sock, msg, jid, reply }) {
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Reply to an image with .night')
    try {
      const sharp = require('sharp')
      const out = await sharp(buf)
        .modulate({ brightness: 0.55, saturation: 0.6 })
        .tint({ r: 20, g: 40, b: 120 })
        .toBuffer()
      await sock.sendMessage(jid, { image: out, caption: '🌃 Night Filter' }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async sunset({ sock, msg, jid, reply }) {
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Reply to an image with .sunset')
    try {
      const sharp = require('sharp')
      const out = await sharp(buf)
        .modulate({ brightness: 1.1, saturation: 1.5 })
        .tint({ r: 255, g: 90, b: 20 })
        .toBuffer()
      await sock.sendMessage(jid, { image: out, caption: '🌅 Sunset Filter' }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async rain({ sock, msg, jid, reply }) {
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Reply to an image with .rain')
    try {
      const sharp = require('sharp')
      const out = await sharp(buf)
        .modulate({ brightness: 0.75, saturation: 0.7 })
        .tint({ r: 70, g: 110, b: 200 })
        .blur(0.8)
        .toBuffer()
      await sock.sendMessage(jid, { image: out, caption: '🌧️ Rain Filter' }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async city({ sock, msg, jid, reply }) {
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Reply to an image with .city')
    try {
      const sharp = require('sharp')
      const out = await sharp(buf)
        .modulate({ brightness: 0.9, saturation: 0.55 })
        .tint({ r: 50, g: 70, b: 140 })
        .sharpen({ sigma: 1 })
        .toBuffer()
      await sock.sendMessage(jid, { image: out, caption: '🌆 City Filter' }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async gun({ sock, msg, jid, reply }) {
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Reply to an image with .gun')
    try {
      const sharp = require('sharp')
      const out = await sharp(buf)
        .grayscale()
        .modulate({ brightness: 0.85 })
        .sharpen({ sigma: 1.5 })
        .toBuffer()
      await sock.sendMessage(jid, { image: out, caption: '🔫 Gun Filter' }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async jail({ sock, msg, jid, reply }) {
    const buf = await getImgBuffer(sock, msg)
    if (!buf) return reply('↩️ Reply to an image with .jail')
    try {
      const sharp = require('sharp')
      const meta = await sharp(buf).metadata()
      const w = meta.width || 512
      const h = meta.height || 512
      const bw = Math.floor(w / 7)
      const bars = Array.from({ length: 7 }, (_, i) =>
        `<rect x="${Math.floor(i * bw + bw * 0.65)}" y="0" width="${Math.floor(bw * 0.3)}" height="${h}" fill="rgba(20,20,20,0.78)"/>`
      ).join('')
      const svg = Buffer.from(
        `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
        bars +
        `<rect x="0" y="${Math.floor(h * 0.08)}" width="${w}" height="${Math.floor(h * 0.05)}" fill="rgba(20,20,20,0.75)"/>` +
        `<rect x="0" y="${Math.floor(h * 0.87)}" width="${w}" height="${Math.floor(h * 0.05)}" fill="rgba(20,20,20,0.75)"/>` +
        `</svg>`
      )
      const base = await sharp(buf).grayscale().modulate({ brightness: 0.75 }).png().toBuffer()
      const out  = await sharp(base).composite([{ input: svg, blend: 'over' }]).jpeg({ quality: 90 }).toBuffer()
      await sock.sendMessage(jid, { image: out, caption: '🔒 Jail Filter' }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async toanime({ sock, msg, jid, reply, args }) {
    const prompt = args.join(' ') || 'anime character'
    try {
      await reply('🎌 Generating anime style...')
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(`beautiful anime art ${prompt} vibrant colors sharp linework studio ghibli style`)  }?width=768&height=768&nologo=true&model=flux&seed=${Date.now()}`
      const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 })
      await sock.sendMessage(jid, { image: Buffer.from(res.data), caption: `🎌 Anime Style: ${prompt}` }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async cartoon({ sock, msg, jid, reply, args }) {
    const prompt = args.join(' ') || 'cartoon character'
    try {
      await reply('🎨 Generating cartoon...')
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(`cartoon illustration ${prompt} bright bold colors flat design fun animated`)  }?width=768&height=768&nologo=true&model=flux&seed=${Date.now()}`
      const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 })
      await sock.sendMessage(jid, { image: Buffer.from(res.data), caption: `🎭 Cartoon: ${prompt}` }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async carbon({ sock, msg, jid, reply, args }) {
    const code = args.join(' ')
    if (!code) return reply('⚠️ Usage: .carbon <code snippet>\n\nExample: .carbon console.log("Hello!")')
    try {
      await reply('💻 Generating carbon image...')
      const res = await axios.post(
        'https://carbonara.solopov.dev/api/cook',
        { code, theme: 'one-dark', backgroundColor: '#1a1a2e', language: 'auto', windowTheme: 'none', paddingHorizontal: '32px', paddingVertical: '32px', fontSize: '14px' },
        { responseType: 'arraybuffer', timeout: 30000 }
      )
      await sock.sendMessage(jid, { image: Buffer.from(res.data), caption: `💻 Carbon` }, { quoted: msg })
    } catch (e) { await reply(`❌ Carbon failed: ${e.message}`) }
  },
}
