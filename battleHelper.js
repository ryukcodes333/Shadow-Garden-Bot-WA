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

// ── Battle challenge "VS screen" image ───────────────────────────────────────
async function buildBattleChallenge(opts) {
  let sharp
  try { sharp = require('sharp') } catch { return null }

  const {
    challengerName    = 'ME',
    challengerAvatarBuf = null,
    opponentName      = 'OPPONENT',
    opponentAvatarBuf = null,
  } = opts

  const W = 800, H = 450
  const AV_D = 136, AV_R = AV_D / 2
  const L_CX = 198, R_CX = 602
  const AV_CY = 228
  const CARD_TOP = 106, CARD_H_EACH = 282, CARD_W_EACH = 242

  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').slice(0, 22)
  const cName = esc(challengerName)
  const oName = esc(opponentName)

  const grid = []
  for (let x = 0; x < W; x += 40) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#14142a" stroke-width="0.6"/>`)
  for (let y = 0; y < H; y += 40) grid.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#14142a" stroke-width="0.6"/>`)

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="redBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#FF2020" stop-opacity="0"/>
      <stop offset="50%"  stop-color="#FF2020" stop-opacity="1"/>
      <stop offset="100%" stop-color="#FF2020" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="blueBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#2040FF" stop-opacity="0"/>
      <stop offset="50%"  stop-color="#2040FF" stop-opacity="1"/>
      <stop offset="100%" stop-color="#2040FF" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="#08080f"/>
  ${grid.join('\n  ')}

  <!-- Title -->
  <text x="${W/2}" y="58" fill="white" font-size="34" font-weight="bold" text-anchor="middle"
    font-family="'Courier New',monospace" letter-spacing="4">BATTLE CHALLENGE</text>

  <!-- Subtitle pill -->
  <rect x="${W/2 - 148}" y="68" width="296" height="28" rx="14" fill="#101020" stroke="#C4920A" stroke-width="1.5"/>
  <text x="${W/2}" y="87" fill="#C4920A" font-size="13" font-weight="bold" text-anchor="middle"
    font-family="'Courier New',monospace" letter-spacing="2">1V1  STANDARD  BATTLE</text>

  <!-- Left card -->
  <rect x="${L_CX - CARD_W_EACH/2}" y="${CARD_TOP}" width="${CARD_W_EACH}" height="${CARD_H_EACH}" rx="14" fill="#0e0e1e"/>
  <rect x="${L_CX - CARD_W_EACH/2}" y="${CARD_TOP}" width="${CARD_W_EACH}" height="5" rx="2" fill="url(#redBar)"/>
  <circle cx="${L_CX}" cy="${AV_CY}" r="${AV_R + 7}" fill="#161628"/>
  <circle cx="${L_CX}" cy="${AV_CY}" r="${AV_R + 7}" fill="none" stroke="#FF3030" stroke-width="2.5"/>
  <text x="${L_CX}" y="${CARD_TOP + CARD_H_EACH - 62}" fill="white" font-size="15" font-style="italic" font-weight="bold"
    text-anchor="middle" font-family="'Courier New',monospace">${cName}</text>
  <text x="${L_CX}" y="${CARD_TOP + CARD_H_EACH - 40}" fill="#00CFFF" font-size="12" font-weight="bold"
    text-anchor="middle" font-family="'Courier New',monospace" letter-spacing="2">CHALLENGER</text>

  <!-- Right card -->
  <rect x="${R_CX - CARD_W_EACH/2}" y="${CARD_TOP}" width="${CARD_W_EACH}" height="${CARD_H_EACH}" rx="14" fill="#0e0e1e"/>
  <rect x="${R_CX - CARD_W_EACH/2}" y="${CARD_TOP}" width="${CARD_W_EACH}" height="5" rx="2" fill="url(#blueBar)"/>
  <circle cx="${R_CX}" cy="${AV_CY}" r="${AV_R + 7}" fill="#161628"/>
  <circle cx="${R_CX}" cy="${AV_CY}" r="${AV_R + 7}" fill="none" stroke="#2840FF" stroke-width="2.5"/>
  <text x="${R_CX}" y="${CARD_TOP + CARD_H_EACH - 62}" fill="white" font-size="15" font-style="italic" font-weight="bold"
    text-anchor="middle" font-family="'Courier New',monospace">${oName}</text>
  <text x="${R_CX}" y="${CARD_TOP + CARD_H_EACH - 40}" fill="#FF5520" font-size="12" font-weight="bold"
    text-anchor="middle" font-family="'Courier New',monospace" letter-spacing="3">OPPONENT</text>

  <!-- VS -->
  <text x="${W/2}" y="${AV_CY + 22}" fill="#F0B020" font-size="60" font-weight="bold"
    text-anchor="middle" font-family="'Courier New',monospace">VS</text>

  <!-- Footer -->
  <text x="${W/2}" y="${H - 16}" fill="#444460" font-size="13" font-style="italic"
    text-anchor="middle" font-family="'Courier New',monospace">Waiting for opponent to accept ...</text>
</svg>`

  let base
  try { base = await sharp(Buffer.from(svg)).png().toBuffer() } catch { return null }

  const composites = []
  if (challengerAvatarBuf) {
    try {
      const av = await _circleAv(sharp, challengerAvatarBuf, AV_D)
      composites.push({ input: av, top: AV_CY - AV_R, left: L_CX - AV_R })
    } catch {}
  }
  if (opponentAvatarBuf) {
    try {
      const av = await _circleAv(sharp, opponentAvatarBuf, AV_D)
      composites.push({ input: av, top: AV_CY - AV_R, left: R_CX - AV_R })
    } catch {}
  }

  try {
    return composites.length
      ? await sharp(base).composite(composites).png().toBuffer()
      : base
  } catch { return base }
}

module.exports = { buildBattleImage, buildBattleChallenge }
