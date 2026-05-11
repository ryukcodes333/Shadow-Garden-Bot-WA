const axios = require('axios')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')

const GROQ_KEY = process.env.GROQ_KEY || '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'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const SYSTEM_PROMPT = `You are Alpha, the AI assistant for Shadow Garden WhatsApp Bot. Be helpful, concise, and friendly. Don't be overly formal. Keep responses short and readable on WhatsApp.`

async function askGroq(prompt, model = 'llama-3.3-70b-versatile') {
  const res = await axios.post(GROQ_URL, {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1024,
    temperature: 0.7,
  }, {
    headers: {
      Authorization: `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  })
  return res.data.choices[0].message.content
}

async function genImage(prompt, model = 'flux') {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&model=${model}&seed=${Math.floor(Math.random() * 99999)}`
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 })
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

async function handleAI(ctx, model) {
  const { reply, args, sock, jid, msg } = ctx
  const prompt = args.join(' ')
  if (!prompt) return reply(`🤖 Usage: .${ctx.cmd} <your question>`)
  await reply('⏳ Thinking...')
  try {
    const answer = await askGroq(prompt, model)
    await sock.sendMessage(jid, { text: answer }, { quoted: msg })
  } catch (e) {
    await reply(`❌ AI error: ${e.message}`)
  }
}

module.exports = {
  async ai(ctx)      { return handleAI(ctx, 'llama-3.3-70b-versatile') },
  async chatgpt(ctx) { return handleAI(ctx, 'llama-3.3-70b-versatile') },
  async gpt(ctx)     { return handleAI(ctx, 'llama-3.3-70b-versatile') },
  async groq(ctx)    { return handleAI(ctx, 'llama-3.3-70b-versatile') },
  async llama(ctx)   { return handleAI(ctx, 'llama-3.1-8b-instant') },
  async deepseek(ctx){ return handleAI(ctx, 'deepseek-r1-distill-llama-70b') },
  async mistral(ctx) { return handleAI(ctx, 'mixtral-8x7b-32768') },
  async gemini(ctx)  { return handleAI(ctx, 'gemma2-9b-it') },

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
      const buf = await genImage(prompt + ' ultra detailed cinematic')
      await sock.sendMessage(jid, { image: buf, caption: `🎨 ${prompt}` }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async aidetect({ sock, msg, jid, reply }) {
    const buf = await getImageBuffer(sock, msg)
    if (!buf) return reply('↩️ Send or reply to an image with .aidetect')
    await reply('🔍 Analyzing image...')
    try {
      const base64 = buf.toString('base64')
      const res = await axios.post(GROQ_URL.replace('chat/completions', 'chat/completions'), {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image in detail. What do you see? Keep it concise.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          ],
        }],
        max_tokens: 512,
      }, {
        headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      })
      const desc = res.data.choices[0].message.content
      await sock.sendMessage(jid, { text: `🔍 *Image Analysis*\n\n${desc}` }, { quoted: msg })
    } catch (e) {
      await reply(`❌ Analysis failed: ${e.message}`)
    }
  },

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
      const a = res.data?.data?.[0]
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

  async animekill({ sock, msg, jid, sender }) {
    await sendAnimeImg(sock, jid, msg, 'kill', `💀 @${sender} goes for the kill!`)
  },
  async animebite({ sock, msg, jid, sender }) {
    await sendAnimeImg(sock, jid, msg, 'bite', `😈 @${sender} bites!`)
  },
  async animewave({ sock, msg, jid, sender }) {
    await sendAnimeImg(sock, jid, msg, 'wave', `👋 @${sender} waves!`)
  },
  async animewink({ sock, msg, jid, sender }) {
    await sendAnimeImg(sock, jid, msg, 'wink', `😉 @${sender} winks~`)
  },
  async animebonk({ sock, msg, jid, sender }) {
    await sendAnimeImg(sock, jid, msg, 'slap', `🔨 @${sender} bonks you!`)
  },

  async megumin({ sock, msg, jid }) {
    await sendAnimeImg(sock, jid, msg, 'megumin', '💥 EXPLOSION!')
  },
  async mikasa({ sock, msg, jid }) {
    try {
      const buf = await genImage('mikasa ackerman attack on titan anime art beautiful dramatic', 'flux')
      await sock.sendMessage(jid, { image: buf, caption: '⚔️ Mikasa Ackerman' }, { quoted: msg })
    } catch { await sock.sendMessage(jid, { text: '⚔️ Mikasa Ackerman — Attack on Titan' }, { quoted: msg }) }
  },
  async naruto({ sock, msg, jid }) {
    try {
      const buf = await genImage('naruto uzumaki anime art naruto shippuden nine tails chakra dramatic', 'flux')
      await sock.sendMessage(jid, { image: buf, caption: '🍥 Naruto Uzumaki' }, { quoted: msg })
    } catch { await sock.sendMessage(jid, { text: '🍥 Naruto Uzumaki — Naruto' }, { quoted: msg }) }
  },
  async sasuke({ sock, msg, jid }) {
    try {
      const buf = await genImage('sasuke uchiha anime art sharingan rinnegan dark dramatic cool', 'flux')
      await sock.sendMessage(jid, { image: buf, caption: '⚡ Sasuke Uchiha' }, { quoted: msg })
    } catch { await sock.sendMessage(jid, { text: '⚡ Sasuke Uchiha — Naruto' }, { quoted: msg }) }
  },
  async itachi({ sock, msg, jid }) {
    try {
      const buf = await genImage('itachi uchiha anime art akatsuki mangekyou sharingan cool dramatic', 'flux')
      await sock.sendMessage(jid, { image: buf, caption: '🌙 Itachi Uchiha' }, { quoted: msg })
    } catch { await sock.sendMessage(jid, { text: '🌙 Itachi Uchiha — Naruto' }, { quoted: msg }) }
  },
  async madara({ sock, msg, jid }) {
    try {
      const buf = await genImage('madara uchiha anime art rinnegan powerful god-like dramatic dark', 'flux')
      await sock.sendMessage(jid, { image: buf, caption: '👁️ Madara Uchiha' }, { quoted: msg })
    } catch { await sock.sendMessage(jid, { text: '👁️ Madara Uchiha — Naruto' }, { quoted: msg }) }
  },
  async gojo({ sock, msg, jid }) {
    try {
      const buf = await genImage('satoru gojo jujutsu kaisen anime art blindfold infinity domain expansion cool', 'flux')
      await sock.sendMessage(jid, { image: buf, caption: '✨ Satoru Gojo' }, { quoted: msg })
    } catch { await sock.sendMessage(jid, { text: '✨ Satoru Gojo — Jujutsu Kaisen' }, { quoted: msg }) }
  },
  async nezuko({ sock, msg, jid }) {
    try {
      const buf = await genImage('nezuko kamado demon slayer anime art cute pink eyes bamboo mouth', 'flux')
      await sock.sendMessage(jid, { image: buf, caption: '🎋 Nezuko Kamado' }, { quoted: msg })
    } catch { await sock.sendMessage(jid, { text: '🎋 Nezuko Kamado — Demon Slayer' }, { quoted: msg }) }
  },
  async kurumi({ sock, msg, jid }) {
    try {
      const buf = await genImage('kurumi tokisaki date a live anime art gothic clock eyes dark beautiful', 'flux')
      await sock.sendMessage(jid, { image: buf, caption: '🕐 Kurumi Tokisaki' }, { quoted: msg })
    } catch { await sock.sendMessage(jid, { text: '🕐 Kurumi Tokisaki — Date A Live' }, { quoted: msg }) }
  },
  async onepiece({ sock, msg, jid }) {
    try {
      const buf = await genImage('luffy one piece anime art gear fifth sun god nika dramatic powerful', 'flux')
      await sock.sendMessage(jid, { image: buf, caption: '☠️ One Piece' }, { quoted: msg })
    } catch { await sock.sendMessage(jid, { text: '☠️ One Piece — Luffy' }, { quoted: msg }) }
  },
  async yumeko({ sock, msg, jid }) {
    try {
      const buf = await genImage('yumeko jabami kakegurui anime art red eyes gambling beautiful intense', 'flux')
      await sock.sendMessage(jid, { image: buf, caption: '🎲 Yumeko Jabami' }, { quoted: msg })
    } catch { await sock.sendMessage(jid, { text: '🎲 Yumeko Jabami — Kakegurui' }, { quoted: msg }) }
  },
}
