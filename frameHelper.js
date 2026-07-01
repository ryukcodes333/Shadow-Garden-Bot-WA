// Generates a single composite gallery image of all custom-uploaded frames.
// Used by ".frames" (no-arg form) to show every frame staff have uploaded.
const sharp = require('sharp')

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function buildFramesGridImage(frames) {
  const CELL = 220
  const PAD = 16
  const LABEL_H = 34
  const TITLE_H = 70
  const COLS = Math.min(4, Math.max(1, frames.length))
  const ROWS = Math.ceil(frames.length / COLS)
  const cellBlockH = CELL + LABEL_H

  const width = COLS * CELL + PAD * (COLS + 1)
  const height = TITLE_H + ROWS * cellBlockH + PAD * (ROWS + 1)

  const titleSvg = `
    <svg width="${width}" height="${TITLE_H}">
      <rect width="100%" height="100%" fill="#0d0d12"/>
      <text x="${width / 2}" y="${TITLE_H / 2 + 10}" font-size="28" font-weight="bold" fill="#f5c2e7" text-anchor="middle" font-family="sans-serif">CUSTOM FRAMES GALLERY</text>
    </svg>`

  const layers = [{ input: Buffer.from(titleSvg), left: 0, top: 0 }]

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const x = PAD + col * (CELL + PAD)
    const y = TITLE_H + PAD + row * (cellBlockH + PAD)

    let thumb
    try {
      const buf = Buffer.from(frame.image, 'base64')
      thumb = await sharp(buf).resize(CELL, CELL, { fit: 'cover' }).png().toBuffer()
    } catch {
      thumb = Buffer.from(
        `<svg width="${CELL}" height="${CELL}"><rect width="100%" height="100%" fill="#333"/></svg>`
      )
    }
    layers.push({ input: thumb, left: x, top: y })

    const labelSvg = `
      <svg width="${CELL}" height="${LABEL_H}">
        <rect width="100%" height="100%" fill="#1a1a22"/>
        <text x="${CELL / 2}" y="24" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="sans-serif">${escapeXml(frame.name)}</text>
      </svg>`
    layers.push({ input: Buffer.from(labelSvg), left: x, top: y + CELL })
  }

  return sharp({
    create: { width, height, channels: 4, background: '#0d0d12' },
  })
    .composite(layers)
    .png()
    .toBuffer()
}

module.exports = { buildFramesGridImage }
