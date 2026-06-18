/**
 * Pokemon-style battle scene image generator.
 * Uses sharp + real battle background + composited sprites.
 */

const https = require('https')
const http  = require('http')
const fs    = require('fs')
const path  = require('path')

const W = 620, H = 350

// ── Battle background ─────────────────────────────────────────────
const BG_PATH = path.join(__dirname, 'assets', 'battle-bg.jpg')

// ── Sprite download ────────────────────────────────────────────────
function downloadBuffer(url, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
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

// ── Colour helpers ────────────────────────────────────────────────
function hpColor(cur, max) {
  const pct = cur / max
  if (pct > 0.50) return '#48D840'
  if (pct > 0.20) return '#F8D030'
  return '#F83838'
}

// ── SVG pieces (all transparent background — composited over real BG) ────

function svgPlatform(cx, cy, rx, ry) {
  return `
    <ellipse cx="${cx}" cy="${cy + 4}" rx="${rx}" ry="${ry}" fill="rgba(30,20,0,0.35)"/>
    <ellipse cx="${cx}" cy="${cy}"     rx="${rx}" ry="${ry}" fill="rgba(80,140,40,0.55)"/>
    <ellipse cx="${cx}" cy="${cy - 3}" rx="${rx * 0.78}" ry="${ry * 0.55}" fill="rgba(120,190,60,0.40)"/>
  `
}

function svgHpBox(x, y, name, level, curHp, maxHp, anchor = 'left') {
  const BW = 200, BH = 74
  const bx = anchor === 'right' ? x - BW : x

  const color     = hpColor(curHp, maxHp)
  const barW      = 150
  const filledW   = Math.max(2, Math.round((curHp / maxHp) * barW))
  const filledDots = Math.round(Math.max(0, Math.min(1, curHp / maxHp)) * 5)

  const dots = Array.from({ length: 5 }, (_, i) =>
    `<circle cx="${13 + i * 14}" cy="10" r="5.5"
      fill="${i < filledDots ? color : '#383838'}"
      stroke="#111" stroke-width="1"/>`
  ).join('')

  const safeName  = String(name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeLevel = String(level).replace(/&/g, '&amp;')

  return `
    <g>
      <rect x="${bx + 3}" y="${y + 3}" width="${BW}" height="${BH}" rx="9" fill="rgba(0,0,0,0.40)"/>
      <rect x="${bx}" y="${y}" width="${BW}" height="${BH}" rx="9" fill="rgba(10,10,10,0.90)" stroke="#555" stroke-width="1.5"/>
      <g transform="translate(${bx + 8}, ${y + 8})">${dots}</g>
      <text x="${bx + BW - 8}" y="${y + 24}"
        font-family="'Courier New',monospace" font-size="12" font-weight="bold"
        fill="white" text-anchor="end">HP: ${curHp} / ${maxHp}</text>
      <rect x="${bx + 10}" y="${y + 32}" width="${barW}" height="9" rx="4.5" fill="#2a2a2a" stroke="#111" stroke-width="0.5"/>
      <rect x="${bx + 10}" y="${y + 32}" width="${filledW}" height="9" rx="4.5" fill="${color}"/>
      <rect x="${bx + 10}" y="${y + 32}" width="${filledW}" height="3" rx="2" fill="rgba(255,255,255,0.2)"/>
      <text x="${bx + 10}" y="${y + 57}"
        font-family="'Courier New',monospace" font-size="13" font-weight="bold"
        fill="white">${safeName}</text>
      <text x="${bx + BW - 8}" y="${y + 57}"
        font-family="'Courier New',monospace" font-size="12"
        fill="#AAAAAA" text-anchor="end">Lv. ${safeLevel}</text>
    </g>
  `
}

function svgActionLog(lines) {
  if (!lines || !lines.length) return ''
  const LH = 17, PX = 14, PY = 10
  const BH = PY * 2 + LH * lines.length
  const BY = H - BH - 8
  const BW = 300
  const BX = (W - BW) / 2

  const textLines = lines.map((ln, i) => {
    const safe = String(ln).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    const fill  = ln.startsWith('✨') || ln.startsWith('💥') ? '#FFD700' : 'white'
    return `<text x="${BX + BW / 2}" y="${BY + PY + LH * (i + 1) - 2}"
      font-family="'Courier New',monospace" font-size="12"
      fill="${fill}" text-anchor="middle">${safe}</text>`
  }).join('\n')

  return `
    <rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="7" fill="rgba(0,0,0,0.75)" stroke="#555" stroke-width="1"/>
    ${textLines}
  `
}

// ── Main export ───────────────────────────────────────────────────
/**
 * Build a Pokemon battle scene image buffer.
 *
 * @param {object} opts
 * @param {string} opts.myName
 * @param {number} opts.myLevel
 * @param {number} opts.myHp
 * @param {number} opts.myMaxHp
 * @param {number|null} opts.myId        — PokeAPI ID for player's Pokemon
 * @param {string} opts.wildName
 * @param {number} opts.wildLevel
 * @param {number} opts.wildHp
 * @param {number} opts.wildMaxHp
 * @param {number|null} opts.wildId      — PokeAPI ID for wild/enemy Pokemon
 * @param {string[]} [opts.logLines]     — action log lines shown at bottom
 * @returns {Promise<Buffer|null>}
 */
async function buildBattleImage(opts) {
  let sharp
  try { sharp = require('sharp') } catch { return null }

  const {
    myName, myLevel, myHp, myMaxHp, myId,
    wildName, wildLevel, wildHp, wildMaxHp, wildId,
    logLines = [],
  } = opts

  // ── 1. Load background ─────────────────────────────────────────
  let baseBuf = null
  if (fs.existsSync(BG_PATH)) {
    try {
      baseBuf = await sharp(BG_PATH)
        .resize(W, H, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer()
    } catch { baseBuf = null }
  }

  // Fallback: gradient background
  if (!baseBuf) {
    const fallbackSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#87CEEB"/>
      <stop offset="100%" stop-color="#c8e6a0"/>
    </linearGradient>
    <linearGradient id="groundG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4CAF50"/>
      <stop offset="100%" stop-color="#2E7D32"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H * 0.55}" fill="url(#skyG)"/>
  <rect x="0" y="${H * 0.55}" width="${W}" height="${H * 0.45}" fill="url(#groundG)"/>
</svg>`
    try { baseBuf = await sharp(Buffer.from(fallbackSvg)).png().toBuffer() } catch { return null }
  }

  // ── 2. SVG UI overlay (transparent background, just UI elements) ──
  // Wild pokemon: top-right area  (opponent / enemy)
  // Player pokemon: bottom-left area (back sprite)
  const uiSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- Enemy platform — top-right -->
  ${svgPlatform(468, 188, 76, 20)}

  <!-- Player platform — bottom-left -->
  ${svgPlatform(152, 288, 100, 24)}

  <!-- Enemy HP box — top-left -->
  ${svgHpBox(12, 8, wildName, wildLevel, wildHp, wildMaxHp, 'left')}

  <!-- Player HP box — bottom-right -->
  ${svgHpBox(W - 12, 212, myName, myLevel, myHp, myMaxHp, 'right')}

  <!-- Action log -->
  ${svgActionLog(logLines)}
</svg>`

  let uiBuf = null
  try {
    uiBuf = await sharp(Buffer.from(uiSvg)).png().toBuffer()
  } catch {}

  // ── 3. Sprite URLs ─────────────────────────────────────────────
  // Wild: official-artwork front (high quality, large)
  // Player: back sprite (authentic battle perspective)
  const wildFrontUrl = wildId
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${wildId}.png`
    : null
  const myBackUrl = myId
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${myId}.png`
    : null

  // Fallback front sprites
  const wildFallbackUrl = wildId
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${wildId}.png`
    : null

  const [wildBufRaw, myBufRaw] = await Promise.all([
    wildFrontUrl ? downloadBuffer(wildFrontUrl) : Promise.resolve(null),
    myBackUrl    ? downloadBuffer(myBackUrl)    : Promise.resolve(null),
  ])

  // Try fallback for wild if official artwork failed
  let wildBuf = wildBufRaw
  if (!wildBuf && wildFallbackUrl) {
    wildBuf = await downloadBuffer(wildFallbackUrl)
  }
  const myBuf = myBufRaw

  // ── 4. Composite ──────────────────────────────────────────────
  const composites = []

  // UI overlay
  if (uiBuf) composites.push({ input: uiBuf, top: 0, left: 0 })

  // Wild / enemy Pokemon (top-right, sized to NOT cover HP bars)
  if (wildBuf) {
    try {
      const scaled = await sharp(wildBuf)
        .resize(155, 155, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
      // Center over enemy platform at cx≈468; top=22 keeps it below HP box bottom (y=82)
      // horizontally: cx=468 - 155/2 = 390
      composites.push({ input: scaled, top: 22, left: 390 })
    } catch {}
  }

  // Player Pokemon back sprite (bottom-left, sized to NOT cover action log)
  if (myBuf) {
    try {
      const scaled = await sharp(myBuf)
        .resize(160, 160, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'nearest' })
        .png()
        .toBuffer()
      // Center over player platform at cx≈152; bottom at 122+160=282 (above log ~288)
      // horizontally: cx=152 - 160/2 = 72
      composites.push({ input: scaled, top: 122, left: 72 })
    } catch {}
  }

  try {
    return await sharp(baseBuf).composite(composites).png().toBuffer()
  } catch { return baseBuf }
}

// ── Circular avatar (for VS screen) ─────────────────────────────────────────
async function _circleAv(sharp, inputBuf, diameter) {
  const r = Math.round(diameter / 2)
  const mask = Buffer.from(
    `<svg width="${diameter}" height="${diameter}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${r}" cy="${r}" r="${r}" fill="white"/></svg>`
  )
  return sharp(inputBuf)
    .resize(diameter, diameter, { fit: 'cover', position: 'centre' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

// ── Battle challenge "VS screen" image ── dark purple/gold dual-card style ───
async function buildBattleChallenge(opts) {
  let sharp
  try { sharp = require('sharp') } catch { return null }

  const {
    challengerName      = 'ME',
    challengerAvatarBuf = null,
    opponentName        = 'OPPONENT',
    opponentAvatarBuf   = null,
    challengerPokeName  = null,
    challengerPokeLevel = 1,
    challengerPokeId    = null,
    challengerHp        = null,
    challengerMaxHp     = null,
    opponentPokeName    = null,
    opponentPokeLevel   = 1,
    opponentPokeId      = null,
    opponentHp          = null,
    opponentMaxHp       = null,
  } = opts

  const W = 900, H = 520
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').slice(0, 20)

  const CARD_W = 375, CARD_H = 420, CARD_Y = 78
  const L_X  = 12,  R_X  = W - CARD_W - 12
  const L_CX = Math.round(L_X + CARD_W / 2)
  const R_CX = Math.round(R_X + CARD_W / 2)

  // Grid
  const g = []
  for (let x = 0; x < W; x += 44) g.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#0d0d22" stroke-width="0.5"/>`)
  for (let y = 0; y < H; y += 44) g.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#0d0d22" stroke-width="0.5"/>`)

  // HP bar
  const hpBar = (cur, max, bx, by, bw) => {
    if (!max || max <= 0) return ''
    const ratio = Math.max(0, Math.min(1, (cur ?? max) / max))
    const fw    = Math.round(ratio * bw)
    const col   = ratio > 0.5 ? '#28CC38' : ratio > 0.25 ? '#EEC020' : '#EE2828'
    return `<rect x="${bx}" y="${by}" width="${bw}" height="7" rx="3.5" fill="#111128"/>` +
           `<rect x="${bx}" y="${by}" width="${fw}" height="7" rx="3.5" fill="${col}"/>`
  }

  // Name badge strip at top of card
  const nameBadge = (cx, by, name, col) => {
    const label = esc(name).toUpperCase().slice(0, 14)
    return `<rect x="${cx - 64}" y="${by}" width="128" height="24" rx="6" fill="#060614" stroke="${col}" stroke-width="1.5"/>` +
           `<text x="${cx}" y="${by + 16}" fill="${col}" font-size="12" font-weight="bold" text-anchor="middle" font-family="'Courier New',monospace" letter-spacing="1">${label}</text>`
  }

  // Trainer silhouette with aura glow
  const figure = (cx, cy, gradId, sparCol) =>
    `<ellipse cx="${cx}" cy="${cy + 15}" rx="92" ry="105" fill="url(#${gradId})"/>` +
    `<circle  cx="${cx}" cy="${cy - 68}" r="20"  fill="#03030c"/>` +
    `<path    d="M${cx-25},${cy-48} Q${cx-38},${cy-8} ${cx-32},${cy+54} L${cx+32},${cy+54} Q${cx+38},${cy-8} ${cx+25},${cy-48} Z" fill="#03030c"/>` +
    `<path    d="M${cx-25},${cy-42} L${cx-62},${cy-4}  L${cx-54},${cy+5}  L${cx-17},${cy-34} Z" fill="#03030c"/>` +
    `<path    d="M${cx+25},${cy-42} L${cx+62},${cy-4}  L${cx+54},${cy+5}  L${cx+17},${cy-34} Z" fill="#03030c"/>` +
    `<path    d="M${cx-14},${cy+54} L${cx-20},${cy+96} L${cx-7},${cy+96}  L${cx-1},${cy+54}  Z" fill="#03030c"/>` +
    `<path    d="M${cx+14},${cy+54} L${cx+20},${cy+96} L${cx+7},${cy+96}  L${cx+1},${cy+54}  Z" fill="#03030c"/>` +
    `<polyline points="${cx-88},${cy-25} ${cx-72},${cy-52} ${cx-58},${cy-22} ${cx-44},${cy-62}" stroke="${sparCol}" stroke-width="1.8" fill="none" opacity="0.65"/>` +
    `<polyline points="${cx+88},${cy-25} ${cx+72},${cy-52} ${cx+58},${cy-22} ${cx+44},${cy-62}" stroke="${sparCol}" stroke-width="1.8" fill="none" opacity="0.65"/>`

  const cPoke  = esc(challengerPokeName || '—')
  const oPoke  = esc(opponentPokeName   || '—')
  const cHpStr = challengerMaxHp ? `${challengerHp ?? challengerMaxHp}/${challengerMaxHp}` : ''
  const oHpStr = opponentMaxHp   ? `${opponentHp   ?? opponentMaxHp}/${opponentMaxHp}` : ''
  const FIG_CY = CARD_Y + 200

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs>
  <linearGradient id="bgG" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%"   stop-color="#030310"/>
    <stop offset="100%" stop-color="#07071a"/>
  </linearGradient>
  <linearGradient id="purpleTopBar" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%"   stop-color="#4400AA"/>
    <stop offset="100%" stop-color="#9933FF"/>
  </linearGradient>
  <linearGradient id="goldTopBar" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%"   stop-color="#AA6600"/>
    <stop offset="100%" stop-color="#FFB800"/>
  </linearGradient>
  <radialGradient id="auraP" cx="50%" cy="50%" r="50%">
    <stop offset="0%"   stop-color="#7B2FFF" stop-opacity="0.60"/>
    <stop offset="65%"  stop-color="#7B2FFF" stop-opacity="0.18"/>
    <stop offset="100%" stop-color="#7B2FFF" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="auraG" cx="50%" cy="50%" r="50%">
    <stop offset="0%"   stop-color="#FFB800" stop-opacity="0.60"/>
    <stop offset="65%"  stop-color="#FFB800" stop-opacity="0.18"/>
    <stop offset="100%" stop-color="#FFB800" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#bgG)"/>
${g.join('\n')}
<text x="${W/2}" y="30" fill="#FFB800" font-size="10" font-weight="bold" text-anchor="middle" font-family="'Courier New',monospace" letter-spacing="3" opacity="0.65">// CHALLENGE INITIATED //</text>
<text x="${W/2}" y="56" fill="white"   font-size="22" font-weight="bold" text-anchor="middle" font-family="'Courier New',monospace" letter-spacing="6">CHALLENGE INITIATED</text>
<text x="${W/2}" y="72" fill="#666688" font-size="10" text-anchor="middle" font-family="'Courier New',monospace">⚠   A battle is about to begin.</text>
<!-- LEFT card (purple) -->
<rect x="${L_X}" y="${CARD_Y}" width="${CARD_W}" height="${CARD_H}" rx="14" fill="#07071a" stroke="#7B2FFF" stroke-width="1.5"/>
<rect x="${L_X}" y="${CARD_Y}" width="${CARD_W}" height="4" rx="2" fill="url(#purpleTopBar)"/>
${nameBadge(L_CX, CARD_Y + 12, challengerName, '#9B5FFF')}
${figure(L_CX, FIG_CY, 'auraP', '#9B5FFF')}
<rect x="${L_X + 10}" y="${CARD_Y + CARD_H - 115}" width="128" height="16" rx="4" fill="#7B2FFF" opacity="0.85"/>
<text x="${L_X + 20}" y="${CARD_Y + CARD_H - 103}" fill="white" font-size="8.5" font-weight="bold" font-family="'Courier New',monospace" letter-spacing="1">ACTIVE POKÉMON</text>
<text x="${L_X + 12}" y="${CARD_Y + CARD_H - 83}"  fill="white" font-size="16" font-weight="bold" font-family="'Courier New',monospace">${cPoke}</text>
<rect x="${L_X + CARD_W - 66}" y="${CARD_Y + CARD_H - 98}" width="54" height="16" rx="8" fill="#7B2FFF"/>
<text x="${L_X + CARD_W - 39}" y="${CARD_Y + CARD_H - 86}" fill="white" font-size="9" font-weight="bold" text-anchor="middle" font-family="'Courier New',monospace">Lv.${challengerPokeLevel}</text>
<text x="${L_X + 12}" y="${CARD_Y + CARD_H - 60}" fill="#8888AA" font-size="8.5" font-family="'Courier New',monospace">HP</text>
${hpBar(challengerHp ?? challengerMaxHp, challengerMaxHp ?? 1, L_X + 28, CARD_Y + CARD_H - 68, CARD_W - 42)}
<text x="${L_X + CARD_W - 10}" y="${CARD_Y + CARD_H - 60}" fill="#8888AA" font-size="8.5" text-anchor="end" font-family="'Courier New',monospace">${cHpStr}</text>
<!-- RIGHT card (gold) -->
<rect x="${R_X}" y="${CARD_Y}" width="${CARD_W}" height="${CARD_H}" rx="14" fill="#100a02" stroke="#FFB800" stroke-width="1.5"/>
<rect x="${R_X}" y="${CARD_Y}" width="${CARD_W}" height="4" rx="2" fill="url(#goldTopBar)"/>
${nameBadge(R_CX, CARD_Y + 12, opponentName, '#FFB800')}
${figure(R_CX, FIG_CY, 'auraG', '#FFB800')}
<rect x="${R_X + 10}" y="${CARD_Y + CARD_H - 115}" width="128" height="16" rx="4" fill="#CC8800" opacity="0.85"/>
<text x="${R_X + 20}" y="${CARD_Y + CARD_H - 103}" fill="white" font-size="8.5" font-weight="bold" font-family="'Courier New',monospace" letter-spacing="1">ACTIVE POKÉMON</text>
<text x="${R_X + 12}" y="${CARD_Y + CARD_H - 83}"  fill="white" font-size="16" font-weight="bold" font-family="'Courier New',monospace">${oPoke}</text>
<rect x="${R_X + CARD_W - 66}" y="${CARD_Y + CARD_H - 98}" width="54" height="16" rx="8" fill="#CC8800"/>
<text x="${R_X + CARD_W - 39}" y="${CARD_Y + CARD_H - 86}" fill="white" font-size="9" font-weight="bold" text-anchor="middle" font-family="'Courier New',monospace">Lv.${opponentPokeLevel}</text>
<text x="${R_X + 12}" y="${CARD_Y + CARD_H - 60}" fill="#8888AA" font-size="8.5" font-family="'Courier New',monospace">HP</text>
${hpBar(opponentHp ?? opponentMaxHp, opponentMaxHp ?? 1, R_X + 28, CARD_Y + CARD_H - 68, CARD_W - 42)}
<text x="${R_X + CARD_W - 10}" y="${CARD_Y + CARD_H - 60}" fill="#8888AA" font-size="8.5" text-anchor="end" font-family="'Courier New',monospace">${oHpStr}</text>
<!-- VS -->
<text x="${W/2}" y="${CARD_Y + 292}" fill="none"    stroke="#7B2FFF" stroke-width="4" font-size="96" font-weight="bold" text-anchor="middle" font-family="'Courier New',monospace">VS</text>
<text x="${W/2}" y="${CARD_Y + 292}" fill="#FFB800" font-size="96" font-weight="bold" text-anchor="middle" font-family="'Courier New',monospace" opacity="0.92">VS</text>
<text x="${W/2}" y="${H - 8}" fill="#222233" font-size="9" text-anchor="middle" font-family="'Courier New',monospace">Waiting for opponent response...</text>
</svg>`

  let base
  try { base = await sharp(Buffer.from(svg)).png().toBuffer() } catch { return null }

  const composites = []
  const AV_D      = 76
  const spriteRow  = CARD_Y + CARD_H - AV_D - 40

  if (challengerAvatarBuf) {
    try {
      const av = await _circleAv(sharp, challengerAvatarBuf, AV_D)
      composites.push({ input: av, top: FIG_CY - AV_D - 30, left: Math.round(L_CX - AV_D / 2) })
    } catch {}
  }
  if (opponentAvatarBuf) {
    try {
      const av = await _circleAv(sharp, opponentAvatarBuf, AV_D)
      composites.push({ input: av, top: FIG_CY - AV_D - 30, left: Math.round(R_CX - AV_D / 2) })
    } catch {}
  }

  // Pokémon sprites at bottom-right of each card
  const SPRITE_SZ = 88
  async function fetchSprite(id) {
    if (!id) return null
    try { return await downloadBuffer(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`, 6000) } catch { return null }
  }
  const [lSpr, rSpr] = await Promise.all([fetchSprite(challengerPokeId), fetchSprite(opponentPokeId)])
  if (lSpr) {
    try {
      const s = await sharp(lSpr).resize(SPRITE_SZ, SPRITE_SZ, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
      composites.push({ input: s, top: spriteRow, left: Math.round(L_CX + 56 - SPRITE_SZ) })
    } catch {}
  }
  if (rSpr) {
    try {
      const s = await sharp(rSpr).resize(SPRITE_SZ, SPRITE_SZ, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
      composites.push({ input: s, top: spriteRow, left: Math.round(R_CX + 56 - SPRITE_SZ) })
    } catch {}
  }

  try {
    return composites.length
      ? await sharp(base).composite(composites).png().toBuffer()
      : base
  } catch { return base }
}

module.exports = { buildBattleImage, buildBattleChallenge }
