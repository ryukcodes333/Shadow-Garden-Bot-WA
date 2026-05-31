'use strict'
const db    = require('../database')
const http  = require('http')
const https = require('https')
const { execFile } = require('child_process')
const path  = require('path')
const os    = require('os')
const fs    = require('fs')

// ─── THREE CARD SOURCES ───────────────────────────────────────────────────────
// 1. Old shoob: [{title, tier (numeric "1"-"6"/"S"), url}]
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

// Shoob numeric tier → label
const LOCAL_TO_LABEL = { '1':'T1','2':'T2','3':'T3','4':'T4','5':'T5','6':'T6','S':'TS','Z':'TZ' }
// Filter tier → numeric (for old/new shoob search)
const LABEL_TO_LOCAL = { T1:'1',T2:'2',T3:'3',T4:'4',T5:'5',T6:'6',TS:'S',TZ:'Z' }
// Valid tier strings for .ci / .fs arg parsing
const VALID_SHOOB   = ['T1','T2','T3','T4','T5','T6','TS','TZ']
const VALID_MAZOKU  = ['C','R','SR','SSR','UR']
const ALL_VALID_TIERS = [...VALID_SHOOB, ...VALID_MAZOKU]

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function norm(v) { return String(v || '').trim().toLowerCase() }

function toShortId(input) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz'
  let h = 2166136261 >>> 0
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  let r = '', n = h
  for (let i = 0; i < 6; i++) { r += chars[n % chars.length]; n = Math.floor(n / chars.length) }
  return r
}
function extractCardId(url) { return toShortId(String(url || '').trim()) }

// ─── CARD BLOCK LAYOUT ────────────────────────────────────────────────────────
function cardBlock(name, tier, series, ownerCount, cardId, ownersList) {
  const seriesLine = series && series !== '-' && series !== '' ? series : '—'
  const tierLine   = tier  // just the tier code, no name label

  let holdersSection
  if (!ownersList || ownersList.length === 0) {
    holdersSection = '\n> No owners found for this card yet.'
  } else {
    const roman = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ','Ⅹ']
    const lines  = ownersList.slice(0, 10).map((o, i) =>
      `⟡ 𝗖𝗼𝗽𝘆 ${roman[i] || i + 1} | \`${cardId}\`\n   👤 @${o.phone || o}`
    ).join('\n')
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

// ─── GIF → MP4 (same as interactions.js) ─────────────────────────────────────
async function fetchBuf(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null) }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end',  () => resolve(Buffer.concat(chunks)))
      res.on('error', () => resolve(null))
    })
    req.on('error',   () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
  })
}

async function gifBufToMp4(gifBuf) {
  return new Promise((resolve) => {
    const tmpGif = path.join(os.tmpdir(), `cg_${Date.now()}.gif`)
    const tmpMp4 = path.join(os.tmpdir(), `cg_${Date.now()}.mp4`)
    fs.writeFileSync(tmpGif, gifBuf)
    execFile('ffmpeg', [
      '-y', '-i', tmpGif,
      '-movflags', 'faststart',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-an', tmpMp4,
    ], { timeout: 20000 }, (err) => {
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

// Send a card image — handles GIFs by converting to MP4 for gifPlayback
async function sendCardMedia(sock, jid, msg, url, caption) {
  if (!url) return false
  try {
    if (url.toLowerCase().endsWith('.gif')) {
      const gifBuf = await fetchBuf(url)
      if (gifBuf) {
        const mp4Buf = await gifBufToMp4(gifBuf)
        if (mp4Buf) {
          await sock.sendMessage(jid, { video: mp4Buf, gifPlayback: true, caption }, { quoted: msg })
          return true
        }
        // fallback: send gif url directly with gifPlayback
        await sock.sendMessage(jid, { video: { url }, gifPlayback: true, caption }, { quoted: msg })
        return true
      }
    }
    await sock.sendMessage(jid, { image: { url }, caption }, { quoted: msg })
    return true
  } catch { return false }
}

// ─── SEARCH: OLD SHOOB ────────────────────────────────────────────────────────
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

// ─── DEDUP: keep series-bearing entry per name+tier ─────────────────────────
function deduplicateResults(results) {
  const seen   = new Map()
  const output = []
  for (const r of results) {
    const key           = `${norm(r.name)}|||${r.tier}`
    const hasSeries     = r.series && r.series !== '-' && r.series !== ''
    if (!seen.has(key)) {
      seen.set(key, { entry: r, hasSeries, idx: output.length })
      output.push(r)
    } else {
      const stored = seen.get(key)
      // Replace a no-series entry with a series-bearing one
      if (!stored.hasSeries && hasSeries) {
        output[stored.idx] = r
        seen.set(key, { entry: r, hasSeries: true, idx: stored.idx })
      }
      // If both have series, keep first (avoid duplicates)
    }
  }
  return output
}

// ─── MERGE ALL SOURCES WITH DEDUP ────────────────────────────────────────────
function findAll(nameQuery, tierFilter) {
  const isMazokuTier = tierFilter && VALID_MAZOKU.includes(tierFilter)
  const isShoobTier  = tierFilter && VALID_SHOOB.includes(tierFilter)

  const fromOld    = (!tierFilter || isShoobTier)  ? findOld(nameQuery, tierFilter)    : []
  const fromNew    = (!tierFilter || isShoobTier)  ? findNew(nameQuery, tierFilter)    : []
  const fromMazoku = (!tierFilter || isMazokuTier) ? findMazoku(nameQuery, tierFilter) : []

  // Merge: new shoob first (has series), then mazoku, then old shoob (no series)
  // dedup removes old-shoob duplicates when new-shoob has the same name+tier with series
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
    .sort((a, b) => norm(a.name).localeCompare(norm(b.name)))
}

// ─── RANDOM CARD ─────────────────────────────────────────────────────────────
function getRandomCardByTier(tier) {
  const lt    = tier ? LABEL_TO_LOCAL[tier] : null
  const pool1 = lt   ? cardIndex.filter(c => String(c.tier) === lt)  : cardIndex
  const pool2 = lt   ? cardIndex2.filter(c => String(c.tier) === lt) : cardIndex2
  const pool3 = tier ? cardIndexMazoku.filter(c => c.tier === tier)  : cardIndexMazoku
  const pool  = [
    ...pool1.map(c => ({ name: c.title, tier: LOCAL_TO_LABEL[String(c.tier)] || String(c.tier), url: c.url, series: '' })),
    ...pool2.map(c => ({ name: c.name,  tier: LOCAL_TO_LABEL[String(c.tier)] || String(c.tier), url: c.url, series: c.series || '' })),
    ...pool3.map(c => ({ name: c.name,  tier: c.tier, url: c.url, series: c.series || '' })),
  ]
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

// ─── DECK IMAGE ───────────────────────────────────────────────────────────────
async function _buildDeckImage(cards) {
  let createCanvas, loadImage
  try { ({ createCanvas, loadImage } = require('@napi-rs/canvas')) } catch { return null }
  const COLS=3, CW=160, CH=220, PAD=8, HEADER=40
  const ROWS=Math.ceil(Math.min(cards.length,9)/3)
  const W=COLS*(CW+PAD)+PAD, H=ROWS*(CH+PAD)+PAD+HEADER
  const canvas=createCanvas(W,H), ctx=canvas.getContext('2d')
  ctx.fillStyle='#1a1a2e'; ctx.fillRect(0,0,W,H)
  ctx.fillStyle='#e2b96a'; ctx.font='bold 18px sans-serif'; ctx.textAlign='center'
  ctx.fillText('🎴 Your Deck',W/2,28)
  const TC={T1:'#a0a0a0',T2:'#3b9ddd',T3:'#2ecc71',T4:'#e74c3c',T5:'#9b59b6',T6:'#f1c40f',TS:'#f39c12',TZ:'#8e44ad',C:'#aaa',R:'#3b9ddd',SR:'#9b59b6',SSR:'#f1c40f',UR:'#e74c3c'}
  for (let i=0;i<Math.min(cards.length,9);i++){
    const uc=cards[i], c=uc.card_id||uc
    const col=i%COLS, row=Math.floor(i/COLS)
    const x=PAD+col*(CW+PAD), y=HEADER+PAD+row*(CH+PAD)
    const tier=c?.tier||'?'
    ctx.fillStyle='#16213e'; ctx.strokeStyle=TC[tier]||'#555'; ctx.lineWidth=3
    ctx.beginPath(); ctx.roundRect(x,y,CW,CH,8); ctx.fill(); ctx.stroke()
    const imgUrl=c?.image_url||null
    if(imgUrl){try{const buf=await fetchBuf(imgUrl);if(buf){const img=await loadImage(buf);ctx.save();ctx.beginPath();ctx.roundRect(x+4,y+4,CW-8,CH-52,6);ctx.clip();ctx.drawImage(img,x+4,y+4,CW-8,CH-52);ctx.restore()}}catch{}}
    ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(x+2,y+CH-50,CW-4,48)
    ctx.fillStyle='#fff'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'
    const name=(c?.name||'Unknown').length>14?(c?.name||'Unknown').slice(0,12)+'…':(c?.name||'Unknown')
    ctx.fillText(name,x+CW/2,y+CH-34)
    ctx.fillStyle=TC[tier]||'#aaa'; ctx.font='10px sans-serif'; ctx.fillText(tier,x+CW/2,y+CH-20)
    ctx.fillStyle='#aaa'; ctx.font='9px sans-serif'; ctx.fillText(`#${i+1}`,x+CW/2,y+CH-6)
  }
  return canvas.toBuffer('image/jpeg',{quality:85})
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
      const owners  = await db.getCardOwners(card.id).catch(() => [])
      const caption =
        `✨ *A card has spawned!*\n\n` +
        cardBlock(card.name, card.tier, card.series, owners.length, card.id, owners) +
        `\n\n> Use *.get* \`${card.id}\` to *claim* this card!`
      pendingCards[jid] = { card, expiresAt: Date.now() + 120000 }
      setTimeout(() => { if (pendingCards[jid]?.card?.id === card.id) delete pendingCards[jid] }, 120000)
      const sent = await sendCardMedia(sock, jid, msg, card.imageUrl, caption)
      if (!sent) await sock.sendMessage(jid, { text: caption }, { quoted: msg })
    } catch (err) { await reply(`❌ Failed to spawn: ${err.message}`) }
  },
  async spawncard(ctx) { return module.exports.spawnc(ctx) },

  async get({ sock, jid, msg, reply, react, sender, args }) {
    const pending = pendingCards[jid]
    if (!pending || Date.now() > pending.expiresAt) return reply('❌ No card spawned right now!')
    const cardIdArg = args[0]
    if (cardIdArg && pending.card.id !== cardIdArg) return reply(`❌ Wrong card ID! Current card is \`${pending.card.id}\``)
    await react('⏳')
    const { card } = pending
    delete pendingCards[jid]
    const rawUrl    = card._rawUrl || card.imageUrl || card.id
    const localCard = await db.getOrCreateShoobCard(rawUrl, card.name, card.tier, card.series, card.imageUrl || null, TIER_PRICES[card.tier] || 0).catch(() => null)
    if (!localCard) return reply('❌ Failed to save card.')
    await db.addUserCard(sender, localCard._id)
    const owners = await db.getCardOwners(card.id).catch(() => [])
    await reply(cardBlock(card.name, card.tier, card.series, owners.length, card.id, owners) + '\n\n✅ *CLAIMED!* Added to your collection.')
  },

  // ─── .ci — send ALL matching cards at once ────────────────────────────────
  async ci({ sock, jid, msg, reply, react, args }) {
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
      if (!matches.length) return reply(`ℹ️ There's no card matching your search, please use a different search query.`)

      // Send ALL matching cards simultaneously — no list, just images
      const MAX_SEND = 6  // cap to avoid spam
      const toSend   = matches.slice(0, MAX_SEND)

      await Promise.all(toSend.map(async (m) => {
        const cardId = extractCardId(m.url)
        const owners = await db.getCardOwners(cardId).catch(() => [])
        const caption = cardBlock(m.name, m.tier, m.series, owners.length, cardId, owners)
        const sent = await sendCardMedia(sock, jid, msg, m.url, caption)
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
      if (!matches.length) return reply(`❌ No cards found: *${nameQuery}*`)

      const cardLines = matches.map((c, i) => {
        const s   = c.series ? ` — _${c.series}_` : ''
        const src = c.source === 'mazoku' ? ' _(mazoku)_' : ''
        return `${i + 1}. ${TIERS[c.tier] || '🎴'} *${c.name}* (${c.tier})${s}${src}`
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
    const owners   = await db.getCardOwners(cardId).catch(() => [])
    const caption  = cardBlock(name, tier, series, owners.length, cardId, owners)
    const sent = await sendCardMedia(sock, jid, msg, imageUrl, caption)
    if (!sent) await reply(caption)
  },

  // ─── .coll ────────────────────────────────────────────────────────────────
  async coll({ reply, sender, msg }) {
    const mentioned   = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const targetPhone = mentioned.length ? mentioned[0].split('@')[0].split(':')[0] : sender
    const cards = await db.getUserCards(targetPhone)
    if (!cards.length) return reply(`*🃏 Card Collection*\n\n_No cards yet._`)
    const lines = cards.map((uc, i) => {
      const c = uc.card_id || uc
      return `${i + 1}. ${TIERS[c?.tier] || '🎴'} *${c?.name || 'Unknown'}* _(${c?.tier || '?'})_`
    }).join('\n')
    await reply(`*🃏 Card Collection* — ${cards.length} card(s)\n\n${lines}`)
  },
  async collection(ctx) { return module.exports.coll(ctx) },

  // ─── .deck ────────────────────────────────────────────────────────────────
  async deck({ sock, jid, msg, reply, sender }) {
    const cards = await db.getUserCards(sender)
    if (!cards.length) return reply('📭 Your deck is empty.')
    const deckSlice  = cards.slice(0, 9)
    const deckExtIds = deckSlice.map(uc => { const c = uc.card_id || uc; return c?.external_id || c?.id || '?' })
    let ownerCounts = {}
    try { ownerCounts = await db.getOwnerCountsBatch(deckExtIds) } catch {}
    const cardLines = deckSlice.map((uc, i) => {
      const c = uc.card_id || uc
      return `\n🎴 *Name:* ${c?.name || 'Unknown'}\n⭐ *Tier:* ${c?.tier || '?'}\n🔷 *Index:* #${i + 1}\n#️⃣ *Owners:* ${ownerCounts[deckExtIds[i]] || 0}`
    }).join('\n\n')
    const ZWLTR  = '\u200e'.repeat(800)
    const caption =
      `*🎴 Your Deck 🎴*${ZWLTR}` +
      cardLines +
      (cards.length > 9 ? `\n\n_...and ${cards.length - 9} more. Use *.coll* for full list._` : '')
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
    if (!mentioned.length) return reply('⚠️ Usage: *.tc @user <card_number>*')
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
}
