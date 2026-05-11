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

  async readqr({ sock, msg, jid, reply }) {
    await reply('📷 QR reading from images isn\'t supported in this version. Try a QR scanner app.')
  },

  async lyrics({ reply, args }) {
    const query = args.join(' ')
    if (!query) return reply('⚠️ Usage: .lyrics <song name>')
    try {
      const parts = query.split('-').map(s => s.trim())
      const artist = parts.length > 1 ? parts[0] : ''
      const title  = parts.length > 1 ? parts.slice(1).join('-').trim() : query
      const url    = artist
        ? `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
        : `https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`

      if (!artist) {
        const sugRes = await axios.get(url, { timeout: 10000 })
        const first  = sugRes.data?.data?.[0]
        if (!first) return reply('❌ Song not found.')
        const lyricRes = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(first.artist.name)}/${encodeURIComponent(first.title)}`, { timeout: 10000 })
        const lyrics   = lyricRes.data?.lyrics?.slice(0, 2000)
        if (!lyrics) return reply('❌ Lyrics not found.')
        return reply(`🎵 *${first.title}* by ${first.artist.name}\n\n${lyrics}${lyricRes.data.lyrics.length > 2000 ? '\n\n...(truncated)' : ''}`)
      }

      const res    = await axios.get(url, { timeout: 10000 })
      const lyrics = res.data?.lyrics?.slice(0, 2000)
      if (!lyrics) return reply('❌ Lyrics not found.')
      await reply(`🎵 *${title}*${artist ? ` by ${artist}` : ''}\n\n${lyrics}${res.data.lyrics.length > 2000 ? '\n\n...(truncated)' : ''}`)
    } catch { await reply('❌ Lyrics not found. Try: .lyrics artist - song') }
  },

  async movie({ reply, args }) {
    const query = args.join(' ')
    if (!query) return reply('⚠️ Usage: .movie <movie name>')
    try {
      const res = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&type=movie&limit=1`, { timeout: 10000 })
      const m   = res.data?.data?.[0]
      if (m) {
        return reply(
          `🎬 *${m.title}*\n\n` +
          `📅 Year: ${m.year || 'N/A'}\n` +
          `⭐ Score: ${m.score || 'N/A'}\n` +
          `🗂️ Status: ${m.status || 'N/A'}\n\n` +
          `📝 ${m.synopsis?.slice(0, 300) || 'No synopsis'}...`
        )
      }
      const wikiRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, { timeout: 10000 })
      const p = wikiRes.data
      await reply(`🎬 *${p.title}*\n\n${p.extract?.slice(0, 400) || 'No info found'}`)
    } catch { await reply('❌ Movie not found.') }
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
        `🌡️ Temp: ${cur.temp_C}°C / ${cur.temp_F}°F\n` +
        `💧 Humidity: ${cur.humidity}%\n` +
        `💨 Wind: ${cur.windspeedKmph} km/h\n` +
        `☁️ Condition: ${cur.weatherDesc?.[0]?.value || 'N/A'}`
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
      if (!articles?.length) {
        return reply(`📰 Search for *${topic}* news:\nhttps://news.google.com/search?q=${encodeURIComponent(topic)}`)
      }
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
      const ss  = await axios.get(`https://image.thum.io/get/width/1280/crop/720/${encodeURIComponent(url)}`, {
        responseType: 'arraybuffer', timeout: 20000,
      })
      await sock.sendMessage(jid, { image: Buffer.from(ss.data), caption: `🌐 ${url}` }, { quoted: msg })
    } catch { await reply(`❌ Screenshot failed. Try: ${url}`) }
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
      const apiUrl = `https://co.wuk.sh/api/json`
      const res = await axios.post(apiUrl, {
        url, vCodec: 'h264', vQuality: '720', aFormat: 'mp3', isAudioOnly: false,
      }, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 20000,
      })
      if (res.data?.url) {
        await reply(`🎬 *Download ready!*\n\n${res.data.url}`)
      } else {
        await reply('❌ Download failed. Try y2mate.com or similar.')
      }
    } catch { await reply(`❌ Download failed.\n\n💡 Try: https://y2mate.com`) }
  },

  async ytmp3({ reply, args }) {
    const url = args[0]
    if (!url) return reply('⚠️ Usage: .ytmp3 <youtube url>')
    try {
      const res = await axios.post(`https://co.wuk.sh/api/json`, {
        url, aFormat: 'mp3', isAudioOnly: true,
      }, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 20000,
      })
      if (res.data?.url) {
        await reply(`🎵 *Download ready!*\n\n${res.data.url}`)
      } else {
        await reply('❌ Download failed. Try y2mate.com or similar.')
      }
    } catch { await reply(`❌ Download failed.\n\n💡 Try: https://y2mate.com`) }
  },

  async tiktok({ reply, args }) {
    const url = args[0]
    if (!url) return reply('⚠️ Usage: .tiktok <tiktok url>')
    await reply(`📥 TikTok downloader:\nhttps://snaptik.app/?url=${encodeURIComponent(url || '')}`)
  },

  async instagram({ reply, args }) {
    const url = args[0]
    if (!url) return reply('⚠️ Usage: .instagram <instagram url>')
    await reply(`📥 Instagram downloader:\nhttps://snapinsta.app/?url=${encodeURIComponent(url || '')}`)
  },

  async facebook({ reply, args }) {
    const url = args[0]
    if (!url) return reply('⚠️ Usage: .facebook <facebook url>')
    await reply(`📥 Facebook downloader:\nhttps://fdownloader.net/?url=${encodeURIComponent(url || '')}`)
  },

  async twitter({ reply, args }) {
    const url = args[0]
    if (!url) return reply('⚠️ Usage: .twitter <tweet url>')
    await reply(`📥 Twitter downloader:\nhttps://twittervideodownloader.com/?url=${encodeURIComponent(url || '')}`)
  },

  async threads({ reply, args }) {
    const url = args[0]
    if (!url) return reply('⚠️ Usage: .threads <threads url>')
    await reply(`📥 Threads downloader:\nhttps://threadsaver.com/?url=${encodeURIComponent(url || '')}`)
  },

  async capcut({ reply, args }) {
    const url = args[0]
    if (!url) return reply('⚠️ Usage: .capcut <capcut url>')
    await reply(`📥 CapCut downloader:\nhttps://capcutdownloader.io/?url=${encodeURIComponent(url || '')}`)
  },

  async mediafire({ reply, args }) {
    const url = args[0]
    if (!url) return reply('⚠️ Usage: .mediafire <mediafire url>')
    await reply(`📥 MediaFire link:\n${url}\n\nOpen it directly in your browser to download.`)
  },

  async apk({ reply, args }) {
    const name = args.join(' ')
    if (!name) return reply('⚠️ Usage: .apk <app name>')
    await reply(`📱 Search for *${name}* APK:\nhttps://apkpure.com/search?q=${encodeURIComponent(name)}`)
  },

  async pinterest({ reply, args }) {
    const query = args.join(' ')
    if (!query) return reply('⚠️ Usage: .pinterest <query>')
    await reply(`📌 Pinterest search:\nhttps://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`)
  },

  async wallpaper({ sock, msg, jid, reply, args }) {
    const query = args.join(' ') || 'nature landscape dark'
    try {
      const res = await axios.get(`https://image.pollinations.ai/prompt/${encodeURIComponent(query + ' high quality wallpaper 4k')}?width=1920&height=1080&nologo=true&model=flux&seed=${Math.floor(Math.random() * 99999)}`, {
        responseType: 'arraybuffer', timeout: 60000,
      })
      await sock.sendMessage(jid, { image: Buffer.from(res.data), caption: `🖼️ Wallpaper: ${query}` }, { quoted: msg })
    } catch { await reply(`❌ Couldn't get wallpaper`) }
  },

  async smeme({ sock, msg, jid, reply }) {
    const ctx    = msg.message?.extendedTextMessage?.contextInfo
    const quoted = ctx?.quotedMessage
    if (!quoted?.imageMessage) return reply('↩️ Reply to an image with .smeme <top text> / <bottom text>')
    await reply('🎭 Meme maker coming soon! Reply to image.')
  },

  async qc({ sock, msg, jid, reply }) {
    const text = msg.message?.extendedTextMessage?.text ||
                 msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation
    if (!text) return reply('↩️ Reply to a text message with .qc to create a quote card')
    try {
      const QRCode = require('qrcode')
      const canvas = `https://api.quotable.io/random`
      const res    = await axios.get(canvas, { timeout: 8000 })
      await reply(`💬 *Quote Card*\n\n_${text}_\n\n— Shadow Garden`)
    } catch {
      await reply(`💬 _${text}_\n\n— Shadow Garden`)
    }
  },

  async emojimix({ reply, args }) {
    const emojis = args.join(' ').trim()
    if (!emojis) return reply('⚠️ Usage: .emojimix 😀 + 🔥')
    await reply(`🎨 Emoji mix: ${emojis}\n\nTry: https://emojikitchen.dev/`)
  },
}
