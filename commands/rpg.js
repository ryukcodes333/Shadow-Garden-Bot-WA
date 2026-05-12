const db = require('../database')
const http = require('http')
const https = require('https')

const dungeonSessions = {}

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
  shieldwall:  'anime knight massive shield wall raise defensive stance dark fantasy dramatic',
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

// ────────────────────────────────────────────────────────────────
// CLASS DEFINITIONS — each has unique stats and abilities
// ────────────────────────────────────────────────────────────────
const CLASSES = {
  warrior: {
    name: 'Shadow Warrior',
    emoji: '⚔️',
    desc: 'Tank fighter with high HP and steady damage.',
    hpBonus: 80,
    atkBonus: 5,
    passiveDesc: '🔥 Berserker Rage: +30% attack when HP < 30%',
    abilities: ['slash', 'berserk', 'ironwall'],
    passive: (s) => s.playerHp / s.playerMaxHp < 0.3 ? 1.3 : 1.0,
  },
  mage: {
    name: 'Dark Mage',
    emoji: '🔮',
    desc: 'Glass cannon with devastating spells and life drain.',
    hpBonus: 0,
    atkBonus: 20,
    passiveDesc: '🌑 Life Drain: heal 10% of all damage dealt',
    abilities: ['darknova', 'lifedrain', 'voidbolt'],
    passive: null,
    lifeDrain: true,
  },
  archer: {
    name: 'Void Archer',
    emoji: '🏹',
    desc: 'Swift striker with high crit chance and poison.',
    hpBonus: 20,
    atkBonus: 12,
    passiveDesc: '💚 Poison Arrow: enemies take 15 extra damage per turn',
    abilities: ['shadowshot', 'poisonarrow', 'pierce'],
    passive: null,
    poisonDmg: 15,
  },
  assassin: {
    name: 'Night Assassin',
    emoji: '🗡️',
    desc: 'Highest burst damage, first strike bonus, smoke dodge.',
    hpBonus: -10,
    atkBonus: 18,
    passiveDesc: '⚡ Backstab: +50% damage on first hit of every dungeon',
    abilities: ['backstab', 'smokebomb', 'shadowstrike'],
    passive: null,
    firstStrike: true,
  },
  knight: {
    name: 'Shadow Knight',
    emoji: '🛡️',
    desc: 'Ultimate tank with heavy block and taunt.',
    hpBonus: 120,
    atkBonus: 0,
    passiveDesc: '🛡️ Shield Wall: automatically block 20% all incoming damage',
    abilities: ['shieldwall', 'taunt', 'deathblow'],
    passive: null,
    dmgReduction: 0.2,
  },
}

// ────────────────────────────────────────────────────────────────
// SKILL EVOLUTION SYSTEM
// ────────────────────────────────────────────────────────────────
const SKILL_EVOLUTION = {
  // format: skillName → { uses: requiredUses, evolvesTo: nextSkillName, desc, multiplier }
  slash: {
    tier: 1, desc: 'Basic sword swing', multiplier: 1.5, uses: 0,
    evolvesAt: 10, evolvesTo: 'darkslash',
  },
  darkslash: {
    tier: 2, desc: 'Dark-infused slash', multiplier: 2.2, uses: 0,
    evolvesAt: 25, evolvesTo: 'voidrend',
  },
  voidrend: {
    tier: 3, desc: 'Tears reality itself', multiplier: 3.5, uses: 0,
    evolvesAt: null, evolvesTo: null,
  },
  darknova: {
    tier: 1, desc: 'Dark magic explosion', multiplier: 2.0, uses: 0,
    evolvesAt: 10, evolvesTo: 'voidcascade',
  },
  voidcascade: {
    tier: 2, desc: 'Cascading void energy', multiplier: 3.2, uses: 0,
    evolvesAt: null, evolvesTo: null,
  },
  shadowshot: {
    tier: 1, desc: 'Shadow-piercing arrow', multiplier: 1.8, uses: 0,
    evolvesAt: 10, evolvesTo: 'voidpiercer',
  },
  voidpiercer: {
    tier: 2, desc: 'Pierces through void', multiplier: 2.8, uses: 0,
    evolvesAt: null, evolvesTo: null,
  },
  backstab: {
    tier: 1, desc: 'Surprise attack from the dark', multiplier: 2.5, uses: 0,
    evolvesAt: 15, evolvesTo: 'deathmark',
  },
  deathmark: {
    tier: 2, desc: 'Mark of death — one-shot potential', multiplier: 4.0, uses: 0,
    evolvesAt: null, evolvesTo: null,
  },
  // Non-evolving skills:
  berserk:      { tier: 1, desc: 'Rage mode: +50% atk, skip defence', multiplier: 2.0, evolvesAt: null, evolvesTo: null },
  ironwall:     { tier: 1, desc: 'Block 80% next attack', multiplier: 0, evolvesAt: null, evolvesTo: null },
  lifedrain:    { tier: 1, desc: 'Drain 50% dmg as HP', multiplier: 1.6, evolvesAt: null, evolvesTo: null },
  voidbolt:     { tier: 1, desc: 'Instant void bolt', multiplier: 1.9, evolvesAt: null, evolvesTo: null },
  poisonarrow:  { tier: 1, desc: 'Apply 30 poison stack', multiplier: 1.2, evolvesAt: null, evolvesTo: null },
  pierce:       { tier: 1, desc: 'Ignore 50% defence', multiplier: 1.7, evolvesAt: null, evolvesTo: null },
  smokebomb:    { tier: 1, desc: '70% chance dodge next hit', multiplier: 0, evolvesAt: null, evolvesTo: null },
  shadowstrike: { tier: 1, desc: 'Swift multi-hit: 3x hits', multiplier: 1.1, evolvesAt: null, evolvesTo: null },
  shieldwall:   { tier: 1, desc: 'Reduce all dmg by 60% for 2 turns', multiplier: 0, evolvesAt: null, evolvesTo: null },
  taunt:        { tier: 1, desc: 'Force monster to attack — skip their ability', multiplier: 0, evolvesAt: null, evolvesTo: null },
  deathblow:    { tier: 1, desc: 'Finisher: 5x dmg if enemy HP < 20%', multiplier: 5.0, evolvesAt: null, evolvesTo: null },
}

// ────────────────────────────────────────────────────────────────
// ENEMIES — with special abilities
// ────────────────────────────────────────────────────────────────
const ENEMIES = [
  {
    name: 'Shadow Slime',  level: 1,  hp: 40,  attack: 6,
    ability: { name: 'Slime Coat', chance: 0.3, desc: 'Reduces your damage by 25% this turn', effect: 'dmgReduce' },
    reward: { coins: 50, xp: 20, gems: 0 },
  },
  {
    name: 'Dark Goblin',   level: 3,  hp: 65,  attack: 12,
    ability: { name: 'Steal', chance: 0.25, desc: 'Steals 30 coins from you!', effect: 'steal' },
    reward: { coins: 120, xp: 45, gems: 1 },
  },
  {
    name: 'Void Wraith',   level: 5,  hp: 95,  attack: 20,
    ability: { name: 'Phase Shift', chance: 0.35, desc: 'Phases through your attack — EVADED!', effect: 'dodge' },
    reward: { coins: 220, xp: 90, gems: 2 },
  },
  {
    name: 'Shadow Knight', level: 8,  hp: 150, attack: 32,
    ability: { name: 'Counter Stance', chance: 0.4, desc: 'Reflects 35% of your damage back!', effect: 'counter' },
    reward: { coins: 450, xp: 160, gems: 3 },
  },
  {
    name: 'Void Serpent',  level: 11, hp: 200, attack: 45,
    ability: { name: 'Venom Bite', chance: 0.45, desc: 'Poisons you! -25 HP next 2 turns.', effect: 'poison' },
    reward: { coins: 700, xp: 280, gems: 5 },
  },
  {
    name: 'Shadow Hydra',  level: 15, hp: 280, attack: 58,
    ability: { name: 'Regenerate', chance: 0.35, desc: 'Regenerates 40 HP!', effect: 'regen' },
    reward: { coins: 1000, xp: 420, gems: 7 },
  },
  {
    name: 'Dark Dragon',   level: 20, hp: 400, attack: 80,
    ability: { name: 'Dragon Breath', chance: 0.5, desc: 'Breathes dark fire — MASSIVE damage!', effect: 'breath' },
    reward: { coins: 1800, xp: 700, gems: 12 },
  },
  {
    name: 'Void Overlord', level: 25, hp: 600, attack: 110,
    ability: { name: 'Void Collapse', chance: 0.55, desc: 'Collapses void energy — deals 60% of your MAX HP!', effect: 'collapse' },
    reward: { coins: 3000, xp: 1200, gems: 20 },
  },
]

function getEnemy(floor, playerLevel = 1) {
  // Scale enemy selection — one new enemy type unlocked every 3 floors
  const baseIdx = Math.min(Math.floor(floor / 3), ENEMIES.length - 1)
  // At higher floors, randomly pick from current or harder enemies
  const maxIdx = Math.min(baseIdx + Math.floor(Math.random() * 2), ENEMIES.length - 1)
  const enemy = { ...ENEMIES[Math.random() < 0.4 ? maxIdx : baseIdx] }

  const scaling = 1 + (floor * 0.15) + (playerLevel * 0.05)
  enemy.currentHp = Math.floor(enemy.hp * scaling)
  enemy.hp = enemy.currentHp
  enemy.attack = Math.floor(enemy.attack * scaling)
  enemy.level = enemy.level + floor
  enemy.ability = { ...enemy.ability } // copy so we don't mutate original
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
    case 'regen':
      const healAmt = Math.floor(enemy.hp * 0.12)
      enemy.currentHp = Math.min(enemy.hp, enemy.currentHp + healAmt)
      result.healed = healAmt
      break
    case 'breath':     result.extraDmg = Math.floor(enemy.attack * 1.5); break
    case 'collapse':   result.collapseDmgPct = 0.60; break
  }
  return result
}

function hpBar(current, max, len = 12) {
  const pct = Math.max(0, current / max)
  const filled = Math.round(pct * len)
  const bar = '█'.repeat(filled) + '░'.repeat(len - filled)
  const dot = pct > 0.6 ? '💚' : pct > 0.3 ? '🟡' : '🔴'
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
  const cls = getClassForUser(user)
  const level = user?.level || 1
  const hpBonus = cls ? cls.hpBonus : 0
  const atkBonus = cls ? cls.atkBonus : 0
  return {
    maxHp: 100 + level * 12 + hpBonus,
    atk: 20 + level * 3 + atkBonus,
    cls,
  }
}

module.exports = {
  // ─── CLASS SELECTION ─────────────────────────────────────────
  async selectclass({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const chosen = args[0]?.toLowerCase()

    if (!chosen) {
      const list = Object.entries(CLASSES).map(([key, c]) =>
        `${c.emoji} *${c.name}* (\`${key}\`)\n   ${c.desc}\n   ${c.passiveDesc}`
      ).join('\n\n')

      return reply(
        `🎭 *CLASS SELECTION*\n\n` +
        `👤 *Player:* ${u.name || sender}\n` +
        (u.class_name ? `⚔️ *Current:* ${CLASSES[u.class_name]?.name || u.class_name}\n` : '') +
        `\n━━━━━━━━━━━━━━━\n\n` +
        `${list}\n\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `📌 *Usage:* *.selectclass <name>*\n` +
        `Example: *.selectclass warrior*\n\n` +
        `_Choose your path in the shadows._ 🖤`
      )
    }

    if (!CLASSES[chosen]) {
      return reply(`❌ Unknown class: *${chosen}*\n\nValid: ${Object.keys(CLASSES).join(', ')}`)
    }

    const cls = CLASSES[chosen]
    const saved = await db.updateUser(sender, { class_name: chosen, skill_xp: JSON.stringify({}) })

    if (!saved) {
      return reply(
        `❌ *CLASS SAVE FAILED*\n\n` +
        `The \`class_name\` or \`skill_xp\` column is missing from your database.\n\n` +
        `Run this SQL once in your *Supabase SQL Editor* and then try again:\n\n` +
        `ALTER TABLE users\n` +
        `  ADD COLUMN IF NOT EXISTS class_name TEXT DEFAULT NULL,\n` +
        `  ADD COLUMN IF NOT EXISTS skill_xp TEXT DEFAULT '{}';\n\n` +
        `_The schema must exist before the shadow can walk its path._ 🖤`
      )
    }

    return reply(
      `🎭 *CLASS CHOSEN*\n\n` +
      `${cls.emoji} You are now a *${cls.name}*!\n\n` +
      `📖 ${cls.desc}\n\n` +
      `✨ *Passive:* ${cls.passiveDesc}\n\n` +
      `⚔️ *Class Abilities:*\n${cls.abilities.map(a => `• \`${a}\` — ${SKILL_EVOLUTION[a]?.desc || '?'}`).join('\n')}\n\n` +
      `_The shadows have acknowledged your path._ 🖤`
    )
  },

  async chooseclass(ctx) { return module.exports.selectclass(ctx) },
  async classselect(ctx) { return module.exports.selectclass(ctx) },

  async skillinfo({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (!cls) return reply(`❌ Pick a class first with *.selectclass*`)

    let skillXp = {}
    try { skillXp = JSON.parse(u.skill_xp || '{}') } catch {}

    const lines = cls.abilities.map(skillKey => {
      const sk = SKILL_EVOLUTION[skillKey]
      if (!sk) return `• ${skillKey}`
      const uses = skillXp[skillKey] || 0
      const evolveLine = sk.evolvesAt
        ? `(evolves at ${sk.evolvesAt} uses — ${Math.max(0, sk.evolvesAt - uses)} left)`
        : sk.tier > 1 ? `(MAX tier)` : `(does not evolve)`
      return `• *${skillKey}* Tier ${sk.tier} — Used: ${uses}x ${evolveLine}\n  ${sk.desc}`
    }).join('\n\n')

    await reply(
      `📖 *SKILL INFO*\n\n` +
      `${cls.emoji} *${cls.name}*\n\n` +
      `${lines}\n\n` +
      `_Level your skills through use._ 🖤`
    )
  },

  // ─── DUNGEON ENTRY ────────────────────────────────────────────
  async dungeon({ sock, jid, msg, reply, sender, user }) {
    if (dungeonSessions[sender]) {
      const s = dungeonSessions[sender]
      const cls = getClassForUser(user)
      const abilityList = cls
        ? cls.abilities.map(a => `• *.${a}*`).join('\n')
        : `⚔️ *.attack* | 💥 *.heavy* | 🛡️ *.defend* | 🌟 *.special* | 🧪 *.heal* | 🏃 *.flee*`
      return reply(
        `🏰 *DUNGEON IN PROGRESS*\n\nFloor: ${s.floor}\nHP: ${s.playerHp}/${s.playerMaxHp}\n\n` +
        (cls ? `${cls.emoji} *${cls.name}* Abilities:\n${abilityList}\n\n` : '') +
        `_Or use: *.attack* *.heavy* *.defend* *.special* *.heal* *.flee*_ 🖤`
      )
    }
    const cdRemaining = await db.getCooldown(sender, 'dungeon')
    if (cdRemaining > 0) {
      const mins = Math.floor(cdRemaining / 60000)
      const secs = Math.floor((cdRemaining % 60000) / 1000)
      return reply(`⏳ *DUNGEON COOLDOWN*\n\n🕒 Wait: ${mins}m ${secs}s\n\n_The dungeon needs time to reset._ 🖤`)
    }
    const u = user || await db.getOrCreateUser(sender)
    const stats = getPlayerStats(u)
    const floor = 1
    const enemy = getEnemy(floor, u.level || 1)

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

    const cls = stats.cls
    const abilityLine = cls
      ? `${cls.emoji} *${cls.name}* — Use *.${cls.abilities.join('*, *.')}*\n`
      : ''

    const intro = ENEMY_INTROS[Math.floor(Math.random() * ENEMY_INTROS.length)]
    const zone  = getZoneDesc(floor)
    const battleText =
      `🏰 *SHADOW DUNGEON — FLOOR ${floor}*\n` +
      `${zone}\n\n` +
      `👤 *${u.name || sender}*  •  📊 Lv.${u.level || 1}${cls ? `  •  ${cls.emoji} ${cls.name}` : ''}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `💀 *${enemy.name}* (Lv.${enemy.level}) ${intro}\n` +
      `⚡ Ability: *${enemy.ability.name}* — _${enemy.ability.desc}_\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `⚔️  YOU        ${hpBar(stats.maxHp, stats.maxHp)}  ${stats.maxHp}/${stats.maxHp}\n` +
      `👾 ${enemy.name.padEnd(10)} ${hpBar(enemy.hp, enemy.hp)}  ${enemy.hp}/${enemy.hp}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      (cls
        ? `${cls.emoji} *Class Moves:*\n${cls.abilities.map(a => `• *.${a}*`).join('  ')}\n\n`
        : '') +
      `📖 *Basic:*  *.attack*  *.heavy*  *.defend*  *.special*  *.heal*  *.flee*\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `_The darkness watches. Choose wisely._ 🖤`

    // Try to fetch an anime dungeon image matching the enemy and zone
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

  // ─── STANDARD ATTACK ─────────────────────────────────────────
  async attack({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ No dungeon active. Use *.dungeon* to start.')
    const u = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)

    let myDmg = Math.floor(s.playerAtk * (0.8 + Math.random() * 0.4))

    // Class passive
    if (cls?.passive) myDmg = Math.floor(myDmg * cls.passive(s))

    // First strike bonus for Assassin
    if (s.firstStrike && !s.firstHitDone) {
      myDmg = Math.floor(myDmg * 1.5)
      s.firstHitDone = true
    }

    // Monster ability
    const abilityResult = applyMonsterAbility(s.enemy, s)
    let abilityText = ''
    if (abilityResult?.triggered) {
      if (abilityResult.dodge) {
        abilityText = `\n⚡ *${s.enemy.ability.name}*: Your attack missed!\n`
        myDmg = 0
      } else if (abilityResult.playerDmgMult) {
        myDmg = Math.floor(myDmg * abilityResult.playerDmgMult)
        abilityText = `\n⚡ *${s.enemy.ability.name}*: ${s.enemy.ability.desc}\n`
      } else if (abilityResult.counterPct) {
        abilityText = `\n⚡ *${s.enemy.ability.name}*: Counter! You take ${Math.floor(myDmg * abilityResult.counterPct)} reflected dmg!\n`
      } else {
        abilityText = `\n⚡ *${s.enemy.ability.name}*: ${abilityResult.desc || s.enemy.ability.desc}\n`
      }
    }

    s.enemy.currentHp = Math.max(0, s.enemy.currentHp - myDmg)

    let enemyDmg = s.defending
      ? Math.floor(s.enemy.attack * 0.5)
      : Math.floor(s.enemy.attack * (0.8 + Math.random() * 0.4))

    // Knight dmg reduction
    if (cls?.dmgReduction) enemyDmg = Math.floor(enemyDmg * (1 - cls.dmgReduction))
    if (s.shieldWallTurns > 0) { enemyDmg = Math.floor(enemyDmg * 0.4); s.shieldWallTurns-- }

    // Counter damage
    if (abilityResult?.counterPct) enemyDmg += Math.floor(myDmg * abilityResult.counterPct)
    if (abilityResult?.extraDmg) enemyDmg += abilityResult.extraDmg
    if (abilityResult?.collapseDmgPct) enemyDmg += Math.floor(s.playerMaxHp * abilityResult.collapseDmgPct)
    if (abilityResult?.stealCoins) {
      await db.updateUser(sender, { wallet: Math.max(0, (u.wallet || 0) - abilityResult.stealCoins) })
      abilityText += ` (Lost ${abilityResult.stealCoins} coins!)`
    }

    s.defending = false

    // Life drain for mage
    if (cls?.lifeDrain && myDmg > 0) {
      const drain = Math.floor(myDmg * 0.10)
      s.playerHp = Math.min(s.playerMaxHp, s.playerHp + drain)
    }

    // Poison damage tick
    let poisonText = ''
    if (s.poisonTurns > 0) {
      s.playerHp = Math.max(0, s.playerHp - s.poisonDmg)
      poisonText = `\n☠️ Poison: -${s.poisonDmg} HP (${s.poisonTurns} turns left)`
      s.poisonTurns--
    }

    s.playerHp = Math.max(0, s.playerHp - enemyDmg)

    if (s.enemy.currentHp <= 0) return await module.exports._dungeonWin(sock, jid, reply, sender, s, u)
    if (s.playerHp <= 0) return await module.exports._dungeonLoss(reply, sender, s)

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

  // ─── CLASS ABILITY: SLASH (Warrior tier-1) ───────────────────
  async slash({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const u = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (!cls || !cls.abilities.includes('slash') && !cls.abilities.includes('darkslash') && !cls.abilities.includes('voidrend'))
      return reply(`❌ This ability is for Warriors only.`)

    const { currentSkill, evolved, reply: skillReply } = await module.exports._useSkill(sender, u, 'slash', s)
    if (skillReply) return reply(skillReply)

    const sk = SKILL_EVOLUTION[currentSkill]
    const myDmg = Math.floor(s.playerAtk * sk.multiplier)
    s.enemy.currentHp = Math.max(0, s.enemy.currentHp - myDmg)
    const enemyDmg = Math.floor(s.enemy.attack * 0.9)
    s.playerHp = Math.max(0, s.playerHp - enemyDmg)

    if (s.enemy.currentHp <= 0) return await module.exports._dungeonWin(sock, jid, reply, sender, s, u)
    if (s.playerHp <= 0) return await module.exports._dungeonLoss(reply, sender, s)

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
  async voidrend(ctx) { return module.exports.slash(ctx) },

  // ─── CLASS ABILITY: DARKNOVA (Mage tier-1) ───────────────────
  async darknova({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const u = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (!cls || cls.name !== 'Dark Mage') return reply('❌ This ability is for Dark Mages only.')

    const { currentSkill, evolved } = await module.exports._useSkill(sender, u, 'darknova', s)
    const sk = SKILL_EVOLUTION[currentSkill]
    const myDmg = Math.floor(s.playerAtk * sk.multiplier)

    const drain = Math.floor(myDmg * 0.15)
    s.playerHp = Math.min(s.playerMaxHp, s.playerHp + drain)
    s.enemy.currentHp = Math.max(0, s.enemy.currentHp - myDmg)
    const enemyDmg = Math.floor(s.enemy.attack * 1.1)
    s.playerHp = Math.max(0, s.playerHp - enemyDmg)

    if (s.enemy.currentHp <= 0) return await module.exports._dungeonWin(sock, jid, reply, sender, s, u)
    if (s.playerHp <= 0) return await module.exports._dungeonLoss(reply, sender, s)

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

  // ─── CLASS ABILITY: SHADOWSHOT (Archer tier-1) ───────────────
  async shadowshot({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const u = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (!cls || cls.name !== 'Void Archer') return reply('❌ This ability is for Void Archers only.')

    const { currentSkill, evolved } = await module.exports._useSkill(sender, u, 'shadowshot', s)
    const sk = SKILL_EVOLUTION[currentSkill]
    const myDmg = Math.floor(s.playerAtk * sk.multiplier)
    const poisonDmg = cls.poisonDmg || 15
    s.enemy.currentHp = Math.max(0, s.enemy.currentHp - myDmg - poisonDmg)
    const enemyDmg = Math.floor(s.enemy.attack * 0.9)
    s.playerHp = Math.max(0, s.playerHp - enemyDmg)

    if (s.enemy.currentHp <= 0) return await module.exports._dungeonWin(sock, jid, reply, sender, s, u)
    if (s.playerHp <= 0) return await module.exports._dungeonLoss(reply, sender, s)

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

  // ─── CLASS ABILITY: BACKSTAB (Assassin tier-1) ───────────────
  async backstab({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const u = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (!cls || cls.name !== 'Night Assassin') return reply('❌ Night Assassins only.')

    const { currentSkill, evolved } = await module.exports._useSkill(sender, u, 'backstab', s)
    const sk = SKILL_EVOLUTION[currentSkill]
    const myDmg = Math.floor(s.playerAtk * sk.multiplier)
    s.enemy.currentHp = Math.max(0, s.enemy.currentHp - myDmg)
    const enemyDmg = Math.floor(s.enemy.attack * 1.2)
    s.playerHp = Math.max(0, s.playerHp - enemyDmg)

    if (s.enemy.currentHp <= 0) return await module.exports._dungeonWin(sock, jid, reply, sender, s, u)
    if (s.playerHp <= 0) return await module.exports._dungeonLoss(reply, sender, s)

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

  // ─── CLASS ABILITY: SMOKEBOMB (Assassin) ─────────────────────
  async smokebomb({ reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const u = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (!cls || cls.name !== 'Night Assassin') return reply('❌ Night Assassins only.')
    s.smokeDodge = true
    await reply(`💨 *SMOKE BOMB*\n\nYou vanish into the shadows!\n70% chance to dodge the next attack.\n\n_They can't hit what they can't see._ 🖤`)
  },

  // ─── CLASS ABILITY: SHIELDWALL (Knight) ──────────────────────
  async shieldwall({ reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const u = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (!cls || cls.name !== 'Shadow Knight') return reply('❌ Shadow Knights only.')
    s.shieldWallTurns = 2
    await reply(`🛡️ *SHIELD WALL*\n\nMassive shield raised!\nDamage reduced 60% for 2 turns.\n\n_The wall holds. Nothing passes._ 🖤`)
  },

  // ─── CLASS ABILITY: DEATHBLOW (Knight finisher) ──────────────
  async deathblow({ reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const u = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (!cls || cls.name !== 'Shadow Knight') return reply('❌ Shadow Knights only.')
    if (s.enemy.currentHp / s.enemy.hp > 0.20)
      return reply(`❌ *Death Blow* only activates when enemy HP is below 20%!\n\nEnemy HP: ${Math.floor(s.enemy.currentHp / s.enemy.hp * 100)}%`)
    const myDmg = Math.floor(s.playerAtk * 5.0)
    s.enemy.currentHp = 0
    return await module.exports._dungeonWin(null, null, reply, sender, s, u)
  },

  // ─── CLASS ABILITY: BERSERK (Warrior) ────────────────────────
  async berserk({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const u = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (!cls || cls.name !== 'Shadow Warrior') return reply('❌ Shadow Warriors only.')
    const myDmg = Math.floor(s.playerAtk * 2.0)
    const enemyDmg = Math.floor(s.enemy.attack * 1.5)
    s.enemy.currentHp = Math.max(0, s.enemy.currentHp - myDmg)
    s.playerHp = Math.max(0, s.playerHp - enemyDmg)
    if (s.enemy.currentHp <= 0) return await module.exports._dungeonWin(sock, jid, reply, sender, s, u)
    if (s.playerHp <= 0) return await module.exports._dungeonLoss(reply, sender, s)
    const battleText =
      `🔥 *BERSERK!*\n\n` +
      `💥 Rage unleashed — *${myDmg}* damage!\n` +
      `🗡️ Defence ignored — ${s.enemy.name}: *${enemyDmg}* back!\n\n` +
      `YOU: ${hpBar(s.playerHp, s.playerMaxHp)} \`${s.playerHp}/${s.playerMaxHp}\`\n` +
      `${s.enemy.name}: ${hpBar(s.enemy.currentHp, s.enemy.hp)} \`${s.enemy.currentHp}/${s.enemy.hp}\`\n\n` +
      `_Pure rage knows no defence._ 🖤`
    const img = await fetchActionImage('berserk', s.enemy.name)
    await sendImgOrReply(sock, jid, img, battleText, reply)
  },

  // ─── STANDARD MOVES ──────────────────────────────────────────
  async heavy({ sock, jid, reply, sender, user }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    const hit = Math.random() < 0.60
    if (!hit) {
      const enemyDmg = Math.floor(s.enemy.attack * (0.8 + Math.random() * 0.4))
      s.playerHp = Math.max(0, s.playerHp - enemyDmg)
      if (s.playerHp <= 0) return await module.exports._dungeonLoss(reply, sender, s)
      const missText =
        `💥 *HEAVY — MISS!*\n\n` +
        `😤 Your massive swing cuts through air!\n` +
        `🗡️ *${s.enemy.name}* exploits the opening — *${enemyDmg}* dmg!\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `⚔️  YOU        ${hpBar(s.playerHp, s.playerMaxHp)}  ${s.playerHp}/${s.playerMaxHp}\n` +
        `👾 ${s.enemy.name.padEnd(10)} ${hpBar(s.enemy.currentHp, s.enemy.hp)}  ${s.enemy.currentHp}/${s.enemy.hp}\n` +
        `_Time your strikes more carefully._ 🖤`
      const missImg = await fetchActionImage('heavy', s.enemy.name)
      return sendImgOrReply(sock, jid, missImg, missText, reply)
    }
    const myDmg    = Math.floor(s.playerAtk * 2.5)
    const enemyDmg = Math.floor(s.enemy.attack * 0.7)
    s.enemy.currentHp = Math.max(0, s.enemy.currentHp - myDmg)
    s.playerHp = Math.max(0, s.playerHp - enemyDmg)
    const u = user || await db.getOrCreateUser(sender)
    if (s.enemy.currentHp <= 0) return await module.exports._dungeonWin(sock, jid, reply, sender, s, u)
    if (s.playerHp <= 0) return await module.exports._dungeonLoss(reply, sender, s)
    const battleText =
      `💥 *HEAVY HIT — DIRECT!*\n\n` +
      `⚡ Your blow *shatters* through armour — *${myDmg}* damage!\n` +
      `🗡️ *${s.enemy.name}* staggers and retaliates — *${enemyDmg}* dmg!\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `⚔️  YOU        ${hpBar(s.playerHp, s.playerMaxHp)}  ${s.playerHp}/${s.playerMaxHp}\n` +
      `👾 ${s.enemy.name.padEnd(10)} ${hpBar(s.enemy.currentHp, s.enemy.hp)}  ${s.enemy.currentHp}/${s.enemy.hp}\n` +
      `_Heavy strikes break defenses._ 🖤`
    const img = await fetchActionImage('heavy', s.enemy.name)
    await sendImgOrReply(sock, jid, img, battleText, reply)
  },

  async defend({ reply, sender }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ Use *.dungeon* first.')
    s.defending = true
    await reply(
      `🛡️ *BRACE!*\n\n` +
      `🛡️ You raise your guard — bracing for impact!\n` +
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
    if (s.playerHp <= 0) return await module.exports._dungeonLoss(reply, sender, s)
    const battleText =
      `🌟 *SHADOW BURST!*\n\n` +
      `⚡ Raw shadow energy focuses — *${myDmg}* damage!\n` +
      `🗡️ *${s.enemy.name}* fights through the blast — *${enemyDmg}* back!\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `⚔️  YOU        ${hpBar(s.playerHp, s.playerMaxHp)}  ${s.playerHp}/${s.playerMaxHp}\n` +
      `👾 ${s.enemy.name.padEnd(10)} ${hpBar(s.enemy.currentHp, s.enemy.hp)}  ${s.enemy.currentHp}/${s.enemy.hp}\n` +
      `_Raw power channeled from the void._ 🖤`
    const img = await fetchActionImage('special', s.enemy.name)
    await sendImgOrReply(sock, jid, img, battleText, reply)
  },

  async heal({ sock, jid, reply, sender }) {
    const s = dungeonSessions[sender]
    if (!s) return reply(`💊 Use *.dungeon* first.`)
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
    const netHeal = s.playerHp - preHeal
    const battleText =
      `🧪 *SHADOW ELIXIR*\n\n` +
      `💚 Healed *+${healAmt}* HP… but the enemy strikes!\n` +
      `🗡️ *${s.enemy.name}* hits for *${enemyDmg}* while you drink!\n` +
      `📊 Net: ${netHeal >= 0 ? '+' : ''}${netHeal} HP\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `⚔️  YOU        ${hpBar(s.playerHp, s.playerMaxHp)}  ${s.playerHp}/${s.playerMaxHp}\n` +
      `👾 ${s.enemy.name.padEnd(10)} ${hpBar(s.enemy.currentHp, s.enemy.hp)}  ${s.enemy.currentHp}/${s.enemy.hp}\n` +
      `_Recovery in the middle of battle._ 🖤`
    const img = await fetchActionImage('heal', s.enemy.name)
    await sendImgOrReply(sock, jid, img, battleText, reply)
  },

  async flee({ reply, sender }) {
    const s = dungeonSessions[sender]
    if (!s) return reply('❌ No dungeon active.')
    if (Math.random() < 0.4) {
      delete dungeonSessions[sender]
      return reply(
        `🏃 *ESCAPED!*\n\n` +
        `You sprint through the dark corridors and find an exit!\n\n` +
        `📍 Escaped from Floor ${s.floor}\n\n` +
        `_Survival is its own kind of victory._ 🖤`
      )
    }
    const enemyDmg = Math.floor(s.enemy.attack * 1.5)
    s.playerHp = Math.max(0, s.playerHp - enemyDmg)
    if (s.playerHp <= 0) {
      delete dungeonSessions[sender]
      return reply(
        `💀 *CAUGHT FLEEING!*\n\n` +
        `*${s.enemy.name}* cuts you down from behind!\n\n` +
        `_The shadows punish cowardice._ 🖤`
      )
    }
    await reply(
      `🚫 *ESCAPE FAILED!*\n\n` +
      `*${s.enemy.name}* blocks every exit — hits you for *${enemyDmg}*!\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `⚔️  YOU        ${hpBar(s.playerHp, s.playerMaxHp)}  ${s.playerHp}/${s.playerMaxHp}\n` +
      `_Fight or die._ 🖤`
    )
  },

  async item({ reply, sender }) {
    const items = await db.getInventory(sender)
    if (!items.length) return reply('❌ Inventory empty! Use *.buy* to get items.')
    await reply(`🎒 *USE ITEM*\n\nInventory: ${items.map(i => i.item).join(', ')}\n\nUsage: *.use <item>*\n\n_Your inventory holds your power._ 🖤`)
  },

  async adventure({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    const clsBonus = cls ? 1.2 : 1.0
    const adventures = [
      { text: 'explored an ancient shadow temple', coins: 150, xp: 50 },
      { text: 'defeated a wandering dark mage', coins: 300, xp: 100 },
      { text: 'discovered a hidden vault', coins: 500, xp: 75 },
      { text: 'survived a shadow storm', coins: 200, xp: 120 },
    ]
    const adv = adventures[Math.floor(Math.random() * adventures.length)]
    const coins = Math.floor(adv.coins * clsBonus)
    const xp = Math.floor(adv.xp * clsBonus)
    await db.updateUser(sender, { wallet: (u.wallet || 0) + coins, xp: (u.xp || 0) + xp })
    await reply(`⚔️ *ADVENTURE COMPLETE*\n\n👤 ${u.name || sender}\n${cls ? `${cls.emoji} Class: ${cls.name}\n` : ''}\n🗺️ You ${adv.text}!\n\n💰 +$${coins}\n⭐ +${xp} XP\n\n_Every adventure forges the shadow warrior._ 🖤`)
  },

  async rpg({ sock, jid, msg, reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    const text =
      `⚔️ *RPG SYSTEM*\n\n` +
      `👤 ${u.name || sender}\n📊 Level: ${u.level || 1}\n⭐ XP: ${u.xp || 0}/${(u.level || 1) * 1000}\n\n` +
      (cls ? `${cls.emoji} Class: *${cls.name}*\n${cls.passiveDesc}\n\n` : `⚠️ No class selected! Use *.selectclass*\n\n`) +
      `🎮 *Commands:*\n• *.dungeon* — Enter dungeon\n• *.adventure* — Quick adventure\n• *.selectclass* — Choose/change class\n• *.skillinfo* — View your skills\n• *.guildraid* — Start guild raid\n• *.quest* — Daily quest\n\n_The shadows await your journey._ 🖤`
    try {
      await sock.sendMessage(jid, { text }, { quoted: msg })
    } catch {
      await reply(text)
    }
  },

  async quest({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const remaining = await db.getCooldown(sender, 'quest')
    if (remaining > 0) {
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      return reply(`⏳ *QUEST COOLDOWN*\n\n🕒 Wait: ${mins}m ${secs}s\n\n_The quest requires preparation._ 🖤`)
    }
    const quests = [
      { name: 'Collect 5 shadows', reward: 200 },
      { name: 'Defeat 3 dungeon enemies', reward: 350 },
      { name: 'Trade with another user', reward: 150 },
    ]
    const quest = quests[Math.floor(Math.random() * quests.length)]
    await db.updateUser(sender, { wallet: (u.wallet || 0) + quest.reward })
    await db.setCooldown(sender, 'quest', 10 * 60)
    await reply(`📜 *QUEST COMPLETE*\n\n👤 ${u.name || sender}\n\n✅ Quest: *${quest.name}*\n💰 Reward: +$${quest.reward}\n\n⏳ Next quest in 10 minutes.\n\n_The shadows reward the diligent._ 🖤`)
  },

  async raid({ sock, jid, reply, sender, isGroup, user }) {
    if (!isGroup) return reply('❌ Raids are group events!')
    const remaining = await db.getCooldown(sender, 'raid')
    if (remaining > 0) {
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      return reply(`⏳ *RAID COOLDOWN*\n\n🕒 Wait: ${mins}m ${secs}s\n\n_The raid boss needs time to respawn._ 🖤`)
    }
    const u = user || await db.getOrCreateUser(sender)
    const boss = ENEMIES[4]
    const reward = 500 + Math.floor(Math.random() * 500)
    await db.updateUser(sender, { wallet: (u.wallet || 0) + reward })
    await db.setCooldown(sender, 'raid', 25 * 60)
    await reply(`⚔️ *RAID COMPLETE*\n\n👥 Your group defeated *${boss.name}*!\n\n💰 Raid Reward: +$${reward}\n\n⏳ Next raid in 25 minutes.\n\n_The raid boss falls before shadow warriors._ 🖤`)
  },

  async class({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const cls = getClassForUser(u)
    if (cls) {
      return reply(
        `🎭 *YOUR CLASS*\n\n👤 ${u.name || sender}\n\n${cls.emoji} Class: *${cls.name}*\n📊 Level: ${u.level || 1}\n\n${cls.passiveDesc}\n\n⚔️ Abilities: ${cls.abilities.join(', ')}\n\n_Use *.skillinfo* to see skill progress._\n_Use *.selectclass* to change class._ 🖤`
      )
    }
    await reply(`🎭 *NO CLASS*\n\n👤 ${u.name || sender}\n\n❌ You haven't chosen a class yet!\n\nUse *.selectclass* to pick your path.\n\n_Every shadow warrior has a role._ 🖤`)
  },

  // ─── SKILL USE HELPER ────────────────────────────────────────
  async _useSkill(sender, user, baseSkill, session) {
    let skillXp = {}
    try { skillXp = JSON.parse(user.skill_xp || '{}') } catch {}

    // Find the current evolution of the base skill
    let currentSkill = baseSkill
    // Walk the evolution chain to find where the user is
    let sk = SKILL_EVOLUTION[baseSkill]
    while (sk?.evolvesTo && (skillXp[baseSkill] || 0) >= (sk.evolvesAt || Infinity)) {
      currentSkill = sk.evolvesTo
      sk = SKILL_EVOLUTION[currentSkill]
    }

    // Increment uses
    skillXp[baseSkill] = (skillXp[baseSkill] || 0) + 1

    // Check if evolution triggers now
    const prevTier = SKILL_EVOLUTION[currentSkill]?.tier || 1
    const baseSk = SKILL_EVOLUTION[baseSkill]
    const didEvolve = baseSk?.evolvesAt && skillXp[baseSkill] === baseSk.evolvesAt

    let newSkill = currentSkill
    if (didEvolve && baseSk.evolvesTo) {
      newSkill = baseSk.evolvesTo
    }

    await db.updateUser(sender, { skill_xp: JSON.stringify(skillXp) })

    return { currentSkill: newSkill, evolved: didEvolve }
  },

  // ─── WIN/LOSS ─────────────────────────────────────────────────
  async _dungeonWin(sock, jid, reply, sender, session, user) {
    // eslint-disable-next-line no-unused-expressions
    sock, jid // may be null from some callers — safe to receive
    const damageTaken = session.playerMaxHp - session.playerHp
    const clearedFloor = session.floor
    const nextFloor   = session.floor + 1
    const reward      = session.enemy.reward

    // Milestone bonus every 5 floors
    const milestone = clearedFloor % 5 === 0
    if (milestone) {
      reward.coins = Math.floor(reward.coins * 2)
      reward.gems  = Math.floor(reward.gems  * 2) + 1
      reward.xp    = Math.floor(reward.xp    * 1.5)
    }

    // Level up check
    const newXp    = (user.xp || 0) + reward.xp
    const xpNeeded = (user.level || 1) * 1000
    const levelUp  = newXp >= xpNeeded
    const newLevel = levelUp ? (user.level || 1) + 1 : (user.level || 1)

    await db.updateUser(sender, {
      wallet: (user.wallet || 0) + reward.coins,
      gems:   (user.gems   || 0) + reward.gems,
      xp:     levelUp ? newXp - xpNeeded : newXp,
      level:  newLevel,
    })

    // Advance session to next floor
    session.floor    = nextFloor
    session.enemy    = getEnemy(nextFloor, newLevel)
    session.enemy.currentHp = session.enemy.hp
    session.defending = false
    session.poisonTurns = 0

    await db.setCooldown(sender, 'dungeon', 10 * 60)

    const hpPct    = session.playerHp / session.playerMaxHp
    const hpStatus = hpPct > 0.7 ? '💪 Barely scratched!' : hpPct > 0.4 ? '😤 Bloodied but standing.' : '😰 Barely alive…'
    const nextZone = getZoneDesc(nextFloor)
    const nextIntro = ENEMY_INTROS[Math.floor(Math.random() * ENEMY_INTROS.length)]

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
      `🚪 *Descending to Floor ${nextFloor}…*\n` +
      `${nextZone}\n\n` +
      `👾 *${session.enemy.name}* (Lv.${session.enemy.level}) ${nextIntro}\n` +
      `⚡ Ability: *${session.enemy.ability.name}*\n\n` +
      `⚔️  YOU        ${hpBar(session.playerHp, session.playerMaxHp)}  ${session.playerHp}/${session.playerMaxHp}\n` +
      `👾 ${session.enemy.name.padEnd(10)} ${hpBar(session.enemy.hp, session.enemy.hp)}  ${session.enemy.hp}/${session.enemy.hp}\n\n` +
      `_The shadows grow thicker with every step._ 🖤`

    // Send loot summary as plain text, then follow with new monster preview
    await reply(winText)
    try {
      const monsterImg = await fetchMonsterImage(session.enemy.name)
      if (monsterImg && monsterImg.length > 500 && sock && jid) {
        await sock.sendMessage(jid, { image: monsterImg, caption: `👾 *${session.enemy.name}* appears on Floor ${nextFloor}!\n⚡ *${session.enemy.ability.name}* — _${session.enemy.ability.desc}_\n\n_Choose your move wisely._ 🖤` })
      }
    } catch {}
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
    const line = deathLines[Math.floor(Math.random() * deathLines.length)]
    await reply(
      `💀 *DEFEATED ON FLOOR ${floor}*\n\n` +
      `👾 *${session.enemy.name}* overwhelmed you!\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `❤️  HP:    0 / ${session.playerMaxHp}\n` +
      `📍 Floor: ${floor}\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `${line} 🖤\n\n` +
      `_Use *.dungeon* to enter again._`
    )
  },
}
