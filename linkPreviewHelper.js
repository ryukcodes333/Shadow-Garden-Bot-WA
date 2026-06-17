'use strict'
const https = require('https')
const http  = require('http')

function fetchHtml(url, maxBytes = 150000, timeoutMs = 8000) {
  return new Promise(resolve => {
    try {
      const client = url.startsWith('https') ? https : http
      const req = client.get(url, {
        timeout: timeoutMs,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkBot/1.0)' },
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          return fetchHtml(res.headers.location, maxBytes, timeoutMs).then(resolve)
        }
        if (res.statusCode !== 200) { res.resume(); return resolve(null) }
        const chunks = []
        let total = 0
        res.on('data', c => {
          total += c.length
          chunks.push(c)
          if (total >= maxBytes) { res.destroy(); resolve(Buffer.concat(chunks).toString('utf8')) }
        })
        res.on('end',   () => resolve(chunks.length ? Buffer.concat(chunks).toString('utf8') : null))
        res.on('error', () => resolve(null))
      })
      req.on('error',   () => resolve(null))
      req.on('timeout', () => { req.destroy(); resolve(null) })
    } catch { resolve(null) }
  })
}

function parseOgMeta(html) {
  const get = (...props) => {
    for (const prop of props) {
      const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"'<>]+)["']`, 'i')
      const re2 = new RegExp(`<meta[^>]+content=["']([^"'<>]+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i')
      const m = re1.exec(html) || re2.exec(html)
      if (m) return m[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'")
    }
    return null
  }
  const getTitle = () => {
    const t = get('og:title', 'twitter:title', 'title')
    if (t) return t
    const m = /<title[^>]*>([^<]{1,120})<\/title>/i.exec(html)
    return m ? m[1].trim() : null
  }
  return {
    title: getTitle(),
    desc:  get('og:description', 'twitter:description', 'description'),
    image: get('og:image', 'twitter:image', 'twitter:image:src'),
    url:   get('og:url', 'canonical'),
  }
}

function dlBuf(url, timeoutMs = 9000) {
  return new Promise(resolve => {
    try {
      const client = url.startsWith('https') ? https : http
      const req = client.get(url, { timeout: timeoutMs, headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); return dlBuf(res.headers.location, timeoutMs).then(resolve)
        }
        if (res.statusCode !== 200) { res.resume(); return resolve(null) }
        const chunks = []
        let size = 0
        res.on('data', c => { size += c.length; if (size < 4_000_000) chunks.push(c) })
        res.on('end',   () => resolve(chunks.length ? Buffer.concat(chunks) : null))
        res.on('error', () => resolve(null))
      })
      req.on('error',   () => resolve(null))
      req.on('timeout', () => { req.destroy(); resolve(null) })
    } catch { resolve(null) }
  })
}

async function buildLinkPreview(url) {
  const html = await fetchHtml(url).catch(() => null)
  if (!html) return null

  const { title, desc, image } = parseOgMeta(html)
  if (!title && !image) return null

  let thumbnail = null
  if (image) {
    try {
      const imgUrl = image.startsWith('http') ? image : new URL(image, url).href
      const rawBuf = await dlBuf(imgUrl).catch(() => null)
      if (rawBuf) {
        try {
          const sharp = require('sharp')
          thumbnail = await sharp(rawBuf)
            .resize(320, 180, { fit: 'cover', position: 'centre' })
            .jpeg({ quality: 75 })
            .toBuffer()
        } catch { thumbnail = null }
      }
    } catch {}
  }

  // Field names must match Baileys 7.x WAUrlInfo exactly
  return {
    'canonical-url':      url,
    'matched-text':       url,
    title:                (title || url).slice(0, 100),
    description:          (desc  || '').slice(0, 200),
    jpegThumbnail:        thumbnail || undefined,
  }
}

const KONO_DOMAIN = 'https://konosubacommunity.onrender.com'

async function buildMiniPartyCard(p) {
  if (!p.pokemon_id) return null
  const raw   = p.name || 'Unknown'
  const name  = raw.charAt(0).toUpperCase() + raw.slice(1)
  const level = p.level || 1
  const types = Array.isArray(p.types) ? p.types.join(' / ') : (p.types || '?')
  const artUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.pokemon_id}.png`
  const sprUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.pokemon_id}.png`
  let thumbnail = null
  try {
    const rawBuf = await dlBuf(artUrl).catch(() => null) || await dlBuf(sprUrl).catch(() => null)
    if (rawBuf) {
      const sharp = require('sharp')
      thumbnail = await sharp(rawBuf)
        .resize(100, 100, { fit: 'contain', background: { r: 18, g: 18, b: 40, alpha: 1 } })
        .jpeg({ quality: 85 })
        .toBuffer()
    }
  } catch {}
  return {
    title:                name,
    body:                 `Level ${level} · ${types}`,
    thumbnail,
    sourceUrl:            `https://pokemondb.net/pokedex/${raw.toLowerCase()}`,
    mediaType:            1,
    renderLargerThumbnail: false,
    showAdUrl:            false,
  }
}

module.exports = { buildLinkPreview, buildMiniPartyCard }
