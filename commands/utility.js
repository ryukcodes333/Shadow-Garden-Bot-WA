const axios = require('axios')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')

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

// Fetch movie poster as buffer
async function fetchMoviePoster(posterPath) {
  if (!posterPath) return null
  try {
    const url = posterPath.startsWith('http') ? posterPath : `https://image.tmdb.org/t/p/w500${posterPath}`
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 })
    return Buffer.from(res.data)
  } catch { return null }
}

// Search movie using imdbot free API
async function searchMovie(query) {
  try {
    const res = await axios.get(`https://search.imdbot.workers.dev/?q=${encodeURIComponent(query)}`, { timeout: 10000 })
    const items = res.data?.description || []
    if (!items.length) return null
    const m = items[0]
    return {
      title:    m['#TITLE']    || query,
      year:     m['#YEAR']     || 'N/A',
      imdb_id:  m['#IMDB_ID']  || '',
      rank:     m['#RANK']     || 'N/A',
      actors:   (m['#ACTORS']  || '').split(',').slice(0, 3).join(', '),
      poster:   m['#IMG_POSTER'] || null,
      link:     m['#IMDB_ID']  ? `https://www.imdb.com/title/${m['#IMDB_ID']}` : null,
    }
  } catch { return null }
}

module.exports = {
  async translate({ reply, args }) {
    const text = args.slice(1).join(' ')
    const lang = args[0]?.toLowerCase() || 'en'
    if (!text) return reply('⚠️ Usage: .translate <lang> <text>\n\nExample: .translate fr Hello world')
    try {
      const res = await axios.get(`https://api.mymemory.translated.net/get`, {
        params: { q: args.slice(1).join(' '), langpair: `auto|${lang}` },
        timeout: 10000,
      })
      const result = res.data?.responseData?.translatedText
      if (!result) return reply('❌ Translation failed.')
      await reply(`🌐 *Translation* (→ ${lang.toUpperCase()})\n\n${result}`)
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },
  async tr(ctx) { return module.exports.translate(ctx) },

  async tts({ sock, msg, jid, reply, args }) {
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: .tts <text>')
    try {
      const url  = `https://api.voicerss.org/?key=free&hl=en-us&src=${encodeURIComponent(text)}&f=16khz_16bit_mono`
      const res  = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 })
      await sock.sendMessage(jid, { audio: Buffer.from(res.data), mimetype: 'audio/mpeg', ptt: false }, { quoted: msg })
    } catch {
      await reply(`🔊 TTS: "${text}"\n\n(Audio unavailable right now)`)
    }
  },
  async say(ctx) { return module.exports.tts(ctx) },

  async tovn({ sock, msg, jid, reply, args }) {
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: .tovn <text>')
    try {
      const url = `https://api.voicerss.org/?key=free&hl=en-us&src=${encodeURIComponent(text)}&f=16khz_16bit_mono`
      const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 })
      await sock.sendMessage(jid, { audio: Buffer.from(res.data), mimetype: 'audio/mpeg', ptt: true }, { quoted: msg })
    } catch {
      await reply(`🔊 VN: "${text}"\n\n(Audio unavailable)`)
    }
  },

  async tourl({ reply, args }) {
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: .tourl <long url>')
    try {
      const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(text)}`, { timeout: 10000 })
      await reply(`🔗 *Short URL*\n\n${res.data}`)
    } catch { await reply('❌ URL shortening failed') }
  },
  async tinyurl(ctx) { return module.exports.tourl(ctx) },
  async shorturl(ctx) { return module.exports.tourl(ctx) },

  async readmore({ sock, msg, jid, args }) {
    const text = args.join(' ')
    if (!text) return sock.sendMessage(jid, { text: '⚠️ Usage: .readmore <text>' }, { quoted: msg })
    const hidden = '\u200e'.repeat(4001)
    await sock.sendMessage(jid, { text: `${text}${hidden}` }, { quoted: msg })
  },

  async qrcode({ sock, msg, jid, reply, args }) {
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: .qrcode <text>')
    try {
      const QRCode = require('qrcode')
      const buffer = await QRCode.toBuffer(text, { width: 400, margin: 2 })
      await sock.sendMessage(jid, { image: buffer, caption: `📱 QR Code\n\n${text}` }, { quoted: msg })
    } catch (e) { await reply(`❌ Failed: ${e.message}`) }
  },

  async readqr({ reply }) {
    await reply('📷 QR reading from images isn\'t supported in this version. Try a QR scanner app.')
  },

  async lyrics({ reply, args }) {
    const query = args.join(' ')
    if (!query) return reply('⚠️ Usage: .lyrics <song name>')
    try {
      const parts  = query.split('-').map(s => s.trim())
      const artist = parts.length > 1 ? parts[0] : ''
      const title  = parts.length > 1 ? parts.slice(1).join('-').trim() : query
      const url    = artist
        ? `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
        : `https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`

      if (!artist) {
        const sugRes = await axios.get(url, { timeout: 10000 })
        const first  = sugRes.data?.data?.[0]
        if (!first) return reply('❌ Song not found.')
        const lr = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(first.artist.name)}/${encodeURIComponent(first.title)}`, { timeout: 10000 })
        const lyr = lr.data?.lyrics?.slice(0, 2000)
        if (!lyr) return reply('❌ Lyrics not found.')
        return reply(`🎵 *${first.title}* by ${first.artist.name}\n\n${lyr}${lr.data.lyrics.length > 2000 ? '\n\n...(truncated)' : ''}`)
      }

      const res    = await axios.get(url, { timeout: 10000 })
      const lyrics = res.data?.lyrics?.slice(0, 2000)
      if (!lyrics) return reply('❌ Lyrics not found.')
      await reply(`🎵 *${title}*${artist ? ` by ${artist}` : ''}\n\n${lyrics}${res.data.lyrics.length > 2000 ? '\n\n...(truncated)' : ''}`)
    } catch { await reply('❌ Lyrics not found. Try: .lyrics artist - song') }
  },

  async movie({ sock, msg, jid, reply, args }) {
    const query = args.join(' ')
    if (!query) return reply('⚠️ Usage: .movie <movie name>')

    await reply('🎬 Searching...')

    try {
      const m = await searchMovie(query)
      if (!m) return reply('❌ Movie not found.')

      const caption =
        `🎬 *${m.title}*\n\n` +
        `📅 Year: ${m.year}\n` +
        `⭐ Rank: #${m.rank}\n` +
        `🎭 Stars: ${m.actors || 'N/A'}\n` +
        (m.link ? `\n🔗 ${m.link}` : '')

      // Try to send with poster image
      if (m.poster) {
        const imgBuf = await fetchMoviePoster(m.poster)
        if (imgBuf) {
          return sock.sendMessage(jid, { image: imgBuf, caption }, { quoted: msg })
        }
      }

      // Fallback: text only
      await reply(caption)
    } catch (e) {
      await reply('❌ Movie not found.')
    }
  },

  async ytsearch({ reply, args }) {
    const query = args.join(' ')
    if (!query) return reply('⚠️ Usage: .ytsearch <query>')
    try {
      const res  = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000,
      })
      const ids  = [...res.data.matchAll(/videoId\\?":\\?"([a-zA-Z0-9_-]{11})\\?"/g)].map(m => m[1])
      const unique = [...new Set(ids)].slice(0, 5)
      if (!unique.length) return reply('❌ No results found.')
      const links = unique.map((id, i) => `${i + 1}. https://youtu.be/${id}`).join('\n')
      await reply(`🔍 *YouTube: ${query}*\n\n${links}`)
    } catch { await reply('❌ Search failed.') }
  },

  async google({ reply, args }) {
    const query = args.join(' ')
    if (!query) return reply('⚠️ Usage: .google <query>')
    await reply(`🔍 Search: https://www.google.com/search?q=${encodeURIComponent(query)}`)
  },

  async weather({ reply, args }) {
    const location = args.join(' ')
    if (!location) return reply('⚠️ Usage: .weather <city>')
    try {
      const res  = await axios.get(`https://wttr.in/${encodeURIComponent(location)}?format=j1`, { timeout: 10000 })
      const cur  = res.data?.current_condition?.[0]
      const area = res.data?.nearest_area?.[0]
      if (!cur) return reply('❌ Location not found.')
      const city = area?.areaName?.[0]?.value || location
      await reply(
        `🌤️ *Weather — ${city}*\n\n` +
        `🌡️ ${cur.temp_C}°C / ${cur.temp_F}°F\n` +
        `💧 Humidity: ${cur.humidity}%\n` +
        `💨 Wind: ${cur.windspeedKmph} km/h\n` +
        `☁️ ${cur.weatherDesc?.[0]?.value || 'N/A'}`
      )
    } catch { await reply('❌ Couldn\'t get weather. Check city name.') }
  },

  async wiki({ reply, args }) {
    const query = args.join(' ')
    if (!query) return reply('⚠️ Usage: .wiki <topic>')
    try {
      const res = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, { timeout: 10000 })
      const p   = res.data
      if (p.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') return reply('❌ Topic not found.')
      await reply(`📖 *${p.title}*\n\n${p.extract?.slice(0, 500) || 'No info found'}`)
    } catch { await reply('❌ Wikipedia search failed.') }
  },

  async news({ reply, args }) {
    const topic = args.join(' ') || 'world'
    try {
      const res = await axios.get(`https://gnews.io/api/v4/search?q=${encodeURIComponent(topic)}&lang=en&max=5&apikey=free`, { timeout: 10000 })
      const articles = res.data?.articles?.slice(0, 5)
      if (!articles?.length) return reply(`📰 Search for *${topic}* news:\nhttps://news.google.com/search?q=${encodeURIComponent(topic)}`)
      const lines = articles.map((a, i) => `${i + 1}. *${a.title}*\n${a.url}`).join('\n\n')
      await reply(`📰 *News: ${topic}*\n\n${lines}`)
    } catch {
      await reply(`📰 Search for *${topic}* news:\nhttps://news.google.com/search?q=${encodeURIComponent(topic)}`)
    }
  },

  async ssweb({ sock, msg, jid, reply, args }) {
    const url = args[0]
    if (!url) return reply('⚠️ Usage: .ssweb <url>')
    try {
      const ss = await axios.get(`https://image.thum.io/get/width/1280/crop/720/${encodeURIComponent(url)}`, {
        responseType: 'arraybuffer', timeout: 20000,
      })
      await sock.sendMessage(jid, { image: Buffer.from(ss.data), caption: `🌐 ${url}` }, { quoted: msg })
    } catch { await reply(`❌ Screenshot failed.`) }
  },

  async myip({ reply }) {
    try {
      const res = await axios.get('https://api.ipify.org?format=json', { timeout: 8000 })
      await reply(`🌐 Bot IP: ${res.data.ip}`)
    } catch { await reply('❌ Couldn\'t get IP') }
  },

  async ytmp4({ reply, args }) {
    const url = args[0]
    if (!url) return reply('⚠️ Usage: .ytmp4 <youtube url>')
    try {
      const res = await axios.post(`https://co.wuk.sh/api/json`, {
        url, vCodec: 'h264', vQuality: '720', aFormat: 'mp3', isAudioOnly: false,
      }, { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 20000 })
      if (res.data?.url) return reply(`🎬 *Download ready!*\n\n${res.data.url}`)
      await reply(`❌ Download failed.\n\n💡 Try: https://y2mate.com`)
    } catch { await reply(`❌ Download failed.\n\n💡 Try: https://y2mate.com`) }
  },

  async ytmp3({ reply, args }) {
    const url = args[0]
    if (!url) return reply('⚠️ Usage: .ytmp3 <youtube url>')
    try {
      const res = await axios.post(`https://co.wuk.sh/api/json`, {
        url, aFormat: 'mp3', isAudioOnly: true,
      }, { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 20000 })
      if (res.data?.url) return reply(`🎵 *Download ready!*\n\n${res.data.url}`)
      await reply(`❌ Download failed.\n\n💡 Try: https://y2mate.com`)
    } catch { await reply(`❌ Download failed.\n\n💡 Try: https://y2mate.com`) }
  },

  async tiktok({ reply, args }) {
    await reply(`📥 TikTok:\nhttps://snaptik.app/?url=${encodeURIComponent(args[0] || '')}`)
  },
  async instagram({ reply, args }) {
    await reply(`📥 Instagram:\nhttps://snapinsta.app/?url=${encodeURIComponent(args[0] || '')}`)
  },
  async facebook({ reply, args }) {
    await reply(`📥 Facebook:\nhttps://fdownloader.net/?url=${encodeURIComponent(args[0] || '')}`)
  },
  async twitter({ reply, args }) {
    await reply(`📥 Twitter:\nhttps://twittervideodownloader.com/?url=${encodeURIComponent(args[0] || '')}`)
  },
  async threads({ reply, args }) {
    await reply(`📥 Threads:\nhttps://threadsaver.com/?url=${encodeURIComponent(args[0] || '')}`)
  },
  async capcut({ reply, args }) {
    await reply(`📥 CapCut:\nhttps://capcutdownloader.io/?url=${encodeURIComponent(args[0] || '')}`)
  },
  async mediafire({ reply, args }) {
    if (!args[0]) return reply('⚠️ Usage: .mediafire <url>')
    await reply(`📥 MediaFire:\n${args[0]}\n\nOpen directly in browser to download.`)
  },
  async apk({ reply, args }) {
    const name = args.join(' ')
    if (!name) return reply('⚠️ Usage: .apk <app name>')
    await reply(`📱 APK Search: *${name}*\nhttps://apkpure.com/search?q=${encodeURIComponent(name)}`)
  },
  async pinterest({ reply, args }) {
    const query = args.join(' ')
    if (!query) return reply('⚠️ Usage: .pinterest <query>')
    await reply(`📌 Pinterest:\nhttps://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`)
  },

  async wallpaper({ sock, msg, jid, reply, args }) {
    const query = args.join(' ') || 'dark anime landscape'
    try {
      const res = await axios.get(
        `https://image.pollinations.ai/prompt/${encodeURIComponent(query + ' high quality wallpaper 4k')}?width=1920&height=1080&nologo=true&model=flux&seed=${Math.floor(Math.random() * 99999)}`,
        { responseType: 'arraybuffer', timeout: 60000 }
      )
      await sock.sendMessage(jid, { image: Buffer.from(res.data), caption: `🖼️ Wallpaper: ${query}` }, { quoted: msg })
    } catch { await reply('❌ Couldn\'t get wallpaper') }
  },

  async smeme({ reply }) {
    await reply('↩️ Reply to an image with .smeme <top text> / <bottom text>')
  },

  async qc({ reply, args, msg }) {
    const text = args.join(' ') ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation
    if (!text) return reply('↩️ Reply to a message or add text: .qc <text>')
    await reply(`💬 _${text}_\n\n— Shadow Garden`)
  },

  async emojimix({ reply, args }) {
    const emojis = args.join(' ').trim()
    if (!emojis) return reply('⚠️ Usage: .emojimix 😀 + 🔥')
    await reply(`🎨 Emoji mix: ${emojis}\n\nTry: https://emojikitchen.dev/`)
  },
}
