'use strict'
const db    = require('../database')
const http  = require('http')
const https = require('https')
const { execFile } = require('child_process')
const path  = require('path')
const os    = require('os')
const fs    = require('fs')

// ─── THREE CARD SOURCES ───────────────────────────────────────────────────────
// 1. Old shoob: [{title, tier (numeric "1"-"6"/"S"), url}] — no series, excluded from spawn/ci/card
const cardIndex = require('./card.json')
// 2. New shoob: [{name, tier (numeric), url, series}]
let cardIndex2 = []
try { cardIndex2 = require('./cards_shoob2.json') } catch {}
// 3. Mazoku: [{id, name, tier (C/R/SR/SSR/UR), series, url}]
let cardIndexMazoku = []
try { cardIndexMazoku = require('./cards_mazoku.json') } catch {}

// ─── TIERS ───────────────────────────────────────────────────────────────────
const TIER_PRICES  = { T1: 17500, T2: 27500, T3: 37500, T4: 50000, T5: 62500, T6: 72500, TS: 90000, TZ: 0 }
const TIERS        = { T1: '🥉', T2: '🔵', T3: '🟢', T4: '🔴', T5: '🟣', T6: '🟡', TS: '✨', TZ: '🌌', C: '⚪', R: '🔵', SR: '🟣', SSR: '🟡', UR: '🔴' }
const SPAWN_TIERS  = ['T1','T1','T1','T1','T2','T2','T2','T3','T3','T4','T4','T5','T6','TS']
const pendingCards = {}
const pendingGives = {}  // key: senderPhone, value: { toPhone, toJid, cardIndex, uc, expiresAt }

// ── Weighted auto-spawn tier picker ───────────────────────────────────────
// T1/T2/T3 are common; T4/T5/T6/TS are increasingly scarce.
// Weights calibrated so T4≈7/month, T5≈2/month, T6≈1/month, TS≈1/2months
// at the 7-spawns-per-day cap.
const AUTO_SPAWN_WEIGHTS = [
  { tier: 'T1', w: 5000 },
  { tier: 'T2', w: 3000 },
  { tier: 'T3', w: 1500 },
  { tier: 'T4', w: 340  },
  { tier: 'T5', w: 100  },
  { tier: 'T6', w: 50   },
  { tier: 'TS', w: 10   },
]
const TOTAL_WEIGHT = AUTO_SPAWN_WEIGHTS.reduce((s, e) => s + e.w, 0)
function pickAutoSpawnTier() {
  let r = Math.random() * TOTAL_WEIGHT
  for (const e of AUTO_SPAWN_WEIGHTS) { r -= e.w; if (r <= 0) return e.tier }
  return 'T1'
}

// Shoob numeric tier → label
const LOCAL_TO_LABEL = { '1':'T1','2':'T2','3':'T3','4':'T4','5':'T5','6':'T6','S':'TS','Z':'TZ' }
// Filter tier → numeric (for old/new shoob search)
const LABEL_TO_LOCAL = { T1:'1',T2:'2',T3:'3',T4:'4',T5:'5',T6:'6',TS:'S',TZ:'Z' }
// Valid tier strings for .ci / .fs arg parsing
const VALID_SHOOB   = ['T1','T2','T3','T4','T5','T6','TS','TZ']
const VALID_MAZOKU  = ['C','R','SR','SSR','UR']
const ALL_VALID_TIERS = [...VALID_SHOOB, ...VALID_MAZOKU]

// Deck background image path
const DECK_BG_PATH = path.join(__dirname, '..', 'assets', 'deck-bg.jpg')

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function norm(v) { return String(v || '').trim().toLowerCase() }

function hasRealSeries(series) {
  if (!series) return false
  const s = String(series).trim()
  return s !== '' && s !== '-'
}

function toShortId(input) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz'
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  let r = '', n = h
  for (let i = 0; i < 6; i++) { r += chars[n % chars.length]; n = Math.floor(n / chars.length) }
  return r
}
function extractCardId(url) { return toShortId(String(url || '').trim()) }

// ─── LID RESOLUTION ───────────────────────────────────────────────────────────
async function resolveLidMention(lid, sock, groupJid) {
  const lidJid = lid.includes('@lid') ? lid : `${lid}@lid`
  try {
    const groupMeta = await sock.groupMetadata(groupJid)
    const members   = groupMeta.participants
    for (const member of members) {
      try {
        const memberLid = await sock.getLidFromJid(member.id)
        if (memberLid === lidJid) {
          const number    = member.id.split('@')[0]
          const formatted = number.replace(/(\d{3})(\d{3})(\d{3})(\d{4})/, '$1 $2 $3 $4')
          return { tag: `@${formatted}`, jid: member.id }
        }
      } catch {}
    }
  } catch {}
  const numPart = lidJid.split('@')[0]
  return { tag: `@${numPart}`, jid: lidJid }
}

// Resolve an owners list to [{tag, jid}], handling @lid entries via group lookup
async function resolveOwnersList(owners, sock, groupJid) {
  if (!owners || !owners.length) return []
  return Promise.all(owners.slice(0, 10).map(async o => {
    const raw = (typeof o === 'object' ? (o?.phone || '') : String(o || ''))
    const num = raw.split('@')[0].split(':')[0] || ''
    if (!num) return { tag: '👤 _Unknown_', jid: null }
    const isLid = raw.includes('@lid') || !/^\d{7,15}$/.test(num)
    if (isLid && sock && groupJid) {
      const resolved = await resolveLidMention(raw, sock, groupJid).catch(() => ({ tag: `@${num}`, jid: `${num}@lid` }))
      return { tag: `👤 ${resolved.tag}`, jid: resolved.jid }
    }
    return { tag: `👤 @${num}`, jid: `${num}@s.whatsapp.net` }
  }))
}

// ─── CARD BLOCK LAYOUT ────────────────────────────────────────────────────────
// resolvedOwners: [{tag, jid}] produced by resolveOwnersList()
function cardBlock(name, tier, series, ownerCount, cardId, resolvedOwners) {
  const seriesLine = series && series !== '-' && series !== '' ? series : '—'
  const tierLine   = tier  // just the tier code, no name label

  let holdersSection
  if (!resolvedOwners || resolvedOwners.length === 0) {
    holdersSection = '\n> No owners found for this card yet.'
  } else {
    const roman = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ','Ⅹ']
    const lines  = resolvedOwners.map((o, i) => {
      return `⟡ 𝗖𝗼𝗽𝘆 ${roman[i] || i + 1} | \`${cardId}\`\n   ${o.tag}`
    }).join('\n')
    holdersSection = '\n' + lines
  }

  return (
    `╭━━━ ✦ 👑 ✦ ━━━╮\n` +
    `     🎴 𝗖𝗔𝗥𝗗 𝗜𝗡𝗙𝗢\n` +
    `╰━━━ ✦ 👑 ✦ ━━━╯\n\n` +
    `👑 𝗡𝗮𝗺𝗲: ${name}\n` +
    `📜 𝗦𝗲𝗿𝗶𝗲𝘀: ${seriesLine}\n` +
    `⭐ 𝗧𝗶𝗲𝗿: ${tierLine}\n` +
    `👥 𝗢𝘄𝗻𝗲𝗿𝘀: ${ownerCount}\n\n` +
    `╔═════ ✦ ═════╗\n` +
    `       👥 𝗛𝗢𝗟𝗗𝗘𝗥𝗦\n` +
    `╚═════ ✦ ═════╝` +
    holdersSection
  )
}

// ─── HTTP fetch with browser headers + redirect follow ───────────────────────
async function fetchBuf(url, _redirects = 0) {
  if (_redirects > 3) return null
  return new Promise((resolve) => {
    try {
      const parsed  = new URL(url)
      const client  = parsed.protocol === 'https:' ? https : http
      const options = {
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        timeout:  15000,
        headers:  {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer':    `https://${parsed.hostname}/`,
          'Accept':     'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
        },
      }
      const req = client.get(options, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          const loc = res.headers.location
          res.resume()
          return loc ? fetchBuf(loc, _redirects + 1).then(resolve) : resolve(null)
        }
        if (res.statusCode !== 200) { res.resume(); return resolve(null) }
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end',  () => resolve(Buffer.concat(chunks)))
        res.on('error', () => resolve(null))
      })
      req.on('error',   () => resolve(null))
      req.on('timeout', () => { req.destroy(); resolve(null) })
    } catch { resolve(null) }
  })
}

function isGifBuffer(buf) {
  return buf && buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46
}

async function gifBufToMp4(gifBuf) {
  return new Promise((resolve) => {
    const ts      = Date.now()
    const tmpGif  = path.join(os.tmpdir(), `cg_${ts}.gif`)
    const tmpMp4  = path.join(os.tmpdir(), `cg_${ts}.mp4`)
    const isLarge = gifBuf.length > 15 * 1024 * 1024   // >15 MB
    fs.writeFileSync(tmpGif, gifBuf)
    // For large GIFs, cap resolution at 480px and use lower bitrate to stay ≤19 MB
    const scaleFilter = isLarge
      ? `scale='if(gt(iw,480),480,-2)':'if(gt(ih,480),480,-2)',fps=12`
      : `scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=15`
    const bitrate = isLarge ? '600k' : '1M'
    execFile('ffmpeg', [
      '-y', '-i', tmpGif,
      '-movflags', 'faststart',
      '-pix_fmt', 'yuv420p',
      '-vf', scaleFilter,
      '-b:v', bitrate,
      '-maxrate', bitrate,
      '-bufsize', isLarge ? '1.2M' : '2M',
      '-an', tmpMp4,
    ], { timeout: 35000 }, (err) => {
      try { fs.unlinkSync(tmpGif) } catch {}
      if (err) { try { fs.unlinkSync(tmpMp4) } catch {}; return resolve(null) }
      try {
        const buf = fs.readFileSync(tmpMp4)
        fs.unlinkSync(tmpMp4)
        resolve(buf)
      } catch { resolve(null) }
    })
  })
}

// Send a card image — always fetches buffer (needed for CDNs like mazoku.cc)
// Extract mentionable @s.whatsapp.net JIDs from pre-resolved owners list
function ownerMentionJids(resolvedOwners) {
  if (!resolvedOwners || !resolvedOwners.length) return []
  return resolvedOwners.map(o => o.jid).filter(j => j && j.endsWith('@s.whatsapp.net'))
}

// Legacy alias used by .card command (non-group, no sock/groupJid available)
function ownerMentions(ownersList) {
  if (!ownersList || !ownersList.length) return []
  return ownersList.slice(0, 10).map(o => {
    const raw = (typeof o === 'object' ? (o?.phone || '') : String(o || ''))
    const num = raw.split('@')[0].split(':')[0]
    if (!num || !/^\d{7,15}$/.test(num)) return null
    return num + '@s.whatsapp.net'
  }).filter(Boolean)
}

async function sendCardMedia(sock, jid, msg, url, caption, mentions) {
  if (!url) return false
  try {
    // Fetch buffer first so CDNs like mazoku.cc that block direct URL access still work
    const buf = await fetchBuf(url)
    // Detect GIF by URL extension OR by magic bytes (GIF87a / GIF89a = 0x47 0x49 0x46)
    const isGif = url.toLowerCase().endsWith('.gif') || isGifBuffer(buf)
    const mentionsArr = mentions && mentions.length ? mentions : undefined
    if (isGif && buf) {
      const mp4Buf = await gifBufToMp4(buf)
      if (mp4Buf) {
        await sock.sendMessage(jid, { video: mp4Buf, gifPlayback: true, caption, ...(mentionsArr ? { mentions: mentionsArr } : {}) }, { quoted: msg })
        return true
      }
      await sock.sendMessage(jid, { video: { url }, gifPlayback: true, caption, ...(mentionsArr ? { mentions: mentionsArr } : {}) }, { quoted: msg })
      return true
    }
    if (buf) {
      await sock.sendMessage(jid, { image: buf, caption, ...(mentionsArr ? { mentions: mentionsArr } : {}) }, { quoted: msg })
    } else {
      await sock.sendMessage(jid, { image: { url }, caption, ...(mentionsArr ? { mentions: mentionsArr } : {}) }, { quoted: msg })
    }
    return true
  } catch { return false }
}

// ─── SEARCH: OLD SHOOB ────────────────────────────────────────────────────────
// Old shoob cards have no series — excluded from series-required contexts
function findOld(nameQuery, tierFilter) {
  const q  = norm(nameQuery)
  const lt = tierFilter ? LABEL_TO_LOCAL[tierFilter] : null
  if (!q) return []
  return cardIndex
    .filter(c => {
      if (norm(c.title) !== q) return false   // exact match only
      if (lt && String(c.tier) !== lt) return false
      return true
    })
    .map(c => ({
      name:   c.title,
      tier:   LOCAL_TO_LABEL[String(c.tier)] || String(c.tier),
      url:    c.url,
      series: '',
      source: 'shoob',
    }))
}

// ─── SEARCH: NEW SHOOB ───────────────────────────────────────────────────────
function findNew(nameQuery, tierFilter) {
  const q  = norm(nameQuery)
  const lt = tierFilter ? LABEL_TO_LOCAL[tierFilter] : null
  if (!q) return []
  return cardIndex2
    .filter(c => {
      if (norm(c.name) !== q) return false   // exact match only
      if (lt && String(c.tier) !== lt) return false
      return true
    })
    .map(c => ({
      name:   c.name,
      tier:   LOCAL_TO_LABEL[String(c.tier)] || String(c.tier),
      url:    c.url,
      series: c.series || '',
      source: 'shoob2',
    }))
}

// ─── SEARCH: MAZOKU ──────────────────────────────────────────────────────────
function findMazoku(nameQuery, tierFilter) {
  const q = norm(nameQuery)
  if (!q) return []
  return cardIndexMazoku
    .filter(c => {
      if (norm(c.name) !== q) return false   // exact match only
      if (tierFilter && c.tier !== tierFilter) return false
      return true
    })
    .map(c => ({
      name:   c.name,
      tier:   c.tier,
      url:    c.url,
      series: c.series || '',
      source: 'mazoku',
    }))
}

// ─── DEDUP: only keep cards with a real series; remove "-" and empty ──────────
function deduplicateResults(results) {
  // Step 1: Only keep entries with a real series (not "-", not empty)
  const filtered = results.filter(r => hasRealSeries(r.series))
  // Step 2: Deduplicate by exact URL only (same image = same card)
  const seenUrls = new Set()
  const output   = []
  for (const r of filtered) {
    if (!seenUrls.has(r.url)) {
      seenUrls.add(r.url)
      output.push(r)
    }
  }
  return output
}

// ─── MERGE ALL SOURCES WITH DEDUP ────────────────────────────────────────────
function findAll(nameQuery, tierFilter) {
  const isMazokuTier = tierFilter && VALID_MAZOKU.includes(tierFilter)
  const isShoobTier  = tierFilter && VALID_SHOOB.includes(tierFilter)

  // Old shoob cards have no series — still search them so .ci can find by name,
  // but deduplicateResults will drop them since series is empty.
  // Only new shoob (shoob2) and mazoku cards with real series survive.
  const fromOld    = (!tierFilter || isShoobTier)  ? findOld(nameQuery, tierFilter)    : []
  const fromNew    = (!tierFilter || isShoobTier)  ? findNew(nameQuery, tierFilter)    : []
  const fromMazoku = (!tierFilter || isMazokuTier) ? findMazoku(nameQuery, tierFilter) : []

  // deduplicateResults filters out empty/"-" series — only real-series cards remain
  const all = deduplicateResults([...fromNew, ...fromMazoku, ...fromOld])
  return all.sort((a, b) => a.tier.localeCompare(b.tier))
}

// ─── SERIES SEARCH ───────────────────────────────────────────────────────────
function findBySeries(seriesQuery, tierFilter) {
  const q = norm(seriesQuery)
  if (!q) return []

  const isMazokuTier = tierFilter && VALID_MAZOKU.includes(tierFilter)
  const isShoobTier  = tierFilter && VALID_SHOOB.includes(tierFilter)

  const fromNew = (!tierFilter || isShoobTier) ? cardIndex2
    .filter(c => norm(c.series).includes(q) && (!tierFilter || LOCAL_TO_LABEL[String(c.tier)] === tierFilter))
    .map(c => ({ name: c.name, tier: LOCAL_TO_LABEL[String(c.tier)] || String(c.tier), url: c.url, series: c.series || '' }))
    : []

  const fromMazoku = (!tierFilter || isMazokuTier) ? cardIndexMazoku
    .filter(c => norm(c.series).includes(q) && (!tierFilter || c.tier === tierFilter))
    .map(c => ({ name: c.name, tier: c.tier, url: c.url, series: c.series || '' }))
    : []

  return [...fromNew, ...fromMazoku]
    .filter(c => hasRealSeries(c.series))
    .sort((a, b) => norm(a.name).localeCompare(norm(b.name)))
}

// ─── RANDOM CARD — only series-having cards (shoob2 + mazoku with real series) ─
function getRandomCardByTier(tier) {
  const lt = tier ? LABEL_TO_LOCAL[tier] : null

  // Only pool2 (new shoob) with real series
  const pool2 = (lt ? cardIndex2.filter(c => String(c.tier) === lt) : cardIndex2)
    .filter(c => hasRealSeries(c.series))
    .map(c => ({ name: c.name, tier: LOCAL_TO_LABEL[String(c.tier)] || String(c.tier), url: c.url, series: c.series }))

  // Only pool3 (mazoku) with real series
  const pool3 = (tier ? cardIndexMazoku.filter(c => c.tier === tier) : cardIndexMazoku)
    .filter(c => hasRealSeries(c.series))
    .map(c => ({ name: c.name, tier: c.tier, url: c.url, series: c.series }))

  const pool = [...pool2, ...pool3]
  if (!pool.length) return null
  const raw = pool[Math.floor(Math.random() * pool.length)]
  return { id: extractCardId(raw.url), name: raw.name, title: raw.name, series: raw.series, tier: raw.tier, imageUrl: raw.url, _rawUrl: raw.url }
}

function getCardStats() {
  const byTier = {}
  const count  = t => { byTier[t] = (byTier[t] || 0) + 1 }
  cardIndex.forEach(c        => count(LOCAL_TO_LABEL[String(c.tier)] || String(c.tier)))
  cardIndex2.forEach(c       => count(LOCAL_TO_LABEL[String(c.tier)] || String(c.tier)))
  cardIndexMazoku.forEach(c  => count(c.tier))
  return { total: cardIndex.length + cardIndex2.length + cardIndexMazoku.length, byTier }
}

// ─── DECK IMAGE — background image + upscaled cards ──────────────────────────
async function _buildDeckImage(cards) {
  let sharp
  try { sharp = require('sharp') } catch { return null }

  // Upscaled to MAX — large card tiles, 4 rows × 3 cols = 12 cards
  const COLS = 3, CW = 280, CH = 390, PAD = 12, HEADER_H = 0
  const slice = cards.slice(0, 12)
  const ROWS  = Math.max(4, Math.ceil(slice.length / COLS))
  const W     = COLS * (CW + PAD) + PAD
  const H     = ROWS * (CH + PAD) + PAD + HEADER_H

  // Load deck background image
  let base
  try {
    if (fs.existsSync(DECK_BG_PATH)) {
      base = await sharp(DECK_BG_PATH)
        .resize(W, H, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 95 })
        .toBuffer()
    }
  } catch {}

  if (!base) {
    // Fallback: dark background
    base = await sharp({ create: { width: W, height: H, channels: 3, background: { r: 26, g: 26, b: 46 } } })
      .png()
      .toBuffer()
  }

  const composites = []
  for (let i = 0; i < slice.length; i++) {
    const uc     = slice[i], c = uc.card_id || uc
    const imgUrl = c?.image_url || null
    if (!imgUrl) continue
    const buf = await fetchBuf(imgUrl)
    if (!buf) continue
    try {
      const tile = await sharp(buf)
        .resize(CW, CH, { fit: 'cover', position: 'centre' })
        .toBuffer()
      const col  = i % COLS, row = Math.floor(i / COLS)
      composites.push({ input: tile, left: PAD + col * (CW + PAD), top: HEADER_H + PAD + row * (CH + PAD) })
    } catch {}
  }
  try {
    if (composites.length)
      return await sharp(base).composite(composites).jpeg({ quality: 95 }).toBuffer()
    return base
  } catch { return null }
}

// ─── COMMANDS ─────────────────────────────────────────────────────────────────
module.exports = {

  async spawnc({ sock, jid, msg, reply, react, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Only staff can spawn cards.')
    await react('⏳')
    try {
      const tier = SPAWN_TIERS[Math.floor(Math.random() * SPAWN_TIERS.length)]
      let card = getRandomCardByTier(tier)
      if (!card) card = getRandomCardByTier(null)
      if (!card) return reply('❌ No cards found.')
      const owners  = await db.getCardOwners(card._rawUrl || card.imageUrl).catch(() => [])
      const price   = TIER_PRICES[card.tier] || 0
      const caption =
        `✨ A collectable card has Spawned! \n\n` +
        `*🎴 Name:* ${card.name}\n` +
        `*⭐ Tier:* ${card.tier}\n` +
        `*📚 Series:* ${card.series}\n` +
        `*🏷️ Price:* ${price.toLocaleString()}\n` +
        `*🆔 Card ID:* ${card.id}\n` +
        `*#️⃣ Issues:* #${owners.length}\n\n` +
        `> Use .get \`${card.id}\` to claim this card! `
      pendingCards[jid] = { card, expiresAt: Date.now() + 120000 }
      setTimeout(() => { if (pendingCards[jid]?.card?.id === card.id) delete pendingCards[jid] }, 120000)
      const sent = await sendCardMedia(sock, jid, msg, card.imageUrl, caption)
      if (!sent) await sock.sendMessage(jid, { text: caption }, { quoted: msg })
    } catch (err) { await reply(`❌ Failed to spawn: ${err.message}`) }
  },
  async spawncard_random(ctx) { return module.exports.spawnc(ctx) },

  async get({ sock, jid, msg, reply, react, sender, senderJid, isGroup, args }) {
    const pending = pendingCards[jid]
    if (!pending || Date.now() > pending.expiresAt) return reply('❌ No card spawned right now!')
    const cardIdArg = args[0]
    if (cardIdArg && pending.card.id !== cardIdArg) return reply(`❌ Wrong card ID! Current card is \`${pending.card.id}\``)
    await react('⏳')
    const { card } = pending

    // ── Coin cost check (price = tier price) ───────────────────────────────
    const price = TIER_PRICES[card.tier] || 0
    if (price > 0) {
      const u = await db.getOrCreateUser(sender)
      if ((u.wallet || 0) < price) {
        return reply(
          `❌ *Not enough coins!*\n\n` +
          `*${card.name}* [${card.tier}] costs *$${price.toLocaleString()}* to claim.\n` +
          `Your wallet: *$${(u.wallet || 0).toLocaleString()}*`
        )
      }
      await db.updateUser(sender, { wallet: (u.wallet || 0) - price })
      await db.trackCurrencyRemoved(price)
    }

    delete pendingCards[jid]

    // ── Resolve LID to real phone before storing ownership ──────────────────
    let realPhone = sender
    if (senderJid?.endsWith('@lid') && isGroup) {
      try {
        const resolved = await resolveLidMention(senderJid, sock, jid)
        if (resolved.jid && resolved.jid.endsWith('@s.whatsapp.net')) {
          realPhone = resolved.jid.split('@')[0]
        }
      } catch {}
    }

    const rawUrl    = card._rawUrl || card.imageUrl || card.id
    const localCard = await db.getOrCreateShoobCard(rawUrl, card.name, card.tier, card.series, card.imageUrl || null, TIER_PRICES[card.tier] || 0).catch(() => null)
    if (!localCard) return reply('❌ Failed to save card.')
    await db.addUserCard(realPhone, localCard._id)
    await reply(
      `🎊 *Card Claimed!*\n\n` +
      `*🎴 Name:* ${card.name}\n` +
      `*⭐ Tier:* ${card.tier}\n` +
      (price > 0 ? `*💰 Paid:* $${price.toLocaleString()}` : '')
    )
  },

  // ─── .ci — send ALL matching cards at once ────────────────────────────────
  async ci({ sock, jid, msg, reply, react, args, isGroup }) {
    if (!args.length) return reply(`Usage: *.ci <name> [tier]*\nShoob tiers: T1-T6 TS | Mazoku tiers: C R SR SSR UR`)
    await react('⏳')
    let rawArgs = [...args]

    // Parse optional tier (must be last arg, must be a valid tier string)
    const lastArg = rawArgs[rawArgs.length - 1]?.toUpperCase()
    let nameQuery, tierFilter
    if (ALL_VALID_TIERS.includes(lastArg)) {
      nameQuery  = rawArgs.slice(0, -1).join(' ').trim()
      tierFilter = lastArg
    } else {
      nameQuery  = rawArgs.join(' ').trim()
      tierFilter = null
    }
    if (!nameQuery) return reply('⚠️ Please provide a card name.')

    try {
      const matches = findAll(nameQuery, tierFilter)
      if (!matches.length) return reply(`ℹ️ No cards match your search. Please try a different query.`)

      // Send ALL matching cards simultaneously — no list, just images
      const MAX_SEND = 6  // cap to avoid spam
      const toSend   = matches.slice(0, MAX_SEND)

      await Promise.all(toSend.map(async (m) => {
        const cardId = extractCardId(m.url)
        const owners = await db.getCardOwners(m.url).catch(() => [])
        const resolvedOwners = await resolveOwnersList(owners, sock, isGroup ? jid : null)
        const caption = cardBlock(m.name, m.tier, m.series, owners.length, cardId, resolvedOwners)
        const sent = await sendCardMedia(sock, jid, msg, m.url, caption, ownerMentionJids(resolvedOwners))
        if (!sent) await reply(caption)
      }))

      if (matches.length > MAX_SEND) {
        await reply(`_...and ${matches.length - MAX_SEND} more result(s). Add a tier filter to narrow down._`)
      }
    } catch (err) { await reply(`❌ Error: ${err.message}`) }
  },

  // ─── .ss — search by name, show list ────────────────────────────────────
  async ss({ reply, react, args }) {
    if (!args.length) return reply('⚠️ Usage: *.ss <card name>*')
    await react('⏳')
    const nameQuery = args.join(' ').trim()
    try {
      const matches = findAll(nameQuery, null)
      if (!matches.length) return reply(`ℹ️ No cards match your search. Please try a different query.`)

      const cardLines = matches.map((c, i) => {
        const s   = c.series && c.series !== '-' ? `\n   📚 _${c.series}_` : ''
        const src = c.source === 'mazoku' ? ' _(mazoku)_' : ''
        return `${i + 1}. ${TIERS[c.tier] || '🎴'} *${c.name}* (${c.tier})${src}${s}`
      }).join('\n')

      const header = `*🎴 "${nameQuery}" — ${matches.length} result(s)*\n\n`
      const full   = header + cardLines
      const MAX    = 4000
      if (full.length <= MAX) { await reply(full); return }
      const chunks = []; let cur = header.trimEnd()
      for (const line of cardLines.split('\n')) {
        if ((cur + '\n' + line).length > MAX) { chunks.push(cur); cur = '_(continued...)_' }
        cur += '\n' + line
      }
      chunks.push(cur)
      for (const chunk of chunks) await reply(chunk)
    } catch (err) { await reply(`❌ Error: ${err.message}`) }
  },

  // ─── .fs — find cards by series (exact layout) ───────────────────────────
  async fs({ sock, jid, msg, reply, react, args }) {
    if (!args.length) return reply(`Usage: *.fs <series name> [tier]*`)
    await react('⏳')
    let rawArgs = [...args]
    const lastArg = rawArgs[rawArgs.length - 1]?.toUpperCase()
    let seriesQuery, tierFilter
    if (ALL_VALID_TIERS.includes(lastArg)) {
      seriesQuery = rawArgs.slice(0, -1).join(' ').trim()
      tierFilter  = lastArg
    } else {
      seriesQuery = rawArgs.join(' ').trim()
      tierFilter  = null
    }
    if (!seriesQuery) return reply('⚠️ Provide a series name.')
    try {
      const matches = findBySeries(seriesQuery, tierFilter)
      if (!matches.length) return reply(`❌ No cards found in series: *${seriesQuery}*`)

      const tierCounts = {}
      for (const c of matches) { tierCounts[c.tier] = (tierCounts[c.tier] || 0) + 1 }
      const tierLines = Object.entries(tierCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([t, cnt]) => `${t} = ${cnt}`)
        .join('\n')

      const seriesName = matches[0]?.series || seriesQuery
      const cardLines  = matches.map(c => `[${c.tier}] ${c.name}`).join('\n')
      const text =
        `∘₊✧──────✧₊∘\n🔎 𝗦𝗘𝗥𝗜𝗘𝗦 𝗦𝗘𝗔𝗥𝗖𝗛\n∘₊✧──────✧₊∘\n\n` +
        `📚 𝗡𝗮𝗺𝗲: ${seriesName}\n🎴 𝗧𝗼𝘁𝗮𝗹 𝗖𝗮𝗿𝗱𝘀: ${matches.length}\n\n` +
        `✨ 𝗧𝗶𝗲𝗿𝘀:\n${tierLines}\n\n` +
        `∘₊✧──────✧₊∘\n📜 𝗖𝗔𝗥𝗗𝗦\n∘₊✧──────✧₊∘\n\n` +
        cardLines +
        `\n\n∘₊✧──────✧₊∘\n💡 Use .ci {card name} {tier} to view a card from this series\n∘₊✧──────✧₊∘`

      // Send first card image then the text
      const first = matches[0]
      if (first.url) {
        await sendCardMedia(sock, jid, msg, first.url, `📚 ${seriesName}`).catch(() => {})
      }

      const MAX = 4000
      if (text.length <= MAX) { await reply(text); return }
      const chunks = []; let cur = ''
      for (const line of text.split('\n')) {
        if ((cur + '\n' + line).length > MAX) { chunks.push(cur); cur = '' }
        cur += (cur ? '\n' : '') + line
      }
      if (cur) chunks.push(cur)
      for (const chunk of chunks) await reply(chunk)
    } catch (err) { await reply(`❌ Error: ${err.message}`) }
  },

  // ─── .card — view a card in your collection ──────────────────────────────
  async card({ sock, jid, msg, reply, react, sender, args }) {
    await react('⏳')
    const index = parseInt(args[0])
    if (!index || index < 1) return reply('⚠️ Usage: *.card <number>*')
    const cards = await db.getUserCards(sender)
    if (!cards.length) return reply('📭 Your collection is empty.')
    if (index > cards.length) return reply(`❌ You only have *${cards.length}* card(s).`)
    const uc      = cards[index - 1]
    const cardData = uc.card_id || uc
    const tier     = cardData?.tier || '?'
    const name     = cardData?.name || 'Unknown'
    const series   = cardData?.series || ''
    const imageUrl = cardData?.image_url || null
    const cardId   = extractCardId(imageUrl || name)
    const owners   = await db.getCardOwners(imageUrl).catch(() => [])
    const caption  = cardBlock(name, tier, series, owners.length, cardId, owners)
    const sent = await sendCardMedia(sock, jid, msg, imageUrl, caption, ownerMentions(owners))
    if (!sent) await reply(caption)
  },

  // ─── .coll ────────────────────────────────────────────────────────────────
  async coll({ reply, sender, msg }) {
    const mentioned   = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    let targetPhone = sender
    if (mentioned.length) {
      const _r = await db.getUserByJid(mentioned[0]).catch(() => null)
      targetPhone = _r?.phone || mentioned[0].split('@')[0].split(':')[0]
    }
    const cards = await db.getUserCards(targetPhone)
    if (!cards.length) return reply(`*🃏 Your collection:*\n\n_No cards yet._`)
    const lines = cards.map((uc, i) => {
      const c = uc.card_id || uc
      const series = c?.series && c.series !== '-' && c.series !== '' ? ` • _${c.series}_` : ''
      return `${i + 1}. ${TIERS[c?.tier] || '🎴'} *${c?.name || 'Unknown'}* [${c?.tier || '?'}]${series}`
    }).join('\n')
    await reply(`*🃏 Your collection:*\n\n${lines}`)
  },
  async collection(ctx) { return module.exports.coll(ctx) },

  async myseries({ reply, sender, msg }) {
    const mentioned   = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    let targetPhone = sender
    if (mentioned.length) {
      const _r = await db.getUserByJid(mentioned[0]).catch(() => null)
      targetPhone = _r?.phone || mentioned[0].split('@')[0].split(':')[0]
    }
    const cards = await db.getUserCards(targetPhone)
    if (!cards.length) return reply(`*📚 Your Cards By Series 📚*\n\n_No cards yet._`)
    const seriesSet = new Set()
    for (const uc of cards) {
      const c = uc.card_id || uc
      if (c?.series && c.series !== '-' && c.series !== '') seriesSet.add(c.series)
    }
    if (!seriesSet.size) return reply(`*📚 Your Cards By Series 📚*\n\n_No series data found._`)
    const lines = [...seriesSet].sort().map(s => `* ${s}`).join('\n')
    await reply(`*📚 Your Cards By Series 📚*\n\n${lines}`)
  },

  async cbs({ reply, sender, msg, args }) {
    const mentioned   = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    let targetPhone = sender
    if (mentioned.length) {
      const _r = await db.getUserByJid(mentioned[0]).catch(() => null)
      targetPhone = _r?.phone || mentioned[0].split('@')[0].split(':')[0]
    }
    const series = args.join(' ').trim()
    if (!series) return reply('⚠️ Usage: *.cbs <series name>*\nExample: *.cbs Dog Days*')
    const cards = await db.getUserCards(targetPhone)
    if (!cards.length) return reply(`*🃏 Your Cards By Series 📚*\n\n_No cards yet._`)
    const filtered = cards.filter(uc => {
      const c = uc.card_id || uc
      return c?.series && c.series.toLowerCase().includes(series.toLowerCase())
    })
    if (!filtered.length) return reply(`*🃏 Your Cards By Series 📚*\n\n_No cards found in series: ${series}_`)
    const lines = filtered.map(uc => {
      const c = uc.card_id || uc
      return `[${c?.tier || '?'}] ${c?.name || 'Unknown'}`
    }).join('\n')
    await reply(`*🃏 Your Cards By Series 📚*\n\n${lines}`)
  },

  async tier({ reply, sender, msg }) {
    const mentioned   = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    let targetPhone = sender
    if (mentioned.length) {
      const _r = await db.getUserByJid(mentioned[0]).catch(() => null)
      targetPhone = _r?.phone || mentioned[0].split('@')[0].split(':')[0]
    }
    const cards = await db.getUserCards(targetPhone)
    if (!cards.length) return reply(`*🏆 Cards By Tier:*\n\n_No cards yet._`)
    const TIER_ORDER  = ['TS','T6','T5','T4','T3','T2','T1','TZ','UR','SSR','SR','R','C']
    const TIER_LABELS = { TS:'S', T6:'6', T5:'5', T4:'4', T3:'3', T2:'2', T1:'1', TZ:'Z', UR:'UR', SSR:'SSR', SR:'SR', R:'R', C:'C' }
    const byTier = {}
    for (const uc of cards) {
      const c = uc.card_id || uc
      const t = c?.tier || '?'
      if (!byTier[t]) byTier[t] = []
      const _series = c?.series && c.series !== '-' && c.series !== '' ? ` • _${c.series}_` : ''
      byTier[t].push(`${c?.name || 'Unknown'}${_series}`)
    }
    const sections = TIER_ORDER
      .filter(t => byTier[t])
      .map(t => `*✨ Tier ${TIER_LABELS[t] || t}*\n\n${byTier[t].join('\n')}`)
      .join('\n\n')
    await reply(`*🏆 Cards By Tier:*\n\n${sections}`)
  },

  // ─── .deck ────────────────────────────────────────────────────────────────
  async deck({ sock, jid, msg, reply, react, sender }) {
    await react('🎴')
    const cards = await db.getUserCards(sender)
    if (!cards.length) return reply('📭 Your deck is empty.')
    // Prefer cards explicitly added to deck; fall back to first 12
    const deckCards = cards.filter(uc => uc.in_deck)
    const deckSlice = deckCards.length ? deckCards.slice(0, 12) : cards.slice(0, 12)
    const deckExtIds = deckSlice.map(uc => { const c = uc.card_id || uc; return c?.external_id || c?.id || '?' })
    let ownerCounts = {}
    try { ownerCounts = await db.getOwnerCountsBatch(deckExtIds) } catch {}
    const cardLines = deckSlice.map((uc, i) => {
      const c = uc.card_id || uc
      const _ser = c?.series && c.series !== '-' && c.series !== '' ? c.series : '—'
      return `\n🎴 *Name:* ${c?.name || 'Unknown'}\n📚 *Series:* ${_ser}\n⭐ *Tier:* ${c?.tier || '?'}\n🔷 *Index:* #${i + 1}\n#️⃣ *Owners:* ${ownerCounts[deckExtIds[i]] || 0}`
    }).join('\n\n')
    const ZWLTR  = '\u200e'.repeat(800)
    const caption =
      `*🎴 Your Deck 🎴*${ZWLTR}` +
      cardLines +
      (cards.length > 12 ? `\n\n_...and ${cards.length - 12} more. Use *.coll* for full list._` : '')
    let deckImage = null
    try { deckImage = await _buildDeckImage(deckSlice) } catch {}
    try {
      if (deckImage) await sock.sendMessage(jid, { image: deckImage, caption }, { quoted: msg })
      else await reply(caption)
    } catch { await reply(caption) }
  },
  async cd(ctx) { return module.exports.deck(ctx) },

  // ─── .cards — stats ───────────────────────────────────────────────────────
  async cards({ reply }) {
    try {
      const { total, byTier } = getCardStats()
      await reply(
        `🎴 *CARD DATABASE*\n\n` +
        `📦 *Total:* ${total.toLocaleString()}\n` +
        `   _(Shoob Classic + Shoob Extended + Mazoku)_\n\n` +
        Object.entries(byTier).sort().map(([t, c]) => `${TIERS[t] || '🎴'} ${t}: ${Number(c).toLocaleString()}`).join('\n')
      )
    } catch (err) { await reply(`❌ Error: ${err.message}`) }
  },

  async cardlb({ reply }) {
    try {
      const users = await db.getLeaderboard(10)
      const lines = await Promise.all(
        users.slice(0, 5).map(async (u, i) => {
          const count = await db.getUserCardCount(u.phone)
          return `${i + 1}. ${u.name || u.phone} — ${count} cards`
        })
      )
      await reply(`🎴 *CARD LEADERBOARD*\n\n${lines.join('\n')}`)
    } catch (err) { await reply(`❌ Error: ${err.message}`) }
  },

  async tc({ reply, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('Please mention a user to trade this card with.')
    await reply(`📤 *TRADE*\n\nTrade requests coming soon! 🖤`)
  },

  async dc({ reply, sender, args }) {
    const index = parseInt(args[0])
    if (!index || index < 1) return reply('⚠️ Usage: *.dc <card_number>*')
    const cards = await db.getUserCards(sender)
    if (index > cards.length) return reply(`❌ You only have ${cards.length} card(s).`)
    const uc = cards[index - 1]
    const c  = uc.card_id || uc
    await db.deleteUserCardById(uc.id)
    await reply(
      `🗑️ *CARD DISCARDED*\n\n` +
      `${TIERS[c?.tier] || '🎴'} *${c?.name || 'Unknown'}* (${c?.tier || '?'})\n\n` +
      `_Returned to the void._ 🖤`
    )
  },

  // ─── .sc — sell a card from collection at 1.5× tier price ───────────────
  async sc({ reply, sender, args }) {
    const index = parseInt(args[0])
    if (!index || index < 1) return reply('⚠️ Usage: *.sc <card_number>*\nSells the card at 1.5× its tier price.')
    const cards = await db.getUserCards(sender)
    if (!cards.length) return reply('📭 Your collection is empty.')
    if (index > cards.length) return reply(`❌ You only have *${cards.length}* card(s).`)
    const uc = cards[index - 1]
    const c  = uc.card_id || uc
    const tier  = c?.tier || 'T1'
    const base  = TIER_PRICES[tier] || 17500
    const price = Math.floor(base * 1.5)
    await db.deleteUserCardById(uc._id || uc.id)
    const u = await db.getOrCreateUser(sender)
    await db.updateUser(sender, { wallet: (u.wallet || 0) + price })
    await reply(
      `💸 *CARD SOLD!*\n\n` +
      `${TIERS[tier] || '🎴'} *${c?.name || 'Unknown'}* (${tier})\n\n` +
      `💰 *+$${price.toLocaleString()}* added to your wallet.\n` +
      `_(Sold at 1.5× base price of $${base.toLocaleString()})_`
    )
  },

  // ─── .ctd <number> — collection card → deck ──────────────────────────────
  async ctd({ reply, react, sender, args }) {
    await react('⏳')
    const index = parseInt(args[0])
    if (!index || index < 1) return reply('⚠️ Usage: *.ctd <card_number>*\nMoves card from collection into your deck.')
    const cards = await db.getUserCards(sender)
    if (!cards.length) return reply('📭 Your collection is empty.')
    if (index > cards.length) return reply(`❌ You only have *${cards.length}* card(s).`)
    const uc     = cards[index - 1]
    const c      = uc.card_id || uc
    const deckCount = cards.filter(x => x.in_deck).length
    if (deckCount >= 12) return reply('❌ Deck is full (max 12 cards). Use *.dtc* to remove one first.')
    if (uc.in_deck) return reply(`❌ *${c?.name || 'Unknown'}* is already in your deck.`)
    await db.updateUserCardById(uc._id || uc.id, { in_deck: true })
    await reply(
      `✅ *ADDED TO DECK*\n\n` +
      `${TIERS[c?.tier] || '🎴'} *${c?.name || 'Unknown'}* (${c?.tier || '?'})\n\n` +
      `📦 Collection → 🎴 Deck\n` +
      `_Deck now has ${deckCount + 1}/12 cards._`
    )
  },

  // ─── .dtc <number> | .dtc --all — deck card → collection ─────────────────
  async dtc({ reply, react, sender, args }) {
    await react('⏳')
    const all   = args[0]?.toLowerCase() === '--all'
    const cards = await db.getUserCards(sender)
    if (!cards.length) return reply('📭 Your collection is empty.')
    const deckCards = cards.filter(uc => uc.in_deck)
    if (!deckCards.length) return reply('📭 Your deck is empty. Use *.ctd* to add cards.')

    if (all) {
      await Promise.all(deckCards.map(uc => db.updateUserCardById(uc._id || uc.id, { in_deck: false }).catch(() => {})))
      return reply(`✅ *DECK CLEARED*\n\n🎴 ${deckCards.length} card(s) moved back to collection.`)
    }

    const index = parseInt(args[0])
    if (!index || index < 1) return reply('⚠️ Usage: *.dtc <deck_card_number>* or *.dtc --all*')
    if (index > deckCards.length) return reply(`❌ Deck only has *${deckCards.length}* card(s).`)
    const uc = deckCards[index - 1]
    const c  = uc.card_id || uc
    await db.updateUserCardById(uc._id || uc.id, { in_deck: false })
    await reply(
      `✅ *MOVED TO COLLECTION*\n\n` +
      `${TIERS[c?.tier] || '🎴'} *${c?.name || 'Unknown'}* (${c?.tier || '?'})\n\n` +
      `🎴 Deck → 📦 Collection`
    )
  },

  // ─── .spawncard {name} [tier] — owner-only: spawn specific card ─────────
  async spawncard({ sock, jid, msg, reply, react, sender, isOwner, args }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    await react('⏳')
    if (!args.length) return reply('⚠️ Usage: *.spawncard <name> [tier]*\nExample: *.spawncard Rimuru T5*')

    // Tier is optional — if last arg is a valid tier, use it
    let tierArg = null
    let nameParts = [...args]
    const lastArg = args[args.length - 1]?.toUpperCase()
    if (ALL_VALID_TIERS.includes(lastArg)) {
      tierArg  = lastArg
      nameParts = args.slice(0, -1)
    }
    const nameQuery = nameParts.join(' ').trim()
    if (!nameQuery) return reply('⚠️ Please provide a card name.')

    // Partial / fuzzy search across all sources
    const q = norm(nameQuery)
    function partialSearch(arr, nameField, tierField, toLabel, isMazoku) {
      return arr
        .filter(c => {
          const n = norm(c[nameField] || '')
          if (!n.includes(q)) return false
          if (tierArg) {
            const t = isMazoku ? c[tierField] : (toLabel[String(c[tierField])] || String(c[tierField]))
            return t === tierArg
          }
          return true
        })
        .map(c => ({
          name:   c[nameField],
          tier:   isMazoku ? c[tierField] : (toLabel[String(c[tierField])] || String(c[tierField])),
          url:    c.url,
          series: c.series || '',
          source: isMazoku ? 'mazoku' : 'shoob',
        }))
    }

    const matches = [
      ...partialSearch(cardIndex2,      'name',  'tier', LOCAL_TO_LABEL, false),
      ...partialSearch(cardIndexMazoku, 'name',  'tier', {},             true),
      ...partialSearch(cardIndex,       'title', 'tier', LOCAL_TO_LABEL, false),
    ]

    if (!matches.length) {
      return reply(`ℹ️ No cards match your search. Please try a different query.`)
    }

    const card = matches[0]
    try {
      const rawUrl = card.url || card.name
      const dbCard = await db.getOrCreateShoobCard(rawUrl, card.name, card.tier, card.series || '', card.url || null, TIER_PRICES[card.tier] || 0)
      await db.assignCard(sender, dbCard._id)
      const caption =
        `✅ *CARD SPAWNED*\n\n` +
        `${TIERS[card.tier] || '🎴'} *${card.name}* (${card.tier})\n` +
        `📚 *Series:* ${card.series || '—'}\n\n` +
        `_Added directly to your collection._ 🖤`
      if (card.url && sock) {
        const sent = await sendCardMedia(sock, jid, msg, card.url, caption).catch(() => false)
        if (!sent) await reply(caption)
      } else {
        await reply(caption)
      }
    } catch (err) {
      await reply(`❌ Error spawning card: ${err.message}`)
    }
  },

  async stardust({ reply }) { await reply(`✨ *STARDUST*\n\n_Coming soon…_ 🖤`) },

  // ─── .upload — staff adds a card to the database ─────────────────────────
  async upload({ reply, sender, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Only staff can upload cards.')
    if (!args.length) return reply(
      '⚠️ Usage: *.upload Name. Series Tier*\n' +
      'Example: *.upload Denji. Chainsaw Man T4*\n' +
      'Optional URL at end: *.upload Denji. Chainsaw Man T4 https://…*'
    )

    const rawText = args.join(' ')
    const dotIdx  = rawText.indexOf('. ')
    if (dotIdx === -1) return reply(
      '⚠️ Missing separator — format: *.upload Name. Series Tier*\n' +
      'Example: *.upload Denji. Chainsaw Man T4*'
    )

    const cardName   = rawText.slice(0, dotIdx).trim()
    const rest       = rawText.slice(dotIdx + 2).trim()
    const restParts  = rest.split(/\s+/)
    if (restParts.length < 2) return reply('⚠️ Usage: *.upload Name. Series Tier*\nExample: *.upload Denji. Chainsaw Man T4*')

    // Optional image URL as last arg
    let imageUrl   = null
    let tierIdx    = restParts.length - 1
    if (/^https?:\/\//i.test(restParts[restParts.length - 1])) {
      imageUrl = restParts[restParts.length - 1]
      tierIdx  = restParts.length - 2
      if (tierIdx < 1) return reply('⚠️ Usage: *.upload Name. Series Tier [url]*')
    }

    const tier = restParts[tierIdx].toUpperCase()
    if (!ALL_VALID_TIERS.includes(tier)) return reply(
      `⚠️ Invalid tier: *${tier}*\nValid tiers: ${ALL_VALID_TIERS.join(', ')}`
    )
    const series = restParts.slice(0, tierIdx).join(' ')
    if (!series) return reply('⚠️ Series name is required. Example: *.upload Denji. Chainsaw Man T4*')

    try {
      const price  = TIER_PRICES[tier] || 0
      const rarity = { T1:'Common',T2:'Uncommon',T3:'Rare',T4:'Epic',T5:'Legendary',T6:'Mythic',TS:'Special',TZ:'Zero' }[tier] || 'Common'
      const card   = await db.addCard(cardName, tier, series, price, imageUrl, rarity, sender)
      await reply(
        `✅ *CARD UPLOADED*\n\n` +
        `🎴 *Name:* ${cardName}\n` +
        `${TIERS[tier] || '🎴'} *Tier:* ${tier}\n` +
        `📚 *Series:* ${series}\n` +
        `💰 *Price:* ${price.toLocaleString()}\n` +
        (imageUrl ? `🖼️ *Image:* set\n` : `🖼️ *Image:* none\n`) +
        `🆔 *ID:* ${card._id}\n\n` +
        `_Card added to the database and available to spawn._`
      )
    } catch (err) {
      await reply(`❌ Failed to upload card: ${err.message}`)
    }
  },

  // ─── .cardspawn on/off — enable/disable auto card spawns for this group ──
  async cardspawn({ reply, args, jid, isGroup, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Only staff can toggle card spawning.')
    if (!isGroup) return reply('❌ This command only works in group chats.')
    const toggle = (args[0] || '').toLowerCase()
    if (toggle !== 'on' && toggle !== 'off') return reply('⚠️ Usage: *.cardspawn on* or *.cardspawn off*')
    const enabled = toggle === 'on'
    await db.setGroupCardSpawn(jid, enabled)
    if (enabled) {
      await reply(
        `✅ *Card Auto-Spawn ENABLED* for this group!\n\n` +
        `📋 *Rules:*\n` +
        `• Max *7 spawns* per day\n` +
        `• Spawn times are *completely random* (30min – 5h apart)\n` +
        `• Claim with *.get <card id>* — costs the card's full tier price\n` +
        `• Cards expire after *2 minutes* if unclaimed\n\n` +
        `🎲 *Rarity:* T1 common → TS extremely rare (once in ~2 months)`
      )
    } else {
      await reply(`🛑 *Card Auto-Spawn DISABLED* for this group.`)
    }
  },

  // ─── Auto-spawn engine — called on every group message ───────────────────
  // db.tickCardSpawn returns true when a spawn window has opened.
  async checkAutoSpawn(sock, jid) {
    try {
      const shouldSpawn = await db.tickCardSpawn(jid)
      if (!shouldSpawn) return
      const tier = pickAutoSpawnTier()
      let card = getRandomCardByTier(tier)
      if (!card) card = getRandomCardByTier('T1')
      if (!card) return
      const owners  = await db.getCardOwners(card._rawUrl || card.imageUrl).catch(() => [])
      const price   = TIER_PRICES[card.tier] || 0
      const caption =
        `✨ *A card has appeared!*\n\n` +
        `*🎴 Name:* ${card.name}\n` +
        `*⭐ Tier:* ${card.tier}\n` +
        `*📚 Series:* ${card.series}\n` +
        `*💰 Price:* $${price.toLocaleString()}\n` +
        `*🆔 Card ID:* ${card.id}\n` +
        `*#️⃣ Issues:* #${owners.length}\n\n` +
        `> Use *.get \`${card.id}\`* to claim! (expires in 2 min)`
      pendingCards[jid] = { card, expiresAt: Date.now() + 120000 }
      setTimeout(() => { if (pendingCards[jid]?.card?.id === card.id) delete pendingCards[jid] }, 120000)
      const sent = await sendCardMedia(sock, jid, null, card.imageUrl, caption)
      if (!sent) await sock.sendMessage(jid, { text: caption })
    } catch {}
  },

  // ─── .cg <index> — give a card to another user ───────────────────────────
  async cg({ sock, jid, msg, reply, sender, senderJid, args }) {
    const index = parseInt(args[0])
    if (!index || index < 1) return reply('⚠️ Usage: *.cg <card number>* (quote or @mention target)')

    // Resolve target from @mention or quoted message
    const mentioned        = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant
    let toJid, toPhone
    if (mentioned.length) {
      toJid   = mentioned[0]
      toPhone = toJid.split('@')[0].split(':')[0]
    } else if (quotedParticipant) {
      toJid   = quotedParticipant
      toPhone = quotedParticipant.split('@')[0].split(':')[0]
    } else {
      return reply('❌ Please *@tag* or *quote a message* from the person you want to give the card to.')
    }
    if (toPhone === sender) return reply('❌ You cannot give a card to yourself.')

    const cards = await db.getUserCards(sender)
    if (!cards.length) return reply('📭 Your collection is empty.')
    if (index > cards.length) return reply(`❌ You only have *${cards.length}* card(s). Use *.coll* to see them.`)

    const uc       = cards[index - 1]
    const cardData = uc.card_id || uc
    const name     = cardData?.name || 'Unknown'
    const tier     = cardData?.tier || '?'
    const series   = cardData?.series || ''

    // Store pending give (expires in 60s)
    // cardDbId = the Card document's _id (needed by addUserCard to create a new UserCard for the recipient)
    // ucId     = the sender's UserCard document's _id (needed by deleteUserCardById to remove it)
    const cardDbId = cardData?._id || cardData?.id || null
    pendingGives[sender] = { toPhone, toJid, cardIndex: index - 1, ucId: uc._id || uc.id, cardDbId, expiresAt: Date.now() + 2820000 }
    setTimeout(() => { if (pendingGives[sender]) delete pendingGives[sender] }, 2820000)

    await sock.sendMessage(jid, {
      text:
        `🎁 *Card Give — Confirmation*\n\n` +
        `*🎴 Card:* ${name}\n` +
        `*⭐ Tier:* ${tier}\n` +
        `*📚 Series:* ${series || '—'}\n` +
        `*📤 To:* @${toPhone}\n\n` +
        `Reply *.cgconfirm* to send, or *.cgcancel* to abort.\n` +
        `_(expires in 47 minutes)_`,
      mentions: [toJid],
    }, { quoted: msg })
  },

  // ─── .cgconfirm — execute the pending card give ──────────────────────────
  async cgconfirm({ reply, sender }) {
    const p = pendingGives[sender]
    if (!p || Date.now() > p.expiresAt) return reply('❌ No pending card give, or it expired. Use *.cg* again.')
    delete pendingGives[sender]
    try {
      if (!p.cardDbId) return reply('❌ Card data missing — please try .cg again.')
      // Remove the card from sender's collection (delete their UserCard entry)
      await db.deleteUserCardById(p.ucId)
      // Create a fresh UserCard entry for the recipient pointing at the same Card document
      await db.addUserCard(p.toPhone, p.cardDbId)
      await reply(`✅ *Card given to @${p.toPhone} successfully!*\n\nThey can view it with *.coll*`)
    } catch (err) {
      await reply(`❌ Failed to transfer card: ${err.message}`)
    }
  },

  // ─── .cgcancel — cancel a pending card give ──────────────────────────────
  async cgcancel({ reply, sender }) {
    if (!pendingGives[sender]) return reply('❌ No pending card give to cancel.')
    delete pendingGives[sender]
    await reply('✅ Card give cancelled.')
  },
}
