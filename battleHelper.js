/**
 * Pokemon-style battle scene image generator.
 * Uses sharp + SVG to composite sprites onto a battle background.
 */

const https = require('https')
const http  = require('http')

const W = 620, H = 350

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

// ── SVG pieces ────────────────────────────────────────────────────

function svgBackground() {
  return `
    <!-- sky / upper field -->
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#D4B87A"/>
        <stop offset="100%" stop-color="#C09A50"/>
      </linearGradient>
      <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#9E7830"/>
        <stop offset="100%" stop-color="#7A5812"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0"           width="${W}" height="${H * 0.48}" fill="url(#skyGrad)"/>
    <rect x="0" y="${H * 0.48}" width="${W}" height="${H * 0.52}" fill="url(#groundGrad)"/>
    <!-- horizon line -->
    <rect x="0" y="${H * 0.47}" width="${W}" height="5" fill="#6A4810" opacity="0.55"/>
    <!-- ground texture lines -->
    <line x1="0" y1="${H * 0.56}" x2="${W}" y2="${H * 0.56}" stroke="#6A4810" stroke-width="1" opacity="0.25"/>
    <line x1="0" y1="${H * 0.65}" x2="${W}" y2="${H * 0.65}" stroke="#6A4810" stroke-width="1" opacity="0.18"/>
    <line x1="0" y1="${H * 0.78}" x2="${W}" y2="${H * 0.78}" stroke="#6A4810" stroke-width="1" opacity="0.12"/>
  `
}

function svgPlatform(cx, cy, rx, ry) {
  return `
    <ellipse cx="${cx}" cy="${cy + 4}" rx="${rx}" ry="${ry}" fill="#5A3808" opacity="0.40"/>
    <ellipse cx="${cx}" cy="${cy}"     rx="${rx}" ry="${ry}" fill="#C4A050" opacity="0.55"/>
    <ellipse cx="${cx}" cy="${cy - 3}" rx="${rx * 0.78}" ry="${ry * 0.55}" fill="#D8B870" opacity="0.45"/>
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
      <!-- box shadow -->
      <rect x="${bx + 3}" y="${y + 3}" width="${BW}" height="${BH}" rx="9" fill="rgba(0,0,0,0.35)"/>
      <!-- main box -->
      <rect x="${bx}" y="${y}" width="${BW}" height="${BH}" rx="9" fill="rgba(16,16,16,0.88)" stroke="#484848" stroke-width="1.5"/>
      <!-- dots -->
      <g transform="translate(${bx + 8}, ${y + 8})">${dots}</g>
      <!-- HP text -->
      <text x="${bx + BW - 8}" y="${y + 24}"
        font-family="'Courier New',monospace" font-size="12" font-weight="bold"
        fill="white" text-anchor="end">HP: ${curHp} / ${maxHp}</text>
      <!-- HP bar track -->
      <rect x="${bx + 10}" y="${y + 32}" width="${barW}" height="9" rx="4.5" fill="#2a2a2a" stroke="#111" stroke-width="0.5"/>
      <!-- HP bar fill -->
      <rect x="${bx + 10}" y="${y + 32}" width="${filledW}" height="9" rx="4.5" fill="${color}"/>
      <!-- HP bar shimmer -->
      <rect x="${bx + 10}" y="${y + 32}" width="${filledW}" height="3" rx="2" fill="rgba(255,255,255,0.2)"/>
      <!-- name -->
      <text x="${bx + 10}" y="${y + 57}"
        font-family="'Courier New',monospace" font-size="13" font-weight="bold"
        fill="white">${safeName}</text>
      <!-- level -->
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
    <rect x="${BX}" y="${BY}" width="${BW}" height="${BH}" rx="7" fill="rgba(0,0,0,0.72)" stroke="#555" stroke-width="1"/>
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
 * @param {number|null} opts.wildId      — PokeAPI ID for wild Pokemon
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

  // ── Sprite URLs ────────────────────────────────────────────────
  const myBackUrl    = myId
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${myId}.png`
    : null
  const wildFrontUrl = wildId
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${wildId}.png`
    : null

  // Download in parallel, failures are fine
  const [myBuf, wildBuf] = await Promise.all([
    myBackUrl    ? downloadBuffer(myBackUrl)    : Promise.resolve(null),
    wildFrontUrl ? downloadBuffer(wildFrontUrl) : Promise.resolve(null),
  ])

  // ── SVG base ──────────────────────────────────────────────────
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  ${svgBackground()}

  <!-- Wild pokemon platform — top-right -->
  ${svgPlatform(455, 162, 72, 20)}

  <!-- Player pokemon platform — bottom-left -->
  ${svgPlatform(155, 298, 98, 24)}

  <!-- Wild HP box — top-left -->
  ${svgHpBox(12, 12, wildName, wildLevel, wildHp, wildMaxHp, 'left')}

  <!-- Player HP box — middle-right -->
  ${svgHpBox(W - 12, 148, myName, myLevel, myHp, myMaxHp, 'right')}

  <!-- Action log -->
  ${svgActionLog(logLines)}
</svg>`

  let base
  try {
    base = await sharp(Buffer.from(svg)).png().toBuffer()
  } catch { return null }

  const composites = []

  // Wild Pokemon sprite (front) — top-right, placed on platform
  if (wildBuf) {
    try {
      const scaled = await sharp(wildBuf)
        .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
      composites.push({ input: scaled, top: 30, left: 388 })
    } catch {}
  }

  // Player Pokemon sprite (back) — bottom-left, placed on platform
  if (myBuf) {
    try {
      const scaled = await sharp(myBuf)
        .resize(155, 155, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
      composites.push({ input: scaled, top: 148, left: 70 })
    } catch {}
  }

  if (!composites.length) return base

  try {
    return await sharp(base).composite(composites).png().toBuffer()
  } catch { return base }
}

module.exports = { buildBattleImage }
