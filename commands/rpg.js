'use strict'

const db     = require('../database')
const http   = require('http')
const https  = require('https')
const maps   = require('./rpg_maps')

// ── In-memory sessions ────────────────────────────────────────────────────
const dungeonSessions = {}    // phone → dungeon state
const exploreSessions = {}    // phone → { mapName }
const questSessions   = {}    // phone → { questId, ...progress }
const rpartySessions  = {}    // groupJid → { leader, members, sharedQuest }

// ═══════════════════════════════════════════════════════════════════════════
//  IMAGE FETCHING (Pollinations)
// ═══════════════════════════════════════════════════════════════════════════

function fetchPollinationsImage(prompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&model=flux`
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { timeout: 18000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null) }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', () => resolve(null))
    })
    req.on('error', () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
  })
}

function fetchProfileCardImage(user, cls) {
  const className = cls ? cls.name : 'Adventurer'
  const level = user.level || 1
  const prompt = `anime fantasy RPG adventurer profile card portrait character illustration, ` +
    `${className.toLowerCase()} class, level ${level} hero, detailed character design, ` +
    `official character card art style, parchment background with dark fantasy decorative border, ` +
    `dramatic lighting, full body or half body, detailed armor and weapons, konosuba art style`
  return fetchPollinationsImage(prompt)
}

function fetchDungeonImage(enemy, floor) {
  const zone = floor <= 3 ? 'mist corridor' : floor <= 6 ? 'dark hall torchlit' : floor <= 10 ? 'burning depths lava' : floor <= 15 ? 'frost vault ice cave' : floor <= 20 ? 'storm chamber lightning' : 'void core fracturing reality'
  const enemyName = (enemy.name || 'shadow monster').toLowerCase()
  return fetchPollinationsImage(`anime dark fantasy dungeon ${zone} ${enemyName} battle scene dramatic lighting shadow garden epic atmospheric`)
}

function fetchMonsterImage(enemyName) {
  const name = (enemyName || 'shadow monster').toLowerCase()
  return fetchPollinationsImage(`anime dark fantasy monster ${name} dramatic battle pose glowing eyes shadow dungeon epic lighting full body`)
}

function fetchExploreImage(mapName, tileName) {
  const prompt = `anime fantasy landscape ${mapName.toLowerCase()} ${(tileName || '').toLowerCase()} location scene, detailed environment art, RPG game background, dramatic lighting, high quality illustration`
  return fetchPollinationsImage(prompt)
}

const ACTION_PROMPTS = {
  attack:     'anime warrior dark fantasy sword slash attack battle motion blur dramatic lighting',
  slash:      'anime swordsman dark slash technique blade energy shadow burst manga style',
  darkslash:  'anime dark energy infused sword slash void energy swirling black purple aura',
  voidrend:   'anime void rend reality tears apart dark energy sword ultimate technique epic',
  darknova:   'anime dark mage void explosion magic spell purple black energy burst dramatic',
  voidcascade:'anime cascading void energy dark mage spell waves of dark magic destruction',
  shadowshot: 'anime archer shadow arrow nocking glowing dark arrow void energy piercing',
  voidpiercer:'anime void arrow piercing through shadow energy ultimate archer technique epic',
  backstab:   'anime assassin shadow backstab surprise attack from darkness blade gleam',
  deathmark:  'anime assassin death mark dark energy marking target crimson glow dramatic',
  berserk:    'anime warrior berserk rage red aura power explosion muscles dark fantasy',
  heavy:      'anime warrior heavy slam massive weapon impact ground shatter dramatic power',
  special:    'anime shadow burst special ability dark energy explosion dramatic pose epic',
  heal:       'anime healing magic green glow potion elixir recovery light dark fantasy battle',
  smokebomb:  'anime assassin smoke bomb vanish into shadows dark mist dramatic escape',
  shieldwall: 'anime knight massive shield wall raise defensive stance dark fantasy dramatic',
  deathblow:  'anime knight finisher death blow massive strike final hit dramatic energy burst',
}

function fetchActionImage(action, enemyName) {
  const prompt = (ACTION_PROMPTS[action] || `anime dark fantasy ${action} battle skill dramatic shadow energy epic`) +
    (enemyName ? ` against ${enemyName.toLowerCase()}` : '')
  return fetchPollinationsImage(prompt)
}

async function sendImgOrReply(sock, jid, buffer, caption, replyFn, quotedMsg) {
  try {
    if (sock && jid && buffer && buffer.length > 500) {
      await sock.sendMessage(jid, { image: buffer, caption }, quotedMsg ? { quoted: quotedMsg } : {})
      return
    }
  } catch (e) { console.error('[sendImgOrReply]', e.message) }
  await replyFn(caption)
}

// ═══════════════════════════════════════════════════════════════════════════
//  RPG PROFILE CARD IMAGE GENERATOR (SVG via sharp)
// ═══════════════════════════════════════════════════════════════════════════

async function generateRpgCardImage(user, cls, profileImgBuffer) {
  try {
    const sharp = require('sharp')

    const name     = (user.name || 'Unknown').slice(0, 20)
    const clsName  = cls ? cls.name : 'No Class'
    const clsEmoji = cls ? cls.emoji : '❔'
    const level    = user.level || 1
    const xp       = user.xp   || 0
    const xpNeeded = level * 1000
    const title    = user.title || 'Newcomer'

    // Stat bars (class-based)
    const hpPct      = cls ? Math.min(100, 60 + (cls.hpBonus / 220 * 40) + (level * 1.5)) : 65
    const energyPct  = Math.min(100, 40 + (xp / xpNeeded) * 60)
    const stealthPct = cls ? (
      cls.name === 'Night Assassin' ? 95 :
      cls.name === 'Void Archer'    ? 72 :
      cls.name === 'Shadow Warrior' ? 45 :
      cls.name === 'Dark Mage'      ? 35 :
      cls.name === 'Shadow Knight'  ? 28 : 50
    ) : 50

    const barLen = 13
    function bar(pct) {
      const filled = Math.round((pct / 100) * barLen)
      return '█'.repeat(filled) + '░'.repeat(barLen - filled)
    }

    const CARD_W = 600
    const CARD_H = 840
    const AV_X   = 110
    const AV_Y   = 160
    const AV_R   = 100

    // Build avatar composite if we have a profile image
    let avatarClipSvg = ''
    let avatarComposite = []

    if (profileImgBuffer && profileImgBuffer.length > 500) {
      try {
        const avatarBuf = await sharp(profileImgBuffer)
          .resize(AV_R * 2, AV_R * 2, { fit: 'cover' })
          .png()
          .toBuffer()

        // Create circular mask
        const circleMask = Buffer.from(
          `<svg width="${AV_R * 2}" height="${AV_R * 2}">
            <circle cx="${AV_R}" cy="${AV_R}" r="${AV_R}" fill="white"/>
          </svg>`
        )

        const maskedAvatar = await sharp(avatarBuf)
          .composite([{ input: circleMask, blend: 'dest-in' }])
          .png()
          .toBuffer()

        avatarComposite = [{ input: maskedAvatar, top: AV_Y - AV_R, left: AV_X - AV_R }]
      } catch {}
    } else {
      // Fallback: draw a placeholder circle with class emoji area
      avatarClipSvg = `
        <circle cx="${AV_X}" cy="${AV_Y}" r="${AV_R}" fill="#2a1a0e" stroke="#c8922a" stroke-width="4"/>
        <text x="${AV_X}" y="${AV_Y + 14}" text-anchor="middle" font-size="48" font-family="Arial">${clsEmoji}</text>`
    }

    const rankStars = '★'.repeat(Math.min(5, Math.ceil(level / 5))) + '☆'.repeat(Math.max(0, 5 - Math.ceil(level / 5)))
    const rankName  = level >= 25 ? 'LEGEND' : level >= 20 ? 'MASTER' : level >= 15 ? 'ELITE' : level >= 10 ? 'VETERAN' : level >= 5 ? 'SKILLED' : 'NOVICE'

    const svg = `<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#1a0e05"/>
          <stop offset="50%"  stop-color="#2e1a08"/>
          <stop offset="100%" stop-color="#1a0e05"/>
        </linearGradient>
        <linearGradient id="parchment" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#f5e6c8"/>
          <stop offset="100%" stop-color="#e8d5a3"/>
        </linearGradient>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stop-color="#8B6914"/>
          <stop offset="50%"  stop-color="#FFD700"/>
          <stop offset="100%" stop-color="#8B6914"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="shadow">
          <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.7)"/>
        </filter>
        <clipPath id="avatarClip">
          <circle cx="${AV_X}" cy="${AV_Y}" r="${AV_R}"/>
        </clipPath>
      </defs>

      <!-- Dark background -->
      <rect width="${CARD_W}" height="${CARD_H}" fill="url(#bg)"/>

      <!-- Outer ornate border -->
      <rect x="8" y="8" width="${CARD_W - 16}" height="${CARD_H - 16}" fill="none" stroke="url(#goldGrad)" stroke-width="3" rx="12"/>
      <rect x="14" y="14" width="${CARD_W - 28}" height="${CARD_H - 28}" fill="none" stroke="#6b4c11" stroke-width="1" rx="10"/>

      <!-- Corner ornaments -->
      <text x="18" y="42"  font-size="24" fill="#FFD700" opacity="0.8">✦</text>
      <text x="${CARD_W - 42}" y="42"  font-size="24" fill="#FFD700" opacity="0.8">✦</text>
      <text x="18" y="${CARD_H - 18}" font-size="24" fill="#FFD700" opacity="0.8">✦</text>
      <text x="${CARD_W - 42}" y="${CARD_H - 18}" font-size="24" fill="#FFD700" opacity="0.8">✦</text>

      <!-- ADVENTURER PROFILE header banner -->
      <rect x="160" y="22" width="280" height="36" fill="#1a0e05" rx="4"/>
      <rect x="162" y="24" width="276" height="32" fill="none" stroke="url(#goldGrad)" stroke-width="1.5" rx="3"/>
      <text x="300" y="45" text-anchor="middle" font-size="13" font-weight="bold" fill="#FFD700" font-family="serif" letter-spacing="2">ADVENTURER PROFILE</text>

      <!-- Left panel: character portrait area -->
      <rect x="25" y="70" width="235" height="480" fill="#1e1208" rx="8" opacity="0.8"/>
      <rect x="27" y="72" width="231" height="476" fill="none" stroke="#5a3a0a" stroke-width="1" rx="7"/>

      <!-- Avatar circle border -->
      <circle cx="${AV_X}" cy="${AV_Y}" r="${AV_R + 8}" fill="none" stroke="url(#goldGrad)" stroke-width="3" filter="url(#glow)"/>
      <circle cx="${AV_X}" cy="${AV_Y}" r="${AV_R + 4}" fill="#1a0e05"/>
      ${avatarClipSvg}

      <!-- Class badge -->
      <rect x="55" y="${AV_Y + AV_R + 15}" width="110" height="28" fill="#2a1800" rx="14" stroke="#FFD700" stroke-width="1.5"/>
      <text x="110" y="${AV_Y + AV_R + 34}" text-anchor="middle" font-size="13" fill="#FFD700" font-family="serif">${clsName}</text>

      <!-- Rank stars -->
      <text x="110" y="${AV_Y + AV_R + 75}" text-anchor="middle" font-size="14" fill="#FFD700">${rankStars}</text>
      <text x="110" y="${AV_Y + AV_R + 95}" text-anchor="middle" font-size="11" fill="#c8a45a" font-family="serif" letter-spacing="3">${rankName}</text>

      <!-- Divider line in left panel -->
      <line x1="40" y1="${AV_Y + AV_R + 110}" x2="245" y2="${AV_Y + AV_R + 110}" stroke="#5a3a0a" stroke-width="1"/>

      <!-- Left panel stat mini-bars -->
      <text x="40" y="${AV_Y + AV_R + 135}" font-size="10" fill="#a08050" font-family="monospace">❤ HP</text>
      <rect x="40" y="${AV_Y + AV_R + 140}" width="180" height="6" fill="#2a1800" rx="3"/>
      <rect x="40" y="${AV_Y + AV_R + 140}" width="${Math.round(180 * hpPct / 100)}" height="6" fill="#cc2244" rx="3"/>

      <text x="40" y="${AV_Y + AV_R + 162}" font-size="10" fill="#a08050" font-family="monospace">⚡ ATK</text>
      <rect x="40" y="${AV_Y + AV_R + 167}" width="180" height="6" fill="#2a1800" rx="3"/>
      <rect x="40" y="${AV_Y + AV_R + 167}" width="${Math.round(180 * Math.min(100, 30 + (level * 3.5)) / 100)}" height="6" fill="#e8a020" rx="3"/>

      <text x="40" y="${AV_Y + AV_R + 189}" font-size="10" fill="#a08050" font-family="monospace">🎯 STL</text>
      <rect x="40" y="${AV_Y + AV_R + 194}" width="180" height="6" fill="#2a1800" rx="3"/>
      <rect x="40" y="${AV_Y + AV_R + 194}" width="${Math.round(180 * stealthPct / 100)}" height="6" fill="#2299cc" rx="3"/>

      <!-- Seal/stamp in bottom left -->
      <circle cx="135" cy="${AV_Y + AV_R + 250}" r="38" fill="none" stroke="#5a3a0a" stroke-width="2" stroke-dasharray="4,3"/>
      <circle cx="135" cy="${AV_Y + AV_R + 250}" r="30" fill="#1a0e05" stroke="#3a2408" stroke-width="1"/>
      <text x="135" y="${AV_Y + AV_R + 245}" text-anchor="middle" font-size="22" font-family="serif">⚔️</text>
      <text x="135" y="${AV_Y + AV_R + 265}" text-anchor="middle" font-size="9"  fill="#7a5a1a" font-family="serif">AXEL</text>

      <!-- Right panel: stats -->
      <rect x="270" y="70" width="315" height="480" fill="#1e1208" rx="8" opacity="0.8"/>
      <rect x="272" y="72" width="311" height="476" fill="none" stroke="#5a3a0a" stroke-width="1" rx="7"/>

      <!-- Name row -->
      <text x="290" y="110" font-size="11" fill="#8a6a2a" font-family="serif">👤  NAME</text>
      <line x1="290" y1="115" x2="570" y2="115" stroke="#3a2408" stroke-width="0.5"/>
      <text x="290" y="138" font-size="20" font-weight="bold" fill="#f0dfa0" font-family="serif">${name.toUpperCase()}</text>

      <!-- Level / XP row -->
      <text x="290" y="168" font-size="11" fill="#8a6a2a" font-family="serif">📊  LEVEL</text>
      <line x1="290" y1="173" x2="570" y2="173" stroke="#3a2408" stroke-width="0.5"/>
      <text x="290" y="196" font-size="20" font-weight="bold" fill="#f0dfa0" font-family="serif">${level}</text>
      <text x="360" y="185" font-size="10" fill="#8a6a2a" font-family="serif">⭐ XP: ${xp}/${xpNeeded}</text>
      <!-- XP bar -->
      <rect x="360" y="188" width="200" height="8" fill="#2a1800" rx="4"/>
      <rect x="360" y="188" width="${Math.round(200 * Math.min(1, xp / xpNeeded))}" height="8" fill="#dda520" rx="4"/>

      <!-- Passive skill -->
      <text x="290" y="228" font-size="11" fill="#8a6a2a" font-family="serif">⚡  PASSIVE SKILL</text>
      <line x1="290" y1="233" x2="570" y2="233" stroke="#3a2408" stroke-width="0.5"/>
      <text x="290" y="253" font-size="12" fill="#f0dfa0" font-family="serif">${cls ? cls.passiveDesc.replace(/[^\x20-\x7E]/g, '').slice(0, 48) : 'None — select a class'}</text>

      <!-- Divider -->
      <line x1="285" y1="270" x2="575" y2="270" stroke="url(#goldGrad)" stroke-width="0.8"/>

      <!-- HP Bar section -->
      <text x="290" y="292" font-size="12" fill="#cc4466" font-family="serif">❤️  Health</text>
      <text x="290" y="312" font-size="11" fill="#c8922a" font-family="monospace">${Math.round(hpPct)}%  |${bar(hpPct)}|</text>

      <!-- Energy Bar -->
      <text x="290" y="338" font-size="12" fill="#4488dd" font-family="serif">⚡  Energy</text>
      <text x="290" y="358" font-size="11" fill="#c8922a" font-family="monospace">${Math.round(energyPct)}%  |${bar(energyPct)}|</text>

      <!-- Stealth Bar -->
      <text x="290" y="384" font-size="12" fill="#44aacc" font-family="serif">🎯  Stealth</text>
      <text x="290" y="404" font-size="11" fill="#c8922a" font-family="monospace">${Math.round(stealthPct)}%  |${bar(stealthPct)}|</text>

      <!-- Divider -->
      <line x1="285" y1="420" x2="575" y2="420" stroke="url(#goldGrad)" stroke-width="0.8"/>

      <!-- Mood / Trait -->
      <text x="290" y="444" font-size="12" fill="#f0dfa0" font-family="serif">🖤  Mood: ${getMood(level, cls)}</text>
      <text x="290" y="466" font-size="12" fill="#f0dfa0" font-family="serif">🏹  Trait: ${getTrait(cls)}</text>
      <text x="290" y="488" font-size="12" fill="#f0dfa0" font-family="serif">🎁  Title: ${title}</text>

      <!-- Divider -->
      <line x1="285" y1="505" x2="575" y2="505" stroke="#3a2408" stroke-width="0.5"/>

      <!-- Commands -->
      <text x="290" y="526" font-size="10" fill="#7a5a1a" font-family="monospace">🎮 COMMANDS</text>
      <text x="290" y="543" font-size="10" fill="#a07840" font-family="monospace">> .dungeon | .quest | .explore</text>
      <text x="290" y="558" font-size="10" fill="#a07840" font-family="monospace">> .selectclass | .skillinfo | .rparty</text>

      <!-- Bottom banner -->
      <rect x="25" y="565" width="555" height="50" fill="#150c04" rx="6"/>
      <rect x="27" y="567" width="551" height="46" fill="none" stroke="#5a3a0a" stroke-width="1" rx="5"/>
      <text x="50"  y="597" font-size="11" fill="#c8922a" font-family="serif">⚔</text>
      <text x="70"  y="596" font-size="10" fill="#8a6a2a" font-family="serif">RANK</text>
      <text x="70"  y="610" font-size="13" font-weight="bold" fill="#f0dfa0" font-family="serif">${rankName}</text>
      <text x="220" y="596" font-size="10" fill="#8a6a2a" font-family="serif">GUILD</text>
      <text x="220" y="610" font-size="13" font-weight="bold" fill="#f0dfa0" font-family="serif">NONE</text>
      <text x="370" y="596" font-size="10" fill="#8a6a2a" font-family="serif">TOWN</text>
      <text x="370" y="610" font-size="13" font-weight="bold" fill="#f0dfa0" font-family="serif">AXEL</text>
    </svg>`

    const cardBuf = await sharp(Buffer.from(svg)).png().toBuffer()

    if (avatarComposite.length) {
      return await sharp(cardBuf)
        .composite(avatarComposite)
        .png()
        .toBuffer()
    }
    return cardBuf
  } catch (e) {
    console.error('[generateRpgCardImage]', e.message)
    return null
  }
}

function getMood(level, cls) {
  if (level >= 25) return 'Transcendent'
  if (level >= 20) return 'Unstoppable'
  if (level >= 15) return 'Battle-hardened'
  if (level >= 10) return 'Determined'
  if (level >= 5)  return 'Eager'
  return 'Cautious'
}

function getTrait(cls) {
  if (!cls) return 'Undecided'
  const traits = {
    'Shadow Warrior': 'Iron Will',
    'Dark Mage':      'Arcane Blood',
    'Void Archer':    'Eagle Eye',
    'Night Assassin': 'Shadow Step',
    'Shadow Knight':  'Unbreakable',
  }
  return traits[cls.name] || 'Unknown'
}

// ═══════════════════════════════════════════════════════════════════════════
//  CLASS DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const CLASSES = {
  warrior: {
    name: 'Shadow Warrior', emoji: '⚔️',
    desc: 'Tank fighter with high HP and steady damage.',
    hpBonus: 80, atkBonus: 5,
    passiveDesc: '🔥 Berserker Rage: +30% attack when HP < 30%',
    abilities: ['slash', 'berserk', 'ironwall'],
    passive: (s) => s.playerHp / s.playerMaxHp < 0.3 ? 1.3 : 1.0,
  },
  mage: {
    name: 'Dark Mage', emoji: '🔮',
    desc: 'Glass cannon with devastating spells and life drain.',
    hpBonus: 0, atkBonus: 20,
    passiveDesc: '🌑 Life Drain: heal 10% of all damage dealt',
    abilities: ['darknova', 'lifedrain', 'voidbolt'],
    passive: null, lifeDrain: true,
  },
  archer: {
    name: 'Void Archer', emoji: '🏹',
    desc: 'Swift striker with high crit chance and poison.',
    hpBonus: 20, atkBonus: 12,
    passiveDesc: '💚 Poison Arrow: enemies take 15 extra damage per turn',
    abilities: ['shadowshot', 'poisonarrow', 'pierce'],
    passive: null, poisonDmg: 15,
  },
  assassin: {
    name: 'Night Assassin', emoji: '🗡️',
    desc: 'Highest burst damage, first strike bonus, smoke dodge.',
    hpBonus: -10, atkBonus: 18,
    passiveDesc: '⚡ Backstab: +50% damage on first hit of every dungeon',
    abilities: ['backstab', 'smokebomb', 'shadowstrike'],
    passive: null, firstStrike: true,
  },
  knight: {
    name: 'Shadow Knight', emoji: '🛡️',
    desc: 'Ultimate tank with heavy block and taunt.',
    hpBonus: 120, atkBonus: 0,
    passiveDesc: '🛡️ Shield Wall: automatically block 20% all incoming damage',
    abilities: ['shieldwall', 'taunt', 'deathblow'],
    passive: null, dmgReduction: 0.2,
  },
}

// ═══════════════════════════════════════════════════════════════════════════
//  SKILL EVOLUTION
// ═══════════════════════════════════════════════════════════════════════════

const SKILL_EVOLUTION = {
  slash:        { tier: 1, desc: 'Basic sword swing',            multiplier: 1.5, evolvesAt: 10, evolvesTo: 'darkslash' },
  darkslash:    { tier: 2, desc: 'Dark-infused slash',           multiplier: 2.2, evolvesAt: 25, evolvesTo: 'voidrend' },
  voidrend:     { tier: 3, desc: 'Tears reality itself',         multiplier: 3.5, evolvesAt: null, evolvesTo: null },
  darknova:     { tier: 1, desc: 'Dark magic explosion',         multiplier: 2.0, evolvesAt: 10, evolvesTo: 'voidcascade' },
  voidcascade:  { tier: 2, desc: 'Cascading void energy',        multiplier: 3.2, evolvesAt: null, evolvesTo: null },
  shadowshot:   { tier: 1, desc: 'Shadow-piercing arrow',        multiplier: 1.8, evolvesAt: 10, evolvesTo: 'voidpiercer' },
  voidpiercer:  { tier: 2, desc: 'Pierces through void',         multiplier: 2.8, evolvesAt: null, evolvesTo: null },
  backstab:     { tier: 1, desc: 'Surprise attack from the dark',multiplier: 2.5, evolvesAt: 15, evolvesTo: 'deathmark' },
  deathmark:    { tier: 2, desc: 'Mark of death — one-shot potential', multiplier: 4.0, evolvesAt: null, evolvesTo: null },
  berserk:      { tier: 1, desc: 'Rage mode: +50% atk, skip defence',     multiplier: 2.0, evolvesAt: null, evolvesTo: null },
  ironwall:     { tier: 1, desc: 'Block 80% next attack',                   multiplier: 0,   evolvesAt: null, evolvesTo: null },
  lifedrain:    { tier: 1, desc: 'Drain 50% dmg as HP',                    multiplier: 1.6, evolvesAt: null, evolvesTo: null },
  voidbolt:     { tier: 1, desc: 'Instant void bolt',                       multiplier: 1.9, evolvesAt: null, evolvesTo: null },
  poisonarrow:  { tier: 1, desc: 'Apply 30 poison stack',                   multiplier: 1.2, evolvesAt: null, evolvesTo: null },
  pierce:       { tier: 1, desc: 'Ignore 50% defence',                      multiplier: 1.7, evolvesAt: null, evolvesTo: null },
  smokebomb:    { tier: 1, desc: '70% chance dodge next hit',               multiplier: 0,   evolvesAt: null, evolvesTo: null },
  shadowstrike: { tier: 1, desc: 'Swift multi-hit: 3x hits',               multiplier: 1.1, evolvesAt: null, evolvesTo: null },
  shieldwall:   { tier: 1, desc: 'Reduce all dmg by 60% for 2 turns',      multiplier: 0,   evolvesAt: null, evolvesTo: null },
  taunt:        { tier: 1, desc: 'Force monster to attack — skip their ability', multiplier: 0, evolvesAt: null, evolvesTo: null },
  deathblow:    { tier: 1, desc: 'Finisher: 5x dmg if enemy HP < 20%',    multiplier: 5.0, evolvesAt: null, evolvesTo: null },
}

// ═══════════════════════════════════════════════════════════════════════════
//  DUNGEON ENEMIES
// ═══════════════════════════════════════════════════════════════════════════

const ENEMIES = [
  { name: 'Shadow Slime',  level: 1,  hp: 40,  attack: 6,   ability: { name: 'Slime Coat',    chance: 0.3,  desc: 'Reduces your damage by 25% this turn',                effect: 'dmgReduce' }, reward: { coins: 50,   xp: 20,  gems: 0  } },
  { name: 'Dark Goblin',   level: 3,  hp: 65,  attack: 12,  ability: { name: 'Steal',          chance: 0.25, desc: 'Steals 30 coins from you!',                           effect: 'steal'     }, reward: { coins: 120,  xp: 45,  gems: 1  } },
  { name: 'Void Wraith',   level: 5,  hp: 95,  attack: 20,  ability: { name: 'Phase Shift',    chance: 0.35, desc: 'Phases through your attack — EVADED!',                effect: 'dodge'     }, reward: { coins: 220,  xp: 90,  gems: 2  } },
  { name: 'Shadow Knight', level: 8,  hp: 150, attack: 32,  ability: { name: 'Counter Stance', chance: 0.4,  desc: 'Reflects 35% of your damage back!',                  effect: 'counter'   }, reward: { coins: 450,  xp: 160, gems: 3  } },
  { name: 'Void Serpent',  level: 11, hp: 200, attack: 45,  ability: { name: 'Venom Bite',     chance: 0.45, desc: 'Poisons you! -25 HP next 2 turns.',                  effect: 'poison'    }, reward: { coins: 700,  xp: 280, gems: 5  } },
  { name: 'Shadow Hydra',  level: 15, hp: 280, attack: 58,  ability: { name: 'Regenerate',     chance: 0.35, desc: 'Regenerates 40 HP!',                                 effect: 'regen'     }, reward: { coins: 1000, xp: 420, gems: 7  } },
  { name: 'Dark Dragon',   level: 20, hp: 400, attack: 80,  ability: { name: 'Dragon Breath',  chance: 0.5,  desc: 'Breathes dark fire — MASSIVE damage!',               effect: 'breath'    }, reward: { coins: 1800, xp: 700, gems: 12 } },
  { name: 'Void Overlord', level: 25, hp: 600, attack: 110, ability: { name: 'Void Collapse',  chance: 0.55, desc: 'Collapses void energy — deals 60% of your MAX HP!',  effect: 'collapse'  }, reward: { coins: 3000, xp: 1200,gems: 20 } },
]

// ═══════════════════════════════════════════════════════════════════════════
//  QUEST DEFINITIONS (level-gated pools)
// ═══════════════════════════════════════════════════════════════════════════

const QUEST_POOL = [
  // ── Level 1-4: Beginner ──────────────────────────────────────────────────
  {
    id: 'q_greenfields', levelMin: 1, levelMax: 4,
    name: '🌿 Clearing the Plains',
    desc: 'The farmers near Axel are troubled by wild beasts roaming the Green Plains.',
    spawnMap: 'Green Plains',
    objectives: [
      { id: 'kill_3', type: 'kill', target: 'any', count: 3, progress: 0, desc: 'Defeat 3 enemies in Green Plains' },
    ],
    rewards: { coins: 250, xp: 80, gems: 0, item: 'Health Potion' },
    flavour: 'The fields are peaceful again thanks to you.',
  },
  {
    id: 'q_bunnyfield', levelMin: 1, levelMax: 4,
    name: '🐇 The Bunny Problem',
    desc: 'Giant bunnies are eating the crops. Deal with them in the Bunny Field.',
    spawnMap: 'Green Plains',
    objectives: [
      { id: 'kill_5', type: 'kill', target: 'any', count: 5, progress: 0, desc: 'Slay 5 creatures in the Plains' },
    ],
    rewards: { coins: 200, xp: 60, gems: 0, item: 'Lucky Paw' },
    flavour: 'The crops are safe. A grateful farmer gives you his lucky charm.',
  },
  {
    id: 'q_shroomgrove', levelMin: 1, levelMax: 4,
    name: '🍄 Mushroom Collection',
    desc: 'The apothecary in Axel needs Healing Shrooms from the Mushroom Grove.',
    spawnMap: 'Mushroom Grove',
    objectives: [
      { id: 'explore_shroom', type: 'explore', target: 'Mushroom Grove', count: 1, progress: 0, desc: 'Reach the Mushroom Grove' },
      { id: 'kill_2', type: 'kill', target: 'any', count: 2, progress: 0, desc: 'Clear the grove of 2 creatures' },
    ],
    rewards: { coins: 180, xp: 55, gems: 0, item: 'Healing Shroom x3' },
    flavour: 'The apothecary thanks you and prepares a batch of potions.',
  },
  {
    id: 'q_wolfwoods_scout', levelMin: 2, levelMax: 5,
    name: '🐺 Wolf Scout',
    desc: 'Rangers report a wolf pack near Wolf Woods. Scout and thin the pack.',
    spawnMap: 'Wolf Woods',
    objectives: [
      { id: 'explore_wolf', type: 'explore', target: 'Wolf Woods', count: 1, progress: 0, desc: 'Enter Wolf Woods' },
      { id: 'kill_wolf_3', type: 'kill', target: 'any', count: 3, progress: 0, desc: 'Defeat 3 wolves' },
    ],
    rewards: { coins: 280, xp: 100, gems: 1, item: 'Wolf Fang' },
    flavour: 'The pack retreats deeper into the woods. Peace returns to the roads.',
  },
  // ── Level 3-7: Intermediate ──────────────────────────────────────────────
  {
    id: 'q_whisperwoods', levelMin: 3, levelMax: 7,
    name: '🌲 The Whispering Dark',
    desc: 'A merchant went missing in Whispering Woods. Find clues and clear the path.',
    spawnMap: 'Whispering Woods',
    objectives: [
      { id: 'explore_ww', type: 'explore', target: 'Whispering Woods', count: 1, progress: 0, desc: 'Reach Whispering Woods' },
      { id: 'kill_4', type: 'kill', target: 'any', count: 4, progress: 0, desc: 'Defeat 4 enemies in the woods' },
    ],
    rewards: { coins: 400, xp: 150, gems: 1, item: 'Merchant\'s Ring' },
    flavour: 'The merchant\'s bag is found. No sign of the merchant — only teeth marks.',
  },
  {
    id: 'q_abandoned_farm', levelMin: 2, levelMax: 6,
    name: '🏚 Pest Control',
    desc: 'The old farm east of Axel has been overrun. Someone wants it cleared.',
    spawnMap: 'Abandoned Farm',
    objectives: [
      { id: 'explore_farm', type: 'explore', target: 'Abandoned Farm', count: 1, progress: 0, desc: 'Reach the Abandoned Farm' },
      { id: 'kill_5', type: 'kill', target: 'any', count: 5, progress: 0, desc: 'Drive out 5 creatures' },
    ],
    rewards: { coins: 320, xp: 120, gems: 1, item: 'Rusted Key' },
    flavour: 'The farm is quiet. What it\'s quiet for, you decide not to ask.',
  },
  {
    id: 'q_training', levelMin: 1, levelMax: 5,
    name: '⚔️ Prove Your Steel',
    desc: 'A veteran at the Training Grounds wants to see what you\'re made of.',
    spawnMap: 'Training Grounds',
    objectives: [
      { id: 'kill_training_3', type: 'kill', target: 'any', count: 3, progress: 0, desc: 'Win 3 sparring matches' },
    ],
    rewards: { coins: 200, xp: 90, gems: 0, item: 'Skill Manual' },
    flavour: 'The veteran nods. "You\'ll do," he says, and walks away.',
  },
  // ── Level 5-10: Mid ─────────────────────────────────────────────────────
  {
    id: 'q_goblin_raid', levelMin: 5, levelMax: 10,
    name: '👺 Goblin Raid',
    desc: 'Goblins from the Territory have raided a village. Push them back.',
    spawnMap: 'Goblin Territory',
    objectives: [
      { id: 'explore_goblin', type: 'explore', target: 'Goblin Territory', count: 1, progress: 0, desc: 'Reach Goblin Territory' },
      { id: 'kill_gob_6', type: 'kill', target: 'any', count: 6, progress: 0, desc: 'Slay 6 goblins' },
    ],
    rewards: { coins: 700, xp: 280, gems: 2, item: 'Goblin Trophy' },
    flavour: 'The goblins scatter. The village elder bows in gratitude.',
  },
  {
    id: 'q_hidden_cave', levelMin: 5, levelMax: 9,
    name: '🪨 Cave Investigation',
    desc: 'Strange sounds from the Hidden Cave. Investigate and report back.',
    spawnMap: 'Hidden Cave',
    objectives: [
      { id: 'explore_cave', type: 'explore', target: 'Hidden Cave', count: 1, progress: 0, desc: 'Enter the Hidden Cave' },
      { id: 'kill_cave_4', type: 'kill', target: 'any', count: 4, progress: 0, desc: 'Defeat 4 cave creatures' },
    ],
    rewards: { coins: 600, xp: 240, gems: 2, item: 'Cave Crystal' },
    flavour: 'The sounds were a troll. Were. You dealt with it.',
  },
  {
    id: 'q_bat_caverns', levelMin: 6, levelMax: 10,
    name: '🦇 Bat Extermination',
    desc: 'The Bat Caverns are blocking passage through to the Crystal Mine.',
    spawnMap: 'Bat Caverns',
    objectives: [
      { id: 'explore_bat', type: 'explore', target: 'Bat Caverns', count: 1, progress: 0, desc: 'Reach the Bat Caverns' },
      { id: 'kill_bat_5', type: 'kill', target: 'any', count: 5, progress: 0, desc: 'Clear 5 bat creatures' },
    ],
    rewards: { coins: 650, xp: 260, gems: 2, item: 'Bat Wing' },
    flavour: 'The passage is clear. The miners thank you with an extra share.',
  },
  // ── Level 8-15: Advanced ─────────────────────────────────────────────────
  {
    id: 'q_crystal_mine', levelMin: 8, levelMax: 14,
    name: '💎 Mine Sweeper',
    desc: 'Something has moved into the Crystal Mine and is killing miners.',
    spawnMap: 'Crystal Mine',
    objectives: [
      { id: 'explore_mine', type: 'explore', target: 'Crystal Mine', count: 1, progress: 0, desc: 'Enter the Crystal Mine' },
      { id: 'kill_mine_5', type: 'kill', target: 'any', count: 5, progress: 0, desc: 'Eliminate 5 mine threats' },
    ],
    rewards: { coins: 1000, xp: 420, gems: 5, item: 'Raw Crystal Shard' },
    flavour: 'The mine foreman hands you a rough gem and a firm handshake.',
  },
  {
    id: 'q_ruins_explorer', levelMin: 10, levelMax: 15,
    name: '🗿 Lost in the Ruins',
    desc: 'An archaeologist\'s team vanished inside Ancient Ruins. Recover their notes.',
    spawnMap: 'Ancient Ruins',
    objectives: [
      { id: 'explore_ruins', type: 'explore', target: 'Ancient Ruins', count: 1, progress: 0, desc: 'Reach the Ancient Ruins' },
      { id: 'kill_ruins_5', type: 'kill', target: 'any', count: 5, progress: 0, desc: 'Defeat 5 ruin guardians' },
    ],
    rewards: { coins: 1400, xp: 560, gems: 6, item: 'Ancient Tome' },
    flavour: 'The notes are recovered. The team... wasn\'t.',
  },
  // ── Level 12-20: Expert ──────────────────────────────────────────────────
  {
    id: 'q_temple_purge', levelMin: 13, levelMax: 20,
    name: '⛪ Purge the Temple',
    desc: 'Dark energy from the Forgotten Temple seeps into nearby villages.',
    spawnMap: 'Forgotten Temple',
    objectives: [
      { id: 'explore_temple', type: 'explore', target: 'Forgotten Temple', count: 1, progress: 0, desc: 'Enter the Forgotten Temple' },
      { id: 'kill_temple_6', type: 'kill', target: 'any', count: 6, progress: 0, desc: 'Banish 6 corrupted entities' },
    ],
    rewards: { coins: 2000, xp: 800, gems: 8, item: 'Sacred Blessing' },
    flavour: 'The darkness recedes. For now.',
  },
  {
    id: 'q_dragon_bounty', levelMin: 17, levelMax: 25,
    name: '🐲 Dragon Bounty',
    desc: 'The Dragon Mountain has been blockading trade routes. A huge bounty is offered.',
    spawnMap: 'Dragon Mountain',
    objectives: [
      { id: 'explore_dragon', type: 'explore', target: 'Dragon Mountain', count: 1, progress: 0, desc: 'Reach Dragon Mountain' },
      { id: 'kill_dragon_4', type: 'kill', target: 'any', count: 4, progress: 0, desc: 'Defeat 4 dragon-kind' },
    ],
    rewards: { coins: 4000, xp: 1600, gems: 15, item: 'Dragon Scale' },
    flavour: 'The trade route reopens. Merchants weep with joy.',
  },
  // ── Level 20+: Legendary ─────────────────────────────────────────────────
  {
    id: 'q_fortress_assault', levelMin: 20, levelMax: 99,
    name: '🏰 Shadow Fortress Assault',
    desc: 'The Shadow Fortress must fall. A legendary quest for the bravest.',
    spawnMap: 'Shadow Fortress',
    objectives: [
      { id: 'explore_fortress', type: 'explore', target: 'Shadow Fortress', count: 1, progress: 0, desc: 'Breach the Shadow Fortress' },
      { id: 'kill_fortress_8', type: 'kill', target: 'any', count: 8, progress: 0, desc: 'Slay 8 fortress defenders' },
    ],
    rewards: { coins: 8000, xp: 3200, gems: 25, item: 'Void Shard' },
    flavour: 'The fortress shakes. You have struck a blow against the darkness.',
  },
  {
    id: 'q_demon_hunt', levelMin: 22, levelMax: 99,
    name: '👹 Demon Hunt',
    desc: 'Deep in the Shadow Hall, a horde of demons grows. Thin their numbers.',
    spawnMap: 'Shadow Hall',
    objectives: [
      { id: 'explore_hall', type: 'explore', target: 'Shadow Hall', count: 1, progress: 0, desc: 'Enter the Shadow Hall' },
      { id: 'kill_demons_6', type: 'kill', target: 'any', count: 6, progress: 0, desc: 'Destroy 6 demon entities' },
    ],
    rewards: { coins: 6000, xp: 2400, gems: 20, item: 'Demon Sigil' },
    flavour: 'The shadow shrinks. You feel the darkness bow — briefly.',
  },
]

function getQuestsForLevel(level) {
  const eligible = QUEST_POOL.filter(q => level >= q.levelMin && level <= q.levelMax)
  // Shuffle and pick 3-4
  const shuffled = eligible.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(4, Math.max(2, shuffled.length)))
}

// ═══════════════════════════════════════════════════════════════════════════
//  DUNGEON HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getEnemy(floor, playerLevel = 1) {
  const baseIdx = Math.min(Math.floor(floor / 3), ENEMIES.length - 1)
  const maxIdx  = Math.min(baseIdx + Math.floor(Math.random() * 2), ENEMIES.length - 1)
  const enemy   = { ...ENEMIES[Math.random() < 0.4 ? maxIdx : baseIdx] }
  const scaling = 1 + (floor * 0.15) + (playerLevel * 0.05)
  enemy.currentHp = Math.floor(enemy.hp * scaling)
  enemy.hp = enemy.currentHp
  enemy.attack = Math.floor(enemy.attack * scaling)
  enemy.level  = enemy.level + floor
  enemy.ability = { ...enemy.ability }
  return enemy
}

function applyMonsterAbility(enemy, session) {
  const ab = enemy.ability
  if (!ab || Math.random() > ab.chance) return null
  const result = { triggered: true, name: ab.name, desc: ab.desc }
  switch (ab.effect) {
    case 'dodge':     result.dodge = true; break
    case 'counter':   result.counterPct = 0.35; break
    case 'steal':     result.stealCoins = 30; break
    case 'dmgReduce': result.playerDmgMult = 0.75; break
    case 'poison':    session.poisonTurns = 2; session.poisonDmg = 25; break
    case 'regen': {
      const healAmt = Math.floor(enemy.hp * 0.12)
      enemy.currentHp = Math.min(enemy.hp, enemy.currentHp + healAmt)
      result.healed = healAmt; break
    }
    case 'breath':   result.extraDmg = Math.floor(enemy.attack * 1.5); break
    case 'collapse': result.collapseDmgPct = 0.60; break
  }
  return result
}

function hpBar(current, max, len = 12) {
  const pct    = Math.max(0, current / max)
  const filled = Math.round(pct * len)
  const bar    = '█'.repeat(filled) + '░'.repeat(len - filled)
  const dot    = pct > 0.6 ? '💚' : pct > 0.3 ? '🟡' : '🔴'
  return `${dot} \`${bar}\``
}

function getZoneDesc(floor) {
  if (floor <= 3)  return '🌫️ *Mist Corridors* — shadowy fog muffles every sound'
  if (floor <= 6)  return '🕯️ *The Dark Halls* — flickering torches cast no real light'
  if (floor <= 10) return '🔥 *Burning Depths* — scorched stone & ember heat'
  if (floor <= 15) return '❄️ *Frost Vaults* — ice formations crack beneath your feet'
  if (floor <= 20) return '⚡ *Storm Chambers* — lightning arcs across the walls'
  if (floor <= 25) return '🌑 *The Void Core* — reality itself begins to fracture'
  return '💀 *The Abyss* — few have returned. None unchanged.'
}

const ENEMY_INTROS = [
  'materialises from the darkness!',
  'emerges from the shadows with a shriek!',
  'lunges at you from the depths!',
  'blocks your path with a guttural roar!',
  'rises from the void floor, silent and deadly!',
]

function getClassForUser(user) {
  if (!user?.class_name) return null
  return CLASSES[user.class_name] || null
}

function getPlayerStats(user) {
  const cls     = getClassForUser(user)
  const level   = user?.level || 1
  const hpBonus = cls ? cls.hpBonus  : 0
  const atkBonus= cls ? cls.atkBonus : 0
  return { maxHp: 200 + hpBonus, atk: 20 + level * 3 + atkBonus, cls }
}

// ═══════════════════════════════════════════════════════════════════════════
//  QUEST PROGRESS HELPER
// ═══════════════════════════════════════════════════════════════════════════

function buildQuestStatus(qs) {
  const lines = qs.objectives.map(obj => {
    const done = obj.progress >= obj.count
    return `${done ? '✅' : '⬜'} ${obj.desc} (${obj.progress}/${obj.count})`
  })
  const allDone = qs.objectives.every(o => o.progress >= o.count)
  return { lines, allDone }
}

function updateQuestKill(questSession, mapName) {
  let changed = false
  for (const obj of questSession.objectives) {
    if (obj.progress >= obj.count) continue
    if (obj.type === 'kill') {
      obj.progress++
      changed = true
    }
  }
  return changed
}

function updateQuestExplore(questSession, mapName) {
  let changed = false
  for (const obj of questSession.objectives) {
    if (obj.progress >= obj.count) continue
    if (obj.type === 'explore' && obj.target === mapName) {
      obj.progress = obj.count // mark done
      changed = true
    }
  }
  return changed
}

// ═══════════════════════════════════════════════════════════════════════════
//  MODULE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {

  // ─── CLASS SELECTION ─────────────────────────────────────────────────────

  async selectclass({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const chosen = args[0]?.toLowerCase()

    if (!chosen) {
      const list = Object.entries(CLASSES).map(([key, c]) =>
        `${c.emoji} *${c.name}* (\`${key}\`)\n   ${c.desc}\n   ${c.passiveDesc}`
      ).join('\n\n')
      return reply(
        `🎭 *CLASS SELECTION*\n\n` +
        `👤 *Player:* ${u.name || sender}\n` +
        (u.class_name ? `⚔️ *Current:* ${CLASSES[u.class_name]?.name || u.class_name}\n` : '') +
        `\n━━━━━━━━━━━━━━━\n\n${list}\n\n━━━━━━━━━━━━━━━\n\n` +
        `📌 *Usage:* *.selectclass <name>*\n` +
        `Example: *.selectclass warrior*\n\n_Choose your path in the shadows._ 🖤`
      )
    }

    if (!CLASSES[chosen]) return reply(`❌ Unknown class: *${chosen}*\n\nValid: ${Object.keys(CLASSES).join(', ')}`)

    const cls   = CLASSES[chosen]
    const saved = await db.updateUser(sender, { class_name: chosen, skill_xp: JSON.stringify({}) })
    if (!saved) return reply(`❌ *CLASS SAVE FAILED*\n\nCould not save your class. Try again. 🖤`)

    return reply(
      `🎭 *CLASS CHOSEN*\n\n${cls.emoji} You are now a *${cls.name}*!\n\n` +
      `📖 ${cls.desc}\n\n✨ *Passive:* ${cls.passiveDesc}\n\n` +
      `⚔️ *Class Abilities:*\n${cls.abilities.map(a => `• \`${a}\` — ${SKILL_EVOLUTION[a]?.desc || '?'}`).join('\n')}\n\n` +
      `_The shadows have acknowledged your path._ 🖤`
    )
  },

  async chooseclass(ctx) { return module.exports.selectclass(ctx) },
  async classselect(ctx) { return module.exports.selectclass(ctx) },

  async skillinfo({ reply, sender, user }) {
    const u   = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (!cls) return reply(`❌ Pick a class first with *.selectclass*`)

    let skillXp = {}
    try { skillXp = JSON.parse(u.skill_xp || '{}') } catch {}

    const lines = cls.abilities.map(skillKey => {
      const sk   = SKILL_EVOLUTION[skillKey]
      if (!sk) return `• ${skillKey}`
      const uses = skillXp[skillKey] || 0
      const evolveLine = sk.evolvesAt
        ? `(evolves at ${sk.evolvesAt} uses — ${Math.max(0, sk.evolvesAt - uses)} left)`
        : sk.tier > 1 ? `(MAX tier)` : `(does not evolve)`
      return `• *${skillKey}* Tier ${sk.tier} — Used: ${uses}x ${evolveLine}\n  ${sk.desc}`
    }).join('\n\n')

    await reply(`📖 *SKILL INFO*\n\n${cls.emoji} *${cls.name}*\n\n${lines}\n\n_Level your skills through use._ 🖤`)
  },

  // ─── RPG PROFILE — exact layout + generated card image ───────────────────

  async rpg({ sock, jid, msg, reply, sender, user }) {
    const u   = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)

    const level     = u.level || 1
    const xp        = u.xp || 0
    const xpNeeded  = level * 1000

    const hpPct     = cls ? Math.min(100, Math.round(60 + (cls.hpBonus / 220 * 40) + (level * 1.5))) : 65
    const energyPct = Math.min(100, Math.round(40 + (xp / xpNeeded) * 60))
    const stealthPct= cls ? (
      cls.name === 'Night Assassin' ? 95 :
      cls.name === 'Void Archer'    ? 72 :
      cls.name === 'Shadow Warrior' ? 45 :
      cls.name === 'Dark Mage'      ? 35 : 28
    ) : 50

    const BAR_LEN = 13
    function bar(pct) {
      const filled = Math.round((Math.min(100, pct) / 100) * BAR_LEN)
      return '█'.repeat(filled) + '░'.repeat(BAR_LEN - filled)
    }

    // Check daily quest
    const questCd  = await db.getCooldown(sender, 'quest')
    const questLine = questCd > 0
      ? `🎁 Daily Quest: ⏳ ${Math.floor(questCd / 60000)}m cooldown`
      : `🎁 Daily Quest: ✅ Ready! Use *.quest*`

    // Active quest progress
    const qs       = questSessions[sender]
    const questSt  = qs ? `📜 Active Quest: *${qs.questName}* (${qs.objectives.filter(o => o.progress >= o.count).length}/${qs.objectives.length} done)` : ''

    const text =
      `⚔️ 𝗥𝗣𝗚 𝗦𝗬𝗦𝗧𝗘𝗠 ⚔️\n` +
      `——————————————\n` +
      `👤 Name: *${u.name || sender}*\n` +
      `🗡️ Class: *${cls ? `${cls.emoji} ${cls.name}` : 'None — use .selectclass'}*\n` +
      `📊 Level: *${level}*    ⭐ XP: *${xp}/${xpNeeded}*\n\n` +
      `⚡ Passive Skill:\n` +
      `└  ${cls ? cls.passiveDesc : 'No passive — choose a class'}\n\n` +
      `❤️ Health:\n└  ${hpPct}%  |${bar(hpPct)}|\n\n` +
      `⚡ Energy:\n└  ${energyPct}%  |${bar(energyPct)}|\n\n` +
      `🎯 Stealth:\n└  ${stealthPct}%  |${bar(stealthPct)}|\n\n` +
      `🖤 Mood: *${getMood(level, cls)}*\n` +
      `🏹 Trait: *${getTrait(cls)}*\n` +
      `${questLine}\n` +
      (questSt ? `${questSt}\n` : '') +
      `\n🎮 Commands:\n` +
      `> └  .dungeon | .adventure | .quest\n` +
      `> └  .selectclass | .skillinfo | .rparty\n` +
      `> └  .explore | .travel <n/s/e/w> | .encounter`

    // Try to generate and send the adventurer profile card image
    try {
      let profileBuffer = null
      if (u.profile_pp) {
        try {
          profileBuffer = await new Promise((resolve) => {
            const client = u.profile_pp.startsWith('https') ? https : http
            client.get(u.profile_pp, { timeout: 8000 }, (res) => {
              if (res.statusCode !== 200) { res.resume(); return resolve(null) }
              const chunks = []
              res.on('data', c => chunks.push(c))
              res.on('end', () => resolve(Buffer.concat(chunks)))
              res.on('error', () => resolve(null))
            }).on('error', () => resolve(null))
          })
        } catch {}
      }

      const cardBuffer = await generateRpgCardImage(u, cls, profileBuffer)
      if (cardBuffer && cardBuffer.length > 500 && sock && jid) {
        await sock.sendMessage(jid, { image: cardBuffer, caption: text }, { quoted: msg })
        return
      }
    } catch (e) { console.error('[rpg card]', e.message) }

    // Fallback: text only
    try {
      await sock.sendMessage(jid, { text }, { quoted: msg })
    } catch {
      await reply(text)
    }
  },

  // ─── QUEST — level-based selection + manual completion ───────────────────

  async quest({ reply, sender, user, args }) {
    const u   = user || await db.getOrCreateUser(sender)
    const lvl = u.level || 1

    // If player already has an active quest, show progress
    if (questSessions[sender] && !args[0]) {
      const qs = questSessions[sender]
      const { lines, allDone } = buildQuestStatus(qs)

      if (allDone) {
        // Auto-award if all objectives complete
        return module.exports._completeQuest({ reply, sender, user: u })
      }

      return reply(
        `📜 *ACTIVE QUEST*\n\n` +
        `🗺️ *${qs.questName}*\n` +
        `_${qs.questDesc}_\n\n` +
        `━━━━━━━━━━━━━━━\n` +
        `📋 *Objectives:*\n${lines.join('\n')}\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `📍 Spawn: *${qs.spawnMap}*\n\n` +
        `_Use *.explore* to navigate the world and fight enemies._\n` +
        `_Use *.travel n/s/e/w* to travel between maps._\n` +
        `_Use *.encounter* to battle enemies in your current area._\n\n` +
        `💡 Type *.quest abandon* to abandon this quest. 🖤`
      )
    }

    // Abandon quest
    if (args[0]?.toLowerCase() === 'abandon') {
      if (!questSessions[sender]) return reply(`❌ No active quest to abandon.`)
      const name = questSessions[sender].questName
      delete questSessions[sender]
      return reply(`🚫 *QUEST ABANDONED*\n\n_"${name}"_ has been abandoned.\n\nUse *.quest* to pick a new one. 🖤`)
    }

    // Pick a quest by number
    if (args[0] && /^\d+$/.test(args[0])) {
      const idx   = parseInt(args[0]) - 1
      const pool  = getQuestsForLevel(lvl)

      if (!pool[idx]) return reply(`❌ Invalid choice. Reply with a number from 1 to ${pool.length}.`)

      const chosen = pool[idx]

      // Deep-clone objectives so we don't mutate the pool
      const cloned = JSON.parse(JSON.stringify(chosen))
      questSessions[sender] = {
        questId:   cloned.id,
        questName: cloned.name,
        questDesc: cloned.desc,
        objectives: cloned.objectives,
        rewards:   cloned.rewards,
        flavour:   cloned.flavour,
        spawnMap:  cloned.spawnMap,
        startedAt: Date.now(),
      }

      // Spawn player in quest's starting map
      exploreSessions[sender] = { mapName: cloned.spawnMap }

      // Update explore objectives immediately
      updateQuestExplore(questSessions[sender], cloned.spawnMap)

      const { lines } = buildQuestStatus(questSessions[sender])

      return reply(
        `📜 *QUEST ACCEPTED*\n\n` +
        `🗺️ *${cloned.name}*\n` +
        `_${cloned.desc}_\n\n` +
        `━━━━━━━━━━━━━━━\n` +
        `📋 *Objectives:*\n${lines.join('\n')}\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `📍 You have been dispatched to *${cloned.spawnMap}*.\n\n` +
        `🎮 *Commands:*\n` +
        `> *.explore* — View your current map\n` +
        `> *.travel n/s/e/w* — Travel to adjacent maps\n` +
        `> *.encounter* — Battle an enemy in your area\n` +
        `> *.quest* — Check quest progress\n\n` +
        `_The quest begins. Complete the objectives yourself!_ 🖤`
      )
    }

    // Check cooldown (only applies between quests, not during one)
    const remaining = await db.getCooldown(sender, 'quest')
    if (remaining > 0 && !questSessions[sender]) {
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      return reply(`⏳ *QUEST COOLDOWN*\n\n🕒 Next quest in: ${mins}m ${secs}s\n\n_Prepare yourself._ 🖤`)
    }

    // Show quest board
    const pool = getQuestsForLevel(lvl)
    if (!pool.length) return reply(`❌ No quests available for your level (${lvl}). Level up and try again!`)

    const questList = pool.map((q, i) => {
      const reqStr = `Lv.${q.levelMin}–${q.levelMax === 99 ? '∞' : q.levelMax}`
      const rwdStr = `💰${q.rewards.coins} ⭐${q.rewards.xp} 💎${q.rewards.gems}`
      return (
        `*${i + 1}.* ${q.name}\n` +
        `   📍 Start: ${q.spawnMap}  [${reqStr}]\n` +
        `   _${q.desc}_\n` +
        `   🎁 Rewards: ${rwdStr}${q.rewards.item ? ` + ${q.rewards.item}` : ''}`
      )
    }).join('\n\n')

    return reply(
      `📋 *QUEST BOARD — AXEL*\n\n` +
      `👤 *${u.name || sender}*  •  📊 Lv.${lvl}\n\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `${questList}\n\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `📌 *Reply:* *.quest <number>* to accept\n` +
      `Example: *.quest 1*\n\n` +
      `_These quests are your responsibility. Complete them yourself!_ 🖤`
    )
  },

  // ─── COMPLETE QUEST ───────────────────────────────────────────────────────

  async _completeQuest({ reply, sender, user }) {
    const qs = questSessions[sender]
    if (!qs) return reply(`❌ No active quest.`)

    const { allDone } = buildQuestStatus(qs)
    if (!allDone) {
      const { lines } = buildQuestStatus(qs)
      return reply(`❌ Quest not yet complete!\n\n${lines.join('\n')}`)
    }

    const u = user || await db.getOrCreateUser(sender)
    const r = qs.rewards

    await db.updateUser(sender, {
      wallet: (u.wallet || 0) + r.coins,
      xp:     (u.xp    || 0) + r.xp,
      gems:   (u.gems  || 0) + r.gems,
    })
    await db.setCooldown(sender, 'quest', 15 * 60) // 15 min cooldown

    delete questSessions[sender]

    return reply(
      `🎉 *QUEST COMPLETE!*\n\n` +
      `📜 *${qs.questName}*\n\n` +
      `_"${qs.flavour}"_\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      `🎁 *REWARDS*\n` +
      `   💰 +${r.coins.toLocaleString()} coins\n` +
      `   ⭐ +${r.xp} XP\n` +
      `   💎 +${r.gems} gems\n` +
      (r.item ? `   📦 ${r.item}\n` : '') +
      `━━━━━━━━━━━━━━━\n\n` +
      `⏳ Next quest available in 15 minutes.\n\n` +
      `_The shadows acknowledge your deed._ 🖤`
    )
  },

  // ─── EXPLORE — show current world map ────────────────────────────────────

  async explore({ sock, jid, msg, reply, sender, user }) {
    const u   = user || await db.getOrCreateUser(sender)

    // Default to Axel Town if no explore session
    if (!exploreSessions[sender]) {
      exploreSessions[sender] = { mapName: 'Axel Town' }
    }

    const { mapName } = exploreSessions[sender]
    const mapData = maps.getMapData(mapName)
    if (!mapData) {
      exploreSessions[sender].mapName = 'Axel Town'
      return reply(`❌ Unknown location. Returning you to Axel Town.`)
    }

    // Check level requirement
    if (mapData.levelReq > (u.level || 1)) {
      return reply(`❌ *${mapName}* requires Level *${mapData.levelReq}*!\n\nYour level: ${u.level || 1}\n\n_Use *.travel* to go back to a safer area._ 🖤`)
    }

    // Check if player has an active quest — update explore objective
    if (questSessions[sender]) {
      const changed = updateQuestExplore(questSessions[sender], mapName)
      if (changed) {
        const { allDone, lines } = buildQuestStatus(questSessions[sender])
        if (allDone) {
          // All objectives done
          await reply(
            `📍 *${mapName}*\n\n${mapData.display}\n\n` +
            `✅ *Quest objective complete!*\n\n` +
            `_Use *.quest* to claim your rewards._ 🖤`
          )
          return
        }
      }
    }

    const landmarks = maps.getMapLandmarks(mapName)
    const landmarkLines = landmarks.map(l =>
      `${l.emoji} *${l.name}* — ${l.desc}`
    ).join('\n')

    const exitLines = Object.entries(mapData.exits || {})
      .filter(([, v]) => v)
      .map(([dir, dest]) => {
        const arrow = { north: '￪', south: '￬', west: '❮', east: '❯' }[dir]
        const req   = maps.MAPS[dest]?.levelReq > 1 ? ` *(Lv.${maps.MAPS[dest].levelReq}+)*` : ''
        return `${arrow} *.travel ${dir[0]}* → *${dest}*${req}`
      }).join('\n')

    const hasEnemies = (mapData.enemies || []).length > 0

    // Quest progress note
    let questNote = ''
    if (questSessions[sender]) {
      const qs = questSessions[sender]
      const { lines } = buildQuestStatus(qs)
      questNote = `\n📜 *Quest:* ${qs.questName}\n${lines.join('\n')}\n`
    }

    const text =
      `🗺️ *${mapName}*\n\n` +
      `${mapData.display}\n\n` +
      `${mapData.desc}\n\n` +
      `━━━━━━━━━━━━━━━\n` +
      (landmarkLines ? `📍 *Points of Interest:*\n${landmarkLines}\n\n` : '') +
      (hasEnemies ? `⚔️ *Enemies lurk here* — use *.encounter* to battle\n\n` : '') +
      `🧭 *Exits:*\n${exitLines || '_No exits_'}\n` +
      `━━━━━━━━━━━━━━━\n` +
      questNote +
      `\n_Use *.encounter* to battle | *.travel n/s/e/w* to travel_ 🖤`

    // Try sending an area image
    try {
      const imgBuf = await fetchExploreImage(mapName, '')
      if (imgBuf && imgBuf.length > 500 && sock && jid) {
        await sock.sendMessage(jid, { image: imgBuf, caption: text }, { quoted: msg })
        return
      }
    } catch {}

    await reply(text)
  },

  // ─── MOVE — travel between maps ──────────────────────────────────────────

  async travel({ reply, sender, user, args }) {
    const u   = user || await db.getOrCreateUser(sender)
    const dir = (args[0] || '').toLowerCase()

    const dirMap = { n: 'north', s: 'south', e: 'east', w: 'west',
                     north: 'north', south: 'south', east: 'east', west: 'west' }
    const direction = dirMap[dir]

    if (!direction) {
      return reply(
        `🧭 *MOVE*\n\n` +
        `Usage: *.travel <direction>*\n\n` +
        `> *.travel n* — North ￪\n` +
        `> *.travel s* — South ￬\n` +
        `> *.travel e* — East ❯\n` +
        `> *.travel w* — West ❮\n\n` +
        `_Use *.explore* to see available exits._ 🖤`
      )
    }

    if (!exploreSessions[sender]) {
      exploreSessions[sender] = { mapName: 'Axel Town' }
    }

    const { mapName } = exploreSessions[sender]
    const mapData     = maps.getMapData(mapName)
    if (!mapData) {
      exploreSessions[sender].mapName = 'Axel Town'
      return reply(`❌ Lost! Returned to Axel Town.`)
    }

    const dest = mapData.exits?.[direction]
    if (!dest) {
      return reply(`❌ No exit to the *${direction}* from *${mapName}*.\n\nUse *.explore* to see available exits.`)
    }

    const destData = maps.getMapData(dest)
    if (!destData) return reply(`❌ That area is currently inaccessible.`)

    // Check level requirement
    const playerLevel = u.level || 1
    if (destData.levelReq > playerLevel) {
      return reply(
        `🔒 *AREA LOCKED*\n\n` +
        `*${dest}* requires Level *${destData.levelReq}*\n` +
        `Your level: ${playerLevel}\n\n` +
        `_You need more experience before entering here._ 🖤`
      )
    }

    // Move the player
    exploreSessions[sender].mapName = dest

    // Update quest explore objectives
    let questUpdate = ''
    if (questSessions[sender]) {
      const changed = updateQuestExplore(questSessions[sender], dest)
      if (changed) {
        const { allDone, lines } = buildQuestStatus(questSessions[sender])
        if (allDone) {
          questUpdate = `\n\n✅ *Quest objective complete!* Use *.quest* to claim rewards!`
        } else {
          const justDone = questSessions[sender].objectives.find(o => o.type === 'explore' && o.target === dest && o.progress >= o.count)
          if (justDone) questUpdate = `\n\n✅ *Objective done:* ${justDone.desc}`
        }
      }
    }

    const hasEnemies = (destData.enemies || []).length > 0
    return reply(
      `🚶 *TRAVELLING...*\n\n` +
      `📍 You arrive at *${dest}*\n\n` +
      `${destData.display}\n\n` +
      `${destData.desc}` +
      (hasEnemies ? `\n\n⚔️ *Enemies are present.* Use *.encounter* to engage!` : '') +
      `\n\n_Use *.explore* for full map details._` +
      questUpdate +
      ` 🖤`
    )
  },

  // ─── FIGHT — battle a world-map enemy ────────────────────────────────────

  async encounter({ sock, jid, msg, reply, sender, user }) {
    // Can't fight while dungeon is active
    if (dungeonSessions[sender]) {
      return reply(`❌ You're in a dungeon! Use *.attack*, *.special*, etc.\n\nFinish the dungeon or use *.escape* first.`)
    }

    const u       = user || await db.getOrCreateUser(sender)
    const cls     = getClassForUser(u)
    const stats   = getPlayerStats(u)
    const mapName = exploreSessions[sender]?.mapName || 'Green Plains'
    const enemy   = maps.getRandomMapEnemy(mapName, u.level || 1)

    if (!enemy) {
      return reply(`⚔️ *NO ENEMIES HERE*\n\n*${mapName}* is peaceful.\n\nUse *.travel* to travel to a combat area.\n\n_Safe zones: Axel Town, Training Grounds_ 🖤`)
    }

    const playerAtk = stats.atk
    const playerHp  = stats.maxHp

    // Simple fight resolution (one round)
    const myDmg    = Math.floor(playerAtk * (0.8 + Math.random() * 0.4) * (cls ? 1.1 : 1.0))
    const enemyDmg = Math.floor(enemy.atk * (0.7 + Math.random() * 0.6))
    const survived = enemyDmg < playerHp * 0.9 // survived if not one-shot

    let resultText = ''
    let rewardText = ''

    if (survived) {
      // Win (simplified: player always wins world map fights, just takes some damage)
      const xpGain    = enemy.xp
      const coinGain  = enemy.coins
      await db.updateUser(sender, {
        xp:     (u.xp    || 0) + xpGain,
        wallet: (u.wallet|| 0) + coinGain,
      })

      rewardText = `💰 +${coinGain} coins  ⭐ +${xpGain} XP`

      // Update quest kill objectives
      let questNote = ''
      if (questSessions[sender]) {
        const changed = updateQuestKill(questSessions[sender], mapName)
        if (changed) {
          const { allDone, lines } = buildQuestStatus(questSessions[sender])
          if (allDone) {
            questNote = `\n\n✅ *All quest objectives complete!*\nUse *.quest* to claim your rewards!`
          } else {
            const next = questSessions[sender].objectives.find(o => o.progress < o.count)
            questNote = `\n\n📜 *Quest progress:*\n${lines.join('\n')}`
          }
        }
      }

      resultText =
        `⚔️ *FIELD BATTLE — ${mapName.toUpperCase()}*\n\n` +
        `👾 A *${enemy.name}* (Lv.${enemy.level}) appears!\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `💥 You strike for *${myDmg}* damage!\n` +
        `🗡️ *${enemy.name}* hits for *${enemyDmg}*!\n\n` +
        `✅ *VICTORY!*\n\n` +
        `${rewardText}` +
        questNote +
        `\n\n_Use *.encounter* again to battle more enemies._ 🖤`
    } else {
      // Close call / lost
      resultText =
        `⚔️ *FIELD BATTLE — ${mapName.toUpperCase()}*\n\n` +
        `👾 A *${enemy.name}* (Lv.${enemy.level}) overpowers you!\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `💥 You strike for *${myDmg}* damage!\n` +
        `🗡️ *${enemy.name}* hits for *${enemyDmg}* — nearly fatal!\n\n` +
        `💀 *DEFEATED!*\n\n` +
        `_You stagger back. No rewards this time._\n\n` +
        `_Try *.dungeon* for a more structured fight, or fight weaker enemies._ 🖤`
    }

    const img = await fetchExploreImage(mapName, enemy.name)
    await sendImgOrReply(sock, jid, img, resultText, reply, msg)
  },

  // ─── DUNGEON ENTRY ────────────────────────────────────────────────────────

  async dungeon({ sock, jid, msg, reply, sender, user }) {
    if (dungeonSessions[sender]) {
      const s   = dungeonSessions[sender]
      const cls = getClassForUser(user)
      const abilityList = cls
        ? cls.abilities.map(a => `• *.${a}*`).join('\n')
        : `⚔️ *.attack* | 💥 *.heavy* | 🛡️ *.defend* | 🌟 *.special* | 🧪 *.heal* | 🏃 *.escape*`
      return reply(
        `🏰 *DUNGEON IN PROGRESS*\n\nFloor: ${s.floor}\nHP: ${s.playerHp}/${s.playerMaxHp}\n\n` +
        (cls ? `${cls.emoji} *${cls.name}* Abilities:\n${abilityList}\n\n` : '') +
        `_Or use: *.attack* *.heavy* *.defend* *.special* *.heal* *.escape*_ 🖤`
      )
    }
    const cdRemaining = await db.getCooldown(sender, 'dungeon')
    if (cdRemaining > 0) {
      const mins = Math.floor(cdRemaining / 60000)
      const secs = Math.floor((cdRemaining % 60000) / 1000)
      return reply(`⏳ *DUNGEON COOLDOWN*\n\n🕒 Wait: ${mins}m ${secs}s\n\n_The dungeon needs time to reset._ 🖤`)
    }
    const u     = user || await db.getOrCreateUser(sender)
    const stats = getPlayerStats(u)
    const floor = 1
    const enemy = getEnemy(floor, u.level || 1)
    const dungeonZone = maps.getDungeonMap(floor)

    dungeonSessions[sender] = {
      floor, enemy,
      playerHp: stats.maxHp, playerMaxHp: stats.maxHp,
      playerAtk: stats.atk,
      defending: false,
      poisonTurns: 0, poisonDmg: 0,
      smokeDodge: false,
      shieldWallTurns: 0,
      firstStrike: stats.cls?.firstStrike || false,
      firstHitDone: false,
    }

    const cls        = stats.cls
    const intro      = ENEMY_INTROS[Math.floor(Math.random() * ENEMY_INTROS.length)]
    const zone       = getZoneDesc(floor)
    const abilityLine= cls
      ? `${cls.emoji} *${cls.name}* — Use *.${cls.abilities.join('*, *.')}*\n`
      : ''

    const battleText =
      `🏰 *SHADOW DUNGEON — FLOOR ${floor}*\n` +
      `${zone}\n\n` +
      `📍 *Current Floor Map:*\n${dungeonZone.display}\n\n` +
      `👤 *${u.name || sender}*  •  📊 Lv.${u.level || 1}${cls ? `  •  ${cls.emoji} ${cls.name}` : ''}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `💀 *${enemy.name}* (Lv.${enemy.level}) ${intro}\n` +
      `⚡ Ability: *${enemy.ability.name}* — _${enemy.ability.desc}_\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `⚔️  YOU        ${hpBar(stats.maxHp, stats.maxHp)}  ${stats.maxHp}/${stats.maxHp}\n` +
      `👾 ${enemy.name.padEnd(10)} ${hpBar(enemy.hp, enemy.hp)}  ${enemy.hp}/${enemy.hp}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      (cls ? `${cls.emoji} *Class Moves:*\n${cls.abilities.map(a => `• *.${a}*`).join('  ')}\n\n` : '') +
      `📖 *Basic:*  *.attack*  *.heavy*  *.defend*  *.special*  *.heal*  *.escape*\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `_The darkness watches. Choose wisely._ 🖤`

    try {
      const imgBuffer = await fetchDungeonImage(enemy, floor)
      if (imgBuffer && imgBuffer.length > 500) {
        await sock.sendMessage(jid, { image: imgBuffer, caption: battleText }, { quoted: msg })
      } else {
        await reply(battleText)
      }
    } catch {
      await reply(battleText)
    }
  },

  // ─── STANDARD ATTACK ──────────────────────────────────────────────────────

  async attack({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ No dungeon active. Use *.dungeon* to start.')
    const u   = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)

    let myDmg = Math.floor(s.playerAtk * (0.8 + Math.random() * 0.4))
    if (cls?.passive) myDmg = Math.floor(myDmg * cls.passive(s))
    if (s.firstStrike && !s.firstHitDone) { myDmg = Math.floor(myDmg * 1.5); s.firstHitDone = true }

    const abilityResult = applyMonsterAbility(s.enemy, s)
    let abilityText = ''
    if (abilityResult?.triggered) {
      if (abilityResult.dodge)         { abilityText = `\n⚡ *${s.enemy.ability.name}*: Your attack missed!\n`; myDmg = 0 }
      else if (abilityResult.playerDmgMult) { myDmg = Math.floor(myDmg * abilityResult.playerDmgMult); abilityText = `\n⚡ *${s.enemy.ability.name}*: ${s.enemy.ability.desc}\n` }
      else if (abilityResult.counterPct)    { abilityText = `\n⚡ *${s.enemy.ability.name}*: Counter! You take ${Math.floor(myDmg * abilityResult.counterPct)} reflected dmg!\n` }
      else                               { abilityText = `\n⚡ *${s.enemy.ability.name}*: ${abilityResult.desc || s.enemy.ability.desc}\n` }
    }

    s.enemy.currentHp = Math.max(0, s.enemy.currentHp - myDmg)

    let enemyDmg = s.defending
      ? Math.floor(s.enemy.attack * 0.5)
      : Math.floor(s.enemy.attack * (0.8 + Math.random() * 0.4))
    if (cls?.dmgReduction)   enemyDmg = Math.floor(enemyDmg * (1 - cls.dmgReduction))
    if (s.shieldWallTurns > 0) { enemyDmg = Math.floor(enemyDmg * 0.4); s.shieldWallTurns-- }
    if (abilityResult?.counterPct)    enemyDmg += Math.floor(myDmg * abilityResult.counterPct)
    if (abilityResult?.extraDmg)      enemyDmg += abilityResult.extraDmg
    if (abilityResult?.collapseDmgPct)enemyDmg += Math.floor(s.playerMaxHp * abilityResult.collapseDmgPct)
    if (abilityResult?.stealCoins) {
      await db.updateUser(sender, { wallet: Math.max(0, (u.wallet || 0) - abilityResult.stealCoins) })
      abilityText += ` (Lost ${abilityResult.stealCoins} coins!)`
    }

    s.defending = false
    if (cls?.lifeDrain && myDmg > 0) s.playerHp = Math.min(s.playerMaxHp, s.playerHp + Math.floor(myDmg * 0.10))

    let poisonText = ''
    if (s.poisonTurns > 0) {
      s.playerHp = Math.max(0, s.playerHp - s.poisonDmg)
      poisonText = `\n☠️ Poison: -${s.poisonDmg} HP (${s.poisonTurns} turns left)`
      s.poisonTurns--
    }

    s.playerHp = Math.max(0, s.playerHp - enemyDmg)

    if (s.enemy.currentHp <= 0) return await module.exports._dungeonWin(sock, jid, reply, sender, s, u)
    if (s.playerHp <= 0)        return await module.exports._dungeonLoss(reply, sender, s)

    const attackVerbs = ['slice through', 'slam into', 'carve into', 'strike', 'slash at']
    const verb = attackVerbs[Math.floor(Math.random() * attackVerbs.length)]
    const battleText =
      `⚔️ *ATTACK*\n\n` +
      `💥 You ${verb} *${s.enemy.name}* for *${myDmg}* damage!${abilityText}` +
      `🗡️ *${s.enemy.name}* hits back for *${enemyDmg}* damage!${poisonText}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `⚔️  YOU        ${hpBar(s.playerHp, s.playerMaxHp)}  ${s.playerHp}/${s.playerMaxHp}\n` +
      `👾 ${s.enemy.name.padEnd(10)} ${hpBar(s.enemy.currentHp, s.enemy.hp)}  ${s.enemy.currentHp}/${s.enemy.hp}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `_${s.playerHp < s.playerMaxHp * 0.3 ? 'You are barely hanging on…' : 'Keep pushing.'}_  🖤`
    const img = await fetchActionImage('attack', s.enemy.name)
    await sendImgOrReply(sock, jid, img, battleText, reply)
  },

  // ─── WARRIOR: SLASH ───────────────────────────────────────────────────────

  async slash({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const u   = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (!cls || !['slash','darkslash','voidrend'].some(a => cls.abilities.includes(a)))
      return reply(`❌ This ability is for Warriors only.`)

    const { currentSkill, evolved } = await module.exports._useSkill(sender, u, 'slash', s)
    const sk    = SKILL_EVOLUTION[currentSkill]
    const myDmg = Math.floor(s.playerAtk * sk.multiplier)
    s.enemy.currentHp = Math.max(0, s.enemy.currentHp - myDmg)
    const enemyDmg = Math.floor(s.enemy.attack * 0.9)
    s.playerHp = Math.max(0, s.playerHp - enemyDmg)

    if (s.enemy.currentHp <= 0) return await module.exports._dungeonWin(sock, jid, reply, sender, s, u)
    if (s.playerHp <= 0)        return await module.exports._dungeonLoss(reply, sender, s)

    const evolveMsg = evolved ? `\n🌟 *${currentSkill.toUpperCase()} EVOLVED!* New skill unlocked!` : ''
    const battleText =
      `⚔️ *${currentSkill.toUpperCase()}* (Tier ${sk.tier})\n\n` +
      `💥 ${sk.desc} — *${myDmg}* damage!${evolveMsg}\n` +
      `🗡️ ${s.enemy.name}: *${enemyDmg}* back\n\n` +
      `YOU: ${hpBar(s.playerHp, s.playerMaxHp)} \`${s.playerHp}/${s.playerMaxHp}\`\n` +
      `${s.enemy.name}: ${hpBar(s.enemy.currentHp, s.enemy.hp)} \`${s.enemy.currentHp}/${s.enemy.hp}\`\n\n` +
      `_The blade of shadow strikes true._ 🖤`
    const img = await fetchActionImage(currentSkill, s.enemy.name)
    await sendImgOrReply(sock, jid, img, battleText, reply)
  },
  async darkslash(ctx) { return module.exports.slash(ctx) },
  async voidrend(ctx)  { return module.exports.slash(ctx) },

  // ─── MAGE: DARKNOVA ───────────────────────────────────────────────────────

  async darknova({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const u   = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (!cls || cls.name !== 'Dark Mage') return reply('❌ This ability is for Dark Mages only.')

    const { currentSkill, evolved } = await module.exports._useSkill(sender, u, 'darknova', s)
    const sk    = SKILL_EVOLUTION[currentSkill]
    const myDmg = Math.floor(s.playerAtk * sk.multiplier)
    const drain = Math.floor(myDmg * 0.15)
    s.playerHp = Math.min(s.playerMaxHp, s.playerHp + drain)
    s.enemy.currentHp = Math.max(0, s.enemy.currentHp - myDmg)
    const enemyDmg = Math.floor(s.enemy.attack * 1.1)
    s.playerHp = Math.max(0, s.playerHp - enemyDmg)

    if (s.enemy.currentHp <= 0) return await module.exports._dungeonWin(sock, jid, reply, sender, s, u)
    if (s.playerHp <= 0)        return await module.exports._dungeonLoss(reply, sender, s)

    const evolveMsg = evolved ? `\n🌟 *SKILL EVOLVED!* Void Cascade unlocked!` : ''
    const battleText =
      `🔮 *${currentSkill.toUpperCase()}* (Tier ${sk.tier})\n\n` +
      `💥 Dark explosion deals *${myDmg}* damage!${evolveMsg}\n` +
      `❤️ Life Drain heals *${drain}* HP!\n` +
      `🗡️ ${s.enemy.name}: *${enemyDmg}* back\n\n` +
      `YOU: ${hpBar(s.playerHp, s.playerMaxHp)} \`${s.playerHp}/${s.playerMaxHp}\`\n` +
      `${s.enemy.name}: ${hpBar(s.enemy.currentHp, s.enemy.hp)} \`${s.enemy.currentHp}/${s.enemy.hp}\`\n\n` +
      `_The void consumes all._ 🖤`
    const img = await fetchActionImage(currentSkill, s.enemy.name)
    await sendImgOrReply(sock, jid, img, battleText, reply)
  },
  async voidcascade(ctx) { return module.exports.darknova(ctx) },

  // ─── ARCHER: SHADOWSHOT ───────────────────────────────────────────────────

  async shadowshot({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const u   = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (!cls || cls.name !== 'Void Archer') return reply('❌ This ability is for Void Archers only.')

    const { currentSkill, evolved } = await module.exports._useSkill(sender, u, 'shadowshot', s)
    const sk       = SKILL_EVOLUTION[currentSkill]
    const myDmg    = Math.floor(s.playerAtk * sk.multiplier)
    const poisonDmg= cls.poisonDmg || 15
    s.enemy.currentHp = Math.max(0, s.enemy.currentHp - myDmg - poisonDmg)
    const enemyDmg = Math.floor(s.enemy.attack * 0.9)
    s.playerHp = Math.max(0, s.playerHp - enemyDmg)

    if (s.enemy.currentHp <= 0) return await module.exports._dungeonWin(sock, jid, reply, sender, s, u)
    if (s.playerHp <= 0)        return await module.exports._dungeonLoss(reply, sender, s)

    const evolveMsg = evolved ? `\n🌟 *EVOLVED!* Void Piercer unlocked!` : ''
    const battleText =
      `🏹 *${currentSkill.toUpperCase()}* (Tier ${sk.tier})\n\n` +
      `💥 Shadow arrow deals *${myDmg}* + *${poisonDmg}* poison dmg!${evolveMsg}\n` +
      `🗡️ ${s.enemy.name}: *${enemyDmg}* back\n\n` +
      `YOU: ${hpBar(s.playerHp, s.playerMaxHp)} \`${s.playerHp}/${s.playerMaxHp}\`\n` +
      `${s.enemy.name}: ${hpBar(s.enemy.currentHp, s.enemy.hp)} \`${s.enemy.currentHp}/${s.enemy.hp}\`\n\n` +
      `_From the dark — an arrow that never misses._ 🖤`
    const img = await fetchActionImage(currentSkill, s.enemy.name)
    await sendImgOrReply(sock, jid, img, battleText, reply)
  },
  async voidpiercer(ctx) { return module.exports.shadowshot(ctx) },

  // ─── ASSASSIN: BACKSTAB ───────────────────────────────────────────────────

  async backstab({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const u   = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (!cls || cls.name !== 'Night Assassin') return reply('❌ Night Assassins only.')

    const { currentSkill, evolved } = await module.exports._useSkill(sender, u, 'backstab', s)
    const sk    = SKILL_EVOLUTION[currentSkill]
    const myDmg = Math.floor(s.playerAtk * sk.multiplier)
    s.enemy.currentHp = Math.max(0, s.enemy.currentHp - myDmg)
    const enemyDmg = Math.floor(s.enemy.attack * 1.2)
    s.playerHp = Math.max(0, s.playerHp - enemyDmg)

    if (s.enemy.currentHp <= 0) return await module.exports._dungeonWin(sock, jid, reply, sender, s, u)
    if (s.playerHp <= 0)        return await module.exports._dungeonLoss(reply, sender, s)

    const evolveMsg = evolved ? `\n🌟 *EVOLVED!* Death Mark unlocked!` : ''
    const battleText =
      `🗡️ *${currentSkill.toUpperCase()}* (Tier ${sk.tier})\n\n` +
      `💥 Strike from the dark — *${myDmg}* damage!${evolveMsg}\n` +
      `🗡️ ${s.enemy.name}: *${enemyDmg}* back\n\n` +
      `YOU: ${hpBar(s.playerHp, s.playerMaxHp)} \`${s.playerHp}/${s.playerMaxHp}\`\n` +
      `${s.enemy.name}: ${hpBar(s.enemy.currentHp, s.enemy.hp)} \`${s.enemy.currentHp}/${s.enemy.hp}\`\n\n` +
      `_Silence, then death._ 🖤`
    const img = await fetchActionImage(currentSkill, s.enemy.name)
    await sendImgOrReply(sock, jid, img, battleText, reply)
  },
  async deathmark(ctx) { return module.exports.backstab(ctx) },

  async smokebomb({ reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const u = user || await db.getOrCreateUser(sender)
    if (!getClassForUser(u) || getClassForUser(u).name !== 'Night Assassin') return reply('❌ Night Assassins only.')
    s.smokeDodge = true
    await reply(`💨 *SMOKE BOMB*\n\nYou vanish into the shadows!\n70% chance to dodge the next attack.\n\n_They can't hit what they can't see._ 🖤`)
  },

  // ─── KNIGHT: SHIELDWALL / DEATHBLOW ──────────────────────────────────────

  async shieldwall({ reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const u = user || await db.getOrCreateUser(sender)
    if (!getClassForUser(u) || getClassForUser(u).name !== 'Shadow Knight') return reply('❌ Shadow Knights only.')
    s.shieldWallTurns = 2
    await reply(`🛡️ *SHIELD WALL*\n\nMassive shield raised!\nDamage reduced 60% for 2 turns.\n\n_The wall holds. Nothing passes._ 🖤`)
  },

  async deathblow({ reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const u = user || await db.getOrCreateUser(sender)
    if (!getClassForUser(u) || getClassForUser(u).name !== 'Shadow Knight') return reply('❌ Shadow Knights only.')
    if (s.enemy.currentHp / s.enemy.hp > 0.20)
      return reply(`❌ *Death Blow* only activates when enemy HP is below 20%!\n\nEnemy HP: ${Math.floor(s.enemy.currentHp / s.enemy.hp * 100)}%`)
    s.enemy.currentHp = 0
    return await module.exports._dungeonWin(null, null, reply, sender, s, u)
  },

  // ─── WARRIOR: BERSERK ─────────────────────────────────────────────────────

  async berserk({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const u = user || await db.getOrCreateUser(sender)
    if (!getClassForUser(u) || getClassForUser(u).name !== 'Shadow Warrior') return reply('❌ Shadow Warriors only.')
    const myDmg    = Math.floor(s.playerAtk * 2.0)
    const enemyDmg = Math.floor(s.enemy.attack * 1.5)
    s.enemy.currentHp = Math.max(0, s.enemy.currentHp - myDmg)
    s.playerHp = Math.max(0, s.playerHp - enemyDmg)
    if (s.enemy.currentHp <= 0) return await module.exports._dungeonWin(sock, jid, reply, sender, s, u)
    if (s.playerHp <= 0)        return await module.exports._dungeonLoss(reply, sender, s)
    const battleText =
      `🔥 *BERSERK!*\n\n💥 Rage unleashed — *${myDmg}* damage!\n` +
      `🗡️ Defence ignored — ${s.enemy.name}: *${enemyDmg}* back!\n\n` +
      `YOU: ${hpBar(s.playerHp, s.playerMaxHp)} \`${s.playerHp}/${s.playerMaxHp}\`\n` +
      `${s.enemy.name}: ${hpBar(s.enemy.currentHp, s.enemy.hp)} \`${s.enemy.currentHp}/${s.enemy.hp}\`\n\n` +
      `_Pure rage knows no defence._ 🖤`
    const img = await fetchActionImage('berserk', s.enemy.name)
    await sendImgOrReply(sock, jid, img, battleText, reply)
  },

  // ─── STANDARD MOVES ───────────────────────────────────────────────────────

  async heavy({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const hit = Math.random() < 0.60
    if (!hit) {
      const enemyDmg = Math.floor(s.enemy.attack * (0.8 + Math.random() * 0.4))
      s.playerHp = Math.max(0, s.playerHp - enemyDmg)
      if (s.playerHp <= 0) return await module.exports._dungeonLoss(reply, sender, s)
      const missText =
        `💥 *HEAVY — MISS!*\n\n😤 Your massive swing cuts through air!\n` +
        `🗡️ *${s.enemy.name}* exploits the opening — *${enemyDmg}* dmg!\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `⚔️  YOU        ${hpBar(s.playerHp, s.playerMaxHp)}  ${s.playerHp}/${s.playerMaxHp}\n` +
        `👾 ${s.enemy.name.padEnd(10)} ${hpBar(s.enemy.currentHp, s.enemy.hp)}  ${s.enemy.currentHp}/${s.enemy.hp}\n` +
        `_Time your strikes more carefully._ 🖤`
      return sendImgOrReply(sock, jid, await fetchActionImage('heavy', s.enemy.name), missText, reply)
    }
    const myDmg    = Math.floor(s.playerAtk * 2.5)
    const enemyDmg = Math.floor(s.enemy.attack * 0.7)
    s.enemy.currentHp = Math.max(0, s.enemy.currentHp - myDmg)
    s.playerHp = Math.max(0, s.playerHp - enemyDmg)
    const u = user || await db.getOrCreateUser(sender)
    if (s.enemy.currentHp <= 0) return await module.exports._dungeonWin(sock, jid, reply, sender, s, u)
    if (s.playerHp <= 0)        return await module.exports._dungeonLoss(reply, sender, s)
    const battleText =
      `💥 *HEAVY HIT — DIRECT!*\n\n⚡ Your blow *shatters* through armour — *${myDmg}* damage!\n` +
      `🗡️ *${s.enemy.name}* staggers and retaliates — *${enemyDmg}* dmg!\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `⚔️  YOU        ${hpBar(s.playerHp, s.playerMaxHp)}  ${s.playerHp}/${s.playerMaxHp}\n` +
      `👾 ${s.enemy.name.padEnd(10)} ${hpBar(s.enemy.currentHp, s.enemy.hp)}  ${s.enemy.currentHp}/${s.enemy.hp}\n` +
      `_Heavy strikes break defenses._ 🖤`
    await sendImgOrReply(sock, jid, await fetchActionImage('heavy', s.enemy.name), battleText, reply)
  },

  async defend({ reply, sender }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    s.defending = true
    await reply(
      `🛡️ *BRACE!*\n\n🛡️ You raise your guard — bracing for impact!\n` +
      `📉 Next incoming attack: *-50% damage*\n\n` +
      `⚔️  YOU        ${hpBar(s.playerHp, s.playerMaxHp)}  ${s.playerHp}/${s.playerMaxHp}\n` +
      `_Hold the line._ 🖤`
    )
  },

  async special({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const myDmg    = Math.floor(s.playerAtk * 2)
    const enemyDmg = Math.floor(s.enemy.attack * 1.2)
    s.enemy.currentHp = Math.max(0, s.enemy.currentHp - myDmg)
    s.playerHp = Math.max(0, s.playerHp - enemyDmg)
    const u = user || await db.getOrCreateUser(sender)
    if (s.enemy.currentHp <= 0) return await module.exports._dungeonWin(sock, jid, reply, sender, s, u)
    if (s.playerHp <= 0)        return await module.exports._dungeonLoss(reply, sender, s)
    const battleText =
      `🌟 *SHADOW BURST!*\n\n⚡ Raw shadow energy focuses — *${myDmg}* damage!\n` +
      `🗡️ *${s.enemy.name}* fights through the blast — *${enemyDmg}* back!\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `⚔️  YOU        ${hpBar(s.playerHp, s.playerMaxHp)}  ${s.playerHp}/${s.playerMaxHp}\n` +
      `👾 ${s.enemy.name.padEnd(10)} ${hpBar(s.enemy.currentHp, s.enemy.hp)}  ${s.enemy.currentHp}/${s.enemy.hp}\n` +
      `_Raw power channeled from the void._ 🖤`
    await sendImgOrReply(sock, jid, await fetchActionImage('special', s.enemy.name), battleText, reply)
  },

  async heal({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) {
      const u     = user || await db.getOrCreateUser(sender).catch(() => null)
      const stats = u ? getPlayerStats(u) : { maxHp: 200, atk: 20 }
      return reply(
        `💊 *HP FULLY RESTORED*\n\n❤️  HP: ${stats.maxHp}/${stats.maxHp}  💪 Ready for battle!\n\n` +
        `_Use *.dungeon* to enter the dungeon._\n` +
        `_Use *.encounter* to fight in the open world._ 🖤`
      )
    }
    if (s.playerHp >= s.playerMaxHp) return reply(
      `❤️ *ALREADY FULL*\n\nYour HP is at maximum — save the potion!\n\n` +
      `⚔️  YOU  ${hpBar(s.playerHp, s.playerMaxHp)}  ${s.playerHp}/${s.playerMaxHp}`
    )
    const healAmt  = Math.floor(s.playerMaxHp * 0.22)
    const preHeal  = s.playerHp
    s.playerHp     = Math.min(s.playerMaxHp, s.playerHp + healAmt)
    const enemyDmg = Math.floor(s.enemy.attack * 0.8)
    s.playerHp     = Math.max(0, s.playerHp - enemyDmg)
    if (s.playerHp <= 0) return await module.exports._dungeonLoss(reply, sender, s)
    const netHeal  = s.playerHp - preHeal
    const battleText =
      `🧪 *SHADOW ELIXIR*\n\n💚 Healed *+${healAmt}* HP… but the enemy strikes!\n` +
      `🗡️ *${s.enemy.name}* hits for *${enemyDmg}* while you drink!\n` +
      `📊 Net: ${netHeal >= 0 ? '+' : ''}${netHeal} HP\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `⚔️  YOU        ${hpBar(s.playerHp, s.playerMaxHp)}  ${s.playerHp}/${s.playerMaxHp}\n` +
      `👾 ${s.enemy.name.padEnd(10)} ${hpBar(s.enemy.currentHp, s.enemy.hp)}  ${s.enemy.currentHp}/${s.enemy.hp}\n` +
      `_Recovery in the middle of battle._ 🖤`
    await sendImgOrReply(sock, jid, await fetchActionImage('heal', s.enemy.name), battleText, reply)
  },

  async escape({ reply, sender }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ No dungeon active.')
    if (Math.random() < 0.4) {
      delete dungeonSessions[sender]
      return reply(`🏃 *ESCAPED!*\n\nYou sprint through the dark corridors and find an exit!\n\n📍 Escaped from Floor ${s.floor}\n\n_Survival is its own kind of victory._ 🖤`)
    }
    const enemyDmg = Math.floor(s.enemy.attack * 1.5)
    s.playerHp = Math.max(0, s.playerHp - enemyDmg)
    if (s.playerHp <= 0) {
      delete dungeonSessions[sender]
      return reply(`💀 *CAUGHT FLEEING!*\n\n*${s.enemy.name}* cuts you down from behind!\n\n_The shadows punish cowardice._ 🖤`)
    }
    await reply(
      `🚫 *ESCAPE FAILED!*\n\n*${s.enemy.name}* blocks every exit — hits you for *${enemyDmg}*!\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `⚔️  YOU        ${hpBar(s.playerHp, s.playerMaxHp)}  ${s.playerHp}/${s.playerMaxHp}\n` +
      `_Fight or die._ 🖤`
    )
  },

  async adventure({ reply, sender, user }) {
    const u   = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    const clsBonus = cls ? 1.2 : 1.0
    const adventures = [
      { text: 'explored an ancient shadow temple', coins: 150, xp: 50 },
      { text: 'defeated a wandering dark mage', coins: 300, xp: 100 },
      { text: 'discovered a hidden vault', coins: 500, xp: 75 },
      { text: 'survived a shadow storm', coins: 200, xp: 120 },
    ]
    const adv   = adventures[Math.floor(Math.random() * adventures.length)]
    const coins = Math.floor(adv.coins * clsBonus)
    const xp    = Math.floor(adv.xp    * clsBonus)
    await db.updateUser(sender, { wallet: (u.wallet || 0) + coins, xp: (u.xp || 0) + xp })
    await reply(`⚔️ *ADVENTURE COMPLETE*\n\n👤 ${u.name || sender}\n${cls ? `${cls.emoji} Class: ${cls.name}\n` : ''}\n🗺️ You ${adv.text}!\n\n💰 +$${coins}\n⭐ +${xp} XP\n\n_Every adventure forges the shadow warrior._ 🖤`)
  },

  async item({ reply, sender }) {
    const items = await db.getInventory(sender)
    if (!items.length) return reply('❌ Inventory empty! Use *.buy* to get items.')
    await reply(`🎒 *USE ITEM*\n\nInventory: ${items.map(i => i.item).join(', ')}\n\nUsage: *.use <item>*\n\n_Your inventory holds your power._ 🖤`)
  },

  async raid({ sock, jid, reply, sender, isGroup, user }) {
    if (!isGroup) return reply('❌ Raids are group events!')
    const remaining = await db.getCooldown(sender, 'raid')
    if (remaining > 0) {
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      return reply(`⏳ *RAID COOLDOWN*\n\n🕒 Wait: ${mins}m ${secs}s\n\n_The raid boss needs time to respawn._ 🖤`)
    }
    const u      = user || await db.getOrCreateUser(sender)
    const boss   = ENEMIES[4]
    const reward = 500 + Math.floor(Math.random() * 500)
    await db.updateUser(sender, { wallet: (u.wallet || 0) + reward })
    await db.setCooldown(sender, 'raid', 25 * 60)
    await reply(`⚔️ *RAID COMPLETE*\n\n👥 Your group defeated *${boss.name}*!\n\n💰 Raid Reward: +$${reward}\n\n⏳ Next raid in 25 minutes.\n\n_The raid boss falls before shadow warriors._ 🖤`)
  },

  async class({ reply, sender, user }) {
    const u   = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (cls) {
      return reply(
        `🎭 *YOUR CLASS*\n\n👤 ${u.name || sender}\n\n${cls.emoji} Class: *${cls.name}*\n📊 Level: ${u.level || 1}\n\n${cls.passiveDesc}\n\n⚔️ Abilities: ${cls.abilities.join(', ')}\n\n_Use *.skillinfo* to see skill progress._\n_Use *.selectclass* to change class._ 🖤`
      )
    }
    await reply(`🎭 *NO CLASS*\n\n👤 ${u.name || sender}\n\n❌ You haven't chosen a class yet!\n\nUse *.selectclass* to pick your path.\n\n_Every shadow warrior has a role._ 🖤`)
  },

  // ─── QUESTPROGRESS shorthand ──────────────────────────────────────────────
  async questprogress({ reply, sender, user }) {
    return module.exports.quest({ reply, sender, user, args: [] })
  },

  // ─── SKILL USE HELPER ─────────────────────────────────────────────────────

  async _useSkill(sender, user, baseSkill, session) {
    const freshUser = await db.getOrCreateUser(sender).catch(() => user)
    let skillXp = {}
    try { skillXp = JSON.parse((freshUser || user).skill_xp || '{}') } catch {}

    let currentSkill = baseSkill
    let sk = SKILL_EVOLUTION[baseSkill]
    while (sk?.evolvesTo && (skillXp[baseSkill] || 0) >= (sk.evolvesAt || Infinity)) {
      currentSkill = sk.evolvesTo
      sk = SKILL_EVOLUTION[currentSkill]
    }

    skillXp[baseSkill] = (skillXp[baseSkill] || 0) + 1
    const baseSk   = SKILL_EVOLUTION[baseSkill]
    const didEvolve= baseSk?.evolvesAt && skillXp[baseSkill] === baseSk.evolvesAt
    let newSkill   = currentSkill
    if (didEvolve && baseSk.evolvesTo) newSkill = baseSk.evolvesTo

    await db.updateUser(sender, { skill_xp: JSON.stringify(skillXp) })
    return { currentSkill: newSkill, evolved: didEvolve }
  },

  // ─── WIN / LOSS ───────────────────────────────────────────────────────────

  async _dungeonWin(sock, jid, reply, sender, session, user) {
    const damageTaken = session.playerMaxHp - session.playerHp
    const clearedFloor= session.floor
    const nextFloor   = session.floor + 1
    const reward      = session.enemy.reward
    const milestone   = clearedFloor % 5 === 0
    if (milestone) {
      reward.coins = Math.floor(reward.coins * 2)
      reward.gems  = Math.floor(reward.gems  * 2) + 1
      reward.xp    = Math.floor(reward.xp    * 1.5)
    }

    const newRpgXp = (user.rpg_xp || user.xp || 0) + reward.xp
    const xpNeeded = (user.level || 1) * 1000
    const levelUp  = newRpgXp >= xpNeeded
    const newLevel = levelUp ? (user.level || 1) + 1 : (user.level || 1)
    const newXp    = levelUp ? newRpgXp - xpNeeded : newRpgXp

    await db.updateUser(sender, {
      wallet: (user.wallet || 0) + reward.coins,
      gems:   (user.gems   || 0) + reward.gems,
      xp:     newXp,
      level:  newLevel,
    })
    await db.setCooldown(sender, 'dungeon', 10 * 60)

    session.floor    = nextFloor
    session.enemy    = getEnemy(nextFloor, newLevel)
    session.enemy.currentHp = session.enemy.hp
    session.defending   = false
    session.poisonTurns = 0

    const hpPct    = session.playerHp / session.playerMaxHp
    const hpStatus = hpPct > 0.7 ? '💪 Barely scratched!' : hpPct > 0.4 ? '😤 Bloodied but standing.' : '😰 Barely alive…'
    const nextZone = getZoneDesc(nextFloor)
    const nextIntro= ENEMY_INTROS[Math.floor(Math.random() * ENEMY_INTROS.length)]
    const dungeonZone = maps.getDungeonMap(nextFloor)

    const winText =
      `✅ *FLOOR ${clearedFloor} CLEARED!*${milestone ? '  👑 *MILESTONE BONUS!*' : ''}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *${user.name || sender}*\n` +
      `❤️  HP: ${session.playerHp}/${session.playerMaxHp}  ${hpStatus}\n` +
      `💔 Damage taken: ${damageTaken}\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎁 *LOOT COLLECTED*\n` +
      `   💰  +$${reward.coins.toLocaleString()}\n` +
      `   💎  +${reward.gems} gems\n` +
      `   ⭐  +${reward.xp} XP\n` +
      (milestone ? `   👑  *MILESTONE BONUS — double loot!*\n` : '') +
      (levelUp   ? `\n🎉 *LEVEL UP!*  →  Level *${newLevel}*!\n` : '') +
      `\n━━━━━━━━━━━━━━━━━━━\n` +
      `🚪 *Descending to Floor ${nextFloor}…*\n${nextZone}\n\n` +
      `📍 *Floor ${nextFloor} Map:*\n${dungeonZone.display}\n\n` +
      `👾 *${session.enemy.name}* (Lv.${session.enemy.level}) ${nextIntro}\n` +
      `⚡ Ability: *${session.enemy.ability.name}*\n\n` +
      `⚔️  YOU        ${hpBar(session.playerHp, session.playerMaxHp)}  ${session.playerHp}/${session.playerMaxHp}\n` +
      `👾 ${session.enemy.name.padEnd(10)} ${hpBar(session.enemy.hp, session.enemy.hp)}  ${session.enemy.hp}/${session.enemy.hp}\n\n` +
      `_The shadows grow thicker with every step._ 🖤`

    await reply(winText)
    try {
      const monsterImg = await fetchMonsterImage(session.enemy.name)
      if (monsterImg && monsterImg.length > 500 && sock && jid) {
        await sock.sendMessage(jid, { image: monsterImg, caption: `👾 *${session.enemy.name}* appears on Floor ${nextFloor}!\n⚡ *${session.enemy.ability.name}* — _${session.enemy.ability.desc}_\n\n_Choose your move wisely._ 🖤` })
      }
    } catch {}
  },

  async pheal({ reply }) {
    await reply(`💊 Use *#pheal* (with # prefix) to heal your Pokémon party.\n\n_Example: #pheal_`)
  },

  async _dungeonLoss(reply, sender, session) {
    const floor = session.floor
    delete dungeonSessions[sender]
    const deathLines = [
      `_The dungeon claims another soul… for now._`,
      `_The shadows swallow you whole._`,
      `_Darkness wins this round. It always does._`,
      `_Your flame goes out. The dungeon forgets you._`,
    ]
    await reply(
      `💀 *DEFEATED ON FLOOR ${floor}*\n\n👾 *${session.enemy.name}* overwhelmed you!\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `❤️  HP:    0 / ${session.playerMaxHp}\n` +
      `📍 Floor: ${floor}\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `${deathLines[Math.floor(Math.random() * deathLines.length)]} 🖤\n\n` +
      `_Use *.dungeon* to enter again._`
    )
  },

  // ─── GUILDRAID alias ──────────────────────────────────────────────────────
  async guildraid(ctx) { return module.exports.raid(ctx) },

  // ─── RPARTY — Group RPG Party System ─────────────────────────────────────

  async rparty({ sock, jid, reply, sender, user, args, isGroup, senderJid }) {
    const u = user || await db.getOrCreateUser(sender)

    // Must be in a group for party features (except viewing solo profile)
    const sub = (args[0] || 'status').toLowerCase()

    if (!isGroup && sub !== 'status') {
      return reply(`❌ RPG parties are group features!\n\nUse *.rparty* in a group to form a party.\n\n_Solo status shown below:_\n\n👤 *${u.name || sender}*  •  📊 Lv.${u.level || 1}`)
    }

    switch (sub) {

      // ── form: create/reset party for this group ──────────────────────────
      case 'form':
      case 'create': {
        rpartySessions[jid] = {
          leader:  sender,
          members: [{ phone: sender, name: u.name || sender, level: u.level || 1, joinedAt: Date.now() }],
          sharedQuest: null,
          groupJid: jid,
          formedAt: Date.now(),
        }
        const meta = await sock.groupMetadata(jid).catch(() => null)
        const groupName = meta?.subject || 'this group'
        return reply(
          `⚔️ *PARTY FORMED*\n\n` +
          `👑 Leader: *${u.name || sender}*\n` +
          `🏠 Group: *${groupName}*\n\n` +
          `━━━━━━━━━━━━━━━\n` +
          `📋 *Members (1):*\n` +
          `• ${u.name || sender} (Lv.${u.level || 1}) 👑\n\n` +
          `━━━━━━━━━━━━━━━\n\n` +
          `_Others can join with *.rparty join*_\n` +
          `_Start a shared quest with *.rparty quest*_  🖤`
        )
      }

      // ── join: join the group's active party ─────────────────────────────
      case 'join': {
        const party = rpartySessions[jid]
        if (!party) return reply(`❌ No active party in this group!\n\nSomeone must first use *.rparty form* to create one.`)
        if (party.members.some(m => m.phone === sender)) return reply(`❌ You're already in this party!`)
        if (party.members.length >= 5) return reply(`❌ Party is full! (Max 5 members)`)
        party.members.push({ phone: sender, name: u.name || sender, level: u.level || 1, joinedAt: Date.now() })
        const memberList = party.members.map((m, i) =>
          `• ${m.name} (Lv.${m.level})${m.phone === party.leader ? ' 👑' : ''}`
        ).join('\n')
        return reply(
          `⚔️ *JOINED PARTY!*\n\n` +
          `👤 *${u.name || sender}* enters the fray!\n\n` +
          `━━━━━━━━━━━━━━━\n` +
          `📋 *Party (${party.members.length}/5):*\n${memberList}\n` +
          `━━━━━━━━━━━━━━━\n\n` +
          `_Use *.rparty quest* to start a shared quest_  🖤`
        )
      }

      // ── leave: leave the party ───────────────────────────────────────────
      case 'leave': {
        const party = rpartySessions[jid]
        if (!party) return reply(`❌ No active party here.`)
        if (!party.members.some(m => m.phone === sender)) return reply(`❌ You're not in this party.`)
        if (party.leader === sender) {
          // Leader leaves — disband
          delete rpartySessions[jid]
          return reply(`💀 *PARTY DISBANDED*\n\nThe leader left. Party has been disbanded.\n\n_Use *.rparty form* to create a new one._  🖤`)
        }
        party.members = party.members.filter(m => m.phone !== sender)
        return reply(`🚪 *${u.name || sender}* has left the party.\n\n_Party continues with ${party.members.length} members._  🖤`)
      }

      // ── status: view party info ──────────────────────────────────────────
      case 'status':
      default: {
        const party = isGroup ? rpartySessions[jid] : null
        if (!party) {
          if (!isGroup) {
            return reply(
              `👤 *${u.name || sender}*  •  📊 Lv.${u.level || 1}\n\n` +
              `❌ No party — use *.rparty form* in a group to create one.\n\n` +
              `_RPG Party commands:_\n` +
              `> *.rparty form* — Form a party\n` +
              `> *.rparty join* — Join current party\n` +
              `> *.rparty quest* — Start shared quest\n` +
              `> *.rparty kick @user* — Kick member\n` +
              `> *.rparty leave* — Leave party  🖤`
            )
          }
          return reply(
            `❌ *No active party in this group.*\n\n` +
            `Use *.rparty form* to create one!\n\n` +
            `_Commands:_\n` +
            `> *.rparty form* — Create party\n` +
            `> *.rparty join* — Join party\n` +
            `> *.rparty status* — View party\n` +
            `> *.rparty quest* — Shared quest\n` +
            `> *.rparty leave* — Leave  🖤`
          )
        }
        const memberList = party.members.map((m, i) =>
          `${i + 1}. ${m.name} (Lv.${m.level})${m.phone === party.leader ? ' 👑' : ''}`
        ).join('\n')
        const qs = party.sharedQuest
        const questLine = qs
          ? `\n📜 *Shared Quest:* ${qs.questName}\n${qs.objectives.map(o => `${o.progress >= o.count ? '✅' : '⬜'} ${o.desc} (${o.progress}/${o.count})`).join('\n')}`
          : `\n📋 No active quest — use *.rparty quest* to pick one`
        return reply(
          `⚔️ *PARTY STATUS*\n\n` +
          `━━━━━━━━━━━━━━━\n` +
          `👥 *Members (${party.members.length}/5):*\n${memberList}\n` +
          `━━━━━━━━━━━━━━━` +
          questLine +
          `\n━━━━━━━━━━━━━━━\n\n` +
          `_Use *.rparty quest* to start a shared quest_\n` +
          `_Each member can *.encounter* enemies to contribute kills_  🖤`
        )
      }

      // ── quest: start a shared party quest ───────────────────────────────
      case 'quest': {
        const party = rpartySessions[jid]
        if (!party) return reply(`❌ No party here! Use *.rparty form* first.`)
        if (!party.members.some(m => m.phone === sender)) return reply(`❌ Join the party first with *.rparty join*`)
        if (party.leader !== sender) return reply(`❌ Only the party leader can start a quest!`)
        if (party.sharedQuest) return reply(`❌ Party already has an active quest!\n\nUse *.rparty status* to check progress.`)

        const minLevel = Math.min(...party.members.map(m => m.level))
        const pool = getQuestsForLevel(minLevel)
        if (!pool.length) return reply(`❌ No quests for this party's level range.`)

        const chosen = pool[Math.floor(Math.random() * pool.length)]
        const cloned = JSON.parse(JSON.stringify(chosen))
        party.sharedQuest = {
          questId:   cloned.id,
          questName: cloned.name,
          questDesc: cloned.desc,
          objectives: cloned.objectives,
          rewards:   cloned.rewards,
          startedAt: Date.now(),
        }

        // Put all members in the quest spawn map
        for (const m of party.members) {
          exploreSessions[m.phone] = { mapName: cloned.spawnMap, partyJid: jid }
        }

        const memberMentions = party.members.map(m => `• ${m.name}`).join('\n')
        const { lines } = buildQuestStatus(party.sharedQuest)
        return reply(
          `⚔️ *PARTY QUEST STARTED!*\n\n` +
          `📜 *${cloned.name}*\n` +
          `_${cloned.desc}_\n\n` +
          `━━━━━━━━━━━━━━━\n` +
          `👥 *Party:*\n${memberMentions}\n\n` +
          `📋 *Objectives:*\n${lines.join('\n')}\n` +
          `━━━━━━━━━━━━━━━\n\n` +
          `📍 All members dispatched to *${cloned.spawnMap}*\n\n` +
          `_Each member's *.encounter* kills count for the party!_\n` +
          `_Use *.rparty status* to check progress._  🖤`
        )
      }

      // ── kick: leader kicks a member ──────────────────────────────────────
      case 'kick': {
        const party = rpartySessions[jid]
        if (!party) return reply(`❌ No active party.`)
        if (party.leader !== sender) return reply(`❌ Only the leader can kick members.`)
        const mentionedJids = (args[1] || '').replace(/[^0-9]/g, '')
        if (!mentionedJids) return reply(`❌ Usage: *.rparty kick @user*`)
        const target = party.members.find(m => m.phone === mentionedJids)
        if (!target) return reply(`❌ That member is not in the party.`)
        if (target.phone === sender) return reply(`❌ You can't kick yourself! Use *.rparty leave* to disband.`)
        party.members = party.members.filter(m => m.phone !== mentionedJids)
        return reply(`🚫 *${target.name}* has been kicked from the party.\n\n_Party: ${party.members.length} members remaining._  🖤`)
      }

      // ── disband: leader disbands the party ───────────────────────────────
      case 'disband': {
        const party = rpartySessions[jid]
        if (!party) return reply(`❌ No active party.`)
        if (party.leader !== sender) return reply(`❌ Only the leader can disband the party.`)
        delete rpartySessions[jid]
        return reply(`💀 *PARTY DISBANDED*\n\nThe party has been disbanded by the leader.\n\n_Use *.rparty form* to create a new one._  🖤`)
      }
    }
  },
}
