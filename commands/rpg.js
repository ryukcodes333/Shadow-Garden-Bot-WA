const db = require('../database')
const http = require('http')
const https = require('https')
const { MAPS, QUESTS, getQuestsForLevel, getMap, renderMap, getQuestById } = require('./maps')

const dungeonSessions = {}
const questSessions   = {}
const exploreSessions = {}

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

function fetchDungeonImage(enemy, floor) {
  const zone = floor <= 3 ? 'mist corridor' : floor <= 6 ? 'dark hall torchlit' : floor <= 10 ? 'burning depths lava' : floor <= 15 ? 'frost vault ice cave' : floor <= 20 ? 'storm chamber lightning' : 'void core fracturing reality'
  const enemyName = (enemy.name || 'shadow monster').toLowerCase()
  return fetchPollinationsImage(`anime dark fantasy dungeon ${zone} ${enemyName} battle scene dramatic lighting shadow garden epic atmospheric`)
}

function fetchMonsterImage(enemyName) {
  const name = (enemyName || 'shadow monster').toLowerCase()
  return fetchPollinationsImage(`anime dark fantasy monster ${name} dramatic battle pose glowing eyes shadow dungeon epic lighting full body`)
}

function fetchProfileCardImage(user, cls) {
  const className = cls ? cls.name.toLowerCase() : 'adventurer'
  const level = user.level || 1
  const prompt = `fantasy RPG adventurer profile card portrait ${className} class character level ${level} wearing medieval armor dramatic lighting detailed anime art style parchment background professional game card art confident pose glowing eyes dark fantasy`
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

async function sendImgOrReply(sock, jid, buffer, caption, replyFn) {
  try {
    if (sock && jid && buffer && buffer.length > 500) {
      await sock.sendMessage(jid, { image: buffer, caption })
      return
    }
  } catch (e) { console.error('[sendImgOrReply]', e.message) }
  await replyFn(caption)
}

// ── CLASS DEFINITIONS ────────────────────────────────────────────
const CLASSES = {
  warrior: {
    name: 'Shadow Warrior', emoji: '⚔️', desc: 'Tank fighter with high HP and steady damage.',
    hpBonus: 80, atkBonus: 5, passiveDesc: '🔥 Berserker Rage: +30% attack when HP < 30%',
    abilities: ['slash', 'berserk', 'ironwall'],
    passive: (s) => s.playerHp / s.playerMaxHp < 0.3 ? 1.3 : 1.0,
    trait: 'Relentless', mood: () => ['Focused','Bloodthirsty','Determined'][Math.floor(Math.random()*3)],
  },
  mage: {
    name: 'Dark Mage', emoji: '🔮', desc: 'Glass cannon with devastating spells and life drain.',
    hpBonus: 0, atkBonus: 20, passiveDesc: '🌑 Life Drain: heal 10% of all damage dealt',
    abilities: ['darknova', 'lifedrain', 'voidbolt'], passive: null, lifeDrain: true,
    trait: 'Arcane Genius', mood: () => ['Mystical','Calculating','Obsessed'][Math.floor(Math.random()*3)],
  },
  archer: {
    name: 'Void Archer', emoji: '🏹', desc: 'Swift striker with high crit chance and poison.',
    hpBonus: 20, atkBonus: 12, passiveDesc: '💚 Poison Arrow: enemies take 15 extra damage per turn',
    abilities: ['shadowshot', 'poisonarrow', 'pierce'], passive: null, poisonDmg: 15,
    trait: 'Shadow Stalker', mood: () => ['Patient','Alert','Restless'][Math.floor(Math.random()*3)],
  },
  assassin: {
    name: 'Night Assassin', emoji: '🗡️', desc: 'Highest burst damage, first strike bonus, smoke dodge.',
    hpBonus: -10, atkBonus: 18, passiveDesc: '⚡ Backstab: +50% damage on first hit of every dungeon',
    abilities: ['backstab', 'smokebomb', 'shadowstrike'], passive: null, firstStrike: true,
    trait: 'Phantom Edge', mood: () => ['Cold','Calculating','Merciless'][Math.floor(Math.random()*3)],
  },
  knight: {
    name: 'Shadow Knight', emoji: '🛡️', desc: 'Ultimate tank with heavy block and taunt.',
    hpBonus: 120, atkBonus: 0, passiveDesc: '🛡️ Shield Wall: automatically block 20% all incoming damage',
    abilities: ['shieldwall', 'taunt', 'deathblow'], passive: null, dmgReduction: 0.2,
    trait: 'Unbreakable', mood: () => ['Stoic','Unyielding','Vigilant'][Math.floor(Math.random()*3)],
  },
}

const SKILL_EVOLUTION = {
  slash:        { tier:1, desc:'Basic sword swing',           multiplier:1.5, evolvesAt:10,  evolvesTo:'darkslash'   },
  darkslash:    { tier:2, desc:'Dark-infused slash',          multiplier:2.2, evolvesAt:25,  evolvesTo:'voidrend'    },
  voidrend:     { tier:3, desc:'Tears reality itself',        multiplier:3.5, evolvesAt:null, evolvesTo:null         },
  darknova:     { tier:1, desc:'Dark magic explosion',        multiplier:2.0, evolvesAt:10,  evolvesTo:'voidcascade' },
  voidcascade:  { tier:2, desc:'Cascading void energy',       multiplier:3.2, evolvesAt:null, evolvesTo:null         },
  shadowshot:   { tier:1, desc:'Shadow-piercing arrow',       multiplier:1.8, evolvesAt:10,  evolvesTo:'voidpiercer' },
  voidpiercer:  { tier:2, desc:'Pierces through void',        multiplier:2.8, evolvesAt:null, evolvesTo:null         },
  backstab:     { tier:1, desc:'Surprise attack from dark',   multiplier:2.5, evolvesAt:15,  evolvesTo:'deathmark'   },
  deathmark:    { tier:2, desc:'Mark of death — one-shot potential', multiplier:4.0, evolvesAt:null, evolvesTo:null  },
  berserk:      { tier:1, desc:'Rage mode: +50% atk',        multiplier:2.0, evolvesAt:null, evolvesTo:null         },
  ironwall:     { tier:1, desc:'Block 80% next attack',       multiplier:0,   evolvesAt:null, evolvesTo:null         },
  lifedrain:    { tier:1, desc:'Drain 50% dmg as HP',         multiplier:1.6, evolvesAt:null, evolvesTo:null         },
  voidbolt:     { tier:1, desc:'Instant void bolt',           multiplier:1.9, evolvesAt:null, evolvesTo:null         },
  poisonarrow:  { tier:1, desc:'Apply 30 poison stack',       multiplier:1.2, evolvesAt:null, evolvesTo:null         },
  pierce:       { tier:1, desc:'Ignore 50% defence',          multiplier:1.7, evolvesAt:null, evolvesTo:null         },
  smokebomb:    { tier:1, desc:'70% chance dodge next hit',   multiplier:0,   evolvesAt:null, evolvesTo:null         },
  shadowstrike: { tier:1, desc:'Swift multi-hit: 3x hits',   multiplier:1.1, evolvesAt:null, evolvesTo:null         },
  shieldwall:   { tier:1, desc:'Reduce all dmg 60% for 2 turns', multiplier:0, evolvesAt:null, evolvesTo:null        },
  taunt:        { tier:1, desc:'Force monster to attack',     multiplier:0,   evolvesAt:null, evolvesTo:null         },
  deathblow:    { tier:1, desc:'Finisher: 5x dmg if enemy HP < 20%', multiplier:5.0, evolvesAt:null, evolvesTo:null },
}

const ENEMIES = [
  { name:'Shadow Slime',  level:1,  hp:40,  attack:6,   ability:{ name:'Slime Coat',    chance:0.30, desc:'Reduces your damage by 25%',      effect:'dmgReduce' }, reward:{ coins:50,   xp:20,   gems:0  }},
  { name:'Dark Goblin',   level:3,  hp:65,  attack:12,  ability:{ name:'Steal',          chance:0.25, desc:'Steals 30 coins from you!',       effect:'steal'     }, reward:{ coins:120,  xp:45,   gems:1  }},
  { name:'Void Wraith',   level:5,  hp:95,  attack:20,  ability:{ name:'Phase Shift',    chance:0.35, desc:'Phases through your attack!',     effect:'dodge'     }, reward:{ coins:220,  xp:90,   gems:2  }},
  { name:'Shadow Knight', level:8,  hp:150, attack:32,  ability:{ name:'Counter Stance', chance:0.40, desc:'Reflects 35% of your damage!',   effect:'counter'   }, reward:{ coins:450,  xp:160,  gems:3  }},
  { name:'Void Serpent',  level:11, hp:200, attack:45,  ability:{ name:'Venom Bite',     chance:0.45, desc:'Poisons you! -25 HP next 2 turns.',effect:'poison'   }, reward:{ coins:700,  xp:280,  gems:5  }},
  { name:'Shadow Hydra',  level:15, hp:280, attack:58,  ability:{ name:'Regenerate',     chance:0.35, desc:'Regenerates 40 HP!',              effect:'regen'     }, reward:{ coins:1000, xp:420,  gems:7  }},
  { name:'Dark Dragon',   level:20, hp:400, attack:80,  ability:{ name:'Dragon Breath',  chance:0.50, desc:'Breathes dark fire — MASSIVE!',  effect:'breath'    }, reward:{ coins:1800, xp:700,  gems:12 }},
  { name:'Void Overlord', level:25, hp:600, attack:110, ability:{ name:'Void Collapse',  chance:0.55, desc:'60% of your MAX HP damage!',     effect:'collapse'  }, reward:{ coins:3000, xp:1200, gems:20 }},
]

function getEnemy(floor, playerLevel = 1) {
  const baseIdx = Math.min(Math.floor(floor / 3), ENEMIES.length - 1)
  const maxIdx  = Math.min(baseIdx + Math.floor(Math.random() * 2), ENEMIES.length - 1)
  const enemy   = { ...ENEMIES[Math.random() < 0.4 ? maxIdx : baseIdx] }
  const scaling = 1 + (floor * 0.15) + (playerLevel * 0.05)
  enemy.currentHp = Math.floor(enemy.hp * scaling)
  enemy.hp        = enemy.currentHp
  enemy.attack    = Math.floor(enemy.attack * scaling)
  enemy.level     = enemy.level + floor
  enemy.ability   = { ...enemy.ability }
  return enemy
}

function applyMonsterAbility(enemy, session) {
  const ab = enemy.ability
  if (!ab || Math.random() > ab.chance) return null
  const result = { triggered: true, name: ab.name, desc: ab.desc }
  switch (ab.effect) {
    case 'dodge':      result.dodge = true; break
    case 'counter':    result.counterPct = 0.35; break
    case 'steal':      result.stealCoins = 30; break
    case 'dmgReduce':  result.playerDmgMult = 0.75; break
    case 'poison':     session.poisonTurns = 2; session.poisonDmg = 25; break
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

function statBar(pct, len = 13) {
  const filled = Math.round(Math.max(0, Math.min(1, pct)) * len)
  return '|' + '█'.repeat(filled) + '░'.repeat(len - filled) + '|'
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
  const hpBonus = cls ? cls.hpBonus : 0
  const atkBonus= cls ? cls.atkBonus : 0
  return { maxHp: 200 + hpBonus, atk: 20 + level * 3 + atkBonus, cls }
}

function getTileInfo(mapKey, row, col) {
  const map = MAPS[mapKey]
  if (!map) return { cell: '-', info: null }
  const cell = map.grid[row]?.[col] || '-'
  return { cell, info: map.legend?.[cell] || null }
}

function movePlayer(session, direction) {
  const map = MAPS[session.map]
  if (!map) return { ok: false, msg: '❌ Unknown map.' }
  let { row, col } = session
  const dirs = {
    north:[-1,0], up:[-1,0], n:[-1,0],
    south:[1,0],  down:[1,0], s:[1,0],
    west:[0,-1],  left:[0,-1], w:[0,-1],
    east:[0,1],   right:[0,1], e:[0,1],
  }
  const delta = dirs[direction?.toLowerCase()]
  if (!delta) return { ok: false, msg: '❌ Use: *.move north/south/east/west*' }

  const newRow = row + delta[0]
  const newCol = col + delta[1]
  if (newRow < 0 || newRow > 8 || newCol < 0 || newCol > 8)
    return { ok: false, msg: '⛔ Edge of the map — you can\'t go further.' }

  const cell = map.grid[newRow]?.[newCol] || '-'
  const wallTiles = ['🌲','⛰','☁']
  if (wallTiles.includes(cell)) return { ok: false, msg: `⛔ Blocked by ${cell} — can't walk through that.` }

  if (['￪','￬','❮','❯'].includes(cell)) {
    const exitMap = map.exits?.[cell]
    if (exitMap && MAPS[exitMap]) {
      const dest = MAPS[exitMap]
      session.map = exitMap
      session.row = dest.spawnRow
      session.col = dest.spawnCol
      return { ok: true, moved: true, exitTo: exitMap, exitName: dest.name, cell }
    }
    return { ok: false, msg: '⛔ That exit leads nowhere yet.' }
  }

  session.row = newRow
  session.col = newCol
  return { ok: true, moved: true, cell, row: newRow, col: newCol }
}

module.exports = {
  // ── CLASS SELECTION ────────────────────────────────────────────
  async selectclass({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const chosen = args[0]?.toLowerCase()
    if (!chosen) {
      const list = Object.entries(CLASSES).map(([key, c]) =>
        `${c.emoji} *${c.name}* (\`${key}\`)\n   ${c.desc}\n   ${c.passiveDesc}`
      ).join('\n\n')
      return reply(`🎭 *CLASS SELECTION*\n\n👤 *Player:* ${u.name||sender}\n${u.class_name?`⚔️ *Current:* ${CLASSES[u.class_name]?.name||u.class_name}\n`:''}\n━━━━━━━━━━━━━━━\n\n${list}\n\n━━━━━━━━━━━━━━━\n\n📌 *Usage:* *.selectclass <name>*\n_Choose your path in the shadows._ 🖤`)
    }
    if (!CLASSES[chosen]) return reply(`❌ Unknown class: *${chosen}*\n\nValid: ${Object.keys(CLASSES).join(', ')}`)
    const cls = CLASSES[chosen]
    await db.updateUser(sender, { class_name: chosen, skill_xp: JSON.stringify({}) })
    return reply(`🎭 *CLASS CHOSEN*\n\n${cls.emoji} You are now a *${cls.name}*!\n\n📖 ${cls.desc}\n\n✨ *Passive:* ${cls.passiveDesc}\n\n⚔️ *Class Abilities:*\n${cls.abilities.map(a=>`• \`${a}\` — ${SKILL_EVOLUTION[a]?.desc||'?'}`).join('\n')}\n\n_The shadows have acknowledged your path._ 🖤`)
  },
  async chooseclass(ctx) { return module.exports.selectclass(ctx) },
  async classselect(ctx) { return module.exports.selectclass(ctx) },

  // ── RPG PROFILE ───────────────────────────────────────────────
  async rpg({ sock, jid, msg, reply, sender, user, pushName }) {
    const u   = user || await db.getOrCreateUser(sender, pushName)
    const cls = getClassForUser(u)
    const lvl = u.level || 1
    const rpgXp    = u.rpg_xp || 0
    const xpNeeded = lvl * 1000
    const stats    = getPlayerStats(u)
    const maxHp    = stats.maxHp
    const curHp    = dungeonSessions[sender]?.playerHp ?? maxHp
    const hpPct    = Math.max(0, curHp / maxHp)
    const energyPct  = 0.4 + (lvl % 10) / 10 * 0.6
    const stealthPct = cls?.name?.includes('Assassin') ? 0.92 : cls?.name?.includes('Archer') ? 0.75 : 0.4 + Math.random() * 0.3
    const moodStr    = cls?.mood?.() || 'Neutral'
    const traitStr   = cls?.trait || 'Unknown'
    const qs = questSessions[sender]
    const questStr = qs ? `📋 ${getQuestById(qs.questId)?.name||'Active Quest'}` : '✅ Ready!'

    const profileText =
      `⚔️ 𝗥𝗣𝗚 𝗦𝗬𝗦𝗧𝗘𝗠 ⚔️\n` +
      `——————————————\n` +
      `👤 Name: ${u.name||pushName||sender}\n` +
      `🗡️ Class: ${cls?cls.name:'None — use *.selectclass*'}\n` +
      `📊 Level: ${lvl}    ⭐ XP: ${rpgXp}/${xpNeeded}\n\n` +
      `⚡ Passive Skill:\n└  ${cls?cls.passiveDesc:'Select a class to unlock'}\n\n` +
      `❤️ Health:\n└  ${Math.round(hpPct*100)}%  ${statBar(hpPct)}\n\n` +
      `⚡ Energy:\n└  ${Math.round(energyPct*100)}%  ${statBar(energyPct)}\n` +
      `🎯 Stealth:\n└  ${Math.round(stealthPct*100)}%  ${statBar(stealthPct)}\n\n` +
      `🖤 Mood: ${moodStr}\n` +
      `🏹 Trait: ${traitStr}\n` +
      `🎁 Daily Quest: ${questStr}\n\n` +
      `🎮 Commands:\n> └  .dungeon | .adventure | .quest\n> └  .selectclass | .skillinfo | .guildraid`

    try {
      const imgBuf = await fetchProfileCardImage(u, cls)
      if (imgBuf && imgBuf.length > 500) {
        await sock.sendMessage(jid, { image: imgBuf, caption: profileText }, { quoted: msg })
        return
      }
    } catch {}
    await reply(profileText)
  },

  // ── QUEST SYSTEM ──────────────────────────────────────────────
  async quest({ reply, sender, user, pushName, args }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    if (args[0] && /^\d+$/.test(args[0])) {
      const lvl = u.level || 1
      const available = getQuestsForLevel(lvl)
      if (!available.length) return reply('❌ No quests available for your level right now.')
      const idx = parseInt(args[0]) - 1
      if (idx < 0 || idx >= available.length) return reply(`❌ Invalid choice. Pick 1–${available.length}.`)
      const quest = available[idx]
      if (questSessions[sender]) {
        const curQ = getQuestById(questSessions[sender].questId)
        return reply(`⚠️ *Already on a quest!*\n\n📋 *${curQ?.name||'?'}*\n${curQ?.objective||''}\n\nProgress: ${questSessions[sender].progress}/${questSessions[sender].targetCount}\n\nUse *.myquest* to track or *.abandquest* to abandon.`)
      }
      const map = MAPS[quest.map]
      questSessions[sender] = { questId:quest.id, progress:0, targetCount:quest.targetCount||1, map:quest.map, row:quest.spawnRow??(map?.spawnRow??4), col:quest.spawnCol??(map?.spawnCol??4), startedAt:Date.now() }
      exploreSessions[sender] = { map:quest.map, row:questSessions[sender].row, col:questSessions[sender].col }
      const mapRendered = renderMap(quest.map, questSessions[sender].row, questSessions[sender].col)
      return reply(
        `✅ *QUEST ACCEPTED*\n\n${quest.emoji} *${quest.name}* ${quest.difficulty}\n📖 ${quest.desc}\n\n━━━━━━━━━━━━━━━━━\n\n` +
        `🎯 *Objective:* ${quest.objective}\n💰 *Reward:* ${quest.reward.coins.toLocaleString()} coins | ⭐ ${quest.reward.xp} XP${quest.reward.gems>0?` | 💎 ${quest.reward.gems} gems`:''}\n\n` +
        `━━━━━━━━━━━━━━━━━\n\n📍 *You spawn at: ${map?.name||quest.map}*\n\n\`\`\`\n${mapRendered}\n\`\`\`\n*(${map?.name||quest.map})*\n\n` +
        `🎮 *.move north/south/east/west* to navigate\n🗺 *.explore* to see position\n📊 *.myquest* to track`
      )
    }
    const lvl = u.level || 1
    const available = getQuestsForLevel(lvl)
    if (!available.length) return reply(`📋 *QUEST BOARD — Axel*\n\n❌ No quests for Level ${lvl}.\n\n_Level up and try again!_ 🖤`)
    const qs = questSessions[sender]
    let activeStr = ''
    if (qs) {
      const cq = getQuestById(qs.questId)
      activeStr = `⚠️ *Active Quest:* ${cq?.name||'?'}\nProgress: ${qs.progress}/${qs.targetCount} — use *.myquest*\n\n━━━━━━━━━━━━━━━━━\n\n`
    }
    const questList = available.map((q,i) =>
      `*${i+1}.* ${q.emoji} *${q.name}* ${q.difficulty}\n` +
      `   📖 ${q.desc}\n   🎯 ${q.objective}\n` +
      `   💰 ${q.reward.coins.toLocaleString()} coins | ⭐ ${q.reward.xp} XP${q.reward.gems>0?` | 💎 ${q.reward.gems} gems`:''}\n` +
      `   📍 Starts at: *${MAPS[q.map]?.name||q.map}*`
    ).join('\n\n')
    return reply(`📋 *QUEST BOARD — Axel*\n——————————————————\n👤 *${u.name||sender}*  •  📊 Level: ${lvl}\n\n${activeStr}${questList}\n\n━━━━━━━━━━━━━━━━━\n\n📌 *.quest <number>* to accept\n_Complete quests to earn rewards!_ 🖤`)
  },

  async myquest({ reply, sender, user, pushName }) {
    const u  = user || await db.getOrCreateUser(sender, pushName)
    const qs = questSessions[sender]
    if (!qs) return reply(`📋 *NO ACTIVE QUEST*\n\nUse *.quest* to pick one from the board! 🖤`)
    const quest = getQuestById(qs.questId)
    if (!quest) { delete questSessions[sender]; return reply('❌ Quest data missing. Use *.quest* to get a new one.') }
    const map = MAPS[qs.map]
    const mapRendered = renderMap(qs.map, qs.row, qs.col)
    const pct = Math.min(1, qs.progress / qs.targetCount)
    return reply(
      `📋 *ACTIVE QUEST*\n——————————————————\n${quest.emoji} *${quest.name}* ${quest.difficulty}\n\n🎯 *Objective:* ${quest.objective}\n\n` +
      `📊 *Progress:*\n└  ${qs.progress}/${qs.targetCount} ${statBar(pct,15)}\n\n` +
      `📍 *Current Location:* ${map?.name||qs.map}\n\n\`\`\`\n${mapRendered}\n\`\`\`\n*(${map?.name||qs.map})*\n\n` +
      `💰 *Reward:* ${quest.reward.coins.toLocaleString()} coins | ⭐ ${quest.reward.xp} XP${quest.reward.gems>0?` | 💎 ${quest.reward.gems} gems`:''}\n\n` +
      `🎮 *.move n/s/e/w* | *.abandquest* to abandon`
    )
  },

  async abandquest({ reply, sender }) {
    if (!questSessions[sender]) return reply('❌ No active quest to abandon.')
    const quest = getQuestById(questSessions[sender].questId)
    delete questSessions[sender]; delete exploreSessions[sender]
    return reply(`❌ *Quest Abandoned*\n\n_${quest?.name||'Quest'}_ has been abandoned.\n\nUse *.quest* to pick a new one. 🖤`)
  },

  async questclaim({ reply, sender, user, pushName }) {
    const u  = user || await db.getOrCreateUser(sender, pushName)
    const qs = questSessions[sender]
    if (!qs) return reply('❌ No active quest. Use *.quest* to get one.')
    const quest = getQuestById(qs.questId)
    if (!quest) { delete questSessions[sender]; return reply('❌ Quest data missing.') }
    if (qs.progress < qs.targetCount)
      return reply(`⚠️ *Quest not complete yet!*\n\n📊 Progress: ${qs.progress}/${qs.targetCount}\n🎯 ${quest.objective}\n\nKeep going! 🖤`)
    const r = quest.reward
    await db.updateUser(sender, { wallet:(u.wallet||0)+r.coins, gems:(u.gems||0)+(r.gems||0), rpg_xp:(u.rpg_xp||0)+r.xp })
    delete questSessions[sender]
    return reply(`🎉 *QUEST COMPLETE!*\n\n${quest.emoji} *${quest.name}*\n\n━━━━━━━━━━━━━━━━━\n\n🏆 *Rewards:*\n💰 +${r.coins.toLocaleString()} coins\n⭐ +${r.xp} XP\n${r.gems>0?`💎 +${r.gems} gems\n`:''}\n━━━━━━━━━━━━━━━━━\n\n_Well done, adventurer._ 🖤\n\nUse *.quest* for another challenge!`)
  },

  // ── MAP EXPLORATION ───────────────────────────────────────────
  async explore({ reply, sender, user, pushName, args }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    if (args[0]) {
      const mapKey = args[0].toLowerCase().replace(/ /g,'_')
      if (!MAPS[mapKey]) {
        const mapList = Object.entries(MAPS).map(([k,m])=>`• \`${k}\` — ${m.name}`).join('\n')
        return reply(`❌ Unknown map: *${args[0]}*\n\n📍 *Available Maps:*\n${mapList}`)
      }
      const map = MAPS[mapKey]
      exploreSessions[sender] = { map:mapKey, row:map.spawnRow, col:map.spawnCol }
    }
    let session = exploreSessions[sender]
    if (!session && questSessions[sender]) {
      const qs = questSessions[sender]
      session = { map:qs.map, row:qs.row, col:qs.col }
      exploreSessions[sender] = session
    }
    if (!session) { session = { map:'green_plains', row:4, col:4 }; exploreSessions[sender] = session }
    const map = MAPS[session.map]
    if (!map) { session.map='green_plains'; session.row=4; session.col=4 }
    const mapRendered = renderMap(session.map, session.row, session.col)
    const mapObj = MAPS[session.map]
    const { cell, info } = getTileInfo(session.map, session.row, session.col)
    let tileStr = ''
    if (info) {
      tileStr = `\n📌 *You're at: ${info.name}*\n_${info.desc||''}_\n`
      if (info.type==='mob'||info.type==='boss') tileStr += `\n⚔️ *${info.mob}* (Lv.${info.level||'?'}) lurks here!\nUse *.fight* to battle or *.move* to flee.\n`
      if (info.type==='loot') tileStr += `\n💰 Use *.loot* to collect!\n`
    } else if (['￪','￬','❮','❯'].includes(cell)) {
      const exitDest = mapObj?.exits?.[cell]
      tileStr = `\n🚪 *Exit → ${exitDest?MAPS[exitDest]?.name||exitDest:'?'}*\n`
    }
    const exits = mapObj?.exits || {}
    const exitLines = Object.entries(exits).map(([arrow,dest])=>{
      const dir = {'￪':'↑ North','￬':'↓ South','❮':'← West','❯':'→ East'}[arrow]||arrow
      return `${dir}: ${MAPS[dest]?.name||dest}`
    }).join('\n')
    if (questSessions[sender]) { questSessions[sender].row=session.row; questSessions[sender].col=session.col; questSessions[sender].map=session.map }
    return reply(`🗺 *${mapObj?.name||session.map}*\n_${mapObj?.desc||''}_\n\n\`\`\`\n${mapRendered}\n\`\`\`\n*(${mapObj?.name||session.map})*\n${tileStr}\n🚪 *Exits:*\n${exitLines||'None'}\n\n📍 Row ${session.row+1}, Col ${session.col+1}\n\n🎮 *.move north/south/east/west*`)
  },

  async move({ reply, sender, user, pushName, args }) {
    await db.getOrCreateUser(sender, pushName).catch(()=>{})
    const direction = args[0]?.toLowerCase()
    if (!direction) return reply(`🧭 *MOVEMENT*\n\nUsage: *.move <direction>*\n• *.move north/south/east/west*\n• *.move n/s/e/w*\n\nUse *.explore* to see your map.`)
    let session = exploreSessions[sender]
    if (!session && questSessions[sender]) { const qs=questSessions[sender]; session={map:qs.map,row:qs.row,col:qs.col}; exploreSessions[sender]=session }
    if (!session) { session={map:'green_plains',row:4,col:4}; exploreSessions[sender]=session }
    const result = movePlayer(session, direction)
    if (!result.ok) return reply(result.msg)
    if (questSessions[sender]) { questSessions[sender].row=session.row; questSessions[sender].col=session.col; questSessions[sender].map=session.map }
    const mapObj = MAPS[session.map]
    const mapRendered = renderMap(session.map, session.row, session.col)
    if (result.exitTo) return reply(`🚪 *Entering ${result.exitName}!*\n\n\`\`\`\n${mapRendered}\n\`\`\`\n*(${result.exitName})*\n\n_${mapObj?.desc||''}_\n\n🎮 *.move n/s/e/w* | *.explore*`)
    const { cell, info } = getTileInfo(session.map, session.row, session.col)
    let eventStr = ''
    if (info?.type==='mob'||info?.type==='boss') {
      eventStr = `\n⚔️ *${info.name}!*\n_A ${info.mob} (Lv.${info.level}) lurks here!_\nUse *.fight* to battle! 💀\n`
      const qs = questSessions[sender]
      if (qs && qs.map===session.map) {
        const quest = getQuestById(qs.questId)
        if (quest?.targetTile && cell===quest.targetTile) {
          qs.progress = Math.min(qs.targetCount, qs.progress+1)
          eventStr += `\n✅ *Quest: ${qs.progress}/${qs.targetCount}*\n`
          if (qs.progress>=qs.targetCount) eventStr += `🎉 *Complete! Use *.questclaim*!*\n`
        }
      }
    } else if (info?.type==='loot') eventStr = `\n💰 *${info.name}!*\n${info.desc||''}\nUse *.loot* to collect!\n`
    else if (info?.type==='location') eventStr = `\n📍 *${info.name}*\n${info.desc||''}\n`
    else if (info?.type==='scenery') eventStr = `\n🌿 *${info.name}*\n_${info.desc||''}_\n`
    else if (['￪','￬','❮','❯'].includes(cell)) {
      const exitDest = mapObj?.exits?.[cell]
      eventStr = `\n🚪 *Exit → ${exitDest?MAPS[exitDest]?.name||exitDest:'?'}* — move again to enter!\n`
    }
    return reply(`✅ *Moved ${direction}*\n\n\`\`\`\n${mapRendered}\n\`\`\`\n*(${mapObj?.name||session.map})*\n${eventStr}\n📍 Row ${session.row+1}, Col ${session.col+1}\n🎮 *.move n/s/e/w* | *.explore* | *.myquest*`)
  },

  async loot({ reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    const session = exploreSessions[sender]
    if (!session) return reply('❌ Explore a map first. Use *.explore*')
    const { cell, info } = getTileInfo(session.map, session.row, session.col)
    if (!info||info.type!=='loot') return reply(`❌ Nothing to loot here. Find a loot tile on the map!`)
    const loot = info.loot||{}
    const coins = loot.coins||0; const gems = loot.gems||0
    await db.updateUser(sender, { wallet:(u.wallet||0)+coins, gems:(u.gems||0)+gems })
    let lootLines = ''
    if (coins) lootLines += `💰 +${coins.toLocaleString()} coins\n`
    if (gems)  lootLines += `💎 +${gems} gems\n`
    const qs = questSessions[sender]
    let questStr = ''
    if (qs) {
      const quest = getQuestById(qs.questId)
      if (quest?.targetTile && cell===quest.targetTile) {
        qs.progress = Math.min(qs.targetCount, qs.progress+1)
        questStr = `\n✅ *Quest progress: ${qs.progress}/${qs.targetCount}*\n`
        if (qs.progress>=qs.targetCount) questStr += `🎉 *Objective complete! Use *.questclaim**\n`
      }
    }
    return reply(`💰 *LOOT COLLECTED*\n\n📦 *${info.name}*\n${info.desc||''}\n\n${lootLines||'Nothing valuable.'}\n${questStr}_The treasure is yours._ 🖤`)
  },

  async worldmap({ reply }) {
    const mapList = Object.entries(MAPS).map(([key,m])=>`${m.emoji} *${m.name}*\n   _${m.desc.slice(0,70)}_\n   \`Key: ${key}\``).join('\n\n')
    return reply(`🗺 *WORLD MAP — Town: Axel*\n——————————————————\n\n${mapList}\n\n━━━━━━━━━━━━━━━━━\n\n📌 *.explore <map>* to jump to a map\n🧭 *.move n/s/e/w* to navigate\n📋 *.quest* for quests\n\n_The world of Axel awaits._ 🖤`)
  },

  // ── SKILL INFO ────────────────────────────────────────────────
  async skillinfo({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (!cls) return reply(`❌ Pick a class first with *.selectclass*`)
    let skillXp = {}; try { skillXp = JSON.parse(u.skill_xp||'{}') } catch {}
    const lines = cls.abilities.map(skillKey => {
      const sk = SKILL_EVOLUTION[skillKey]; if (!sk) return `• ${skillKey}`
      const uses = skillXp[skillKey]||0
      const evolveLine = sk.evolvesAt ? `(evolves at ${sk.evolvesAt} uses — ${Math.max(0,sk.evolvesAt-uses)} left)` : sk.tier>1?`(MAX tier)`:``
      return `• *${skillKey}* Tier ${sk.tier} — Used: ${uses}x ${evolveLine}\n  ${sk.desc}`
    }).join('\n\n')
    await reply(`📖 *SKILL INFO*\n\n${cls.emoji} *${cls.name}*\n\n${lines}\n\n_Level your skills through use._ 🖤`)
  },

  // ── DUNGEON ───────────────────────────────────────────────────
  async dungeon({ sock, jid, msg, reply, sender, user }) {
    if (dungeonSessions[sender]) {
      const s = dungeonSessions[sender]; const cls = getClassForUser(user)
      const abilityList = cls ? cls.abilities.map(a=>`• *.${a}*`).join('\n') : `*.attack* | *.heavy* | *.defend* | *.special* | *.heal* | *.flee*`
      return reply(`🏰 *DUNGEON IN PROGRESS*\n\nFloor: ${s.floor}\nHP: ${s.playerHp}/${s.playerMaxHp}\n\n${cls?`${cls.emoji} *${cls.name}*:\n${abilityList}\n\n`:''}_.attack .heavy .defend .special .heal .flee_ 🖤`)
    }
    const cdRemaining = await db.getCooldown(sender, 'dungeon')
    if (cdRemaining > 0) { const mins=Math.floor(cdRemaining/60000),secs=Math.floor((cdRemaining%60000)/1000); return reply(`⏳ *DUNGEON COOLDOWN*\n\n🕒 Wait: ${mins}m ${secs}s\n\n_The dungeon needs time to reset._ 🖤`) }
    const u = user || await db.getOrCreateUser(sender)
    const stats = getPlayerStats(u); const floor = 1; const enemy = getEnemy(floor, u.level||1)
    dungeonSessions[sender] = { floor, enemy, playerHp:stats.maxHp, playerMaxHp:stats.maxHp, playerAtk:stats.atk, defending:false, poisonTurns:0, poisonDmg:0, smokeDodge:false, shieldWallTurns:0, firstStrike:stats.cls?.firstStrike||false, firstHitDone:false }
    const cls = stats.cls; const intro = ENEMY_INTROS[Math.floor(Math.random()*ENEMY_INTROS.length)]; const zone = getZoneDesc(floor)
    const battleText = `🏰 *SHADOW DUNGEON — FLOOR ${floor}*\n${zone}\n\n👤 *${u.name||sender}*  •  📊 Lv.${u.level||1}${cls?`  •  ${cls.emoji} ${cls.name}`:''}\n\n━━━━━━━━━━━━━━━━━━━\n\n💀 *${enemy.name}* (Lv.${enemy.level}) ${intro}\n⚡ Ability: *${enemy.ability.name}* — _${enemy.ability.desc}_\n\n━━━━━━━━━━━━━━━━━━━\n\n⚔️  YOU        ${hpBar(stats.maxHp,stats.maxHp)}  ${stats.maxHp}/${stats.maxHp}\n👾 ${enemy.name.padEnd(10)} ${hpBar(enemy.hp,enemy.hp)}  ${enemy.hp}/${enemy.hp}\n\n━━━━━━━━━━━━━━━━━━━\n\n${cls?`${cls.emoji} *Class Moves:*\n${cls.abilities.map(a=>`• *.${a}*`).join('  ')}\n\n`:''}📖 *Basic:*  *.attack*  *.heavy*  *.defend*  *.special*  *.heal*  *.flee*\n\n━━━━━━━━━━━━━━━━━━━\n_The darkness watches. Choose wisely._ 🖤`
    try { const imgBuffer = await fetchDungeonImage(enemy, floor); if (imgBuffer&&imgBuffer.length>500) { await sock.sendMessage(jid,{image:imgBuffer,caption:battleText},{quoted:msg}); return } } catch {}
    await reply(battleText)
  },

  async attack({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]; if (!s) return reply('❌ No dungeon active. Use *.dungeon*')
    const u = user || await db.getOrCreateUser(sender); const cls = getClassForUser(u)
    let myDmg = Math.floor(s.playerAtk*(0.8+Math.random()*0.4))
    if (cls?.passive) myDmg = Math.floor(myDmg*cls.passive(s))
    if (s.firstStrike&&!s.firstHitDone) { myDmg=Math.floor(myDmg*1.5); s.firstHitDone=true }
    const abilityResult = applyMonsterAbility(s.enemy, s)
    let abilityText = ''
    if (abilityResult?.triggered) {
      if (abilityResult.dodge) { abilityText=`\n⚡ *${s.enemy.ability.name}*: Your attack missed!\n`; myDmg=0 }
      else if (abilityResult.playerDmgMult) { myDmg=Math.floor(myDmg*abilityResult.playerDmgMult); abilityText=`\n⚡ *${s.enemy.ability.name}*: ${s.enemy.ability.desc}\n` }
      else if (abilityResult.counterPct) abilityText=`\n⚡ *${s.enemy.ability.name}*: Counter! Take ${Math.floor(myDmg*abilityResult.counterPct)} reflected!\n`
      else abilityText=`\n⚡ *${s.enemy.ability.name}*: ${abilityResult.desc||s.enemy.ability.desc}\n`
    }
    s.enemy.currentHp = Math.max(0, s.enemy.currentHp-myDmg)
    let enemyDmg = s.defending?Math.floor(s.enemy.attack*0.5):Math.floor(s.enemy.attack*(0.8+Math.random()*0.4))
    if (cls?.dmgReduction) enemyDmg=Math.floor(enemyDmg*(1-cls.dmgReduction))
    if (s.shieldWallTurns>0) { enemyDmg=Math.floor(enemyDmg*0.4); s.shieldWallTurns-- }
    if (abilityResult?.counterPct) enemyDmg+=Math.floor(myDmg*abilityResult.counterPct)
    if (abilityResult?.extraDmg) enemyDmg+=abilityResult.extraDmg
    if (abilityResult?.collapseDmgPct) enemyDmg+=Math.floor(s.playerMaxHp*abilityResult.collapseDmgPct)
    if (abilityResult?.stealCoins) { await db.updateUser(sender,{wallet:Math.max(0,(u.wallet||0)-abilityResult.stealCoins)}); abilityText+=` (Lost ${abilityResult.stealCoins} coins!)` }
    s.defending=false
    if (cls?.lifeDrain&&myDmg>0) s.playerHp=Math.min(s.playerMaxHp,s.playerHp+Math.floor(myDmg*0.10))
    let poisonText=''
    if (s.poisonTurns>0) { s.playerHp=Math.max(0,s.playerHp-s.poisonDmg); poisonText=`\n☠️ Poison: -${s.poisonDmg} HP (${s.poisonTurns} turns left)`; s.poisonTurns-- }
    s.playerHp=Math.max(0,s.playerHp-enemyDmg)
    if (s.enemy.currentHp<=0) return await module.exports._dungeonWin(sock,jid,reply,sender,s,u)
    if (s.playerHp<=0) return await module.exports._dungeonLoss(reply,sender,s)
    const txt = `⚔️ *ATTACK!*\n\n💥 Hit *${s.enemy.name}* for *${myDmg} damage*!\n${abilityText}👾 *${s.enemy.name}* hits for *${enemyDmg} damage*!\n${poisonText}\n\n━━━━━━━━━━━━━━━━━━━\n\n⚔️  YOU        ${hpBar(s.playerHp,s.playerMaxHp)}  ${s.playerHp}/${s.playerMaxHp}\n👾 ${s.enemy.name.padEnd(10)} ${hpBar(s.enemy.currentHp,s.enemy.hp)}  ${s.enemy.currentHp}/${s.enemy.hp}\n\n_Choose your next move._ 🖤`
    try { const img=await fetchActionImage('attack',s.enemy.name); await sendImgOrReply(sock,jid,img,txt,reply) } catch { await reply(txt) }
  },

  async _classSkill({ sock, jid, reply, sender, user, skillName }) {
    const s = dungeonSessions[sender]; if (!s) return reply('❌ No dungeon active. Use *.dungeon*')
    const u = user || await db.getOrCreateUser(sender); const cls = getClassForUser(u)
    if (!cls||!cls.abilities.includes(skillName)) return reply(`❌ Your class doesn't have *${skillName}*. See *.skillinfo*`)
    const sk = SKILL_EVOLUTION[skillName]; if (!sk) return reply('❌ Unknown skill.')
    let skillXp={}; try { skillXp=JSON.parse(u.skill_xp||'{}') } catch {}
    skillXp[skillName]=(skillXp[skillName]||0)+1
    let evolvedSkill=null
    if (sk.evolvesAt&&skillXp[skillName]>=sk.evolvesAt&&sk.evolvesTo) {
      if (!cls.abilities.includes(sk.evolvesTo)) { const idx=cls.abilities.indexOf(skillName); if (idx!==-1) cls.abilities[idx]=sk.evolvesTo; evolvedSkill=sk.evolvesTo }
    }
    await db.updateUser(sender,{skill_xp:JSON.stringify(skillXp)})
    let myDmg=0, skillText='', skipEnemyTurn=false
    switch(skillName) {
      case 'ironwall': case 'shieldwall':
        s.shieldWallTurns=2; skipEnemyTurn=true
        skillText=`🛡️ *${skillName==='ironwall'?'Iron Wall':'Shield Wall'}!*\nBrace! -60% damage for 2 turns.\n`; break
      case 'smokebomb': s.smokeDodge=true; skipEnemyTurn=true; skillText=`💨 *Smoke Bomb!*\n70% chance to dodge next hit!\n`; break
      case 'berserk':
        s.playerAtk=Math.floor(s.playerAtk*1.5); myDmg=Math.floor(s.playerAtk*(1.0+Math.random()*0.5))
        s.enemy.currentHp=Math.max(0,s.enemy.currentHp-myDmg); skillText=`🔥 *BERSERK!*\nRage! +50% ATK! Dealt *${myDmg} damage*!\n`; break
      case 'taunt': skipEnemyTurn=true; skillText=`📣 *TAUNT!*\nDrew their attention — they skip their ability!\n`; break
      case 'deathblow':
        if (s.enemy.currentHp/s.enemy.hp<0.20) { myDmg=Math.floor(s.playerAtk*(sk.multiplier||5)); s.enemy.currentHp=0; skillText=`💀 *DEATHBLOW!*\n*${myDmg} MASSIVE damage!* Enemy destroyed!\n` }
        else { myDmg=Math.floor(s.playerAtk*1.2); s.enemy.currentHp=Math.max(0,s.enemy.currentHp-myDmg); skillText=`💀 *Death Blow* — enemy not weak enough yet. *${myDmg} damage*\n` }
        break
      default:
        myDmg=Math.floor(s.playerAtk*(sk.multiplier||1.5)*(0.9+Math.random()*0.2))
        if (cls?.passive) myDmg=Math.floor(myDmg*cls.passive(s))
        if (s.firstStrike&&!s.firstHitDone) { myDmg=Math.floor(myDmg*1.5); s.firstHitDone=true }
        s.enemy.currentHp=Math.max(0,s.enemy.currentHp-myDmg)
        skillText=`✨ *${skillName.toUpperCase()}!*\nPowerful strike! *${myDmg} damage*!\n`
        if (skillName==='lifedrain'&&myDmg>0) { const drain=Math.floor(myDmg*0.5); s.playerHp=Math.min(s.playerMaxHp,s.playerHp+drain); skillText+=`🩸 Life Drain: +${drain} HP!\n` }
        if (skillName==='poisonarrow') { s.poisonTurns=3; s.poisonDmg=30; skillText+=`☠️ Enemy poisoned!\n` }
        if (skillName==='shadowstrike') { const extraDmg=Math.floor(s.playerAtk*0.7*2); s.enemy.currentHp=Math.max(0,s.enemy.currentHp-extraDmg); skillText=`⚡ *SHADOW STRIKE — 3 hits!*\nTotal: *${myDmg+extraDmg} damage*!\n` }
    }
    if (s.enemy.currentHp<=0) return await module.exports._dungeonWin(sock,jid,reply,sender,s,u)
    let enemyDmg=0, abilityText=''
    if (!skipEnemyTurn) {
      const abilityResult=applyMonsterAbility(s.enemy,s)
      if (abilityResult?.triggered) abilityText=`⚡ *${s.enemy.ability.name}*: ${abilityResult.desc||s.enemy.ability.desc}\n`
      enemyDmg=Math.floor(s.enemy.attack*(0.8+Math.random()*0.4))
      if (cls?.dmgReduction) enemyDmg=Math.floor(enemyDmg*(1-cls.dmgReduction))
      if (s.shieldWallTurns>0) { enemyDmg=Math.floor(enemyDmg*0.4); s.shieldWallTurns-- }
      if (s.smokeDodge&&Math.random()<0.70) { enemyDmg=0; s.smokeDodge=false; abilityText+=`💨 *Smoke Bomb evaded!*\n` } else s.smokeDodge=false
      s.playerHp=Math.max(0,s.playerHp-enemyDmg)
    }
    let poisonText=''
    if (s.poisonTurns>0) { s.playerHp=Math.max(0,s.playerHp-s.poisonDmg); poisonText=`☠️ Poison: -${s.poisonDmg} HP (${s.poisonTurns} turns left)\n`; s.poisonTurns-- }
    if (s.playerHp<=0) return await module.exports._dungeonLoss(reply,sender,s)
    const evolveText = evolvedSkill?`\n🌟 *SKILL EVOLVED!* ${skillName} → *${evolvedSkill}*!\n`:''
    const txt=`${skillText}${skipEnemyTurn?'':abilityText+`👾 *${s.enemy.name}* attacks for *${enemyDmg} damage*!\n`}${poisonText}${evolveText}\n━━━━━━━━━━━━━━━━━━━\n\n⚔️  YOU        ${hpBar(s.playerHp,s.playerMaxHp)}  ${s.playerHp}/${s.playerMaxHp}\n👾 ${s.enemy.name.padEnd(10)} ${hpBar(s.enemy.currentHp,s.enemy.hp)}  ${s.enemy.currentHp}/${s.enemy.hp}\n\n_Keep fighting._ 🖤`
    try { const img=await fetchActionImage(skillName,s.enemy.name); await sendImgOrReply(sock,jid,img,txt,reply) } catch { await reply(txt) }
  },

  async slash(ctx)       { return module.exports._classSkill({...ctx,skillName:'slash'       }) },
  async darkslash(ctx)   { return module.exports._classSkill({...ctx,skillName:'darkslash'   }) },
  async voidrend(ctx)    { return module.exports._classSkill({...ctx,skillName:'voidrend'    }) },
  async darknova(ctx)    { return module.exports._classSkill({...ctx,skillName:'darknova'    }) },
  async voidcascade(ctx) { return module.exports._classSkill({...ctx,skillName:'voidcascade' }) },
  async shadowshot(ctx)  { return module.exports._classSkill({...ctx,skillName:'shadowshot'  }) },
  async voidpiercer(ctx) { return module.exports._classSkill({...ctx,skillName:'voidpiercer' }) },
  async backstab(ctx)    { return module.exports._classSkill({...ctx,skillName:'backstab'    }) },
  async deathmark(ctx)   { return module.exports._classSkill({...ctx,skillName:'deathmark'   }) },
  async berserk(ctx)     { return module.exports._classSkill({...ctx,skillName:'berserk'     }) },
  async ironwall(ctx)    { return module.exports._classSkill({...ctx,skillName:'ironwall'     }) },
  async lifedrain(ctx)   { return module.exports._classSkill({...ctx,skillName:'lifedrain'   }) },
  async voidbolt(ctx)    { return module.exports._classSkill({...ctx,skillName:'voidbolt'    }) },
  async poisonarrow(ctx) { return module.exports._classSkill({...ctx,skillName:'poisonarrow' }) },
  async pierce(ctx)      { return module.exports._classSkill({...ctx,skillName:'pierce'      }) },
  async smokebomb(ctx)   { return module.exports._classSkill({...ctx,skillName:'smokebomb'   }) },
  async shadowstrike(ctx){ return module.exports._classSkill({...ctx,skillName:'shadowstrike'}) },
  async shieldwall(ctx)  { return module.exports._classSkill({...ctx,skillName:'shieldwall'  }) },
  async taunt(ctx)       { return module.exports._classSkill({...ctx,skillName:'taunt'       }) },
  async deathblow(ctx)   { return module.exports._classSkill({...ctx,skillName:'deathblow'   }) },

  async heavy({ sock, jid, reply, sender, user }) {
    const s=dungeonSessions[sender]; if (!s) return reply('❌ No dungeon active.')
    const u=user||await db.getOrCreateUser(sender)
    const myDmg=Math.floor(s.playerAtk*(1.4+Math.random()*0.4)); s.enemy.currentHp=Math.max(0,s.enemy.currentHp-myDmg)
    const enemyDmg=Math.floor(s.enemy.attack*(1.1+Math.random()*0.3)); s.playerHp=Math.max(0,s.playerHp-enemyDmg)
    if (s.enemy.currentHp<=0) return await module.exports._dungeonWin(sock,jid,reply,sender,s,u)
    if (s.playerHp<=0) return await module.exports._dungeonLoss(reply,sender,s)
    const txt=`💥 *HEAVY ATTACK!*\n\n+${myDmg} dmg! You take ${enemyDmg} (reckless).\n\n⚔️ YOU  ${hpBar(s.playerHp,s.playerMaxHp)} ${s.playerHp}/${s.playerMaxHp}\n👾 ${s.enemy.name} ${hpBar(s.enemy.currentHp,s.enemy.hp)} ${s.enemy.currentHp}/${s.enemy.hp}`
    try { const img=await fetchActionImage('heavy',s.enemy.name); await sendImgOrReply(sock,jid,img,txt,reply) } catch { await reply(txt) }
  },

  async defend({ reply, sender }) {
    const s=dungeonSessions[sender]; if (!s) return reply('❌ No dungeon active.')
    s.defending=true; await reply(`🛡️ *DEFENDING!*\n\nNext enemy hit is halved!\n\n_Hold your ground._ 🖤`)
  },

  async special({ sock, jid, reply, sender, user }) {
    const s=dungeonSessions[sender]; if (!s) return reply('❌ No dungeon active.')
    const u=user||await db.getOrCreateUser(sender); const cls=getClassForUser(u)
    if (cls) return module.exports._classSkill({sock,jid,reply,sender,user:u,skillName:cls.abilities[0]})
    const myDmg=Math.floor(s.playerAtk*(1.8+Math.random()*0.5)); s.enemy.currentHp=Math.max(0,s.enemy.currentHp-myDmg)
    const enemyDmg=Math.floor(s.enemy.attack*(0.7+Math.random()*0.3)); s.playerHp=Math.max(0,s.playerHp-enemyDmg)
    if (s.enemy.currentHp<=0) return await module.exports._dungeonWin(sock,jid,reply,sender,s,u)
    if (s.playerHp<=0) return await module.exports._dungeonLoss(reply,sender,s)
    const txt=`🌟 *SPECIAL ATTACK!*\n\n+${myDmg} shadow burst! Enemy strikes for ${enemyDmg}.\n\n⚔️ YOU  ${hpBar(s.playerHp,s.playerMaxHp)} ${s.playerHp}/${s.playerMaxHp}\n👾 ${s.enemy.name} ${hpBar(s.enemy.currentHp,s.enemy.hp)} ${s.enemy.currentHp}/${s.enemy.hp}`
    try { const img=await fetchActionImage('special',s.enemy.name); await sendImgOrReply(sock,jid,img,txt,reply) } catch { await reply(txt) }
  },

  async heal({ reply, sender, user }) {
    const s=dungeonSessions[sender]; if (!s) return reply('❌ No dungeon active.')
    const u=user||await db.getOrCreateUser(sender); const potionCost=150
    if ((u.wallet||0)<potionCost) return reply(`❌ Need ${potionCost} coins for a potion.`)
    const healAmt=Math.floor(s.playerMaxHp*0.3); s.playerHp=Math.min(s.playerMaxHp,s.playerHp+healAmt)
    await db.updateUser(sender,{wallet:(u.wallet||0)-potionCost})
    await reply(`🧪 *POTION USED!*\n\n+${healAmt} HP! 💰 -${potionCost} coins\n\n⚔️ YOU  ${hpBar(s.playerHp,s.playerMaxHp)} ${s.playerHp}/${s.playerMaxHp}\n\n_Stay alive._ 🖤`)
  },

  async flee({ reply, sender }) {
    const s=dungeonSessions[sender]; if (!s) return reply('❌ No dungeon active.')
    if (Math.random()<0.4) return reply(`😤 *Can't escape!*\n\n${s.enemy.name} blocks you!\nHP: ${s.playerHp}/${s.playerMaxHp}`)
    delete dungeonSessions[sender]; await reply(`🏃 *FLED from Floor ${s.floor}!*\n\n_The shadows let you go... this time._ 🖤\n\nUse *.dungeon* to try again.`)
  },

  async _dungeonWin(sock, jid, reply, sender, session, user) {
    sock, jid
    const damageTaken = session.playerMaxHp-session.playerHp; const clearedFloor=session.floor; const nextFloor=session.floor+1; const reward=session.enemy.reward
    const milestone = clearedFloor%5===0
    if (milestone) { reward.coins=Math.floor(reward.coins*2); reward.gems=Math.floor(reward.gems*2)+1; reward.xp=Math.floor(reward.xp*1.5) }
    const newRpgXp=(user.rpg_xp||0)+reward.xp; const xpNeeded=(user.level||1)*1000; const levelUp=newRpgXp>=xpNeeded; const newLevel=levelUp?(user.level||1)+1:(user.level||1); const newXp=levelUp?newRpgXp-xpNeeded:newRpgXp
    await db.updateUser(sender,{rpg_wallet:(user.rpg_wallet||0)+reward.coins,gems:(user.gems||0)+reward.gems,rpg_xp:newXp,level:newLevel})
    session.floor=nextFloor; session.enemy=getEnemy(nextFloor,newLevel); session.enemy.currentHp=session.enemy.hp; session.defending=false; session.poisonTurns=0
    await db.setCooldown(sender,'dungeon',10*60)
    const hpPct=session.playerHp/session.playerMaxHp; const hpStatus=hpPct>0.7?'💪 Barely scratched!':hpPct>0.4?'😤 Bloodied but standing.':'😰 Barely alive…'
    const nextZone=getZoneDesc(nextFloor); const nextIntro=ENEMY_INTROS[Math.floor(Math.random()*ENEMY_INTROS.length)]
    const winText=`✅ *FLOOR ${clearedFloor} CLEARED!*${milestone?'  👑 *MILESTONE BONUS!*':''}\n\n━━━━━━━━━━━━━━━━━━━\n👤 *${user.name||sender}*\n❤️  HP: ${session.playerHp}/${session.playerMaxHp}  ${hpStatus}\n💔 Damage taken: ${damageTaken}\n━━━━━━━━━━━━━━━━━━━\n\n🎁 *LOOT COLLECTED*\n   💰  +$${reward.coins.toLocaleString()}\n   💎  +${reward.gems} gems\n   ⭐  +${reward.xp} XP\n${milestone?'   👑  *MILESTONE BONUS — double loot!*\n':''}${levelUp?`\n🎉 *LEVEL UP!*  →  Level *${newLevel}*!\n`:''}\n━━━━━━━━━━━━━━━━━━━\n🚪 *Descending to Floor ${nextFloor}…*\n${nextZone}\n\n👾 *${session.enemy.name}* (Lv.${session.enemy.level}) ${nextIntro}\n⚡ Ability: *${session.enemy.ability.name}*\n\n⚔️  YOU        ${hpBar(session.playerHp,session.playerMaxHp)}  ${session.playerHp}/${session.playerMaxHp}\n👾 ${session.enemy.name.padEnd(10)} ${hpBar(session.enemy.hp,session.enemy.hp)}  ${session.enemy.hp}/${session.enemy.hp}\n\n_The shadows grow thicker with every step._ 🖤`
    await reply(winText)
    try { const monsterImg=await fetchMonsterImage(session.enemy.name); if (monsterImg&&monsterImg.length>500&&sock&&jid) await sock.sendMessage(jid,{image:monsterImg,caption:`👾 *${session.enemy.name}* appears on Floor ${nextFloor}!\n⚡ *${session.enemy.ability.name}* — _${session.enemy.ability.desc}_\n\n_Choose your move wisely._ 🖤`}) } catch {}
  },

  async pheal({ reply }) { await reply(`💊 Use *#pheal* (with # prefix) to heal your Pokémon party.`) },

  async _dungeonLoss(reply, sender, session) {
    const floor=session.floor; delete dungeonSessions[sender]
    const deathLines=['_The dungeon claims another soul… for now._','_The shadows swallow you whole._','_Darkness wins this round. It always does._','_Your flame goes out. The dungeon forgets you._']
    const line=deathLines[Math.floor(Math.random()*deathLines.length)]
    await reply(`💀 *DEFEATED ON FLOOR ${floor}*\n\n👾 *${session.enemy.name}* overwhelmed you!\n\n━━━━━━━━━━━━━━━━━━━\n❤️  HP:    0 / ${session.playerMaxHp}\n📍 Floor: ${floor}\n━━━━━━━━━━━━━━━━━━━\n\n${line} 🖤\n\n_Use *.dungeon* to enter again._`)
  },

  questSessions,
  exploreSessions,
}
