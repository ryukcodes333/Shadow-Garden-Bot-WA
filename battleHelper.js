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
  ${svgPlatform(460, 175, 80, 22)}

  <!-- Player platform — bottom-left -->
  ${svgPlatform(150, 315, 105, 26)}

  <!-- Enemy HP box — top-left -->
  ${svgHpBox(12, 10, wildName, wildLevel, wildHp, wildMaxHp, 'left')}

  <!-- Player HP box — right-center -->
  ${svgHpBox(W - 12, 158, myName, myLevel, myHp, myMaxHp, 'right')}

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

  // Wild / enemy Pokemon (top-right, UPSCALED to 210x210)
  if (wildBuf) {
    try {
      const scaled = await sharp(wildBuf)
        .resize(210, 210, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
      // Center over enemy platform at ~cx=460
      composites.push({ input: scaled, top: 5, left: 355 })
    } catch {}
  }

  // Player Pokemon back sprite (bottom-left, UPSCALED to 240x240)
  if (myBuf) {
    try {
      const scaled = await sharp(myBuf)
        .resize(240, 240, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'nearest' })
        .png()
        .toBuffer()
      // Center over player platform at ~cx=150
      composites.push({ input: scaled, top: 100, left: 15 })
    } catch {}
  }

  try {
    return await sharp(baseBuf).composite(composites).png().toBuffer()
  } catch { return baseBuf }
}

module.exports = { buildBattleImage }
