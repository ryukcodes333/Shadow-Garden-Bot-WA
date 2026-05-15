const axios = require('axios')

// ─── GIF Action URLs ────────────────────────────────────────────────────────
const GIF_ACTIONS = {
  hug:    'https://nekos.life/api/v2/img/hug',
  kiss:   'https://nekos.life/api/v2/img/kiss',
  slap:   'https://nekos.life/api/v2/img/slap',
  pat:    'https://nekos.life/api/v2/img/pat',
  wave:   'https://nekos.life/api/v2/img/wave',
  dance:  'https://nekos.life/api/v2/img/dance',
  lick:   'https://nekos.life/api/v2/img/lick',
  cuddle: 'https://nekos.life/api/v2/img/cuddle',
  poke:   'https://nekos.life/api/v2/img/poke',
  bite:   'https://nekos.life/api/v2/img/bite',
  nuzzle: 'https://nekos.life/api/v2/img/nuzzle',
  boop:   'https://nekos.life/api/v2/img/boop',
  stare:  'https://nekos.life/api/v2/img/stare',
  cry:    'https://nekos.life/api/v2/img/cry',
  blush:  'https://nekos.life/api/v2/img/blush',
  smile:  'https://nekos.life/api/v2/img/smile',
  highfive: 'https://nekos.life/api/v2/img/pat',
}

async function getGif(action) {
  try {
    const url = GIF_ACTIONS[action] || GIF_ACTIONS.hug
    const res = await axios.get(url, { timeout: 8000 })
    return res.data.url
  } catch { return null }
}

// Download a GIF buffer from URL
async function downloadGif(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 })
    return Buffer.from(res.data)
  } catch { return null }
}

// ─── Helper to get the target JID from a quoted message or @mention ──────────
function getTargetJid(msg) {
  // 1. From @mention list
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
  if (mentioned.length) return mentioned[0]

  // 2. From quoted message sender (participant)
  const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant
  if (quotedParticipant) return quotedParticipant

  return null
}

// ─── Core sender that downloads GIF and sends as animated video ───────────────
async function sendInteraction(ctx, action, buildText) {
  const { sock, msg, jid, senderJid, sender, reply } = ctx

  // Resolve sender JID
  const sJid = senderJid || msg.key.participant || msg.key.remoteJid
  const sPhone = sender || sJid.split('@')[0].split(':')[0]

  // Resolve target JID
  const tJid = getTargetJid(msg)
  const tPhone = tJid ? tJid.split('@')[0].split(':')[0] : null

  const text = buildText(sPhone, tPhone)
  const mentions = [sJid, tJid].filter(Boolean)

  const gifUrl = await getGif(action)
  if (gifUrl) {
    const gifBuf = await downloadGif(gifUrl)
    if (gifBuf) {
      try {
        await sock.sendMessage(jid, {
          video: gifBuf,
          gifPlayback: true,
          mimetype: 'video/mp4',
          caption: text,
          mentions,
        }, { quoted: msg })
        return
      } catch {}
      // Fallback to image if video fails
      try {
        await sock.sendMessage(jid, { image: gifBuf, caption: text, mentions }, { quoted: msg })
        return
      } catch {}
    }
  }

  // Final fallback: text only with mentions
  await sock.sendMessage(jid, { text, mentions }, { quoted: msg })
}

// ─── RP action that needs no GIF (text + mentions) ───────────────────────────
async function sendTextAction(ctx, buildText) {
  const { sock, msg, jid, senderJid, sender } = ctx
  const sJid = senderJid || msg.key.participant || msg.key.remoteJid
  const sPhone = sender || sJid.split('@')[0].split(':')[0]
  const tJid = getTargetJid(msg)
  const tPhone = tJid ? tJid.split('@')[0].split(':')[0] : null
  const mentions = [sJid, tJid].filter(Boolean)
  const text = buildText(sPhone, tPhone)
  await sock.sendMessage(jid, { text, mentions }, { quoted: msg })
}

// ─── Marriage store (in-memory, resets on restart) ───────────────────────────
const marriages = {}

module.exports = {
  // ── GIF interactions ───────────────────────────────────────────────────────
  async hug(ctx) {
    await sendInteraction(ctx, 'hug', (s, t) =>
      `🤗 *HUG*\n\n@${s} hugged ${t ? `@${t}` : 'the air'} warmly 🤗`)
  },

  async kiss(ctx) {
    await sendInteraction(ctx, 'kiss', (s, t) =>
      `💋 *KISS*\n\n@${s} kissed ${t ? `@${t}` : 'the void'} 💋`)
  },

  async slap(ctx) {
    await sendInteraction(ctx, 'slap', (s, t) =>
      `👋 *SLAP*\n\n@${s} slapped ${t ? `@${t}` : 'nobody'} hard 👋`)
  },

  async wave(ctx) {
    await sendInteraction(ctx, 'wave', (s, t) =>
      `👋 *WAVE*\n\n@${s} waved ${t ? `to @${t}` : 'at everyone'} 👋`)
  },

  async pat(ctx) {
    await sendInteraction(ctx, 'pat', (s, t) =>
      `🤚 *PAT*\n\n@${s} pats ${t ? `@${t}` : 'the air'} gently 🤚`)
  },

  async dance(ctx) {
    await sendInteraction(ctx, 'dance', (s, _t) =>
      `💃 *DANCE*\n\n@${s} is busting moves on the dance floor! 💃🕺`)
  },

  async lick(ctx) {
    await sendInteraction(ctx, 'lick', (s, t) =>
      `👅 *LICK*\n\n@${s} licked ${t ? `@${t}` : 'the air'} 👅`)
  },

  async cuddle(ctx) {
    await sendInteraction(ctx, 'cuddle', (s, t) =>
      `🥰 *CUDDLE*\n\n@${s} is cuddling ${t ? `@${t}` : 'a pillow'} 🥰`)
  },

  async poke(ctx) {
    await sendInteraction(ctx, 'poke', (s, t) =>
      `👉 *POKE*\n\n@${s} poked ${t ? `@${t}` : 'the void'} with a finger 👉`)
  },

  async bite(ctx) {
    await sendInteraction(ctx, 'bite', (s, t) =>
      `🦷 *BITE*\n\n@${s} bit ${t ? `@${t}` : 'thin air'} 😬🦷`)
  },

  async nuzzle(ctx) {
    await sendInteraction(ctx, 'nuzzle', (s, t) =>
      `🐱 *NUZZLE*\n\n@${s} nuzzled ${t ? `@${t}` : 'nobody'} softly 🐱`)
  },

  async boop(ctx) {
    await sendInteraction(ctx, 'boop', (s, t) =>
      `☝️ *BOOP*\n\n@${s} booped ${t ? `@${t}` : 'someone'} on the nose 👃`)
  },

  async stare(ctx) {
    await sendInteraction(ctx, 'stare', (s, t) =>
      `👁️ *STARE*\n\n@${s} is staring intensely at ${t ? `@${t}` : 'the wall'} 👁️`)
  },

  async highfive(ctx) {
    await sendInteraction(ctx, 'highfive', (s, t) =>
      `🙌 *HIGH FIVE*\n\n@${s} high-fived ${t ? `@${t}` : 'the air'} 🙌`)
  },

  async blush(ctx) {
    await sendInteraction(ctx, 'blush', (s, t) =>
      `😳 *BLUSH*\n\n@${s} is blushing ${t ? `because of @${t}` : 'shyly'} 😳`)
  },

  async cry(ctx) {
    await sendInteraction(ctx, 'cry', (s, _t) =>
      `😭 *CRY*\n\n@${s} is crying... 😭 someone give them a hug!`)
  },

  // ── Text-only interactions ─────────────────────────────────────────────────
  async sad({ sock, msg, jid, senderJid, sender }) {
    const sJid = senderJid || msg.key.participant || msg.key.remoteJid
    const sPhone = sender || sJid.split('@')[0].split(':')[0]
    await sock.sendMessage(jid, { text: `😢 *SAD*\n\n@${sPhone} is feeling sad... 😢 someone comfort them!`, mentions: [sJid] })
  },

  async laugh({ sock, msg, jid, senderJid, sender }) {
    const sJid = senderJid || msg.key.participant || msg.key.remoteJid
    const sPhone = sender || sJid.split('@')[0].split(':')[0]
    await sock.sendMessage(jid, { text: `😂 *LAUGH*\n\n@${sPhone} is laughing hysterically! 😂`, mentions: [sJid] })
  },

  async punch(ctx) {
    await sendTextAction(ctx, (s, t) =>
      `👊 *PUNCH*\n\n@${s} punched ${t ? `@${t}` : 'the wall'} - *BOOM!* 💥`)
  },

  async hit(ctx) { return module.exports.punch(ctx) },

  async kill(ctx) {
    await sendTextAction(ctx, (s, t) =>
      `💀 *ELIMINATED*\n\n@${s} eliminated ${t ? `@${t}` : '???'}! 💀`)
  },

  async kidnap(ctx) {
    await sendTextAction(ctx, (s, t) =>
      `🎭 *KIDNAPPED*\n\n@${s} kidnapped ${t ? `@${t}` : '???'}! 🚗 *Vroom!*`)
  },

  async bonk(ctx) {
    await sendTextAction(ctx, (s, t) =>
      `🔨 *BONK*\n\n@${s} bonked ${t ? `@${t}` : 'someone'}! Go to horny jail 🚔`)
  },

  async tickle(ctx) {
    await sendTextAction(ctx, (s, t) =>
      `🤣 *TICKLE*\n\n@${s} is tickling ${t ? `@${t}` : 'someone'}! 😂 HAHA STOP!`)
  },

  async shrug({ sock, msg, jid, senderJid, sender }) {
    const sJid = senderJid || msg.key.participant || msg.key.remoteJid
    const sPhone = sender || sJid.split('@')[0].split(':')[0]
    await sock.sendMessage(jid, { text: `🤷 @${sPhone}: ¯\\_(ツ)_/¯`, mentions: [sJid] })
  },

  async smile({ sock, msg, jid, senderJid, sender }) {
    const sJid = senderJid || msg.key.participant || msg.key.remoteJid
    const sPhone = sender || sJid.split('@')[0].split(':')[0]
    await sock.sendMessage(jid, { text: `😊 *SMILE*\n\n@${sPhone} is wearing a bright smile! 😊`, mentions: [sJid] })
  },

  // ── RP life commands ───────────────────────────────────────────────────────

  async marry(ctx) {
    const { sock, msg, jid, senderJid, sender, reply } = ctx
    const sJid = senderJid || msg.key.participant || msg.key.remoteJid
    const sPhone = sender || sJid.split('@')[0].split(':')[0]
    const tJid = getTargetJid(msg)
    if (!tJid) return reply('💍 Mention or quote someone to propose to!')
    const tPhone = tJid.split('@')[0].split(':')[0]
    if (marriages[sPhone]) return reply(`💔 You are already married to @${marriages[sPhone]}! Use *.divorce* first.`)
    marriages[sPhone] = tPhone
    marriages[tPhone] = sPhone
    await sock.sendMessage(jid, {
      text: `💍 *MARRIED!*\n\n@${sPhone} and @${tPhone} are now officially married! 💑\n\n_May your bond in Shadow Garden last forever._ 🖤`,
      mentions: [sJid, tJid],
    }, { quoted: msg })
  },

  async divorce(ctx) {
    const { sock, msg, jid, senderJid, sender, reply } = ctx
    const sJid = senderJid || msg.key.participant || msg.key.remoteJid
    const sPhone = sender || sJid.split('@')[0].split(':')[0]
    if (!marriages[sPhone]) return reply('💔 You are not married to anyone.')
    const exPhone = marriages[sPhone]
    delete marriages[sPhone]
    delete marriages[exPhone]
    await sock.sendMessage(jid, {
      text: `💔 *DIVORCED*\n\n@${sPhone} is now single again.\n_The shadow garden witnesses the end._ 🖤`,
      mentions: [sJid],
    }, { quoted: msg })
  },

  async spouse(ctx) {
    const { sock, msg, jid, senderJid, sender, reply } = ctx
    const sJid = senderJid || msg.key.participant || msg.key.remoteJid
    const sPhone = sender || sJid.split('@')[0].split(':')[0]
    if (!marriages[sPhone]) return reply('💔 You are not married to anyone.')
    await sock.sendMessage(jid, {
      text: `💑 *MARRIAGE INFO*\n\n@${sPhone} is married to *@${marriages[sPhone]}* 💍`,
      mentions: [sJid],
    }, { quoted: msg })
  },

  async givebirth(ctx) {
    const { sock, msg, jid, senderJid, sender, reply } = ctx
    const sJid = senderJid || msg.key.participant || msg.key.remoteJid
    const sPhone = sender || sJid.split('@')[0].split(':')[0]
    const babyNames = ['Kira', 'Shadow Jr', 'Void', 'Luna', 'Raven', 'Eclipse', 'Nova', 'Onyx', 'Zen', 'Blaze']
    const baby = babyNames[Math.floor(Math.random() * babyNames.length)]
    const spouse = marriages[sPhone]
    await sock.sendMessage(jid, {
      text: `👶 *NEW ARRIVAL!*\n\n@${sPhone}${spouse ? ` and @${spouse}` : ''} just welcomed *${baby}* into the world! 🎉\n\n_The shadow garden grows._ 🖤`,
      mentions: spouse ? [sJid, `${spouse}@s.whatsapp.net`] : [sJid],
    }, { quoted: msg })
  },
  async birth(ctx) { return module.exports.givebirth(ctx) },

  async adopt(ctx) {
    const { sock, msg, jid, senderJid, sender, reply } = ctx
    const sJid = senderJid || msg.key.participant || msg.key.remoteJid
    const sPhone = sender || sJid.split('@')[0].split(':')[0]
    const tJid = getTargetJid(msg)
    if (!tJid) return reply('👨‍👧 Mention or quote someone to adopt!')
    const tPhone = tJid.split('@')[0].split(':')[0]
    await sock.sendMessage(jid, {
      text: `👨‍👧 *ADOPTED!*\n\n@${sPhone} has officially adopted @${tPhone}! 🏠\n\n_Welcome to the family._ 🖤`,
      mentions: [sJid, tJid],
    }, { quoted: msg })
  },

  async sleep(ctx) {
    const { sock, msg, jid, senderJid, sender } = ctx
    const sJid = senderJid || msg.key.participant || msg.key.remoteJid
    const sPhone = sender || sJid.split('@')[0].split(':')[0]
    const sleepEmojis = ['💤', '😴', '🌙', '⭐']
    const e = sleepEmojis[Math.floor(Math.random() * sleepEmojis.length)]
    await sock.sendMessage(jid, {
      text: `${e} *SLEEPING*\n\n@${sPhone} has gone to sleep... zzz ${e}\n\n_Do not disturb._ 🖤`,
      mentions: [sJid],
    }, { quoted: msg })
  },

  async wake(ctx) {
    const { sock, msg, jid, senderJid, sender } = ctx
    const sJid = senderJid || msg.key.participant || msg.key.remoteJid
    const sPhone = sender || sJid.split('@')[0].split(':')[0]
    const tJid = getTargetJid(msg)
    const tPhone = tJid ? tJid.split('@')[0].split(':')[0] : null
    const mentions = [sJid, tJid].filter(Boolean)
    await sock.sendMessage(jid, {
      text: `⏰ *WAKE UP!*\n\n@${sPhone} is waking ${tPhone ? `@${tPhone}` : 'themselves'} up! ⏰\n\n_Rise and grind!_ 🖤`,
      mentions,
    }, { quoted: msg })
  },

  async feed(ctx) {
    const { sock, msg, jid, senderJid, sender, reply } = ctx
    const sJid = senderJid || msg.key.participant || msg.key.remoteJid
    const sPhone = sender || sJid.split('@')[0].split(':')[0]
    const tJid = getTargetJid(msg)
    if (!tJid) return reply('🍱 Mention or quote someone to feed!')
    const tPhone = tJid.split('@')[0].split(':')[0]
    const foods = ['🍜 ramen', '🍣 sushi', '🍕 pizza', '🍔 burger', '🍎 apple', '🍩 donut', '🍦 ice cream']
    const food = foods[Math.floor(Math.random() * foods.length)]
    await sock.sendMessage(jid, {
      text: `🍱 *FEED*\n\n@${sPhone} fed @${tPhone} some ${food}! Yum! 😋`,
      mentions: [sJid, tJid],
    }, { quoted: msg })
  },

  async headpat(ctx) {
    await sendTextAction(ctx, (s, t) =>
      `✋ *HEAD PAT*\n\n@${s} is giving ${t ? `@${t}` : 'themselves'} wholesome head pats! ✋💕`)
  },

  async scold(ctx) {
    await sendTextAction(ctx, (s, t) =>
      `😤 *SCOLD*\n\n@${s} is scolding ${t ? `@${t}` : 'everyone'}! Behave! 😤`)
  },

  async tuck(ctx) {
    await sendTextAction(ctx, (s, t) =>
      `🛏️ *TUCK IN*\n\n@${s} tucked ${t ? `@${t}` : 'someone'} into bed! Sleep tight 🌙`)
  },

  async challenge(ctx) {
    await sendTextAction(ctx, (s, t) =>
      `⚔️ *CHALLENGE*\n\n@${s} has challenged ${t ? `@${t}` : 'everyone'} to a duel! ⚔️\n_Do you accept?_`)
  },

  async propose(ctx) {
    await sendTextAction(ctx, (s, t) =>
      `💍 *PROPOSAL*\n\n@${s} got down on one knee and proposed to ${t ? `@${t}` : 'the void'}! 💍\n_Will they say yes?_`)
  },

  async hype(ctx) {
    const { sock, msg, jid, senderJid, sender } = ctx
    const sJid = senderJid || msg.key.participant || msg.key.remoteJid
    const sPhone = sender || sJid.split('@')[0].split(':')[0]
    const tJid = getTargetJid(msg)
    const tPhone = tJid ? tJid.split('@')[0].split(':')[0] : null
    const mentions = [sJid, tJid].filter(Boolean)
    await sock.sendMessage(jid, {
      text: `🔥 *HYPED UP*\n\n@${sPhone} is hyping ${tPhone ? `@${tPhone}` : 'the whole group'} up! 🔥🎉\nLET'S GOOO!!`,
      mentions,
    }, { quoted: msg })
  },

  async vibe(ctx) {
    const { sock, msg, jid, senderJid, sender } = ctx
    const sJid = senderJid || msg.key.participant || msg.key.remoteJid
    const sPhone = sender || sJid.split('@')[0].split(':')[0]
    await sock.sendMessage(jid, {
      text: `🎵 *VIBE CHECK*\n\n@${sPhone} is vibing! ✅ You passed the vibe check 🎵`,
      mentions: [sJid],
    }, { quoted: msg })
  },

  async spoil(ctx) {
    await sendTextAction(ctx, (s, t) =>
      `🎁 *SPOIL*\n\n@${s} is spoiling ${t ? `@${t}` : 'themselves'} rotten! 🎁💕`)
  },

  async comfort(ctx) {
    await sendTextAction(ctx, (s, t) =>
      `🫂 *COMFORT*\n\n@${s} is comforting ${t ? `@${t}` : 'a friend'}. Everything will be okay. 🫂💙`)
  },

  async glare(ctx) {
    await sendTextAction(ctx, (s, t) =>
      `😠 *GLARE*\n\n@${s} is sending @${t || '???'} the most intense death glare 👁️🔥`)
  },
}
