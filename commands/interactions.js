const axios = require('axios')

const GIF_ACTIONS = {
  hug: 'https://nekos.life/api/v2/img/hug',
  kiss: 'https://nekos.life/api/v2/img/kiss',
  slap: 'https://nekos.life/api/v2/img/slap',
  pat: 'https://nekos.life/api/v2/img/pat',
  wave: 'https://nekos.life/api/v2/img/wave',
  dance: 'https://nekos.life/api/v2/img/dance',
  lick: 'https://nekos.life/api/v2/img/lick',
}

async function getGif(action) {
  try {
    const res = await axios.get(GIF_ACTIONS[action] || GIF_ACTIONS.hug)
    return res.data.url
  } catch { return null }
}

async function sendInteraction(ctx, action, template) {
  const { sock, msg, jid, senderJid, sender, reply } = ctx
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
  const target = mentioned.length ? mentioned[0].split('@')[0] : null
  const text = template(sender, target)
  const gifUrl = await getGif(action)
  if (gifUrl) {
    try {
      await sock.sendMessage(jid, { image: { url: gifUrl }, caption: text }, { quoted: msg })
      return
    } catch (e) {}
  }
  await reply(text)
}

module.exports = {
  async hug(ctx) {
    await sendInteraction(ctx, 'hug', (s, t) =>
      `🤗 *HUG*\n\n👤 @${s} hugged ${t ? `@${t}` : 'the air'} 🤗`)
  },
  async kiss(ctx) {
    await sendInteraction(ctx, 'kiss', (s, t) =>
      `💋 *KISS*\n\n👤 @${s} kissed ${t ? `@${t}` : 'the void'} 💋`)
  },
  async slap(ctx) {
    await sendInteraction(ctx, 'slap', (s, t) =>
      `👋 *SLAP*\n\n👤 @${s} slapped ${t ? `@${t}` : 'nobody'} 👋`)
  },
  async wave(ctx) {
    await sendInteraction(ctx, 'wave', (s, t) =>
      `👋 *WAVE*\n\n👤 @${s} waved ${t ? `to @${t}` : 'at everyone'} 👋`)
  },
  async pat(ctx) {
    await sendInteraction(ctx, 'pat', (s, t) =>
      `🤚 *PAT*\n\n👤 @${s} patted ${t ? `@${t}` : 'the air'} 🤚`)
  },
  async dance(ctx) {
    await sendInteraction(ctx, 'dance', (s, t) =>
      `💃 *DANCE*\n\n👤 @${s} is dancing! 💃`)
  },
  async sad({ reply, sender }) {
    await reply(`😢 *SAD*\n\n👤 @${sender} is feeling sad… 😢`)
  },
  async smile({ reply, sender }) {
    await reply(`😊 *SMILE*\n\n👤 @${sender} is smiling! 😊`)
  },
  async laugh({ reply, sender }) {
    await reply(`😂 *LAUGH*\n\n👤 @${sender} is laughing! 😂`)
  },
  async punch(ctx) {
    const { sock, msg, jid, sender, senderJid, reply } = ctx
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : 'the wall'
    await sock.sendMessage(jid, {
      text: `👊 *PUNCH*\n\n👤 @${sender} punched @${target} — *BOOM!* 💥`,
      mentions: mentioned.length ? [msg.key.participant || msg.key.remoteJid, mentioned[0]] : []
    })
  },
  async hit(ctx) { return module.exports.punch(ctx) },
  async kill(ctx) {
    const { sock, msg, jid, sender, senderJid, reply } = ctx
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : '???'
    await sock.sendMessage(jid, {
      text: `💀 *ELIMINATED*\n\n👤 @${sender} eliminated @${target}!`,
      mentions: mentioned.length ? [msg.key.participant || msg.key.remoteJid, mentioned[0]] : []
    })
  },
  async kidnap(ctx) {
    const { sock, msg, jid, sender, senderJid, reply } = ctx
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : '???'
    await sock.sendMessage(jid, {
      text: `🎭 *KIDNAPPED*\n\n👤 @${sender} kidnapped @${target}! 🚗 *Vroom!*`,
      mentions: mentioned.length ? [msg.key.participant || msg.key.remoteJid, mentioned[0]] : []
    })
  },
  async lick(ctx) {
    await sendInteraction(ctx, 'lick', (s, t) =>
      `👅 *LICK*\n\n👤 @${s} licked ${t ? `@${t}` : 'the air'}… 👅`)
  },
  async bonk(ctx) {
    const { sock, msg, jid, sender, senderJid, reply } = ctx
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : '???'
    await sock.sendMessage(jid, {
      text: `🔨 *BONK*\n\n👤 @${sender} bonked @${target}! Go to horny jail 🚔`,
      mentions: mentioned.length ? [msg.key.participant || msg.key.remoteJid, mentioned[0]] : []
    })
  },
  async tickle(ctx) {
    const { sock, msg, jid, sender, senderJid, reply } = ctx
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : '???'
    await sock.sendMessage(jid, {
      text: `🤣 *TICKLE*\n\n👤 @${sender} is tickling @${target}! 😂 HAHA STOP!`,
      mentions: mentioned.length ? [msg.key.participant || msg.key.remoteJid, mentioned[0]] : []
    })
  },
  async shrug({ reply, sender }) {
    await reply(`🤷 @${sender}: ¯\\_(ツ)_/¯`)
  },
}
