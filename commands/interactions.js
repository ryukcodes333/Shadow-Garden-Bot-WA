const axios     = require('axios')
const { execFile } = require('child_process')
const os        = require('os')
const path      = require('path')
const fs        = require('fs')

const GIF_ACTIONS = {
  hug:   'https://nekos.life/api/v2/img/hug',
  kiss:  'https://nekos.life/api/v2/img/kiss',
  slap:  'https://nekos.life/api/v2/img/slap',
  pat:   'https://nekos.life/api/v2/img/pat',
  wave:  'https://nekos.life/api/v2/img/wave',
  dance: 'https://nekos.life/api/v2/img/dance',
  lick:  'https://nekos.life/api/v2/img/lick',
}

async function getGifUrl(action) {
  try {
    const res = await axios.get(GIF_ACTIONS[action] || GIF_ACTIONS.hug, { timeout: 8000 })
    return res.data.url
  } catch { return null }
}

// Download a GIF URL and convert to MP4 buffer using ffmpeg
// gifPlayback:true in Baileys requires a real MP4, not a raw GIF URL
async function gifUrlToMp4(gifUrl) {
  const res = await axios.get(gifUrl, { responseType: 'arraybuffer', timeout: 15000 })
  const tmpIn  = path.join(os.tmpdir(), `gif_in_${Date.now()}.gif`)
  const tmpOut = path.join(os.tmpdir(), `gif_out_${Date.now()}.mp4`)
  fs.writeFileSync(tmpIn, Buffer.from(res.data))
  await new Promise((resolve, reject) => {
    execFile('ffmpeg', [
      '-y', '-i', tmpIn,
      '-movflags', 'faststart',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-an',
      tmpOut,
    ], { timeout: 30000 }, (err, _o, stderr) => {
      if (err) reject(new Error((stderr || err.message).slice(0, 200)))
      else resolve()
    })
  })
  const buf = fs.readFileSync(tmpOut)
  try { fs.unlinkSync(tmpIn) } catch {}
  try { fs.unlinkSync(tmpOut) } catch {}
  return buf
}

// Resolve target from quoted message or @mention
function resolveTarget(ctx) {
  const { msg } = ctx
  const ctxInfo = msg.message?.extendedTextMessage?.contextInfo

  const quotedParticipant = ctxInfo?.participant
  if (quotedParticipant) {
    const phone = quotedParticipant.split('@')[0].split(':')[0]
    return { phone, jid: quotedParticipant }
  }

  const mentioned = ctxInfo?.mentionedJid || []
  if (mentioned.length) {
    const jid   = mentioned[0]
    const phone = jid.split('@')[0].split(':')[0]
    return { phone, jid }
  }

  return null
}

async function sendInteraction(ctx, action, template) {
  const { sock, msg, jid, sender } = ctx
  const senderJid = msg.key.participant || msg.key.remoteJid || `${sender}@s.whatsapp.net`

  const target   = resolveTarget(ctx)
  const text     = template(sender, target?.phone || null)
  const mentions = target ? [senderJid, target.jid] : [senderJid]

  const gifUrl = await getGifUrl(action)
  if (gifUrl) {
    // Try MP4 conversion first (required for gifPlayback to animate)
    try {
      const mp4Buf = await gifUrlToMp4(gifUrl)
      await sock.sendMessage(jid, { video: mp4Buf, gifPlayback: true, caption: text, mentions }, { quoted: msg })
      return
    } catch {}
    // Fallback: send raw GIF URL as video
    try {
      await sock.sendMessage(jid, { video: { url: gifUrl }, gifPlayback: true, caption: text, mentions }, { quoted: msg })
      return
    } catch {}
    // Final fallback: static image
    try {
      await sock.sendMessage(jid, { image: { url: gifUrl }, caption: text, mentions }, { quoted: msg })
      return
    } catch {}
  }
  await sock.sendMessage(jid, { text, mentions }, { quoted: msg })
}

async function sendTextInteraction(ctx, template) {
  const { sock, msg, jid, sender } = ctx
  const senderJid = msg.key.participant || msg.key.remoteJid || `${sender}@s.whatsapp.net`

  const target   = resolveTarget(ctx)
  const text     = template(sender, target?.phone || null)
  const mentions = target ? [senderJid, target.jid] : [senderJid]

  await sock.sendMessage(jid, { text, mentions }, { quoted: msg })
}

module.exports = {
  async hug(ctx) {
    await sendInteraction(ctx, 'hug', (s, t) =>
      `🤗 *HUG*\n\n@${s} hugged ${t ? `@${t}` : 'the air'} 🤗`)
  },
  async kiss(ctx) {
    await sendInteraction(ctx, 'kiss', (s, t) =>
      `💋 *KISS*\n\n@${s} kissed ${t ? `@${t}` : 'the void'} 💋`)
  },
  async slap(ctx) {
    await sendInteraction(ctx, 'slap', (s, t) =>
      `👋 *SLAP*\n\n@${s} slapped ${t ? `@${t}` : 'nobody'} 👋`)
  },
  async wave(ctx) {
    await sendInteraction(ctx, 'wave', (s, t) =>
      `👋 *WAVE*\n\n@${s} waved ${t ? `to @${t}` : 'at everyone'} 👋`)
  },
  async pat(ctx) {
    await sendInteraction(ctx, 'pat', (s, t) =>
      `🤚 *PAT*\n\n@${s} patted ${t ? `@${t}` : 'the air'} 🤚`)
  },
  async dance(ctx) {
    await sendInteraction(ctx, 'dance', (s, t) =>
      `💃 *DANCE*\n\n@${s} is dancing! 💃`)
  },
  async lick(ctx) {
    await sendInteraction(ctx, 'lick', (s, t) =>
      `👅 *LICK*\n\n@${s} licked ${t ? `@${t}` : 'the air'}… 👅`)
  },
  async sad({ sock, msg, jid, sender }) {
    const senderJid = msg.key.participant || msg.key.remoteJid || `${sender}@s.whatsapp.net`
    await sock.sendMessage(jid, { text: `😢 *SAD*\n\n@${sender} is feeling sad… 😢`, mentions: [senderJid] }, { quoted: msg })
  },
  async smile({ sock, msg, jid, sender }) {
    const senderJid = msg.key.participant || msg.key.remoteJid || `${sender}@s.whatsapp.net`
    await sock.sendMessage(jid, { text: `😊 *SMILE*\n\n@${sender} is smiling! 😊`, mentions: [senderJid] }, { quoted: msg })
  },
  async laugh({ sock, msg, jid, sender }) {
    const senderJid = msg.key.participant || msg.key.remoteJid || `${sender}@s.whatsapp.net`
    await sock.sendMessage(jid, { text: `😂 *LAUGH*\n\n@${sender} is laughing! 😂`, mentions: [senderJid] }, { quoted: msg })
  },
  async punch(ctx) {
    await sendTextInteraction(ctx, (s, t) =>
      `👊 *PUNCH*\n\n@${s} punched ${t ? `@${t}` : 'the wall'} — *BOOM!* 💥`)
  },
  async hit(ctx) { return module.exports.punch(ctx) },
  async kill(ctx) {
    await sendTextInteraction(ctx, (s, t) =>
      `💀 *ELIMINATED*\n\n@${s} eliminated ${t ? `@${t}` : 'someone'}!`)
  },
  async kidnap(ctx) {
    await sendTextInteraction(ctx, (s, t) =>
      `🎭 *KIDNAPPED*\n\n@${s} kidnapped ${t ? `@${t}` : 'someone'}! 🚗 *Vroom!*`)
  },
  async bonk(ctx) {
    await sendTextInteraction(ctx, (s, t) =>
      `🔨 *BONK*\n\n@${s} bonked ${t ? `@${t}` : 'someone'}! Go to horny jail 🚔`)
  },
  async tickle(ctx) {
    await sendTextInteraction(ctx, (s, t) =>
      `🤣 *TICKLE*\n\n@${s} is tickling ${t ? `@${t}` : 'someone'}! 😂 HAHA STOP!`)
  },
  async shrug({ sock, msg, jid, sender }) {
    const senderJid = msg.key.participant || msg.key.remoteJid || `${sender}@s.whatsapp.net`
    await sock.sendMessage(jid, { text: `🤷 @${sender}: ¯\\_(ツ)_/¯`, mentions: [senderJid] }, { quoted: msg })
  },
}
