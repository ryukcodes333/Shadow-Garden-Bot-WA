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
      `🤗 *HUG*\n\n👤 @${s} hugged ${t ? `@${t}` : 'the air'} 🤗\n\n_Warmth in the shadows…_ 🖤`)
  },
  async kiss(ctx) {
    await sendInteraction(ctx, 'kiss', (s, t) =>
      `💋 *KISS*\n\n👤 @${s} kissed ${t ? `@${t}` : 'the void'} 💋\n\n_Even shadows can feel affection…_ 🖤`)
  },
  async slap(ctx) {
    await sendInteraction(ctx, 'slap', (s, t) =>
      `👋 *SLAP*\n\n👤 @${s} slapped ${t ? `@${t}` : 'nobody'} 👋\n\n_Justice dealt by shadow hands._ 🖤`)
  },
  async wave(ctx) {
    await sendInteraction(ctx, 'wave', (s, t) =>
      `👋 *WAVE*\n\n👤 @${s} waved ${t ? `to @${t}` : 'at everyone'} 👋\n\n_A gesture from the shadows._ 🖤`)
  },
  async pat(ctx) {
    await sendInteraction(ctx, 'pat', (s, t) =>
      `🤚 *PAT*\n\n👤 @${s} patted ${t ? `@${t}` : 'the air'} 🤚\n\n_Gentle power._ 🖤`)
  },
  async dance(ctx) {
    await sendInteraction(ctx, 'dance', (s, t) =>
      `💃 *DANCE*\n\n👤 @${s} is dancing! 💃\n\n_Even shadows move to music._ 🖤`)
  },
  async sad({ reply, sender }) {
    await reply(`😢 *SAD*\n\n👤 @${sender} is feeling sad… 😢\n\n_The shadows share your grief._ 🖤`)
  },
  async smile({ reply, sender }) {
    await reply(`😊 *SMILE*\n\n👤 @${sender} is smiling! 😊\n\n_Light finds even the darkest corner._ 🖤`)
  },
  async laugh({ reply, sender }) {
    await reply(`😂 *LAUGH*\n\n👤 @${sender} is laughing! 😂\n\n_Laughter echoes through the shadows._ 🖤`)
  },
  async punch(ctx) {
    const { sock, msg, jid, sender, senderJid, reply } = ctx
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : 'the wall'
    await sock.sendMessage(jid, {
      text: `👊 *PUNCH*\n\n👤 @${sender} punched @${target} 👊\n\n*BOOM!* 💥\n\n_Shadow fists hit hard._ 🖤`,
      mentions: mentioned.length ? [msg.key.participant || msg.key.remoteJid, mentioned[0]] : []
    })
  },
  async hit(ctx) { return module.exports.punch(ctx) },
  async kill(ctx) {
    const { sock, msg, jid, sender, senderJid, reply } = ctx
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : '???'
    await sock.sendMessage(jid, {
      text: `💀 *ELIMINATED*\n\n👤 @${sender} eliminated @${target}!\n\n_Another soul consumed by the shadows._ 🖤`,
      mentions: mentioned.length ? [msg.key.participant || msg.key.remoteJid, mentioned[0]] : []
    })
  },
  async kidnap(ctx) {
    const { sock, msg, jid, sender, senderJid, reply } = ctx
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : '???'
    await sock.sendMessage(jid, {
      text: `🎭 *KIDNAPPED*\n\n👤 @${sender} kidnapped @${target}!\n\n🚗 *Vroom!*\n\n_Taken into the shadows… gone without a trace._ 🖤`,
      mentions: mentioned.length ? [msg.key.participant || msg.key.remoteJid, mentioned[0]] : []
    })
  },
  async lick(ctx) {
    await sendInteraction(ctx, 'lick', (s, t) =>
      `👅 *LICK*\n\n👤 @${s} licked ${t ? `@${t}` : 'the air'}… 👅\n\n_Odd flex but ok._ 🖤`)
  },
  async bonk(ctx) {
    const { sock, msg, jid, sender, senderJid, reply } = ctx
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : '???'
    await sock.sendMessage(jid, {
      text: `🔨 *BONK*\n\n👤 @${sender} bonked @${target}!\n\nGo to horny jail 🚔\n\n_The shadows enforce order._ 🖤`,
      mentions: mentioned.length ? [msg.key.participant || msg.key.remoteJid, mentioned[0]] : []
    })
  },
  async tickle(ctx) {
    const { sock, msg, jid, sender, senderJid, reply } = ctx
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target = mentioned.length ? mentioned[0].split('@')[0] : '???'
    await sock.sendMessage(jid, {
      text: `🤣 *TICKLE*\n\n👤 @${sender} is tickling @${target}!\n\n😂 HAHA STOP!\n\n_Even shadows can be playful._ 🖤`,
      mentions: mentioned.length ? [msg.key.participant || msg.key.remoteJid, mentioned[0]] : []
    })
  },
  async shrug({ reply, sender }) {
    await reply(`🤷 *SHRUG*\n\n👤 @${sender}: ¯\\_(ツ)_/¯\n\n_Whatever…_ 🖤`)
  },
}
