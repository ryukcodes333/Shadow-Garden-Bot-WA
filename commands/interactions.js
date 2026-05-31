const axios = require('axios')

const GIF_ACTIONS = {
  hug:   'https://nekos.life/api/v2/img/hug',
  kiss:  'https://nekos.life/api/v2/img/kiss',
  slap:  'https://nekos.life/api/v2/img/slap',
  pat:   'https://nekos.life/api/v2/img/pat',
  wave:  'https://nekos.life/api/v2/img/wave',
  dance: 'https://nekos.life/api/v2/img/dance',
  lick:  'https://nekos.life/api/v2/img/lick',
}

async function getGif(action) {
  try {
    const res = await axios.get(GIF_ACTIONS[action] || GIF_ACTIONS.hug, { timeout: 8000 })
    return res.data.url
  } catch { return null }
}

// Resolve target from quoted message or @mention; returns { phone, jid }
function resolveTarget(ctx) {
  const { msg } = ctx
  const ctxInfo = msg.message?.extendedTextMessage?.contextInfo

  // 1. Quoted message participant (reply to someone's message)
  const quotedParticipant = ctxInfo?.participant
  if (quotedParticipant) {
    const phone = quotedParticipant.split('@')[0].split(':')[0]
    return { phone, jid: quotedParticipant }
  }

  // 2. @mention
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

  const target = resolveTarget(ctx)
  const text   = template(sender, target?.phone || null)

  const mentions = target
    ? [senderJid, target.jid]
    : [senderJid]

  const gifUrl = await getGif(action)
  if (gifUrl) {
    try {
      await sock.sendMessage(jid, { video: { url: gifUrl }, gifPlayback: true, caption: text, mentions }, { quoted: msg })
      return
    } catch {}
    // fallback to image if video fails
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

  const target = resolveTarget(ctx)
  const text   = template(sender, target?.phone || null)

  const mentions = target
    ? [senderJid, target.jid]
    : [senderJid]

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
