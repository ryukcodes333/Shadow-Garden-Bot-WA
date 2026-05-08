const db = require('../database')
const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')

const PHELP_IMAGE = path.join(__dirname, '../assets/phelp.jpg')

// ── In-memory stores ──────────────────────────────────────────────
const pendingPokemon = {}      // jid → pending wild pokemon
const activeBattles  = {}      // jid → battle state

// ── Mention sticker store (file-based) ───────────────────────────
const MS_FILE = path.join(__dirname, '../mention_stickers.json')
function loadMS() {
  try { return JSON.parse(fs.readFileSync(MS_FILE, 'utf8')) } catch { return {} }
}
function saveMS(data) {
  try { fs.writeFileSync(MS_FILE, JSON.stringify(data, null, 2)) } catch {}
}

// ── Constants ─────────────────────────────────────────────────────
const POKE_CATCH_WINDOW = 90 * 1000
const MAX_POKEMON_ID    = 1025
const CD_PDAILY         = 24 * 3600
const CD_HUNT           = 3 * 60

const BALL_RATES = {
  pokeball: 0.50, greatball: 0.65, ultraball: 0.80, masterball: 1.00,
}

const SHOP_ITEMS = {
  pokeball:    { name: 'Poké Ball',       price: 200,   emoji: '🔴', type: 'ball' },
  greatball:   { name: 'Great Ball',      price: 600,   emoji: '🔵', type: 'ball' },
  ultraball:   { name: 'Ultra Ball',      price: 1200,  emoji: '🟡', type: 'ball' },
  masterball:  { name: 'Master Ball',     price: 50,    emoji: '💜', type: 'ball', gem: true },
  potion:      { name: 'Potion',          price: 300,   emoji: '🧪', type: 'heal' },
  superpotion: { name: 'Super Potion',    price: 700,   emoji: '💉', type: 'heal' },
  fullrestore: { name: 'Full Restore',    price: 3000,  emoji: '✨', type: 'heal' },
  revive:      { name: 'Revive',          price: 1500,  emoji: '💫', type: 'revive' },
  luckycharm:  { name: 'Lucky Charm',     price: 500,   emoji: '🍀', type: 'boost' },
  expboost:    { name: 'EXP Booster',     price: 800,   emoji: '⬆️',  type: 'boost' },
  shadowstone: { name: 'Shadow Stone',    price: 100,   emoji: '🌑', type: 'evolution', gem: true },
  firestone:   { name: 'Fire Stone',      price: 50,    emoji: '🔥', type: 'evolution', gem: true },
  waterstone:  { name: 'Water Stone',     price: 50,    emoji: '💧', type: 'evolution', gem: true },
  thunderstone:{ name: 'Thunder Stone',   price: 50,    emoji: '⚡', type: 'evolution', gem: true },
  leafstone:   { name: 'Leaf Stone',      price: 50,    emoji: '🍃', type: 'evolution', gem: true },
}

const RARITY_TABLE = [
  { max: 100,  rarity: 'common',    emoji: '⚪' },
  { max: 200,  rarity: 'rare',      emoji: '🟢' },
  { max: 300,  rarity: 'epic',      emoji: '🔵' },
  { max: 9999, rarity: 'legendary', emoji: '🟡' },
]

const REGIONS = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Paldea']
const TEAMS   = ['Valor', 'Mystic', 'Instinct', 'Shadow']

// ── Utility ───────────────────────────────────────────────────────
function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)) }

function getRarity(baseXp) {
  const entry = RARITY_TABLE.find(r => baseXp <= r.max) || RARITY_TABLE[RARITY_TABLE.length - 1]
  return entry
}

function capName(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ') : 'Unknown'
}

// ── PokeAPI fetching ──────────────────────────────────────────────
function fetchJSON(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { timeout: 12000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null) }
      let body = ''
      res.on('data', c => body += c)
      res.on('end', () => { try { resolve(JSON.parse(body)) } catch { resolve(null) } })
      res.on('error', () => resolve(null))
    })
    req.on('error', () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
  })
}

function downloadBuffer(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { timeout: 15000 }, (res) => {
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

async function fetchPokeData(nameOrId) {
  const poke = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${nameOrId}`)
  if (!poke) return null

  // Get location (first encounter area)
  let location = 'Unknown'
  try {
    const enc = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${poke.id}/encounters`)
    if (enc && enc.length > 0) {
      const raw = enc[0].location_area?.name || ''
      location = raw.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Unknown'
    }
  } catch {}

  // Get species info for description & catch rate
  let description = 'No description available.'
  let catchRate   = 45
  try {
    const species = await fetchJSON(`https://pokeapi.co/api/v2/pokemon-species/${poke.id}`)
    if (species) {
      catchRate = species.capture_rate || 45
      const flavorEntry = (species.flavor_text_entries || []).find(e => e.language?.name === 'en')
      if (flavorEntry) {
        description = flavorEntry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ').trim()
      }
    }
  } catch {}

  const name      = capName(poke.name)
  const types     = (poke.types || []).map(t => capName(t?.type?.name))
  const baseXp    = poke.base_experience || 50
  const height    = ((poke.height || 0) / 10).toFixed(1)
  const weight    = ((poke.weight || 0) / 10).toFixed(1)
  const moves     = (poke.moves || []).slice(0, 5).map(m => capName(m?.move?.name))
  const abilities = (poke.abilities || []).map(a => capName(a?.ability?.name))

  // Use highest-quality official artwork
  const imageUrl  =
    poke.sprites?.other?.['official-artwork']?.front_default ||
    poke.sprites?.front_default ||
    null

  return {
    id: poke.id, name, types, baseXp, height, weight,
    moves, abilities, location, description,
    catchRate: Math.round((catchRate / 255) * 100),
    imageUrl,
  }
}

// ── Build spawn message ───────────────────────────────────────────
function buildSpawnCaption(data) {
  const { rarity, emoji } = getRarity(data.baseXp)
  const movesList = data.moves.map(m => `\n${m}`).join('')
  const abilitiesList = data.abilities.map(a => `\n${a}`).join('')
  return (
    `🎊 *A wild Pokémon has appeared!*\n\n` +
    `🆔 *Poke ID:* ${data.id}\n` +
    `🔖 *Name:* ${data.name}\n\n` +
    `📏 *Height:* ${data.height} m\n` +
    `⚖️ *Weight:* ${data.weight} kg\n\n` +
    `🔄 *Type:* ${data.types.join(' / ')}\n` +
    `🌍 *Location:* ${data.location}\n\n` +
    `🎮 *Moves:*\n${movesList}\n\n` +
    `📊 *Base Experience:* ${data.baseXp}\n` +
    `⭐ *Rarity:* ${emoji} ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}\n\n` +
    `🧬 *Possible Abilities:*\n${abilitiesList}\n\n` +
    `💡 *Hint:*\n> Use *#catch <pokeslot> | <ball type>* to catch this pokemon`
  )
}

// ── Build dex info message ────────────────────────────────────────
function buildDexCaption(data) {
  const movesList = data.moves.slice(0, 4).map(m => `\n${m}`).join('')
  const abilitiesList = data.abilities.map(a => `\n${a}`).join('')
  return (
    `📘 *Pokémon Info*\n\n` +
    `🆔 *ID:* ${data.id}\n` +
    `🔖 *Name:* ${data.name}\n\n` +
    `📏 *Height:* ${data.height} m\n` +
    `⚖️ *Weight:* ${data.weight} kg\n\n` +
    `🔄 *Type:* ${data.types.join(' / ')}\n` +
    `🌍 *Location:* ${data.location}\n\n` +
    `🎮 *Moves:*\n${movesList}\n\n` +
    `🧬 *Abilities:*\n${abilitiesList}\n\n` +
    `📊 *Base Exp:* ${data.baseXp}\n` +
    `🎯 *Catch Rate:* ${data.catchRate}%\n\n` +
    `📝 *Info:* ${data.description}`
  )
}

// ─────────────────────────────────────────────────────────────────
module.exports = {

  // ── #phelp ────────────────────────────────────────────────────
  async phelp({ sock, jid, msg }) {
    const helpText =
      `📜  *𝗣𝗢𝗞𝗘́𝗠𝗢𝗡 𝗔𝗗𝗩𝗔𝗡𝗖𝗘𝗗 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗠𝗘𝗡𝗨* 📜\n\n` +

      `🌿 *START & PROFILE*\n\n` +
      `> *#start* → Begin your Pokémon journey\n` +
      `*#trainer* → View trainer profile card\n` +
      `*#pdaily* → Claim daily rewards\n` +
      `*#quests* → Active missions & rewards\n` +
      `*#rank* → Global trainer ranking\n\n` +

      `🐾 *CATCH & TRAIN*\n\n` +
      `> *#hunt* → Search & encounter wild Pokémon\n` +
      `*#catch / #c <slot> --<ball type>* → Attempt capture\n` +
      `*#spawn* → Spawn rare Pokémon (Event/Staff)\n` +
      `*#team* → View active squad\n` +
      `*#pc* → Pokémon storage system\n` +
      `*#swap <a> <b>* → Rearrange team slot\n\n` +

      `⚔️ *BATTLES*\n\n` +
      `> *#battle @user* → PvP trainer duel\n` +
      `*#gym* → Challenge gym leaders\n` +
      `*#raid* → Raid boss fights\n` +
      `*#heal* → Restore entire team\n` +
      `*#boost* → Temporary battle buff\n\n` +

      `🔄 *EVOLUTION & GROWTH*\n\n` +
      `> *#evolve <slot>* → Evolve Pokémon\n` +
      `*#train <slot>* → Train & gain XP\n` +
      `*#moves <slot>* → View & manage moves\n` +
      `*#learn <slot>* → Unlock new abilities\n` +
      `*#stats <slot>* → Detailed Pokémon stats\n\n` +

      `🛒 *SHOP & ECONOMY*\n\n` +
      `> *#mart* → PokéMart store\n` +
      `*#mbuy <item>* → Purchase items\n` +
      `*#use <item>* → Use item on Pokémon\n` +
      `*#trade @user* → Start Pokémon trade\n` +
      `*#gift <slot> @user* → Send Pokémon\n\n` +

      `🧠 *EXTRA SYSTEMS*\n\n` +
      `> *#dex* → Pokédex database\n` +
      `*#event* → Special limited events\n` +
      `*#legend* → Legendary tracker\n` +
      `*#achieve* → Unlock achievements\n` +
      `*#cooldown* → Check command timers`

    if (fs.existsSync(PHELP_IMAGE)) {
      await sock.sendMessage(jid, { image: { url: PHELP_IMAGE }, caption: helpText }, { quoted: msg })
    } else {
      await sock.sendMessage(jid, { text: helpText }, { quoted: msg })
    }
  },

  // ── #start ────────────────────────────────────────────────────
  async start({ reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    const region = REGIONS[Math.floor(Math.random() * REGIONS.length)]
    const team   = TEAMS[Math.floor(Math.random() * TEAMS.length)]
    await db.updateUser(sender, {
      bio: `A trainer from ${region}`,
    })
    await reply(
      `🌟 *WELCOME TO THE POKÉMON WORLD!*\n\n` +
      `👤 *Trainer:* ${u.name || pushName || sender}\n` +
      `🌍 *Assigned Region:* ${region}\n` +
      `🧭 *Team:* ${team}\n\n` +
      `🎒 *Your journey begins now!*\n\n` +
      `📋 *Getting Started:*\n` +
      `• *#hunt* — Search for wild Pokémon\n` +
      `• *#pdaily* — Claim your daily starter pack\n` +
      `• *#phelp* — View all Pokémon commands\n\n` +
      `_The shadows welcome you, Trainer._ 🖤`
    )
  },

  // ── #trainer ─────────────────────────────────────────────────
  async trainer({ sock, jid, msg, reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const partyPokemon = (pokemon || []).filter(p => p.in_party)
    const region  = u.bio?.includes('from') ? u.bio.replace('A trainer from ', '') : REGIONS[Math.floor(Math.random() * REGIONS.length)]
    const team    = u.team || TEAMS[0]
    const joined  = u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : 'Unknown'

    const profileText =
      `👤 *Trainer Profile*\n\n` +
      `🆔 *Trainer ID:* ${sender.slice(-6)}\n` +
      `🔖 *Name:* ${u.name || pushName || sender}\n\n` +
      `🌍 *Region:* ${region}\n` +
      `🎯 *Level:* ${u.level || 1}\n` +
      `⭐ *XP:* ${(u.xp || 0).toLocaleString()}\n\n` +
      `🏆 *Badges:* ${u.pokemon_badges || 0}\n` +
      `🎒 *Pokémon Owned:* ${(pokemon || []).length}\n\n` +
      `⚔️ *Wins:* ${u.pokemon_wins || 0}\n` +
      `💥 *Losses:* ${u.pokemon_losses || 0}\n\n` +
      `🧭 *Team:* ${team}\n\n` +
      `📝 *Bio:* ${u.bio || 'No bio set.'}\n\n` +
      `📆 *Joined:* ${joined}\n` +
      `🎮 *Registered:* ${joined}`

    // Try to generate a trainer image via pollinations
    const imgPrompt = `anime pokemon trainer card, dark shadow theme, ${u.name || 'Trainer'}, gothic, purple and black, professional card design`
    const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imgPrompt)}?width=600&height=400&nologo=true&model=flux`
    const imgBuf = await downloadBuffer(imgUrl).catch(() => null)

    if (imgBuf) {
      await sock.sendMessage(jid, { image: imgBuf, caption: profileText }, { quoted: msg })
    } else {
      await sock.sendMessage(jid, { text: profileText }, { quoted: msg })
    }
  },

  // ── #pdaily ───────────────────────────────────────────────────
  async pdaily({ reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    const cd = await db.getCooldown(sender, 'pdaily').catch(() => 0)
    if (cd > 0) {
      const hrs  = Math.floor(cd / 3600000)
      const mins = Math.floor((cd % 3600000) / 60000)
      return reply(`⏳ *POKÉMON DAILY ALREADY CLAIMED*\n\n⏰ Come back in *${hrs}h ${mins}m*\n\n_The Pokémon world refreshes each day._ 🖤`)
    }
    const coins   = randInt(300, 800)
    const balls   = randInt(2, 5)
    const expBoost = Math.random() < 0.3
    await db.updateUser(sender, { wallet: (u.wallet || 0) + coins })
    await db.setCooldown(sender, 'pdaily', CD_PDAILY)

    await reply(
      `🎁 *POKÉMON DAILY REWARDS*\n\n` +
      `👤 *Trainer:* ${u.name || sender}\n\n` +
      `💰 *+${coins} coins* added to wallet\n` +
      `🔴 *+${balls} Poké Balls* added to bag\n` +
      `${expBoost ? `⬆️ *EXP Boost activated!* (2 hours)\n` : ''}` +
      `\n🔥 *Streak:* ${(u.streak || 0) + 1} days\n\n` +
      `⏳ Come back in *24 hours*\n\n` +
      `_Keep training, Trainer!_ 🖤`
    )
  },

  // ── #quests ───────────────────────────────────────────────────
  async quests({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const caught  = (pokemon || []).length
    await reply(
      `📋 *ACTIVE QUESTS*\n\n` +
      `👤 *Trainer:* ${u.name || sender}\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `🐾 *Catch 5 Pokémon*\n` +
      `   Progress: ${Math.min(caught, 5)}/5 ${caught >= 5 ? '✅' : '⬜'}\n` +
      `   Reward: 500 coins\n\n` +
      `⚔️ *Win 3 Battles*\n` +
      `   Progress: ${Math.min(u.pokemon_wins || 0, 3)}/3 ${(u.pokemon_wins || 0) >= 3 ? '✅' : '⬜'}\n` +
      `   Reward: 1 Great Ball\n\n` +
      `🎯 *Catch a Rare Pokémon*\n` +
      `   Progress: 0/1 ⬜\n` +
      `   Reward: 200 gems\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `_Complete quests to earn big rewards!_ 🖤`
    )
  },

  // ── #rank ─────────────────────────────────────────────────────
  async rank({ reply }) {
    const top = await db.getLeaderboard(10).catch(() => [])
    if (!top.length) return reply('No trainers ranked yet!')
    const medals = ['🥇', '🥈', '🥉']
    const lines = top.map((u, i) =>
      `${medals[i] || `${i + 1}.`} *${u.name || u.phone}* — Level ${u.level || 1} | XP: ${(u.xp || 0).toLocaleString()}`
    ).join('\n')
    await reply(
      `🏆 *POKÉMON TRAINER RANKINGS*\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `${lines}\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `_Only the strongest claim the top._ 🖤`
    )
  },

  // ── #hunt ─────────────────────────────────────────────────────
  async hunt({ sock, jid, msg, reply, sender }) {
    const cd = await db.getCooldown(sender, 'hunt').catch(() => 0)
    if (cd > 0) {
      const mins = Math.floor(cd / 60000)
      const secs = Math.floor((cd % 60000) / 1000)
      return reply(`⏳ *HUNT COOLDOWN*\n\n⏰ Wait *${mins}m ${secs}s* before hunting again.\n\n_The Pokémon need time to respawn._ 🖤`)
    }
    if (pendingPokemon[jid]) {
      return reply(`⚠️ A wild Pokémon is already here!\n\nUse *#catch <slot> | <ball>* to catch it first!`)
    }
    await db.setCooldown(sender, 'hunt', CD_HUNT)
    await module.exports.spawnPokemon(sock, jid, msg)
  },

  // ── Internal: spawn a wild pokemon ────────────────────────────
  async spawnPokemon(sock, jid, msg) {
    const id   = randInt(1, MAX_POKEMON_ID)
    const data = await fetchPokeData(id).catch(() => null)

    if (!data) {
      pendingPokemon[jid] = {
        id, name: `Shadow-${id}`, types: ['Shadow'],
        baseXp: 60, spawnedAt: Date.now(), imageUrl: null,
        moves: ['Scratch', 'Growl', 'Tackle', 'Leer', 'Quick Attack'],
        abilities: ['Shadow Force'], height: '?', weight: '?', location: 'Unknown',
      }
      await sock.sendMessage(jid, {
        text:
          `🎊 *A wild Pokémon has appeared!*\n\n` +
          `🆔 *Poke ID:* ${id}\n🔖 *Name:* Shadow-${id}\n\n` +
          `💡 *Hint:*\n> Use *#catch <pokeslot> | <ball type>* to catch this pokemon`
      }, { quoted: msg })
      return
    }

    pendingPokemon[jid] = { ...data, spawnedAt: Date.now() }
    const caption = buildSpawnCaption(data)

    if (data.imageUrl) {
      const imgBuf = await downloadBuffer(data.imageUrl).catch(() => null)
      if (imgBuf) {
        await sock.sendMessage(jid, { image: imgBuf, caption }, { quoted: msg })
        setTimeout(() => { if (pendingPokemon[jid]?.id === id) delete pendingPokemon[jid] }, POKE_CATCH_WINDOW)
        return
      }
    }
    await sock.sendMessage(jid, { text: caption }, { quoted: msg })
    setTimeout(() => { if (pendingPokemon[jid]?.id === id) delete pendingPokemon[jid] }, POKE_CATCH_WINDOW)
  },

  // ── #spawnp (staff) ───────────────────────────────────────────
  async spawnp({ sock, jid, msg, reply, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const nameOrId = args[0]?.toLowerCase()
    if (!nameOrId) return reply('⚠️ Usage: *#spawnp <name or id>*')
    await reply(`🔍 Fetching Pokémon data for *${nameOrId}*...`)
    const data = await fetchPokeData(nameOrId).catch(() => null)
    if (!data) return reply(`❌ Pokémon *${nameOrId}* not found on PokéAPI.`)
    pendingPokemon[jid] = { ...data, spawnedAt: Date.now() }
    const caption = buildSpawnCaption(data)
    if (data.imageUrl) {
      const imgBuf = await downloadBuffer(data.imageUrl).catch(() => null)
      if (imgBuf) {
        await sock.sendMessage(jid, { image: imgBuf, caption }, { quoted: msg })
        setTimeout(() => { if (pendingPokemon[jid]?.id === data.id) delete pendingPokemon[jid] }, POKE_CATCH_WINDOW)
        return
      }
    }
    await sock.sendMessage(jid, { text: caption }, { quoted: msg })
    setTimeout(() => { if (pendingPokemon[jid]?.id === data.id) delete pendingPokemon[jid] }, POKE_CATCH_WINDOW)
  },

  // ── #catch / #c ───────────────────────────────────────────────
  async catch({ sock, jid, msg, reply, react, sender, user, args }) {
    const poke = pendingPokemon[jid]
    if (!poke) return reply(`❌ *No wild Pokémon here!*\n\nUse *#hunt* to search for one.`)
    if (Date.now() - poke.spawnedAt > POKE_CATCH_WINDOW) {
      delete pendingPokemon[jid]
      return reply(`⏱️ *Too slow!* The Pokémon fled!\n\n_Be quicker next time._ 🖤`)
    }

    // Parse args: #catch <slot> | <ball>  OR  #catch <slot> --<ball>
    const raw   = args.join(' ')
    const parts = raw.split(/\||\-\-/)
    const slot  = parseInt(parts[0]?.trim()) || 1
    const ball  = (parts[1]?.trim()?.toLowerCase() || 'pokeball').replace(/\s+/g, '')
    const ballKey = Object.keys(BALL_RATES).find(k => k === ball || k.startsWith(ball)) || 'pokeball'
    const ballData = SHOP_ITEMS[ballKey] || SHOP_ITEMS.pokeball

    if (slot < 1 || slot > 6) return reply(`⚠️ Slot must be between 1 and 6.`)

    const u = user || await db.getOrCreateUser(sender)

    // Battle log
    const battleLog = [
      `⚔️ *BATTLE LOG*\n`,
      `🏃 Trainer threw a *${ballData.name}*!`,
      `${poke.name} used *Struggle*!`,
      `📉 *${poke.name}* is weakened...`,
    ]

    const { rarity } = getRarity(poke.baseXp)
    const catchRate  = BALL_RATES[ballKey] || 0.5
    const rarityMod  = rarity === 'legendary' ? 0.3 : rarity === 'epic' ? 0.6 : 1
    const success    = ballKey === 'masterball' ? true : Math.random() < (catchRate * rarityMod)

    delete pendingPokemon[jid]

    if (!success) {
      battleLog.push(`💨 *${poke.name}* broke free!`)
      await react('😢')
      return reply(battleLog.join('\n') + `\n\n_Try a better ball next time._ 🖤`)
    }

    battleLog.push(`✅ *${poke.name}* was caught!`)

    // Calculate XP for catching
    const xpGained = poke.baseXp + randInt(10, 30)
    const newXp    = (u.xp || 0) + xpGained
    const oldLvl   = u.level || 1
    const newLvl   = Math.floor(newXp / 500) + 1
    const leveled  = newLvl > oldLvl

    await db.updateUser(sender, { xp: newXp, level: newLvl })

    // Store pokemon
    try {
      await db.addPokemon(sender, {
        pokemon_id: poke.id,
        name: poke.name,
        types: poke.types,
        level: 1,
        xp: 0,
        moves: poke.moves || [],
        abilities: poke.abilities || [],
        ball: ballKey,
        slot: slot,
        in_party: true,
        base_xp: poke.baseXp,
        height: poke.height,
        weight: poke.weight,
        location: poke.location,
      })
    } catch {}

    await react('🎉')

    const captionLines =
      battleLog.join('\n') + '\n\n' +
      `🎉 *POKÉMON CAUGHT!*\n\n` +
      `📛 *${poke.name}* (No. ${poke.id})\n` +
      `⚡ *Type:* ${poke.types.join(' / ')}\n` +
      `🎯 *Ball Used:* ${ballData.emoji} ${ballData.name}\n` +
      `📍 *Party Slot:* #${slot}\n\n` +
      `⭐ *+${xpGained} XP gained!*\n` +
      (leveled ? `\n🆙 *LEVEL UP!* ${oldLvl} → ${newLvl} 🎊\n` : '') +
      `\n_The shadow garden grows stronger._ 🖤`

    if (poke.imageUrl) {
      const imgBuf = await downloadBuffer(poke.imageUrl).catch(() => null)
      if (imgBuf) {
        await sock.sendMessage(jid, { image: imgBuf, caption: captionLines }, { quoted: msg })
        if (leveled) await _sendLevelUpImage(sock, jid, msg, poke.name, newLvl)
        return
      }
    }
    await sock.sendMessage(jid, { text: captionLines }, { quoted: msg })
    if (leveled) await _sendLevelUpImage(sock, jid, msg, poke.name, newLvl)
  },

  // ── #team ─────────────────────────────────────────────────────
  async team({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party).slice(0, 6)
    if (!party.length) return reply(`❌ *Your team is empty!*\n\nCatch some Pokémon with *#hunt*!`)

    const lines = party.map((p, i) =>
      `*#${i + 1}* ${p.name} | Lvl ${p.level || 1} | XP: ${p.xp || 0}\n` +
      `     Type: ${Array.isArray(p.types) ? p.types.join('/') : p.types || 'N/A'}`
    ).join('\n\n')

    await reply(`⚗ *Team*\n\n👤 *${u.name || sender}*\n\n${lines}\n\n_Your squad awaits battle._ 🖤`)
  },

  // ── #party ────────────────────────────────────────────────────
  async party({ sock, jid, msg, reply, sender, user, pushName, args }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party).slice(0, 6)

    // If a slot index is given, show details
    if (args[0]) {
      const idx = parseInt(args[0]) - 1
      if (isNaN(idx) || idx < 0 || idx >= party.length) return reply(`⚠️ Invalid slot. You have ${party.length} Pokémon in party.`)
      const p = party[idx]
      const moves = Array.isArray(p.moves) ? p.moves.join(', ') : p.moves || 'N/A'
      const abilities = Array.isArray(p.abilities) ? p.abilities.join(', ') : p.abilities || 'N/A'
      return reply(
        `📊 *POKÉMON STATS — Slot #${idx + 1}*\n\n` +
        `📛 *Name:* ${p.name}\n` +
        `🆔 *Pokédex No:* ${p.pokemon_id}\n` +
        `🔮 *Level:* ${p.level || 1}\n` +
        `🪄 *XP:* ${p.xp || 0}\n\n` +
        `🔄 *Type:* ${Array.isArray(p.types) ? p.types.join(' / ') : p.types}\n` +
        `📏 *Height:* ${p.height || '?'} m\n` +
        `⚖️ *Weight:* ${p.weight || '?'} kg\n\n` +
        `🎮 *Moves:* ${moves}\n` +
        `🧬 *Abilities:* ${abilities}\n` +
        `🎱 *Ball:* ${p.ball || 'Poké Ball'}\n\n` +
        `_Use *#stats ${idx + 1}* for full battle stats._ 🖤`
      )
    }

    // Build party caption
    const slots = Array.from({ length: 6 }, (_, i) => {
      const p = party[i]
      if (!p) return `#${i + 1}\n🎈 *Name:* (empty)\n🔮 *Level:* —\n🪄 *XP:* —`
      return (
        `#${i + 1}\n` +
        `🎈 *Name:* ${p.name}\n` +
        `🔮 *Level:* ${p.level || 1}\n` +
        `🪄 *XP:* ${p.xp || 0}`
      )
    }).join('\n\n')

    const caption =
      `⚗ *Party*\n\n` +
      `🎴 *ID:* ${sender.slice(-6)}\n` +
      `🏮 *Username:* ${u.name || pushName || sender}\n` +
      `🧧 *Tag:* @${sender}\n\n` +
      `${slots}\n\n` +
      `[Use *#party <index_number>* to see stats of a Pokémon in your party]\n\n` +
      `> Shadow Pokémon 👥`

    // Try to build party image using Pokemon sprites
    const imgBuf = await _buildPartyImage(party).catch(() => null)
    if (imgBuf) {
      await sock.sendMessage(jid, { image: imgBuf, caption }, { quoted: msg })
    } else {
      await sock.sendMessage(jid, { text: caption }, { quoted: msg })
    }
  },

  // ── #pc ───────────────────────────────────────────────────────
  async pc({ reply, sender }) {
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const stored  = (pokemon || []).filter(p => !p.in_party)
    if (!stored.length) return reply(`📦 *PC STORAGE EMPTY*\n\nAll your Pokémon are in your party.\n\n_Use *#swap* to move Pokémon._ 🖤`)
    const lines = stored.map((p, i) =>
      `${i + 1}. *${p.name}* — Lvl ${p.level || 1} (${Array.isArray(p.types) ? p.types.join('/') : p.types})`
    ).join('\n')
    await reply(`📦 *PC STORAGE*\n\n${lines}\n\n_Use *#t2party <slot>* to add to team._ 🖤`)
  },

  // ── #swap ─────────────────────────────────────────────────────
  async swap({ reply, sender, args }) {
    const [a, b] = [parseInt(args[0]), parseInt(args[1])]
    if (!a || !b || a === b || a < 1 || b < 1 || a > 6 || b > 6) {
      return reply(`⚠️ Usage: *#swap <slot1> <slot2>*\n\nExample: *#swap 1 3*`)
    }
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const pa = party[a - 1], pb = party[b - 1]
    if (!pa) return reply(`❌ No Pokémon in slot #${a}`)
    if (!pb) return reply(`❌ No Pokémon in slot #${b}`)
    try {
      await db.updatePokemon(pa.id, { slot: b })
      await db.updatePokemon(pb.id, { slot: a })
    } catch {}
    await reply(`🔄 *SWAP COMPLETE!*\n\n#${a} ${pa.name} ↔️ #${b} ${pb.name}\n\n_Team formation updated._ 🖤`)
  },

  // ── #dex ──────────────────────────────────────────────────────
  async dex({ sock, jid, msg, reply, args }) {
    const query = args[0]?.toLowerCase()
    if (!query) return reply(`📘 *POKÉDEX*\n\nUsage: *#dex <name or id>*\n\nExample: *#dex pikachu* or *#dex 25*`)
    await sock.sendMessage(jid, { text: `🔍 Searching Pokédex for *${query}*...` }, { quoted: msg })
    const data = await fetchPokeData(query).catch(() => null)
    if (!data) return reply(`❌ *${query}* not found in the Pokédex.`)
    const caption = buildDexCaption(data)
    if (data.imageUrl) {
      const imgBuf = await downloadBuffer(data.imageUrl).catch(() => null)
      if (imgBuf) return await sock.sendMessage(jid, { image: imgBuf, caption }, { quoted: msg })
    }
    await sock.sendMessage(jid, { text: caption }, { quoted: msg })
  },

  // ── #heal ─────────────────────────────────────────────────────
  async heal({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    await reply(`✨ *TEAM HEALED!*\n\n💚 All Pokémon in your party have been fully restored!\n\n_The healing light washes over your team._ 🖤`)
  },

  // ── #boost ────────────────────────────────────────────────────
  async boost({ reply, sender }) {
    const cd = await db.getCooldown(sender, 'pboost').catch(() => 0)
    if (cd > 0) {
      const mins = Math.floor(cd / 60000)
      return reply(`⏳ Boost still active! *${mins}m* remaining.`)
    }
    await db.setCooldown(sender, 'pboost', 30 * 60)
    await reply(`⚡ *BATTLE BOOST ACTIVATED!*\n\n🔥 Your Pokémon gain *+25% ATK & SPD* for the next 30 minutes!\n\n_Unleash the power within!_ 🖤`)
  },

  // ── #battle ───────────────────────────────────────────────────
  async battle({ sock, jid, msg, reply, sender, user, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply(`⚠️ Usage: *#battle @user*`)
    const opponentJid   = mentioned[0]
    const opponentPhone = opponentJid.split('@')[0]
    if (opponentPhone === sender) return reply(`❌ You can't battle yourself!`)

    const u = user || await db.getOrCreateUser(sender)
    const myPokemon = await db.getUserPokemon(sender).catch(() => [])
    const myParty   = (myPokemon || []).filter(p => p.in_party)
    if (!myParty.length) return reply(`❌ You need Pokémon in your party!\n\nUse *#hunt* to catch some.`)

    const theirPokemon = await db.getUserPokemon(opponentPhone).catch(() => [])
    const theirParty   = (theirPokemon || []).filter(p => p.in_party)
    if (!theirParty.length) return reply(`❌ *@${opponentPhone}* has no Pokémon in their party!`, )

    const mine   = myParty[0]
    const theirs = theirParty[0]
    const win    = Math.random() > 0.5

    const log = [
      `⚔️ *TRAINER BATTLE!*\n`,
      `*${u.name || sender}* vs *@${opponentPhone}*\n`,
      `🔵 *${mine.name}* (Lvl ${mine.level || 1}) vs 🔴 *${theirs.name}* (Lvl ${theirs.level || 1})\n`,
      `━━━━━━━━━━━━━━━━━━\n`,
      `${mine.name} used *${(Array.isArray(mine.moves) ? mine.moves[0] : 'Tackle') || 'Tackle'}*!`,
      `${theirs.name} used *${(Array.isArray(theirs.moves) ? theirs.moves[0] : 'Scratch') || 'Scratch'}*!`,
      win
        ? `💥 ${mine.name} lands a *critical hit!*`
        : `💥 ${theirs.name} lands a *critical hit!*`,
      win
        ? `\n🏆 *${u.name || sender} WINS!*`
        : `\n💥 *@${opponentPhone} WINS!*`,
    ]

    if (win) {
      const xpGain = 50 + randInt(10, 30)
      await db.updateUser(sender, { xp: (u.xp || 0) + xpGain, pokemon_wins: (u.pokemon_wins || 0) + 1 })
      log.push(`\n⭐ *+${xpGain} XP* earned!`)
    } else {
      await db.updateUser(sender, { pokemon_losses: (u.pokemon_losses || 0) + 1 })
    }

    await sock.sendMessage(jid, { text: log.join('\n'), mentions: [opponentJid] }, { quoted: msg })
  },

  // ── #gym ──────────────────────────────────────────────────────
  async gym({ reply, sender, user }) {
    const leaders = ['Brock', 'Misty', 'Lt. Surge', 'Erika', 'Koga', 'Sabrina', 'Blaine', 'Giovanni']
    const leader  = leaders[Math.floor(Math.random() * leaders.length)]
    const win     = Math.random() > 0.4
    const u       = user || await db.getOrCreateUser(sender)
    if (win) {
      const badge = (u.pokemon_badges || 0) + 1
      await db.updateUser(sender, { pokemon_badges: badge, xp: (u.xp || 0) + 100 })
      await reply(
        `🏅 *GYM BATTLE — ${leader.toUpperCase()}!*\n\n` +
        `⚔️ A fierce battle erupted!\n\n` +
        `🏆 *YOU WIN!*\n\n` +
        `🥇 Badge earned! Total: ${badge}\n` +
        `⭐ +100 XP\n\n` +
        `_${leader} bows in defeat._ 🖤`
      )
    } else {
      await reply(
        `🏅 *GYM BATTLE — ${leader.toUpperCase()}!*\n\n` +
        `⚔️ A fierce battle erupted!\n\n` +
        `💥 *DEFEAT!* ${leader} was too strong.\n\n` +
        `_Train harder and return._ 🖤`
      )
    }
  },

  // ── #raid ─────────────────────────────────────────────────────
  async raid({ reply, sender, user, jid }) {
    const bosses = [
      { name: 'Mega Mewtwo', hp: 10000, xp: 500 },
      { name: 'Shadow Kyogre', hp: 8000, xp: 400 },
      { name: 'Dark Rayquaza', hp: 9000, xp: 450 },
    ]
    const boss = bosses[Math.floor(Math.random() * bosses.length)]
    const win  = Math.random() > 0.5
    const u    = user || await db.getOrCreateUser(sender)
    if (win) {
      await db.updateUser(sender, { xp: (u.xp || 0) + boss.xp, wallet: (u.wallet || 0) + 2000 })
      await reply(
        `🔥 *RAID BOSS — ${boss.name.toUpperCase()}!*\n\n` +
        `💪 HP: ${boss.hp.toLocaleString()}\n\n` +
        `⚔️ Epic battle ensues...\n` +
        `💥 Critical combo strikes land!\n\n` +
        `🏆 *RAID CLEARED!*\n\n` +
        `⭐ +${boss.xp} XP\n💰 +2,000 coins\n\n` +
        `_The shadows conquered even this beast._ 🖤`
      )
    } else {
      await reply(
        `🔥 *RAID BOSS — ${boss.name.toUpperCase()}!*\n\n` +
        `💪 HP: ${boss.hp.toLocaleString()}\n\n` +
        `⚔️ Brutal battle...\n\n` +
        `💔 *RAID FAILED!*\n\n` +
        `_Gather more trainers and try again._ 🖤`
      )
    }
  },

  // ── #evolve ───────────────────────────────────────────────────
  async evolve({ sock, jid, msg, reply, sender, args }) {
    const slot = parseInt(args[0]) || 1
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`❌ No Pokémon in slot #${slot}`)

    // Fetch evolution data from PokeAPI
    const data = await fetchPokeData(p.pokemon_id).catch(() => null)
    await reply(
      `🔄 *EVOLUTION!*\n\n` +
      `✨ *${p.name}* is evolving...\n\n` +
      `🌟 A bright light engulfs ${p.name}!\n\n` +
      `🎊 *Evolution complete!*\n\n` +
      `_The power within has awakened._ 🖤`
    )
  },

  // ── #train ────────────────────────────────────────────────────
  async train({ reply, sender, user, args }) {
    const slot = parseInt(args[0]) || 1
    const cd = await db.getCooldown(sender, `ptrain${slot}`).catch(() => 0)
    if (cd > 0) {
      const mins = Math.floor(cd / 60000)
      return reply(`⏳ *Training Cooldown*\n\nWait *${mins}m* before training slot #${slot} again.`)
    }
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`❌ No Pokémon in slot #${slot}`)

    const xpGain  = randInt(20, 60)
    const newXp   = (p.xp || 0) + xpGain
    const newLvl  = Math.floor(newXp / 200) + 1
    const leveled = newLvl > (p.level || 1)

    try { await db.updatePokemon(p.id, { xp: newXp, level: newLvl }) } catch {}
    await db.setCooldown(sender, `ptrain${slot}`, 15 * 60)

    await reply(
      `💪 *TRAINING COMPLETE!*\n\n` +
      `📛 *${p.name}* trained hard!\n\n` +
      `⭐ *+${xpGain} XP* gained!\n` +
      `🔮 *XP:* ${newXp}\n` +
      (leveled ? `\n🆙 *LEVEL UP!* → Level ${newLvl} 🎊\n` : '') +
      `\n⏰ Train again in 15 minutes.\n\n` +
      `_Strength comes from dedication._ 🖤`
    )
  },

  // ── #moves ────────────────────────────────────────────────────
  async moves({ reply, sender, args }) {
    const slot = parseInt(args[0]) || 1
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`❌ No Pokémon in slot #${slot}`)
    const moveList = Array.isArray(p.moves) ? p.moves : [p.moves || 'Tackle']
    const lines = moveList.map((m, i) => `${i + 1}. *${m}*`).join('\n')
    await reply(
      `🎮 *${p.name.toUpperCase()} — MOVES*\n\n` +
      `${lines}\n\n` +
      `_Use *#learn ${slot}* to unlock new moves._ 🖤`
    )
  },

  // ── #learn ────────────────────────────────────────────────────
  async learn({ reply, sender, args }) {
    const slot = parseInt(args[0]) || 1
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`❌ No Pokémon in slot #${slot}`)
    // Fetch new move from PokéAPI
    const data = await fetchPokeData(p.pokemon_id).catch(() => null)
    const allMoves = data?.moves || []
    const newMove  = allMoves[Math.floor(Math.random() * allMoves.length)] || 'Hyper Beam'
    const curMoves = Array.isArray(p.moves) ? p.moves : [p.moves || 'Tackle']
    if (!curMoves.includes(newMove)) {
      curMoves.push(newMove)
      try { await db.updatePokemon(p.id, { moves: curMoves.slice(0, 8) }) } catch {}
    }
    await reply(
      `📚 *MOVE LEARNED!*\n\n` +
      `📛 *${p.name}* learned *${newMove}*!\n\n` +
      `🎮 Current moves:\n${curMoves.slice(0, 8).map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\n` +
      `_New power acquired._ 🖤`
    )
  },

  // ── #stats ────────────────────────────────────────────────────
  async stats({ reply, sender, args }) {
    const slot = parseInt(args[0]) || 1
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`❌ No Pokémon in slot #${slot}`)
    const lvl = p.level || 1
    const atk = 50 + lvl * 5 + randInt(0, 10)
    const def = 40 + lvl * 4 + randInt(0, 8)
    const spd = 45 + lvl * 3 + randInt(0, 6)
    const hp  = 200 + lvl * 15
    await reply(
      `📊 *DETAILED STATS — ${p.name.toUpperCase()}*\n\n` +
      `🆔 *Pokédex No:* ${p.pokemon_id}\n` +
      `🔮 *Level:* ${lvl}\n` +
      `🪄 *XP:* ${p.xp || 0} / ${lvl * 200}\n\n` +
      `❤️ *HP:* ${hp}\n` +
      `⚔️ *ATK:* ${atk}\n` +
      `🛡️ *DEF:* ${def}\n` +
      `💨 *SPD:* ${spd}\n\n` +
      `🔄 *Type:* ${Array.isArray(p.types) ? p.types.join(' / ') : p.types}\n` +
      `📏 *Height:* ${p.height || '?'} m\n` +
      `⚖️ *Weight:* ${p.weight || '?'} kg\n\n` +
      `_Power is measured in more than numbers._ 🖤`
    )
  },

  // ── #mart ─────────────────────────────────────────────────────
  async mart({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const coins   = Object.entries(SHOP_ITEMS).filter(([, v]) => !v.gem).map(([k, v]) => `${v.emoji} *${v.name}* — $${v.price}`).join('\n')
    const gemItems = Object.entries(SHOP_ITEMS).filter(([, v]) => v.gem).map(([k, v]) => `${v.emoji} *${v.name}* — ${v.price} gems`).join('\n')
    await reply(
      `🛒 *POKÉMART*\n\n` +
      `💰 *Your Coins:* $${(u.wallet || 0).toLocaleString()}\n` +
      `💎 *Your Gems:* ${u.gems || 0}\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `🏪 *ITEMS (Coins)*\n${coins}\n\n` +
      `💜 *PREMIUM (Gems)*\n${gemItems}\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `💡 Use *#mbuy <item>* to purchase\n\n` +
      `_The mart has everything a trainer needs._ 🖤`
    )
  },

  // ── #mbuy ─────────────────────────────────────────────────────
  async mbuy({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const key = args[0]?.toLowerCase()
    if (!key) return reply(`⚠️ Usage: *#mbuy <item>*\n\nSee *#mart* for items.`)
    const entry = Object.entries(SHOP_ITEMS).find(([k, v]) => k === key || v.name.toLowerCase().includes(key))
    if (!entry) return reply(`❌ Item "*${key}*" not found. Check *#mart*`)
    const [itemKey, item] = entry
    if (item.gem) {
      if ((u.gems || 0) < item.price) return reply(`❌ Not enough gems! Need *${item.price} gems*`)
      await db.updateUser(sender, { gems: (u.gems || 0) - item.price })
    } else {
      if ((u.wallet || 0) < item.price) return reply(`❌ Not enough coins! Need *$${item.price}*`)
      await db.updateUser(sender, { wallet: (u.wallet || 0) - item.price })
    }
    try {
      await db.addItem(sender, itemKey, 1)
    } catch {}
    await reply(
      `✅ *PURCHASE SUCCESSFUL!*\n\n` +
      `${item.emoji} *${item.name}* added to your bag!\n\n` +
      `💰 *Remaining:* ${item.gem ? `${(u.gems || 0) - item.price} gems` : `$${((u.wallet || 0) - item.price).toLocaleString()}`}\n\n` +
      `_Use *#use ${itemKey}* to use this item._ 🖤`
    )
  },

  // ── #use ──────────────────────────────────────────────────────
  async use({ reply, sender, user, args }) {
    const itemKey = args[0]?.toLowerCase()
    if (!itemKey) return reply(`⚠️ Usage: *#use <item>*`)
    const item = SHOP_ITEMS[itemKey]
    if (!item) return reply(`❌ Item not found. Check *#mart*`)
    await reply(
      `✨ *ITEM USED!*\n\n` +
      `${item.emoji} *${item.name}* activated!\n\n` +
      `${item.type === 'heal' ? '💚 Your Pokémon have been healed!' :
        item.type === 'boost' ? '⚡ Battle stats boosted for 30 mins!' :
        item.type === 'ball' ? '🎯 Ball added to your bag!' :
        item.type === 'evolution' ? '🌟 Evolution stone ready! Use #evolve <slot>' :
        '✅ Item effect applied!'}\n\n` +
      `_Use your items wisely._ 🖤`
    )
  },

  // ── #trade ────────────────────────────────────────────────────
  async trade({ sock, jid, msg, reply, sender, user, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply(`⚠️ Usage: *#trade @user*`)
    const targetPhone = mentioned[0].split('@')[0]
    if (targetPhone === sender) return reply(`❌ Can't trade with yourself!`)
    await sock.sendMessage(jid, {
      text: `🔄 *TRADE REQUEST*\n\n*@${sender}* wants to trade with *@${targetPhone}*!\n\n_Feature coming soon — use *#gift* to send Pokémon directly._ 🖤`,
      mentions: [msg.key.participant || msg.key.remoteJid, mentioned[0]],
    }, { quoted: msg })
  },

  // ── #gift ─────────────────────────────────────────────────────
  async gift({ sock, jid, msg, reply, sender, user, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const slot = parseInt(args[0]) || 1
    if (!mentioned.length) return reply(`⚠️ Usage: *#gift <slot> @user*`)
    const targetPhone = mentioned[0].split('@')[0]
    if (targetPhone === sender) return reply(`❌ Can't gift to yourself!`)

    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`❌ No Pokémon in slot #${slot}`)

    try {
      await db.updatePokemon(p.id, { phone: targetPhone })
    } catch {}

    await sock.sendMessage(jid, {
      text: `🎁 *POKÉMON GIFTED!*\n\n*@${sender}* sent *${p.name}* to *@${targetPhone}*!\n\n_A generous trainer!_ 🖤`,
      mentions: [msg.key.participant || msg.key.remoteJid, mentioned[0]],
    }, { quoted: msg })
  },

  // ── #event ────────────────────────────────────────────────────
  async event({ reply }) {
    await reply(
      `🎉 *SPECIAL EVENTS*\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `🌑 *Shadow Festival* — Ongoing\n` +
      `   Increased shiny rates!\n` +
      `   Dark & Ghost type spawns boosted!\n\n` +
      `⭐ *Legendary Weekend* — Every Friday–Sunday\n` +
      `   Legendary spawn rate x2\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `_Check back often for new events!_ 🖤`
    )
  },

  // ── #legend ───────────────────────────────────────────────────
  async legend({ reply, sender }) {
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const legendaries = (pokemon || []).filter(p => {
      const bxp = p.base_xp || 0
      return bxp > 300
    })
    if (!legendaries.length) return reply(`🌟 *LEGENDARY TRACKER*\n\nYou haven't caught any Legendaries yet!\n\nKeep hunting — they appear rarely.\n\n_The legends await discovery._ 🖤`)
    const lines = legendaries.map(p => `✨ *${p.name}* — Lvl ${p.level || 1}`).join('\n')
    await reply(`🌟 *YOUR LEGENDARIES*\n\n${lines}\n\n_Rare power is yours._ 🖤`)
  },

  // ── #achieve ──────────────────────────────────────────────────
  async achieve({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const caught = (pokemon || []).length
    const wins   = u.pokemon_wins || 0
    const badges = u.pokemon_badges || 0

    const achievements = [
      { name: 'First Catch',    done: caught >= 1,  emoji: '🔴' },
      { name: 'Collector',      done: caught >= 10,  emoji: '🟠' },
      { name: 'Pokémon Master', done: caught >= 50,  emoji: '🟡' },
      { name: 'First Battle',   done: wins >= 1,     emoji: '⚔️' },
      { name: 'Champion',       done: wins >= 10,    emoji: '🏆' },
      { name: 'Badge Collector',done: badges >= 4,   emoji: '🥇' },
      { name: 'Gym Master',     done: badges >= 8,   emoji: '🎖️' },
    ]

    const lines = achievements.map(a => `${a.done ? '✅' : '⬜'} ${a.emoji} ${a.name}`).join('\n')
    await reply(
      `🏅 *ACHIEVEMENTS*\n\n` +
      `👤 *${u.name || sender}*\n\n` +
      `${lines}\n\n` +
      `📊 Progress: ${achievements.filter(a => a.done).length}/${achievements.length}\n\n` +
      `_Every achievement tells your story._ 🖤`
    )
  },

  // ── #cooldown ─────────────────────────────────────────────────
  async cooldown({ reply, sender }) {
    const cmds = ['pdaily', 'hunt', 'pboost']
    const results = await Promise.all(cmds.map(async c => {
      const cd = await db.getCooldown(sender, c).catch(() => 0)
      const mins = Math.floor(cd / 60000)
      const secs = Math.floor((cd % 60000) / 1000)
      return `${cd > 0 ? '⏳' : '✅'} *${c}* — ${cd > 0 ? `${mins}m ${secs}s` : 'Ready!'}`
    }))
    await reply(`⏱️ *COMMAND COOLDOWNS*\n\n${results.join('\n')}\n\n_Patience is a trainer's strength._ 🖤`)
  },

  // ── Legacy aliases ────────────────────────────────────────────
  async wb(ctx) { return module.exports.hunt(ctx) },

  // ── Mention sticker: #setms / #delms ──────────────────────────
  async setms({ sock, jid, msg, reply, sender }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    if (!quoted || !quoted.stickerMessage) {
      return reply(`⚠️ *HOW TO USE:*\n\nReply to a *sticker* with *.setms*\n\nThis sticker will be sent when someone tags you!\n\n_Make it iconic._ 🖤`)
    }

    // Download the quoted sticker
    const stanzaId     = msg.message.extendedTextMessage.contextInfo.stanzaId
    const participant  = msg.message.extendedTextMessage.contextInfo.participant || jid
    const stickerMsg   = {
      key: { remoteJid: jid, id: stanzaId, participant },
      message: quoted,
    }

    try {
      const { downloadMediaMessage } = require('@whiskeysockets/baileys')
      const buffer = await downloadMediaMessage(stickerMsg, 'buffer', {}, {
        logger: { level: () => {}, info: () => {}, warn: () => {}, error: () => {} },
        reuploadRequest: sock.updateMediaMessage,
      })
      const b64 = buffer.toString('base64')
      const ms  = loadMS()
      ms[sender] = { data: b64, mime: 'image/webp', setAt: Date.now() }
      saveMS(ms)
      await reply(`✅ *MENTION STICKER SET!*\n\nNow when someone tags you, the bot will reply with your sticker!\n\nUse *.delms* to remove it.\n\n_Your sticker is ready._ 🖤`)
    } catch (err) {
      await reply(`❌ Failed to save sticker: ${err.message}`)
    }
  },

  async delms({ reply, sender }) {
    const ms = loadMS()
    if (!ms[sender]) return reply(`⚠️ You don't have a mention sticker set.\n\nUse *.setms* by replying to a sticker.`)
    delete ms[sender]
    saveMS(ms)
    await reply(`🗑️ *MENTION STICKER REMOVED.*\n\n_You will no longer auto-reply to tags._ 🖤`)
  },

  // Expose the store for index.js to use
  getMentionStickers: loadMS,

  // ── Pokemon on/off (staff) ────────────────────────────────────
  async pokemon({ jid, reply, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const toggle = args[0]?.toLowerCase()
    if (toggle === 'on') {
      await db.updateGroup(jid, { pokemon_enabled: true })
      await reply(`✅ *Pokémon System ENABLED* in this group!\n\nUse *#hunt* to start catching.`)
    } else if (toggle === 'off') {
      await db.updateGroup(jid, { pokemon_enabled: false })
      await reply(`❌ *Pokémon System DISABLED* in this group.`)
    } else {
      await reply(`⚠️ Usage: *.pokemon on/off*`)
    }
  },
}

// ── Internal helpers ──────────────────────────────────────────────
async function _sendLevelUpImage(sock, jid, msg, pokeName, newLvl) {
  try {
    const prompt = `epic pokemon level up animation glow, ${pokeName}, level ${newLvl}, golden light burst, dark background`
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&model=flux`
    const buf = await downloadBuffer(url).catch(() => null)
    if (buf) {
      await sock.sendMessage(jid, {
        image: buf,
        caption: `🆙 *LEVEL UP!*\n\n✨ *${pokeName}* grew to Level *${newLvl}*!\n\n_Power evolves within the shadows._ 🖤`,
      }, { quoted: msg })
    }
  } catch {}
}

async function _buildPartyImage(party) {
  // Try to use jimp to build a composite 3x2 party image
  let Jimp
  try { Jimp = require('jimp') } catch { return null }

  const W = 480, H = 320
  const cellW = W / 3, cellH = H / 2
  let base

  try {
    base = await Jimp.create(W, H, 0x1a1a2eff)
  } catch {
    try { base = new Jimp(W, H, 0x1a1a2eff) } catch { return null }
  }

  for (let i = 0; i < Math.min(party.length, 6); i++) {
    const p = party[i]
    const imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.pokemon_id}.png`
    try {
      const buf = await downloadBuffer(imgUrl)
      if (!buf) continue
      let sprite
      try { sprite = await Jimp.read(buf) } catch { continue }
      sprite.resize(cellW - 8, cellH - 8)
      const x = (i % 3) * cellW + 4
      const y = Math.floor(i / 3) * cellH + 4
      base.composite(sprite, x, y)
    } catch {}
  }

  return await base.getBufferAsync(Jimp.MIME_PNG)
}
