const axios = require('axios')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')
const db = require('../database')

// ── Pollinations text API — free, no API key required ────────────────────────
// Docs: https://text.pollinations.ai  (model: openai = GPT-4o-mini, openai-large = GPT-4o)
const POLLINATIONS_TEXT = 'https://text.pollinations.ai/'

const DEFAULT_SYSTEM = `You are a helpful, witty, and friendly AI assistant for a WhatsApp group bot. Keep responses short and readable on WhatsApp. Don't be overly formal.`

async function askAI(messages, model = 'openai') {
  const seed = Math.floor(Math.random() * 999999)
  const res  = await axios.post(
    POLLINATIONS_TEXT,
    { messages, model, seed, private: true },
    { headers: { 'Content-Type': 'application/json' }, timeout: 35000, responseType: 'text' }
  )
  return typeof res.data === 'string' ? res.data.trim() : JSON.stringify(res.data)
}

async function genImage(prompt, model = 'flux') {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&model=${model}&seed=${Math.floor(Math.random() * 99999)}`
  const res  = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 })
  return Buffer.from(res.data)
}

async function fetchNekoImg(type) {
  const res = await axios.get(`https://nekos.life/api/v2/img/${type}`, { timeout: 10000 })
  return res.data.url
}

async function sendAnimeImg(sock, jid, msg, type, caption) {
  try {
    const url = await fetchNekoImg(type)
    await sock.sendMessage(jid, { image: { url }, caption }, { quoted: msg })
  } catch {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg })
    await reply(`🎭 ${caption}\n\n(Image unavailable right now)`)
  }
}

async function getImageBuffer(sock, msg) {
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

async function handleAI(ctx, model = 'openai') {
  const { reply, args, sock, jid, msg } = ctx
  const prompt = args.join(' ')
  if (!prompt) return reply(`🤖 Usage: .${ctx.cmd} <your question>`)
  await reply('⏳ Thinking...')
  try {
    const messages = [
      { role: 'system', content: DEFAULT_SYSTEM },
      { role: 'user',   content: prompt },
    ]
    const answer = await askAI(messages, model)
    await sock.sendMessage(jid, { text: answer + '\n\n *Konosuba* ' }, { quoted: msg })
  } catch (e) {
    await reply(`❌ AI error: ${e.message}`)
  }
}

// ── AI Persona — fully adaptive AI trained by staff ───────────────────────────
// Staff set the bot's name and teach it facts via .aitrain.
// The name + facts become a custom system prompt fed to Pollinations on every reply.
// When anyone mentions the AI's name or replies to a bot message, it responds with
// a real, context-aware, non-repeating answer — not a pattern matcher.

function buildPersonaSystemPrompt(persona) {
  const name  = (persona?.name || '').trim() || 'Aqua'
  const facts = (persona?.facts || []).filter(Boolean)
  let sys = `You are ${name}, a smart, witty, and expressive AI living inside a WhatsApp group bot.\n`
  sys += `You respond naturally as ${name} — not as a generic assistant. You have real opinions and personality.\n`
  if (facts.length) {
    sys += `\nThings you know about yourself:\n`
    facts.forEach(f => { sys += `• ${f}\n` })
  }
  sys += `\nIMPORTANT:\n`
  sys += `• Keep responses short and punchy — this is WhatsApp, not a blog post.\n`
  sys += `• Always respond to what the user ACTUALLY said. Read the message carefully.\n`
  sys += `• Never be repetitive. Vary your tone and wording every time.\n`
  sys += `• If you don't know something, say so naturally — don't make things up.\n`
  sys += `• Be real, be yourself, and be engaging.`
  return sys
}

// Called by index.js when the AI name is mentioned or someone replies to bot
async function handleAiPersonaReply(sock, jid, msg, textRaw, persona) {
  const name     = (persona?.name || 'Aqua').trim()
  const messages = [
    { role: 'system', content: buildPersonaSystemPrompt(persona) },
    { role: 'user',   content: textRaw },
  ]
  const answer = await askAI(messages, 'openai')
  await sock.sendMessage(jid, { text: `*${name}:* ${answer}` }, { quoted: msg })
}

module.exports = {
  // ── Exposed for index.js ──────────────────────────────────────────────────
  handleAiPersonaReply,

  // ── .aitrain — staff-only AI persona trainer ─────────────────────────────
  async aitrain({ reply, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Only staff can train the AI.')

    const sub  = (args[0] || '').toLowerCase()
    const rest = args.slice(1).join(' ').trim()

    if (sub === 'name') {
      if (!rest) return reply('⚠️ Usage: *.aitrain name <name>*\nExample: *.aitrain name Aqua*')
      await db.setAiPersonaName(rest)
      return reply(
        `✅ *AI name set to "${rest}"*\n\n` +
        `Anyone who mentions *${rest}* in chat, or replies to any bot message, ` +
        `will get a real AI response as ${rest}.\n\n` +
        `Use *.aitrain fact <text>* to teach ${rest} things about itself.`
      )
    }

    if (sub === 'fact') {
      if (!rest) return reply('⚠️ Usage: *.aitrain fact <something about the AI>*\nExample: *.aitrain fact You love anime and you hate being ignored*')
      await db.addAiPersonaFact(rest)
      const persona = await db.getAiPersona()
      const name    = persona?.name || 'the AI'
      return reply(
        `✅ *Fact added!*\n\n_"${rest}"_\n\n` +
        `${name} will reflect this in every future response. ` +
        `_(${persona?.facts?.length || 1} total facts trained)_`
      )
    }

    if (sub === 'removefact') {
      const idx = parseInt(rest) - 1
      if (isNaN(idx) || idx < 0) return reply('⚠️ Usage: *.aitrain removefact <number>*\nUse *.aitrain list* to see numbers.')
      const updated = await db.removeAiPersonaFact(idx)
      return reply(updated ? `✅ Fact #${idx + 1} removed.` : `❌ Fact not found.`)
    }

    if (sub === 'clearfacts') {
      await db.clearAiPersonaFacts()
      return reply('✅ All AI facts cleared. The AI will no longer have personality traits until you teach new ones.')
    }

    if (sub === 'list') {
      const persona = await db.getAiPersona()
      const name    = persona?.name || '_(not set)_'
      const facts   = persona?.facts?.length
        ? persona.facts.map((f, i) => `${i + 1}. ${f}`).join('\n')
        : '_No facts trained yet._'
      return reply(`🤖 *AI Persona — Current State*\n\n*Name:* ${name}\n\n*Facts:*\n${facts}`)
    }

    if (sub === 'test') {
      const persona = await db.getAiPersona()
      if (!persona?.name) return reply('❌ No AI name set yet. Use *.aitrain name <name>* first.')
      await reply('⏳ Testing AI response...')
      try {
        await handleAiPersonaReply(
          { sendMessage: async (...a) => reply(a[1]?.text || '') },
          null, null,
          rest || 'Say hi and introduce yourself briefly!',
          persona
        )
      } catch (e) {
        await reply(`❌ AI test failed: ${e.message}\n\n_Check your internet connection or try again in a moment._`)
      }
      return
    }

    return reply(
      `🤖 *AI Training Commands* _(staff only)_\n\n` +
      `*.aitrain name <name>* — Set the AI's name (e.g. Aqua)\n` +
      `*.aitrain fact <text>* — Teach the AI something about itself\n` +
      `*.aitrain list* — View current name + all trained facts\n` +
      `*.aitrain removefact <#>* — Delete a specific fact\n` +
      `*.aitrain clearfacts* — Wipe all facts\n` +
      `*.aitrain test [prompt]* — Test the AI response live\n\n` +
      `_The AI uses Pollinations (free, no key) to generate real, adaptive responses based on what it's been taught._`
    )
  },

  // ── General AI commands (all powered by Pollinations) ────────────────────
  async ai(ctx)       { return handleAI(ctx, 'openai') },
  async chatgpt(ctx)  { return handleAI(ctx, 'openai-large') },
  async gpt(ctx)      { return handleAI(ctx, 'openai') },
  async llama(ctx)    { return handleAI(ctx, 'openai') },
  async deepseek(ctx) { return handleAI(ctx, 'deepseek-reasoning') },
  async mistral(ctx)  { return handleAI(ctx, 'mistral') },
  async gemini(ctx)   { return handleAI(ctx, 'openai') },

  // ── Image generation (Pollinations image — already was this) ─────────────
  async flux({ reply, args, sock, jid, msg }) {
    const prompt = args.join(' ')
    if (!prompt) return reply('🎨 Usage: .flux <description>')
    await reply('🎨 Generating image...')
    try {
      const buf = await genImage(prompt, 'flux')
      await sock.sendMessage(jid, { image: buf, caption: `🎨 ${prompt}` }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async pixart({ reply, args, sock, jid, msg }) {
    const prompt = args.join(' ')
    if (!prompt) return reply('🎨 Usage: .pixart <description>')
    await reply('🎨 Generating...')
    try {
      const buf = await genImage(prompt + ' pixel art style', 'flux')
      await sock.sendMessage(jid, { image: buf, caption: `🎨 ${prompt}` }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async sdxl({ reply, args, sock, jid, msg }) {
    const prompt = args.join(' ')
    if (!prompt) return reply('🎨 Usage: .sdxl <description>')
    await reply('🎨 Generating...')
    try {
      const buf = await genImage(prompt, 'turbo')
      await sock.sendMessage(jid, { image: buf, caption: `🎨 ${prompt}` }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async pollinations({ reply, args, sock, jid, msg }) {
    const prompt = args.join(' ')
    if (!prompt) return reply('🎨 Usage: .pollinations <description>')
    await reply('🎨 Generating...')
    try {
      const buf = await genImage(prompt)
      await sock.sendMessage(jid, { image: buf, caption: `🎨 ${prompt}` }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async playground({ reply, args, sock, jid, msg }) {
    const prompt = args.join(' ')
    if (!prompt) return reply('🎨 Usage: .playground <description>')
    await reply('🎨 Generating...')
    try {
      const buf = await genImage(prompt + ' ultra detailed cinematic', 'flux')
      await sock.sendMessage(jid, { image: buf, caption: `🎨 ${prompt}` }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  // ── .aidetect — image analysis via Pollinations vision ───────────────────
  async aidetect({ sock, msg, jid, reply }) {
    const buf = await getImageBuffer(sock, msg)
    if (!buf) return reply('↩️ Send or reply to an image with .aidetect')
    await reply('🔍 Analyzing image...')
    try {
      const base64 = buf.toString('base64')
      const messages = [{
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this image in detail. What do you see? Keep it concise and readable.' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
        ],
      }]
      const desc = await askAI(messages, 'openai')
      await sock.sendMessage(jid, { text: `🔍 *Image Analysis*\n\n${desc}` }, { quoted: msg })
    } catch (e) {
      await reply(`❌ Analysis failed: ${e.message}`)
    }
  },

  // ── Anime image commands ──────────────────────────────────────────────────
  async waifu({ sock, msg, jid, reply }) {
    try {
      const url = await fetchNekoImg('waifu')
      await sock.sendMessage(jid, { image: { url }, caption: '🌸 Waifu' }, { quoted: msg })
    } catch { await reply('❌ Waifu fetch failed') }
  },
  async neko({ sock, msg, jid, reply }) {
    try {
      const url = await fetchNekoImg('neko')
      await sock.sendMessage(jid, { image: { url }, caption: '🐱 Neko' }, { quoted: msg })
    } catch { await reply('❌ Neko fetch failed') }
  },
  async animesearch({ reply, args }) {
    const query = args.join(' ')
    if (!query) return reply('⚠️ Usage: .animesearch <anime name>')
    try {
      const res = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`, { timeout: 10000 })
      const a   = res.data?.data?.[0]
      if (!a) return reply('❌ Anime not found.')
      await reply(
        `🎭 *${a.title}*\n\n` +
        `📅 Year: ${a.year || 'N/A'}\n` +
        `⭐ Score: ${a.score || 'N/A'}\n` +
        `📺 Episodes: ${a.episodes || 'N/A'}\n` +
        `🗂️ Status: ${a.status || 'N/A'}\n\n` +
        `📝 ${a.synopsis?.slice(0, 200) || 'No synopsis'}...`
      )
    } catch { await reply('❌ Search failed') }
  },
  async animekill({ sock, msg, jid, sender }) { await sendAnimeImg(sock, jid, msg, 'kill', `💀 @${sender} goes for the kill!`) },
  async animebite({ sock, msg, jid, sender }) { await sendAnimeImg(sock, jid, msg, 'bite', `😈 @${sender} bites!`) },
  async animewave({ sock, msg, jid, sender }) { await sendAnimeImg(sock, jid, msg, 'wave', `👋 @${sender} waves!`) },
  async animewink({ sock, msg, jid, sender }) { await sendAnimeImg(sock, jid, msg, 'wink', `😉 @${sender} winks~`) },
  async animebonk({ sock, msg, jid, sender }) { await sendAnimeImg(sock, jid, msg, 'slap', `🔨 @${sender} bonks you!`) },
  async megumin({ sock, msg, jid }) { await sendAnimeImg(sock, jid, msg, 'megumin', '💥 EXPLOSION!') },
  async mikasa({ sock, msg, jid }) {
    try { await sock.sendMessage(jid, { image: await genImage('mikasa ackerman attack on titan anime art beautiful dramatic', 'flux'), caption: '⚔️ Mikasa Ackerman' }, { quoted: msg }) }
    catch { await sock.sendMessage(jid, { text: '⚔️ Mikasa Ackerman - Attack on Titan' }, { quoted: msg }) }
  },
  async naruto({ sock, msg, jid }) {
    try { await sock.sendMessage(jid, { image: await genImage('naruto uzumaki anime art nine tails chakra dramatic', 'flux'), caption: '🍥 Naruto Uzumaki' }, { quoted: msg }) }
    catch { await sock.sendMessage(jid, { text: '🍥 Naruto Uzumaki - Naruto' }, { quoted: msg }) }
  },
  async sasuke({ sock, msg, jid }) {
    try { await sock.sendMessage(jid, { image: await genImage('sasuke uchiha anime sharingan rinnegan dark dramatic', 'flux'), caption: '⚡ Sasuke Uchiha' }, { quoted: msg }) }
    catch { await sock.sendMessage(jid, { text: '⚡ Sasuke Uchiha - Naruto' }, { quoted: msg }) }
  },
  async itachi({ sock, msg, jid }) {
    try { await sock.sendMessage(jid, { image: await genImage('itachi uchiha anime akatsuki mangekyou sharingan dramatic', 'flux'), caption: '🌙 Itachi Uchiha' }, { quoted: msg }) }
    catch { await sock.sendMessage(jid, { text: '🌙 Itachi Uchiha - Naruto' }, { quoted: msg }) }
  },
  async madara({ sock, msg, jid }) {
    try { await sock.sendMessage(jid, { image: await genImage('madara uchiha anime rinnegan god-like dramatic dark', 'flux'), caption: '👁️ Madara Uchiha' }, { quoted: msg }) }
    catch { await sock.sendMessage(jid, { text: '👁️ Madara Uchiha - Naruto' }, { quoted: msg }) }
  },
  async gojo({ sock, msg, jid }) {
    try { await sock.sendMessage(jid, { image: await genImage('satoru gojo jujutsu kaisen blindfold infinity domain expansion', 'flux'), caption: '✨ Satoru Gojo' }, { quoted: msg }) }
    catch { await sock.sendMessage(jid, { text: '✨ Satoru Gojo - Jujutsu Kaisen' }, { quoted: msg }) }
  },
  async nezuko({ sock, msg, jid }) {
    try { await sock.sendMessage(jid, { image: await genImage('nezuko kamado demon slayer anime cute pink eyes bamboo', 'flux'), caption: '🎋 Nezuko Kamado' }, { quoted: msg }) }
    catch { await sock.sendMessage(jid, { text: '🎋 Nezuko Kamado - Demon Slayer' }, { quoted: msg }) }
  },
  async kurumi({ sock, msg, jid }) {
    try { await sock.sendMessage(jid, { image: await genImage('kurumi tokisaki date a live gothic clock eyes dark beautiful', 'flux'), caption: '🕐 Kurumi Tokisaki' }, { quoted: msg }) }
    catch { await sock.sendMessage(jid, { text: '🕐 Kurumi Tokisaki - Date A Live' }, { quoted: msg }) }
  },
  async onepiece({ sock, msg, jid }) {
    try { await sock.sendMessage(jid, { image: await genImage('luffy one piece gear fifth sun god nika dramatic powerful', 'flux'), caption: '☠️ One Piece' }, { quoted: msg }) }
    catch { await sock.sendMessage(jid, { text: '☠️ One Piece - Luffy' }, { quoted: msg }) }
  },
  async yumeko({ sock, msg, jid }) {
    try { await sock.sendMessage(jid, { image: await genImage('yumeko jabami kakegurui red eyes gambling beautiful intense', 'flux'), caption: '🎲 Yumeko Jabami' }, { quoted: msg }) }
    catch { await sock.sendMessage(jid, { text: '🎲 Yumeko Jabami - Kakegurui' }, { quoted: msg }) }
  },
}
