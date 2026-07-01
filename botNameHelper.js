// Shared helpers for the multi-bot renaming feature (.name command).
// Lets a paired bot fully replace every user-facing mention of "Aqua" with
// its own configured name, including the stylized small-caps menu greeting.
// The MAIN bot never uses this — it always stays "Aqua".

const SMALL_CAPS = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ',
  k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ',
  u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
}

function toSmallCaps(str) {
  return String(str)
    .split('')
    .map((ch, i) => {
      if (i === 0) return ch.toUpperCase()
      const lower = ch.toLowerCase()
      return SMALL_CAPS[lower] || ch
    })
    .join('')
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Replaces every mention of "Aqua" (plain + the stylized small-caps variant
// used in the menu greeting) with the given bot name. No-op for the main bot.
function applyBotName(text, name) {
  if (!text || !name || name.toLowerCase() === 'aqua') return text
  let out = String(text).replace(/\baqua\b/gi, name)
  const stylizedAqua = toSmallCaps('Aqua') // "Aǫᴜᴀ"
  if (out.includes(stylizedAqua)) out = out.split(stylizedAqua).join(toSmallCaps(name))
  return out
}

module.exports = { toSmallCaps, escapeRegExp, applyBotName }
