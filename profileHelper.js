const sharp = require('sharp')
const https = require('https')
const http = require('http')

const CARD_W = 500
const CARD_H = 524
const AV_CX = 250
const AV_CY = 182
const AV_R = 82

// ─── 70 FRAMES ──────────────────────────────────────────────────────────────
const FRAMES = [
  // ── BASIC (1–5) ──
  { id: 1,  name: 'Classic White',    category: 'Basic',    type: 'solid',    color: '#FFFFFF', width: 6 },
  { id: 2,  name: 'Gold Rush',        category: 'Basic',    type: 'solid',    color: '#FFD700', width: 7 },
  { id: 3,  name: 'Silver Strike',    category: 'Basic',    type: 'solid',    color: '#C0C0C0', width: 6 },
  { id: 4,  name: 'Bronze Guard',     category: 'Basic',    type: 'solid',    color: '#CD7F32', width: 6 },
  { id: 5,  name: 'Crimson Blood',    category: 'Basic',    type: 'solid',    color: '#DC143C', width: 7 },
  // ── NEON (6–10) ──
  { id: 6,  name: 'Neon Cyan',        category: 'Neon',     type: 'glow',     color: '#00FFFF', width: 5 },
  { id: 7,  name: 'Neon Pink',        category: 'Neon',     type: 'glow',     color: '#FF00FF', width: 5 },
  { id: 8,  name: 'Neon Green',       category: 'Neon',     type: 'glow',     color: '#39FF14', width: 5 },
  { id: 9,  name: 'Neon Orange',      category: 'Neon',     type: 'glow',     color: '#FF6600', width: 5 },
  { id: 10, name: 'Neon Yellow',      category: 'Neon',     type: 'glow',     color: '#FFFF00', width: 5 },
  // ── GRADIENT (11–15) ──
  { id: 11, name: 'Sunset Flame',     category: 'Gradient', type: 'gradient', color: '#FF6B35', color2: '#FF0066', width: 7 },
  { id: 12, name: 'Ocean Tide',       category: 'Gradient', type: 'gradient', color: '#0099FF', color2: '#00FFCC', width: 7 },
  { id: 13, name: 'Aurora',           category: 'Gradient', type: 'gradient', color: '#00FF88', color2: '#AA00FF', width: 7 },
  { id: 14, name: 'Galaxy Core',      category: 'Gradient', type: 'gradient', color: '#9933FF', color2: '#FF3366', width: 7 },
  { id: 15, name: 'Forest Dawn',      category: 'Gradient', type: 'gradient', color: '#228B22', color2: '#90EE90', width: 7 },
  // ── ORNATE / DOUBLE (16–20) ──
  { id: 16, name: 'Royal Crown',      category: 'Ornate',   type: 'double',   color: '#FFD700', color2: '#FFF8DC', width: 4 },
  { id: 17, name: 'Shadow King',      category: 'Ornate',   type: 'double',   color: '#8B008B', color2: '#1a1a2e', width: 4 },
  { id: 18, name: 'Eclipse Ring',     category: 'Ornate',   type: 'double',   color: '#FF8C00', color2: '#444444', width: 4 },
  { id: 19, name: 'Void Abyss',       category: 'Ornate',   type: 'double',   color: '#440044', color2: '#220022', width: 4 },
  { id: 20, name: 'Phantom Night',    category: 'Ornate',   type: 'double',   color: '#7B68EE', color2: '#2d2d4e', width: 4 },
  // ── NATURE / DASHED (21–25) ──
  { id: 21, name: 'Sakura Bloom',     category: 'Nature',   type: 'dashed',   color: '#FFB7C5', width: 6, dash: '8,4' },
  { id: 22, name: 'Lightning',        category: 'Nature',   type: 'dashed',   color: '#FFD700', width: 4, dash: '3,7' },
  { id: 23, name: 'Ice Crystal',      category: 'Nature',   type: 'dashed',   color: '#B0E0E6', width: 5, dash: '12,3' },
  { id: 24, name: 'Fire Blaze',       category: 'Nature',   type: 'dashed',   color: '#FF4500', width: 8, dash: '6,2' },
  { id: 25, name: 'Vine Wrap',        category: 'Nature',   type: 'dashed',   color: '#32CD32', width: 5, dash: '4,8' },
  // ── PRESTIGE (26–30) ──
  { id: 26, name: 'Diamond Crest',    category: 'Prestige', type: 'triple',   color: '#B9F2FF', color2: '#FFFFFF', color3: '#B9F2FF', width: 3 },
  { id: 27, name: 'Zodiac Mystic',    category: 'Prestige', type: 'dotted',   color: '#9400D3', width: 4, dash: '3,6' },
  { id: 28, name: 'Legendary Aura',   category: 'Prestige', type: 'triple',   color: '#FFD700', color2: '#FFA500', color3: '#FF8C00', width: 3 },
  { id: 29, name: 'Mythic Seal',      category: 'Prestige', type: 'rainbow',  color: '#FF0000', color2: '#00FF00', color3: '#0000FF', width: 7 },
  { id: 30, name: 'Shadow Crown',     category: 'Prestige', type: 'glow',     color: '#9933FF', width: 8 },
  // ── PAGE 1 EXTRAS (31–35) ──
  { id: 31, name: 'Pastel Lavender',  category: 'Extra',    type: 'solid',    color: '#E6D0FF', width: 6 },
  { id: 32, name: 'Coral Sunset',     category: 'Extra',    type: 'solid',    color: '#FF7F50', width: 7 },
  { id: 33, name: 'Sky Drift',        category: 'Extra',    type: 'solid',    color: '#87CEEB', width: 6 },
  { id: 34, name: 'Mint Glow',        category: 'Extra',    type: 'glow',     color: '#98FF98', width: 5 },
  { id: 35, name: 'Warm Amber',       category: 'Extra',    type: 'solid',    color: '#FFBF00', width: 7 },
  // ── ANIME BASICS (36–40) ──
  { id: 36, name: 'Sakura Petals',    category: 'Anime',    type: 'petal',    color: '#FFB7C5', count: 12, r2: 8, r3: 3 },
  { id: 37, name: 'Stardust',         category: 'Anime',    type: 'dotring',  color: '#FFFFFF', count: 16, dotR: 4 },
  { id: 38, name: 'Magical Girl',     category: 'Anime',    type: 'dotring',  color: '#FF69B4', count: 14, dotR: 5 },
  { id: 39, name: 'Chibi Pop',        category: 'Anime',    type: 'dotring',  color: '#FFD700', count: 18, dotR: 3 },
  { id: 40, name: 'Manga Action',     category: 'Anime',    type: 'triple',   color: '#FFFFFF', color2: '#AAAAAA', color3: '#444444', width: 2 },
  // ── ANIME FANTASY (41–45) ──
  { id: 41, name: 'Shonen Rage',      category: 'Anime',    type: 'glow',     color: '#FF2222', width: 9 },
  { id: 42, name: 'Moon Rabbit',      category: 'Anime',    type: 'dotring',  color: '#DDE8FF', count: 12, dotR: 5 },
  { id: 43, name: 'Dragon Lord',      category: 'Anime',    type: 'gradient', color: '#006400', color2: '#7FFF00', width: 8 },
  { id: 44, name: 'Demon King',       category: 'Anime',    type: 'glow',     color: '#8B0000', width: 8 },
  { id: 45, name: 'Spirit Fox',       category: 'Anime',    type: 'sparkle',  color: '#FF8C00', count: 8 },
  // ── ANIME MAGIC (46–50) ──
  { id: 46, name: 'Crystal Fairy',    category: 'Anime',    type: 'triple',   color: '#00FFFF', color2: '#7FFFAA', color3: '#00BFFF', width: 3 },
  { id: 47, name: 'Shrine Maiden',    category: 'Anime',    type: 'double',   color: '#FFFFFF', color2: '#FF2244', width: 4 },
  { id: 48, name: 'Dark Sorcerer',    category: 'Anime',    type: 'triple',   color: '#4B0082', color2: '#8B008B', color3: '#9400D3', width: 4 },
  { id: 49, name: 'Thunder Deity',    category: 'Anime',    type: 'sparkle',  color: '#FFD700', count: 10 },
  { id: 50, name: 'Cosmic Guard',     category: 'Anime',    type: 'glow',     color: '#4169E1', width: 7 },
  // ── ANIME NATURE (51–55) ──
  { id: 51, name: 'Cherry Storm',     category: 'Anime',    type: 'petal',    color: '#FF1493', count: 10, r2: 10, r3: 4 },
  { id: 52, name: 'Arcane Rune',      category: 'Anime',    type: 'dotted',   color: '#9370DB', width: 5, dash: '4,4' },
  { id: 53, name: 'Inferno Spirit',   category: 'Anime',    type: 'sparkle',  color: '#FF4500', count: 12 },
  { id: 54, name: 'Frost Empress',    category: 'Anime',    type: 'triple',   color: '#ADD8E6', color2: '#E0F4FF', color3: '#87CEEB', width: 3 },
  { id: 55, name: 'Night Blade',      category: 'Anime',    type: 'double',   color: '#778899', color2: '#1C1C1C', width: 5 },
  // ── ANIME CYBERPUNK (56–60) ──
  { id: 56, name: 'Neo Tokyo',        category: 'Anime',    type: 'glow',     color: '#00FF41', width: 6 },
  { id: 57, name: 'Pixel Warrior',    category: 'Anime',    type: 'dashed',   color: '#FF6347', width: 5, dash: '4,4' },
  { id: 58, name: 'Aurora Dream',     category: 'Anime',    type: 'rainbow',  color: '#FF1493', color2: '#9400D3', color3: '#00BFFF', width: 8 },
  { id: 59, name: 'Crimson Oni',      category: 'Anime',    type: 'double',   color: '#DC143C', color2: '#8B0000', width: 5 },
  { id: 60, name: 'Ronin Edge',       category: 'Anime',    type: 'gradient', color: '#191970', color2: '#DAA520', width: 8 },
  // ── ANIME PRESTIGE (61–65) ──
  { id: 61, name: 'Twilight Witch',   category: 'Anime',    type: 'glow',     color: '#9B30FF', width: 8 },
  { id: 62, name: 'Bubble Charm',     category: 'Anime',    type: 'dotring',  color: '#FFB6C1', count: 20, dotR: 3 },
  { id: 63, name: 'Storm Dragon',     category: 'Anime',    type: 'triple',   color: '#4169E1', color2: '#87CEEB', color3: '#F0F8FF', width: 4 },
  { id: 64, name: 'Blossom Crown',    category: 'Anime',    type: 'petal',    color: '#FF91A4', count: 16, r2: 6, r3: 2 },
  { id: 65, name: 'Void Walker',      category: 'Anime',    type: 'glow',     color: '#9400D3', width: 10 },
  // ── ANIME ULTIMATE (66–70) ──
  { id: 66, name: 'Cotton Candy',     category: 'Anime',    type: 'gradient', color: '#FFB6C1', color2: '#B0C4DE', width: 7 },
  { id: 67, name: 'Phantom Soul',     category: 'Anime',    type: 'glow',     color: '#B0C4DE', width: 6 },
  { id: 68, name: 'Infernal Lord',    category: 'Anime',    type: 'triple',   color: '#FF0000', color2: '#8B0000', color3: '#DC143C', width: 4 },
  { id: 69, name: 'Star Prism',       category: 'Anime',    type: 'rainbow',  color: '#FF0000', color2: '#00FF88', color3: '#0099FF', width: 9 },
  { id: 70, name: 'Eternal Shadow',   category: 'Anime',    type: 'glow',     color: '#CC00FF', width: 11 },

  // ── 3D IMAGE FRAMES (71–100) ──────────────────────────────────────────────
  // Aquatic
  { id: 71,  name: 'Ocean Storm',     category: '3D',  type: 'image', light: '#66ddff', mid: '#0066cc', dark: '#001144', glow: '#00ccff', accent: '#00ffff', accent2: '#88eeff', deco: 'drop'    },
  { id: 72,  name: 'Frost Crown',     category: '3D',  type: 'image', light: '#eef8ff', mid: '#88bbdd', dark: '#0a2a44', glow: '#cceeff', accent: '#ffffff', accent2: '#aaddff', deco: 'crystal' },
  { id: 73,  name: 'Coral Reef',      category: '3D',  type: 'image', light: '#ff9966', mid: '#dd4422', dark: '#220800', glow: '#ff7744', accent: '#00ccee', accent2: '#ff8866', deco: 'orb'     },
  // Fire
  { id: 74,  name: 'Inferno Gate',    category: '3D',  type: 'image', light: '#ffaa44', mid: '#cc2200', dark: '#280400', glow: '#ff5500', accent: '#ffdd00', accent2: '#ff8833', deco: 'flame'   },
  { id: 75,  name: 'Phoenix Rise',    category: '3D',  type: 'image', light: '#ffee66', mid: '#dd6600', dark: '#1e0800', glow: '#ff8800', accent: '#fff066', accent2: '#ffcc22', deco: 'flame'   },
  { id: 76,  name: 'Solar Flare',     category: '3D',  type: 'image', light: '#ffff88', mid: '#ff9900', dark: '#220f00', glow: '#ffcc00', accent: '#ffff44', accent2: '#ffdd44', deco: 'star'    },
  // Nature
  { id: 77,  name: 'Emerald Warden',  category: '3D',  type: 'image', light: '#66ff99', mid: '#00aa44', dark: '#001a0a', glow: '#00ff66', accent: '#aaff66', accent2: '#44ff88', deco: 'crystal' },
  { id: 78,  name: 'Forest Spirit',   category: '3D',  type: 'image', light: '#44cc55', mid: '#006622', dark: '#000d04', glow: '#33bb44', accent: '#88ff55', accent2: '#66dd33', deco: 'drop'    },
  { id: 79,  name: 'Cherry Blossom',  category: '3D',  type: 'image', light: '#ffccdd', mid: '#dd4488', dark: '#1a000e', glow: '#ff88bb', accent: '#ffffff', accent2: '#ffbbdd', deco: 'orb'     },
  // Arcane
  { id: 80,  name: 'Arcane Seal',     category: '3D',  type: 'image', light: '#dd88ff', mid: '#8800cc', dark: '#12002a', glow: '#bb44ff', accent: '#ff99ff', accent2: '#cc66ff', deco: 'orb'     },
  { id: 81,  name: 'Void Nexus',      category: '3D',  type: 'image', light: '#44ffee', mid: '#007766', dark: '#000d0a', glow: '#00ffcc', accent: '#66ffee', accent2: '#33ddcc', deco: 'diamond' },
  { id: 82,  name: 'Shadow Throne',   category: '3D',  type: 'image', light: '#bb77ff', mid: '#550099', dark: '#080011', glow: '#8800ff', accent: '#dd77ff', accent2: '#9933ff', deco: 'spike'   },
  { id: 83,  name: 'Nebula Core',     category: '3D',  type: 'image', light: '#ff66cc', mid: '#5533ff', dark: '#080011', glow: '#9966ff', accent: '#88aaff', accent2: '#ff88ff', deco: 'star'    },
  // Prestige
  { id: 84,  name: 'Golden Emperor',  category: '3D',  type: 'image', light: '#fff099', mid: '#ddaa00', dark: '#2e1a00', glow: '#ffcc00', accent: '#ffffff', accent2: '#ffee88', deco: 'diamond' },
  { id: 85,  name: 'Diamond Crest',   category: '3D',  type: 'image', light: '#ffffff', mid: '#aaccee', dark: '#223344', glow: '#ddeeff', accent: '#ccffff', accent2: '#aaddff', deco: 'diamond' },
  { id: 86,  name: 'Angel Halo',      category: '3D',  type: 'image', light: '#fffff0', mid: '#eedd88', dark: '#1a1200', glow: '#ffffaa', accent: '#ffffff', accent2: '#ffffcc', deco: 'orb'     },
  { id: 87,  name: 'Ancient Rune',    category: '3D',  type: 'image', light: '#ddbb66', mid: '#886600', dark: '#0d0900', glow: '#ccaa33', accent: '#ffdd88', accent2: '#ccaa44', deco: 'diamond' },
  // Dark
  { id: 88,  name: 'Crimson Eclipse', category: '3D',  type: 'image', light: '#ff6655', mid: '#aa0000', dark: '#110000', glow: '#dd0000', accent: '#ff8888', accent2: '#ff3333', deco: 'spike'   },
  { id: 89,  name: 'Demon Seal',      category: '3D',  type: 'image', light: '#cc3300', mid: '#550000', dark: '#080000', glow: '#aa1100', accent: '#ff2200', accent2: '#882200', deco: 'spike'   },
  { id: 90,  name: 'Obsidian Edge',   category: '3D',  type: 'image', light: '#888899', mid: '#333344', dark: '#050508', glow: '#7777aa', accent: '#9999bb', accent2: '#666688', deco: 'crystal' },
  { id: 91,  name: 'Midnight Raven',  category: '3D',  type: 'image', light: '#4466aa', mid: '#112255', dark: '#020509', glow: '#3355aa', accent: '#6688cc', accent2: '#334477', deco: 'orb'     },
  { id: 92,  name: 'Blood Moon',      category: '3D',  type: 'image', light: '#dd2222', mid: '#770000', dark: '#0d0000', glow: '#cc1100', accent: '#ff4444', accent2: '#cc0000', deco: 'orb'     },
  // Storm & Energy
  { id: 93,  name: 'Thunder God',     category: '3D',  type: 'image', light: '#ffff44', mid: '#ffaa00', dark: '#1a1000', glow: '#ffee00', accent: '#ffffff', accent2: '#ffff99', deco: 'star'    },
  { id: 94,  name: 'Storm Breaker',   category: '3D',  type: 'image', light: '#88aacc', mid: '#334466', dark: '#05080f', glow: '#6688bb', accent: '#aaccff', accent2: '#7799bb', deco: 'spike'   },
  { id: 95,  name: 'Neon Surge',      category: '3D',  type: 'image', light: '#66ffcc', mid: '#00bb88', dark: '#000d08', glow: '#00ffaa', accent: '#aaffee', accent2: '#33ffcc', deco: 'star'    },
  // Special
  { id: 96,  name: 'Dragon Scale',    category: '3D',  type: 'image', light: '#44dd22', mid: '#115500', dark: '#010800', glow: '#44bb22', accent: '#ffdd00', accent2: '#33bb11', deco: 'spike'   },
  { id: 97,  name: 'Lunar Shrine',    category: '3D',  type: 'image', light: '#eef4ff', mid: '#7788bb', dark: '#080c18', glow: '#9aaad4', accent: '#ffffff', accent2: '#ccd8ff', deco: 'orb'     },
  { id: 98,  name: 'Rose Quartz',     category: '3D',  type: 'image', light: '#ffddee', mid: '#cc5577', dark: '#150008', glow: '#ff88aa', accent: '#ffd0e0', accent2: '#ff99bb', deco: 'orb'     },
  { id: 99,  name: 'Toxic Bloom',     category: '3D',  type: 'image', light: '#aaff22', mid: '#55aa00', dark: '#081000', glow: '#88ff00', accent: '#eeff44', accent2: '#88dd00', deco: 'drop'    },
  { id: 100, name: 'Starfall',        category: '3D',  type: 'image', light: '#5577ff', mid: '#1133bb', dark: '#010318', glow: '#3355dd', accent: '#ffdd66', accent2: '#aabbff', deco: 'star'    },
]

function getFrame(id) {
  return FRAMES.find(f => f.id === Number(id)) || FRAMES[0]
}
module.exports.FRAMES = FRAMES
module.exports.getFrame = getFrame

// ─── FRAME SVG ELEMENTS ──────────────────────────────────────────────────────
function buildFrameElements(frame, cx, cy, r, uid) {
  let defs = ''
  let circles = ''
  const w = frame.width || 5

  switch (frame.type) {
    case 'solid':
      // 3D bevel effect: lighter top-left, darker bottom-right
      defs = `
        <filter id="bevel-${uid}" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur"/>
          <feOffset dx="-2" dy="-2" in="blur" result="offsetBlur1"/>
          <feOffset dx="2" dy="2" in="blur" result="offsetBlur2"/>
          <feFlood flood-color="rgba(255,255,255,0.4)" result="light"/>
          <feFlood flood-color="rgba(0,0,0,0.5)" result="shadow"/>
          <feComposite in="light" in2="offsetBlur1" operator="in" result="lightEdge"/>
          <feComposite in="shadow" in2="offsetBlur2" operator="in" result="shadowEdge"/>
          <feMerge>
            <feMergeNode in="shadowEdge"/>
            <feMergeNode in="SourceGraphic"/>
            <feMergeNode in="lightEdge"/>
          </feMerge>
        </filter>
        <linearGradient id="bevelGrad-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${lighten(frame.color, 0.5)}"/>
          <stop offset="40%" stop-color="${frame.color}"/>
          <stop offset="100%" stop-color="${darken(frame.color, 0.4)}"/>
        </linearGradient>`
      // Outer shadow ring
      circles = `
        <circle cx="${cx + 2}" cy="${cy + 2}" r="${r}" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="${w + 2}"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#bevelGrad-${uid})" stroke-width="${w}" filter="url(#bevel-${uid})"/>
        <circle cx="${cx - 1}" cy="${cy - 1}" r="${r - w / 2}" fill="none" stroke="${lighten(frame.color, 0.6)}" stroke-width="1" opacity="0.5"/>`
      break

    case 'glow': {
      const fid = `glow-${uid}`
      // Multi-layer glow for cartoon 3D pop
      defs = `
        <filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur1"/>
          <feGaussianBlur stdDeviation="3" result="blur2"/>
          <feMerge><feMergeNode in="blur1"/><feMergeNode in="blur2"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="glowG-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${lighten(frame.color, 0.5)}"/>
          <stop offset="100%" stop-color="${frame.color}"/>
        </linearGradient>`
      circles = `
        <circle cx="${cx + 2}" cy="${cy + 2}" r="${r}" fill="none" stroke="${darken(frame.color, 0.5)}" stroke-width="${w + 3}" opacity="0.4"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${frame.color}" stroke-width="${w + 4}" filter="url(#${fid})" opacity="0.5"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#glowG-${uid})" stroke-width="${w}"/>`
      break
    }

    case 'gradient': {
      const gid = `grad-${uid}`
      defs = `
        <linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${frame.color}"/>
          <stop offset="50%" stop-color="${blend(frame.color, frame.color2 || frame.color, 0.5)}"/>
          <stop offset="100%" stop-color="${frame.color2 || frame.color}"/>
        </linearGradient>
        <filter id="gradShadow-${uid}">
          <feDropShadow dx="2" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.5)"/>
        </filter>`
      circles = `
        <circle cx="${cx + 3}" cy="${cy + 3}" r="${r}" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="${w + 2}"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#${gid})" stroke-width="${w}" filter="url(#gradShadow-${uid})"/>
        <circle cx="${cx - 1}" cy="${cy - 1}" r="${r}" fill="none" stroke="${lighten(frame.color, 0.4)}" stroke-width="1.5" opacity="0.5"/>`
      break
    }

    case 'double':
      defs = `<filter id="dblShadow-${uid}"><feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.6)"/></filter>`
      circles = `
        <circle cx="${cx + 2}" cy="${cy + 2}" r="${r + 5}" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="5"/>
        <circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="none" stroke="${frame.color}" stroke-width="3.5" filter="url(#dblShadow-${uid})"/>
        <circle cx="${cx}" cy="${cy}" r="${r - 4}" fill="none" stroke="${frame.color2 || frame.color}" stroke-width="3"/>
        <circle cx="${cx - 1}" cy="${cy - 1}" r="${r + 5}" fill="none" stroke="${lighten(frame.color, 0.5)}" stroke-width="1" opacity="0.4"/>`
      break

    case 'dashed':
      defs = `<filter id="dashShadow-${uid}"><feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.5)"/></filter>`
      circles = `
        <circle cx="${cx + 2}" cy="${cy + 2}" r="${r}" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="${w + 2}" stroke-dasharray="${frame.dash || '8,4'}"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${frame.color}" stroke-width="${w}" stroke-dasharray="${frame.dash || '8,4'}" filter="url(#dashShadow-${uid})"/>`
      break

    case 'dotted':
      circles = `
        <circle cx="${cx + 2}" cy="${cy + 2}" r="${r}" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="${w}" stroke-dasharray="${frame.dash || '3,6'}" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${frame.color}" stroke-width="${w}" stroke-dasharray="${frame.dash || '3,6'}" stroke-linecap="round"/>`
      break

    case 'triple': {
      const c1 = frame.color
      const c2 = frame.color2 || frame.color
      const c3 = frame.color3 || frame.color2 || frame.color
      defs = `<filter id="triShadow-${uid}"><feDropShadow dx="2" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.5)"/></filter>`
      circles = `
        <circle cx="${cx + 3}" cy="${cy + 3}" r="${r + 7}" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="${w + 2}"/>
        <circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="none" stroke="${c1}" stroke-width="${w}" filter="url(#triShadow-${uid})"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c2}" stroke-width="${w}"/>
        <circle cx="${cx}" cy="${cy}" r="${r - 7}" fill="none" stroke="${c3}" stroke-width="${w}"/>
        <circle cx="${cx - 1}" cy="${cy - 1}" r="${r + 7}" fill="none" stroke="${lighten(c1, 0.4)}" stroke-width="1" opacity="0.4"/>`
      break
    }

    case 'rainbow': {
      const gid = `rainbow-${uid}`
      defs = `
        <linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${frame.color}"/>
          <stop offset="50%" stop-color="${frame.color2 || '#00FF00'}"/>
          <stop offset="100%" stop-color="${frame.color3 || '#0000FF'}"/>
        </linearGradient>
        <filter id="rainbowGlow-${uid}" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>`
      circles = `
        <circle cx="${cx + 2}" cy="${cy + 2}" r="${r}" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="${w + 2}"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#${gid})" stroke-width="${w}" filter="url(#rainbowGlow-${uid})"/>`
      break
    }

    case 'dotring': {
      const N = frame.count || 16
      const dr = frame.dotR || 4
      defs = `<filter id="dotShadow-${uid}"><feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.5)"/></filter>`
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * 2 * Math.PI
        const dx = (cx + r * Math.cos(angle)).toFixed(1)
        const dy = (cy + r * Math.sin(angle)).toFixed(1)
        // Alternating size for 3D depth illusion
        const sz = dr * (0.75 + 0.25 * Math.sin(angle + Math.PI / 4))
        circles += `<circle cx="${dx}" cy="${dy}" r="${sz.toFixed(1)}" fill="${frame.color}" filter="url(#dotShadow-${uid})"/>`
        // Highlight on top of each dot
        circles += `<circle cx="${(parseFloat(dx) - 0.5).toFixed(1)}" cy="${(parseFloat(dy) - 0.5).toFixed(1)}" r="${(sz * 0.3).toFixed(1)}" fill="${lighten(frame.color, 0.6)}" opacity="0.7"/>`
      }
      break
    }

    case 'petal': {
      const N = frame.count || 12
      const rx = frame.r2 || 7
      const ry = frame.r3 || 3
      defs = `<filter id="petalShadow-${uid}"><feDropShadow dx="1" dy="1" stdDeviation="1.5" flood-color="rgba(0,0,0,0.4)"/></filter>
        <radialGradient id="petalG-${uid}" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="${lighten(frame.color, 0.5)}"/>
          <stop offset="100%" stop-color="${frame.color}"/>
        </radialGradient>`
      for (let i = 0; i < N; i++) {
        const angleDeg = (i / N) * 360
        const angleRad = (angleDeg * Math.PI) / 180
        const ex = (cx + r * Math.cos(angleRad)).toFixed(1)
        const ey = (cy + r * Math.sin(angleRad)).toFixed(1)
        circles += `<ellipse cx="${ex}" cy="${ey}" rx="${rx}" ry="${ry}" fill="url(#petalG-${uid})" transform="rotate(${angleDeg.toFixed(1)} ${ex} ${ey})" filter="url(#petalShadow-${uid})"/>`
      }
      break
    }

    case 'sparkle': {
      const N = frame.count || 8
      const sz = 7
      defs = `<filter id="sparkShadow-${uid}"><feDropShadow dx="1" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,0.5)"/></filter>
        <radialGradient id="sparkG-${uid}" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="${lighten(frame.color, 0.6)}"/>
          <stop offset="100%" stop-color="${frame.color}"/>
        </radialGradient>`
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * 2 * Math.PI
        const sx = (cx + r * Math.cos(angle)).toFixed(1)
        const sy = (cy + r * Math.sin(angle)).toFixed(1)
        const deg = ((i / N) * 360).toFixed(1)
        const pts = [
          `${sx},${(cy + r * Math.sin(angle) - sz * 1.8).toFixed(1)}`,
          `${(cx + r * Math.cos(angle) + sz * 0.6).toFixed(1)},${sy}`,
          `${sx},${(cy + r * Math.sin(angle) + sz * 1.8).toFixed(1)}`,
          `${(cx + r * Math.cos(angle) - sz * 0.6).toFixed(1)},${sy}`,
        ].join(' ')
        circles += `<polygon points="${pts}" fill="url(#sparkG-${uid})" transform="rotate(${deg} ${sx} ${sy})" filter="url(#sparkShadow-${uid})"/>`
        // Star highlight
        circles += `<polygon points="${pts}" fill="${lighten(frame.color, 0.6)}" transform="rotate(${deg} ${sx} ${sy})" opacity="0.25" transform-origin="${sx} ${sy}" style="transform: rotate(${deg}deg) scale(0.4)"/>`
      }
      break
    }

    case 'image': {
      // 3D image frame — render a vivid layered ring using the frame's palette
      const gid   = `imgGrad-${uid}`
      const gid2  = `imgRim-${uid}`
      const light  = frame.light  || '#ffffff'
      const mid    = frame.mid    || '#888888'
      const dark   = frame.dark   || '#111111'
      const glowC  = frame.glow   || light
      const acc    = frame.accent || light
      const acc2   = frame.accent2 || acc
      defs = `
        <radialGradient id="${gid}" cx="32%" cy="28%" r="72%">
          <stop offset="0%"   stop-color="${light}"/>
          <stop offset="45%"  stop-color="${mid}"/>
          <stop offset="100%" stop-color="${dark}"/>
        </radialGradient>
        <linearGradient id="${gid2}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="${light}"/>
          <stop offset="100%" stop-color="${mid}"/>
        </linearGradient>`
      // outer ambient glow (two overlapping for bloom)
      circles = `
        <circle cx="${cx}"   cy="${cy}"   r="${r+13}" fill="${glowC}" opacity="0.10"/>
        <circle cx="${cx}"   cy="${cy}"   r="${r+9}"  fill="${glowC}" opacity="0.14"/>
        <circle cx="${cx+3}" cy="${cy+3}" r="${r+6}"  fill="${dark}"  opacity="0.55"/>
        <circle cx="${cx}"   cy="${cy}"   r="${r+6}"  fill="url(#${gid})" opacity="0.88"/>
        <circle cx="${cx}"   cy="${cy}"   r="${r+3}"  fill="none" stroke="${mid}"   stroke-width="6"/>
        <circle cx="${cx}"   cy="${cy}"   r="${r+6}"  fill="none" stroke="${light}" stroke-width="1.5" opacity="0.55"/>
        <circle cx="${cx}"   cy="${cy}"   r="${r}"    fill="none" stroke="url(#${gid2})" stroke-width="2.5" opacity="0.7"/>
        <circle cx="${cx-1}" cy="${cy-1}" r="${r+4}"  fill="none" stroke="white" stroke-width="0.8" opacity="0.18"/>
        <circle cx="${cx}"   cy="${cy}"   r="${r-3}"  fill="none" stroke="${acc2}" stroke-width="1.2" opacity="0.45"/>`
      // top & bottom accent gems
      circles += `
        <circle cx="${cx}" cy="${cy-r-3}" r="5.5" fill="${acc}" opacity="0.92"/>
        <circle cx="${cx-1.5}" cy="${cy-r-4.5}" r="2" fill="white" opacity="0.5"/>
        <circle cx="${cx}" cy="${cy+r+3}" r="4" fill="${acc2}" opacity="0.82"/>
        <circle cx="${cx-1}" cy="${cy+r+1.5}" r="1.4" fill="white" opacity="0.42"/>`
      break
    }

    default:
      circles = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${frame.color || '#FFFFFF'}" stroke-width="${w}"/>`
  }

  return { defs, circles }
}

// ─── COLOR HELPERS ──────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 128, g: 128, b: 128 }
}
function lighten(hex, amount) {
  const { r, g, b } = hexToRgb(hex)
  const rr = Math.round(Math.min(255, r + (255 - r) * amount))
  const gg = Math.round(Math.min(255, g + (255 - g) * amount))
  const bb = Math.round(Math.min(255, b + (255 - b) * amount))
  return `rgb(${rr},${gg},${bb})`
}
function darken(hex, amount) {
  const { r, g, b } = hexToRgb(hex)
  const rr = Math.round(r * (1 - amount))
  const gg = Math.round(g * (1 - amount))
  const bb = Math.round(b * (1 - amount))
  return `rgb(${rr},${gg},${bb})`
}
function blend(hex1, hex2, t) {
  const a = hexToRgb(hex1), b = hexToRgb(hex2)
  return `rgb(${Math.round(a.r + (b.r - a.r) * t)},${Math.round(a.g + (b.g - a.g) * t)},${Math.round(a.b + (b.b - a.b) * t)})`
}

// ─── 3D IMAGE FRAME SVG GENERATOR ────────────────────────────────────────────
// NOTE: Uses NO SVG <filter> elements — libvips/Sharp only supports gradients
// and basic shapes. The 3D illusion is achieved with layered circles.
function buildImageFrameSvg(frame) {
  const SIZE  = 300
  const CX    = 150, CY = 150
  const MID_R = 117
  const W     = 58
  const id    = `if${frame.id}`

  const { light, mid, dark, glow: glowC, accent, deco = 'orb' } = frame
  const accent2 = frame.accent2 || accent

  // ── Dots (no filter attribute) ──
  let dotsSvg = ''
  const NUM_DOTS = 8
  for (let i = 0; i < NUM_DOTS; i++) {
    if (i === 0 || i === 4) continue
    const angleDeg = (i / NUM_DOTS) * 360 - 90
    const angleRad = angleDeg * Math.PI / 180
    const dx = (CX + MID_R * Math.cos(angleRad)).toFixed(1)
    const dy = (CY + MID_R * Math.sin(angleRad)).toFixed(1)
    const sz = (3.2 + 1.4 * Math.abs(Math.sin(angleRad))).toFixed(1)
    // Simulated glow: two overlapping circles at different opacities
    dotsSvg += `<circle cx="${dx}" cy="${dy}" r="${(parseFloat(sz)*1.9).toFixed(1)}" fill="${accent2}" opacity="0.18"/>`
    dotsSvg += `<circle cx="${dx}" cy="${dy}" r="${sz}" fill="${accent2}" opacity="0.92"/>`
    dotsSvg += `<circle cx="${(parseFloat(dx)-0.8).toFixed(1)}" cy="${(parseFloat(dy)-0.8).toFixed(1)}" r="${(parseFloat(sz)*0.35).toFixed(1)}" fill="white" opacity="0.58"/>`
  }

  // ── Accent gem builder (NO filter attributes) ──
  function makeAccent(ax, ay, sz, top) {
    const d = top ? -1 : 1
    switch (deco) {
      case 'diamond': {
        const hw = sz * 0.55, hh = sz * 0.9
        const pts = `${ax},${ay - hh} ${ax + hw},${ay} ${ax},${ay + hh} ${ax - hw},${ay}`
        return `<circle cx="${ax}" cy="${ay}" r="${sz*1.6}" fill="${accent}" opacity="0.15"/>
          <polygon points="${pts}" fill="${accent}" opacity="0.96"/>
          <polygon points="${ax},${ay-hh*0.82} ${ax+hw*0.5},${ay-hh*0.08} ${ax},${ay-hh*0.12} ${ax-hw*0.5},${ay-hh*0.08}" fill="white" opacity="0.32"/>
          <circle cx="${ax - sz*0.14}" cy="${ay - hh*0.5}" r="${sz*0.14}" fill="white" opacity="0.5"/>`
      }
      case 'orb': return `
          <circle cx="${ax}" cy="${ay}" r="${sz*1.8}" fill="${accent}" opacity="0.15"/>
          <circle cx="${ax}" cy="${ay}" r="${sz}" fill="${accent}" opacity="0.96"/>
          <circle cx="${ax - sz*0.28}" cy="${ay - sz*0.28}" r="${sz*0.38}" fill="white" opacity="0.38"/>
          <circle cx="${ax - sz*0.18}" cy="${ay - sz*0.18}" r="${sz*0.15}" fill="white" opacity="0.6"/>`
      case 'star': {
        const pts = []
        for (let i = 0; i < 8; i++) {
          const r2 = i % 2 === 0 ? sz : sz * 0.44
          const a  = (i / 8) * 2 * Math.PI - Math.PI / 2
          pts.push(`${(ax + r2 * Math.cos(a)).toFixed(1)},${(ay + r2 * Math.sin(a)).toFixed(1)}`)
        }
        return `<circle cx="${ax}" cy="${ay}" r="${sz*1.6}" fill="${accent}" opacity="0.15"/>
          <polygon points="${pts.join(' ')}" fill="${accent}" opacity="0.96"/>
          <circle cx="${ax - sz*0.22}" cy="${ay - sz*0.22}" r="${sz*0.22}" fill="white" opacity="0.42"/>`
      }
      case 'crystal': {
        const hw = sz * 0.48
        const pts = `${ax},${ay - sz} ${ax+hw},${ay-sz*0.18} ${ax+hw*0.45},${ay+sz} ${ax-hw*0.45},${ay+sz} ${ax-hw},${ay-sz*0.18}`
        return `<circle cx="${ax}" cy="${ay}" r="${sz*1.5}" fill="${accent}" opacity="0.15"/>
          <polygon points="${pts}" fill="${accent}" opacity="0.92"/>
          <polygon points="${ax},${ay-sz} ${ax+hw},${ay-sz*0.18} ${ax},${ay}" fill="white" opacity="0.22"/>
          <circle cx="${ax - sz*0.1}" cy="${ay - sz*0.5}" r="${sz*0.12}" fill="white" opacity="0.6"/>`
      }
      case 'drop': return `
          <circle cx="${ax}" cy="${ay}" r="${sz*1.7}" fill="${accent}" opacity="0.15"/>
          <ellipse cx="${ax}" cy="${ay}" rx="${sz*0.62}" ry="${sz*0.78}" fill="${accent}" opacity="0.95"/>
          <circle cx="${ax}" cy="${ay + d*sz*0.28}" r="${sz*0.52}" fill="${accent2}" opacity="0.6"/>
          <circle cx="${ax - sz*0.2}" cy="${ay - d*sz*0.18}" r="${sz*0.22}" fill="white" opacity="0.48"/>
          <circle cx="${ax - sz*0.1}" cy="${ay - d*sz*0.08}" r="${sz*0.1}" fill="white" opacity="0.65"/>`
      case 'spike': {
        const hw = sz * 0.36
        const pts = top
          ? `${ax},${ay - sz} ${ax+hw},${ay} ${ax},${ay+sz*0.38} ${ax-hw},${ay}`
          : `${ax},${ay + sz} ${ax+hw},${ay} ${ax},${ay-sz*0.38} ${ax-hw},${ay}`
        return `<circle cx="${ax}" cy="${ay}" r="${sz*1.5}" fill="${accent}" opacity="0.15"/>
          <polygon points="${pts}" fill="${accent}" opacity="0.92"/>
          <polygon points="${ax},${top ? ay-sz : ay+sz} ${ax+hw*0.38},${ay} ${ax},${ay+(top?0:-1)*sz*0.28}" fill="white" opacity="0.22"/>`
      }
      case 'flame': return `
          <circle cx="${ax}" cy="${ay}" r="${sz*1.6}" fill="${accent}" opacity="0.15"/>
          <ellipse cx="${ax}" cy="${ay}" rx="${sz*0.52}" ry="${sz*0.82}" fill="${accent}" opacity="0.92" transform="rotate(${top?0:180} ${ax} ${ay})"/>
          <ellipse cx="${ax}" cy="${ay + d*sz*0.14}" rx="${sz*0.28}" ry="${sz*0.52}" fill="${accent2}" opacity="0.65"/>
          <circle cx="${ax - sz*0.1}" cy="${ay - d*sz*0.2}" r="${sz*0.13}" fill="white" opacity="0.52"/>`
      default: return `
          <circle cx="${ax}" cy="${ay}" r="${sz*1.8}" fill="${accent}" opacity="0.15"/>
          <circle cx="${ax}" cy="${ay}" r="${sz}" fill="${accent}" opacity="0.95"/>
          <circle cx="${ax - sz*0.28}" cy="${ay - sz*0.28}" r="${sz*0.38}" fill="white" opacity="0.38"/>`
    }
  }

  const topY = CY - MID_R - W / 2 + 4
  const botY = CY + MID_R + W / 2 - 4

  // Simulated inner glow: thin ring at slightly larger opacity
  const innerGlow1 = MID_R - W / 2 + 9
  const outerGlow1 = MID_R + W / 2 - 7

  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="rg-${id}" gradientUnits="userSpaceOnUse" cx="105" cy="90" fx="88" fy="74" r="145">
      <stop offset="0%"   stop-color="${light}"/>
      <stop offset="42%"  stop-color="${mid}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </radialGradient>
  </defs>

  <!-- Drop shadow: soft dark ring offset down-right -->
  <circle cx="${CX+3}" cy="${CY+6}" r="${MID_R}" fill="none" stroke="${dark}" stroke-width="${W+10}" opacity="0.42"/>
  <circle cx="${CX+2}" cy="${CY+4}" r="${MID_R}" fill="none" stroke="${dark}" stroke-width="${W+4}"  opacity="0.28"/>

  <!-- Main 3D ring: radial gradient gives top-left lit, bottom-right dark -->
  <circle cx="${CX}" cy="${CY}" r="${MID_R}" fill="none" stroke="url(#rg-${id})" stroke-width="${W}"/>

  <!-- Inner bevel edge -->
  <circle cx="${CX}" cy="${CY}" r="${MID_R - W/2 + 1.5}" fill="none" stroke="${dark}"  stroke-width="3.5" opacity="0.65"/>
  <circle cx="${CX}" cy="${CY}" r="${MID_R - W/2 + 4}"   fill="none" stroke="${light}" stroke-width="1.5" opacity="0.28"/>

  <!-- Outer bevel edge -->
  <circle cx="${CX}" cy="${CY}" r="${MID_R + W/2 - 1.5}" fill="none" stroke="${dark}"  stroke-width="2.5" opacity="0.52"/>
  <circle cx="${CX}" cy="${CY}" r="${MID_R + W/2 - 4}"   fill="none" stroke="${light}" stroke-width="1.5" opacity="0.22"/>

  <!-- Top-left broad highlight arc (3D pop illusion) -->
  <path d="M ${CX - MID_R + 10},${CY - 8} A ${MID_R},${MID_R} 0 0 1 ${CX - 8},${CY - MID_R + 10}"
    fill="none" stroke="white" stroke-width="14" stroke-linecap="round" opacity="0.12"/>

  <!-- Specular hot-spot (smaller brighter arc) -->
  <path d="M ${CX - 62},${CY - 92} A ${MID_R - 8},${MID_R - 8} 0 0 1 ${CX - 92},${CY - 62}"
    fill="none" stroke="white" stroke-width="7" stroke-linecap="round" opacity="0.30"/>

  <!-- Simulated inner glow (no filter — just slightly wider transparent ring) -->
  <circle cx="${CX}" cy="${CY}" r="${innerGlow1}" fill="none" stroke="${glowC}" stroke-width="5" opacity="0.22"/>
  <circle cx="${CX}" cy="${CY}" r="${innerGlow1}" fill="none" stroke="${glowC}" stroke-width="2" opacity="0.40"/>

  <!-- Simulated outer glow -->
  <circle cx="${CX}" cy="${CY}" r="${outerGlow1}" fill="none" stroke="${glowC}" stroke-width="4" opacity="0.18"/>
  <circle cx="${CX}" cy="${CY}" r="${outerGlow1}" fill="none" stroke="${glowC}" stroke-width="1.5" opacity="0.32"/>

  <!-- Decorative ring dots -->
  ${dotsSvg}

  <!-- Top accent gem -->
  ${makeAccent(CX, topY, 11, true)}

  <!-- Bottom accent gem -->
  ${makeAccent(CX, botY, 11, false)}
</svg>`
}

// ─── FRAME OVERLAY SVG (transparent layer over the full card) ────────────────
function buildCardFrameSvg(frame) {
  const r = AV_R + 6
  const { defs, circles } = buildFrameElements(frame, AV_CX, AV_CY, r, `cf${frame.id}`)
  return `<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>${defs}</defs>
    ${circles}
  </svg>`
}

// ─── STATS OVERLAY SVG (portrait) ────────────────────────────────────────────
function buildStatsSvg(user, frameName) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const name    = esc((user.name || user.phone || 'Unknown').substring(0, 20))
  const title   = esc((user.title || 'Newcomer').substring(0, 18))
  const role    = esc((user.role || 'member').toUpperCase())
  const wallet  = '$' + Number(user.wallet || 0).toLocaleString()
  const bank    = '$' + Number(user.bank || 0).toLocaleString()
  const gems    = Number(user.gems || 0).toLocaleString()
  const streak  = user.streak || 0
  const level   = user.level || 1
  const xp      = Number(user.xp || 0)
  const xpNeed  = level * 1000
  const xpPct   = Math.min(xp / xpNeed, 1)
  const xpBarW  = Math.round(350 * xpPct)
  const phone   = esc((user.phone || '').substring(0, 15))
  const fname   = esc((frameName || 'Classic White').substring(0, 18))

  const roleColor = {
    owner:      '#FF4444',
    admin:      '#FF8800',
    mod:        '#FF8800',
    guardian:   '#00BFFF',
    staff:      '#FFAA00',
    vip:        '#AA00FF',
    card_maker: '#8b5cf6',
    cardmaker:  '#8b5cf6',
    member:     '#4ade80',
  }[user.role] || '#4ade80'
  const roleTextColor = (user.role === 'member') ? '#000000' : '#ffffff'

  // Role label: map internal role names to display labels
  const roleLabel = {
    owner:      'OWNER',
    admin:      'ADMIN',
    mod:        'MOD',
    guardian:   'GUARDIAN',
    staff:      'STAFF',
    vip:        'VIP',
    card_maker: 'CARD MAKER',
    cardmaker:  'CARD MAKER',
    member:     'MEMBER',
  }[user.role] || (user.role || 'MEMBER').toUpperCase()

  // Widen badge for longer labels
  const badgeW = Math.max(72, roleLabel.length * 7 + 20)
  const badgeX = AV_CX - badgeW / 2

  return `<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ov" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="#000000" stop-opacity="0.0"/>
      <stop offset="55%"  stop-color="#000000" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.20"/>
    </linearGradient>
    <linearGradient id="xpg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <clipPath id="card-clip">
      <rect width="${CARD_W}" height="${CARD_H}" rx="18" ry="18"/>
    </clipPath>
  </defs>

  <rect width="${CARD_W}" height="${CARD_H}" fill="url(#ov)" clip-path="url(#card-clip)"/>
  <circle cx="${AV_CX}" cy="${AV_CY}" r="${AV_R + 4}" fill="#04040e" opacity="0.68"/>

  <text x="16" y="26" fill="#ffffff" font-size="13" font-weight="bold" font-family="Liberation Sans,sans-serif">Bank: ${bank}</text>
  <text x="16" y="46" fill="#ffffff" font-size="13" font-weight="bold" font-family="Liberation Sans,sans-serif">Wallet: ${wallet}</text>

  <!-- Avatar bottom = y ${AV_CY + AV_R} = ${AV_CY + AV_R}. Extra gap before name. -->
  <text x="${AV_CX}" y="304" fill="#ffffff" font-size="24" font-weight="bold"
    text-anchor="middle" font-family="Liberation Sans,sans-serif">${name}</text>
  <text x="${AV_CX}" y="323" fill="#aaaacc" font-size="12"
    text-anchor="middle" font-family="Liberation Sans,sans-serif">(${title})</text>
  <text x="${AV_CX}" y="344" fill="#e0e0ff" font-size="14" font-weight="bold"
    text-anchor="middle" font-family="Liberation Sans,sans-serif">Level ${level}</text>
  <rect x="${badgeX}" y="350" width="${badgeW}" height="20" fill="${roleColor}" rx="10"/>
  <text x="${AV_CX}" y="364" fill="${roleTextColor}" font-size="11" font-weight="bold"
    text-anchor="middle" font-family="Liberation Sans,sans-serif">${roleLabel}</text>

  <rect x="75" y="380" width="350" height="18" fill="#111128" rx="9"/>
  <rect x="75" y="380" width="${Math.max(xpBarW, 4)}" height="18" fill="url(#xpg)" rx="9"/>
  <text x="${AV_CX}" y="393" fill="#ffffff" font-size="10" font-weight="bold"
    text-anchor="middle" font-family="Liberation Sans,sans-serif">${xp.toLocaleString()} / ${xpNeed.toLocaleString()} XP</text>

  <line x1="40" y1="410" x2="460" y2="410" stroke="#1e1e3a" stroke-width="1"/>

  <text x="103"  y="426" fill="#555577" font-size="9" text-anchor="middle" font-family="Liberation Sans,sans-serif" letter-spacing="1">BANK</text>
  <text x="103"  y="448" fill="#34d399" font-size="20" font-weight="bold" text-anchor="middle" font-family="Liberation Sans,sans-serif">${bank}</text>

  <text x="${AV_CX}" y="426" fill="#555577" font-size="9" text-anchor="middle" font-family="Liberation Sans,sans-serif" letter-spacing="1">GEMS</text>
  <text x="${AV_CX}" y="448" fill="#60a5fa" font-size="20" font-weight="bold" text-anchor="middle" font-family="Liberation Sans,sans-serif">${gems}</text>

  <text x="397"  y="426" fill="#555577" font-size="9" text-anchor="middle" font-family="Liberation Sans,sans-serif" letter-spacing="1">STREAK</text>
  <text x="397"  y="448" fill="#f472b6" font-size="20" font-weight="bold" text-anchor="middle" font-family="Liberation Sans,sans-serif">${streak}d</text>

  <line x1="40" y1="464" x2="460" y2="464" stroke="#1e1e3a" stroke-width="1"/>

  <text x="${AV_CX}" y="480" fill="#3a3a5c" font-size="10"
    text-anchor="middle" font-family="Liberation Sans,sans-serif">Frame: ${fname}  |  ${phone}</text>

  <text x="${AV_CX}" y="510" fill="#272740" font-size="12" font-weight="bold"
    text-anchor="middle" font-family="Liberation Sans,sans-serif">Shadow Garden  -  Alpha</text>
</svg>`
}

// ─── CIRCULAR AVATAR ─────────────────────────────────────────────────────────
async function makeCircleAvatar(inputBuffer, diameter) {
  const r = diameter / 2
  const mask = Buffer.from(
    `<svg width="${diameter}" height="${diameter}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${r}" cy="${r}" r="${r}" fill="white"/>
    </svg>`
  )
  return sharp(inputBuffer)
    .resize(diameter, diameter, { fit: 'cover' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

async function makeInitialsAvatar(name, diameter) {
  const initial = (name || '?')[0].toUpperCase().replace(/[^A-Z0-9]/, '?')
  const r = diameter / 2
  const svg = `<svg width="${diameter}" height="${diameter}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${r}" cy="${r}" r="${r}" fill="#1e1e2e"/>
    <text x="${r}" y="${r + diameter * 0.15}" fill="#8b5cf6" font-size="${Math.round(diameter * 0.42)}"
      font-weight="bold" text-anchor="middle" font-family="Liberation Sans,sans-serif">${initial}</text>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

// ─── FETCH REMOTE BUFFER ─────────────────────────────────────────────────────
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
  })
}

// ─── MAIN: GENERATE PROFILE CARD ─────────────────────────────────────────────
async function generateProfileCard(user, ppBuffer = null, bgBuffer = null) {
  const diameter = AV_R * 2

  let bgLayer
  if (bgBuffer) {
    bgLayer = await sharp(bgBuffer)
      .resize(CARD_W, CARD_H, { fit: 'cover' })
      .png()
      .toBuffer()
  } else {
    const bgSvg = `<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0d0d1a"/>
          <stop offset="100%" stop-color="#1a0a2e"/>
        </linearGradient>
      </defs>
      <rect width="${CARD_W}" height="${CARD_H}" fill="url(#bg)" rx="16"/>
    </svg>`
    bgLayer = await sharp(Buffer.from(bgSvg)).png().toBuffer()
  }

  const frameId = user.profile_frame || 1
  const frame = getFrame(frameId)
  const statsLayer = Buffer.from(buildStatsSvg(user, frame.name))

  let avatarBuf
  if (ppBuffer) {
    avatarBuf = await makeCircleAvatar(ppBuffer, diameter)
  } else {
    avatarBuf = await makeInitialsAvatar(user.name || user.phone || '?', diameter)
  }

  const avatarTop  = AV_CY - AV_R
  const avatarLeft = AV_CX - AV_R

  // ── Image frames (3D, 300×300 PNG centered on avatar) ──
  if (frame.type === 'image') {
    const FRAME_SIZE = 300
    const frameSvgBuf = Buffer.from(buildImageFrameSvg(frame))
    const framePng = await sharp(frameSvgBuf)
      .resize(FRAME_SIZE, FRAME_SIZE)
      .png()
      .toBuffer()
    const frameLeft = AV_CX - FRAME_SIZE / 2
    const frameTop  = AV_CY - FRAME_SIZE / 2

    return sharp(bgLayer)
      .composite([
        { input: statsLayer, top: 0,        left: 0        },
        { input: avatarBuf,  top: avatarTop, left: avatarLeft },
        { input: framePng,   top: frameTop,  left: frameLeft  },
      ])
      .png()
      .toBuffer()
  }

  // ── Classic SVG frames (full-card overlay) ──
  const frameLayer = Buffer.from(buildCardFrameSvg(frame))

  return sharp(bgLayer)
    .composite([
      { input: statsLayer, top: 0,        left: 0        },
      { input: avatarBuf,  top: avatarTop, left: avatarLeft },
      { input: frameLayer, top: 0,         left: 0         },
    ])
    .png()
    .toBuffer()
}
module.exports.generateProfileCard = generateProfileCard

// ─── FRAME CATALOG IMAGE (3D cartoon style, paged: 35 per page) ──────────────
async function generateFrameCatalog(page = 1) {
  const PER_PAGE = 35
  const COLS = 7
  const ROWS = 5
  const CW = 112
  const CH = 156
  const PAD = 18
  const HEADER = 96
  const W = COLS * CW + PAD * 2
  const H = ROWS * CH + HEADER + PAD * 2

  const startIdx = (page - 1) * PER_PAGE
  const pageFrames = FRAMES.slice(startIdx, startIdx + PER_PAGE)

  const totalPages = Math.ceil(FRAMES.length / PER_PAGE)
  const pageLabel = `Page ${page} / ${totalPages}`
  const rangeLabel = `Frames ${startIdx + 1}–${Math.min(startIdx + PER_PAGE, FRAMES.length)}`

  let allDefs = `
    <!-- 3D cartoon cell styles -->
    <filter id="cellShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="rgba(0,0,0,0.7)"/>
    </filter>
    <filter id="innerGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="cellGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e1e3f"/>
      <stop offset="50%" stop-color="#12122a"/>
      <stop offset="100%" stop-color="#0a0a1c"/>
    </linearGradient>
    <linearGradient id="cellHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.12)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0d0d1a"/>
      <stop offset="50%" stop-color="#1a0a2e"/>
      <stop offset="100%" stop-color="#0d0d1a"/>
    </linearGradient>
    <linearGradient id="idBadge" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#4c1d95"/>
    </linearGradient>
  `
  let allCells = ''

  pageFrames.forEach((frame, i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const ox = PAD + col * CW
    const oy = HEADER + PAD + row * CH
    const cx = ox + CW / 2
    const cy = oy + 50
    const r  = 38

    // 3D card: bottom shadow layer
    allCells += `<rect x="${ox + 4}" y="${oy + 6}" width="${CW - 8}" height="${CH - 8}" fill="rgba(0,0,0,0.6)" rx="12"/>`
    // Main cell background
    allCells += `<rect x="${ox + 2}" y="${oy + 2}" width="${CW - 4}" height="${CH - 4}" fill="url(#cellGrad)" rx="12" filter="url(#cellShadow)"/>`
    // Top highlight (gives 3D raised look)
    allCells += `<rect x="${ox + 3}" y="${oy + 3}" width="${CW - 6}" height="${(CH - 6) * 0.45}" fill="url(#cellHighlight)" rx="10"/>`
    // Inner border
    allCells += `<rect x="${ox + 3}" y="${oy + 3}" width="${CW - 6}" height="${CH - 6}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1" rx="11"/>`

    // Avatar circle backing with 3D depth
    allCells += `<circle cx="${cx + 2}" cy="${cy + 2}" r="${r + 2}" fill="rgba(0,0,0,0.5)"/>`
    allCells += `<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="#07071a"/>`
    allCells += `<circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="#0d0d20"/>`
    // Inner avatar area sheen
    allCells += `<ellipse cx="${cx - 5}" cy="${cy - 8}" rx="${r * 0.6}" ry="${r * 0.35}" fill="rgba(255,255,255,0.04)"/>`
    // PP placeholder text
    allCells += `<text x="${cx}" y="${cy + 4}" fill="#1e1e44" font-size="9" text-anchor="middle" font-family="Liberation Sans,sans-serif" font-weight="bold">PP</text>`

    const uid = `cat${frame.id}`
    const { defs, circles } = buildFrameElements(frame, cx, cy, r, uid)
    allDefs += defs
    allCells += circles

    // ID badge — 3D pill
    allCells += `<rect x="${cx - 13}" y="${cy + r + 5}" width="26" height="17" fill="url(#idBadge)" rx="8"/>`
    // Badge highlight
    allCells += `<rect x="${cx - 12}" y="${cy + r + 6}" width="24" height="7" fill="rgba(255,255,255,0.15)" rx="6"/>`
    // Badge shadow
    allCells += `<rect x="${cx - 13}" y="${cy + r + 16}" width="26" height="4" fill="rgba(0,0,0,0.4)" rx="0 0 8 8"/>`
    allCells += `<text x="${cx}" y="${cy + r + 17}" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle" font-family="Liberation Sans,sans-serif">${frame.id}</text>`

    // Frame name
    const n = frame.name.length > 12 ? frame.name.slice(0, 11) + '.' : frame.name
    allCells += `<text x="${cx}" y="${cy + r + 32}" fill="#c4b5fd" font-size="8" font-weight="bold" text-anchor="middle" font-family="Liberation Sans,sans-serif">${n}</text>`

    // Category tag
    const catColor = { Basic: '#6b7280', Neon: '#06b6d4', Gradient: '#f59e0b', Ornate: '#a855f7', Nature: '#22c55e', Prestige: '#eab308', Extra: '#f97316', Anime: '#ec4899' }[frame.category] || '#6b7280'
    allCells += `<text x="${cx}" y="${cy + r + 46}" fill="${catColor}" font-size="7" text-anchor="middle" font-family="Liberation Sans,sans-serif" font-weight="bold">${frame.category.toUpperCase()}</text>`
  })

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>${allDefs}</defs>

    <!-- Background -->
    <rect width="${W}" height="${H}" fill="#060612"/>
    <!-- Subtle grid pattern for depth -->
    <rect width="${W}" height="${H}" fill="url(#headerGrad)" opacity="0.4"/>

    <!-- Header area -->
    <rect width="${W}" height="${HEADER}" fill="url(#headerGrad)"/>
    <rect x="0" y="${HEADER - 2}" width="${W}" height="2" fill="#8b5cf6" opacity="0.6"/>

    <!-- Header star-field dots -->
    ${Array.from({length: 30}, (_, i) => {
      const sx = Math.abs((i * 137 + 43) % W)
      const sy = Math.abs((i * 97 + 11) % (HEADER - 20)) + 4
      const sz = (i % 3 === 0) ? 1.5 : 1
      return `<circle cx="${sx}" cy="${sy}" r="${sz}" fill="#ffffff" opacity="${0.2 + (i % 5) * 0.08}"/>`
    }).join('')}

    <text x="${W / 2}" y="34" fill="#ffffff" font-size="22" font-weight="bold"
      text-anchor="middle" font-family="Liberation Sans,sans-serif">🖼 FRAMES COLLECTION</text>
    <text x="${W / 2}" y="56" fill="#8b5cf6" font-size="13" font-weight="bold"
      text-anchor="middle" font-family="Liberation Sans,sans-serif">${pageLabel}  ·  ${rangeLabel}</text>
    <line x1="${PAD}" y1="68" x2="${W - PAD}" y2="68" stroke="#1e1e4a" stroke-width="1"/>
    <text x="${W / 2}" y="84" fill="#4a4a77" font-size="10"
      text-anchor="middle" font-family="Liberation Sans,sans-serif">Use .setframe &lt;id&gt; to equip  ·  .frames 2 for anime page</text>

    <!-- Cells -->
    ${allCells}
  </svg>`

  return sharp(Buffer.from(svg)).png().toBuffer()
}
module.exports.generateFrameCatalog = generateFrameCatalog
module.exports.fetchBuffer = fetchBuffer
