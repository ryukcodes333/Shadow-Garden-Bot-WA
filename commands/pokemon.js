const db = require('../database')
const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')

const PHELP_IMAGE = path.join(__dirname, '../assets/phelp.jpg')

// ── Pending wild pokemon & battles ───────────────────────────────
const pendingPokemon = {}
const activeBattles  = {}

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
  pokeball:     { name: 'Poké Ball',     price: 200,  emoji: '🔴', type: 'ball' },
  greatball:    { name: 'Great Ball',    price: 600,  emoji: '🔵', type: 'ball' },
  ultraball:    { name: 'Ultra Ball',    price: 1200, emoji: '🟡', type: 'ball' },
  masterball:   { name: 'Master Ball',   price: 50,   emoji: '💜', type: 'ball',  gem: true },
  potion:       { name: 'Potion',        price: 300,  emoji: '🧪', type: 'heal' },
  superpotion:  { name: 'Super Potion',  price: 700,  emoji: '💉', type: 'heal' },
  fullrestore:  { name: 'Full Restore',  price: 3000, emoji: '✨', type: 'heal' },
  revive:       { name: 'Revive',        price: 1500, emoji: '💫', type: 'revive' },
  luckycharm:   { name: 'Lucky Charm',   price: 500,  emoji: '🍀', type: 'boost' },
  expboost:     { name: 'EXP Booster',   price: 800,  emoji: '⬆️', type: 'boost' },
  shadowstone:  { name: 'Shadow Stone',  price: 100,  emoji: '🌑', type: 'evolution', gem: true },
  firestone:    { name: 'Fire Stone',    price: 50,   emoji: '🔥', type: 'evolution', gem: true },
  waterstone:   { name: 'Water Stone',   price: 50,   emoji: '💧', type: 'evolution', gem: true },
  thunderstone: { name: 'Thunder Stone', price: 50,   emoji: '⚡', type: 'evolution', gem: true },
  leafstone:    { name: 'Leaf Stone',    price: 50,   emoji: '🍃', type: 'evolution', gem: true },
}

const RARITY_TABLE = [
  { max: 100,  rarity: 'common',    emoji: '⚪' },
  { max: 200,  rarity: 'rare',      emoji: '🟢' },
  { max: 300,  rarity: 'epic',      emoji: '🔵' },
  { max: 9999, rarity: 'legendary', emoji: '🟡' },
]

const REGIONS = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Paldea']
const TEAMS   = ['Valor', 'Mystic', 'Instinct', 'Shadow']

// ── Utilities ─────────────────────────────────────────────────────
function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)) }

function getRarity(baseXp) {
  return RARITY_TABLE.find(r => baseXp <= r.max) || RARITY_TABLE[RARITY_TABLE.length - 1]
}

function capName(s) {
  if (!s) return 'Unknown'
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')
}

// ── HTTP helpers ──────────────────────────────────────────────────
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

function downloadBuffer(url, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
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

// ── PokeAPI evolution chain helper ────────────────────────────────
async function getPokeEvolutionTarget(pokemonId, pokemonName) {
  try {
    const species = await fetchJSON(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`)
    if (!species?.evolution_chain?.url) return null
    const evoChain = await fetchJSON(species.evolution_chain.url)
    if (!evoChain?.chain) return null
    // Walk the chain to find our pokemon and return what it evolves into
    function findEvolvesTo(node) {
      const nodeName = (node.species?.name || '').toLowerCase()
      const nameMatch = nodeName === pokemonName.toLowerCase()
      const idMatch   = (node.species?.url || '').includes(`/${pokemonId}/`)
      if (nameMatch || idMatch) {
        if (node.evolves_to?.length > 0) return node.evolves_to[0].species.name
        return null
      }
      for (const child of (node.evolves_to || [])) {
        const found = findEvolvesTo(child)
        if (found !== undefined) return found
      }
    }
    return findEvolvesTo(evoChain.chain) || null
  } catch { return null }
}

// ── PokeAPI ───────────────────────────────────────────────────────
async function fetchPokeData(nameOrId) {
  const poke = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${nameOrId}`)
  if (!poke) return null

  let location = 'Unknown'
  try {
    const enc = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${poke.id}/encounters`)
    if (enc && enc.length > 0) {
      const raw = enc[0].location_area?.name || ''
      location = raw.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Unknown'
    }
  } catch {}

  let description = 'No description available.'
  let catchRate   = 45
  try {
    const species = await fetchJSON(`https://pokeapi.co/api/v2/pokemon-species/${poke.id}`)
    if (species) {
      catchRate = species.capture_rate || 45
      const entry = (species.flavor_text_entries || []).find(e => e.language?.name === 'en')
      if (entry) description = entry.flavor_text.replace(/[\f\n]/g, ' ').trim()
    }
  } catch {}

  const getStat = (name) => (poke.stats || []).find(s => s?.stat?.name === name)?.base_stat || 45

  return {
    id:          poke.id,
    name:        capName(poke.name),
    types:       (poke.types || []).map(t => capName(t?.type?.name)),
    baseXp:      poke.base_experience || 50,
    height:      ((poke.height || 0) / 10).toFixed(1),
    weight:      ((poke.weight || 0) / 10).toFixed(1),
    moves:       (poke.moves || []).slice(0, 5).map(m => capName(m?.move?.name)),
    abilities:   (poke.abilities || []).map(a => capName(a?.ability?.name)),
    hp:          getStat('hp'),
    attack:      getStat('attack'),
    defense:     getStat('defense'),
    speed:       getStat('speed'),
    location,
    description,
    catchRate:   Math.round((catchRate / 255) * 100),
    imageUrl:    poke.sprites?.other?.['official-artwork']?.front_default || poke.sprites?.front_default || null,
  }
}

// ── Captions ──────────────────────────────────────────────────────
const WEATHER_BOOSTS = ['Sunny ☀️', 'Rainy 🌧️', 'Windy 🌬️', 'Cloudy ⛅', 'Snowy ❄️', 'Foggy 🌫️', 'Stormy ⚡']
const MOODS = ['curious', 'aggressive', 'playful', 'timid', 'confused', 'hungry', 'sleepy', 'excited']
const STATUSES = ['Wild 🟢', 'Weakened 🔴', 'Energized ⚡', 'Cautious 👀', 'Raging 🔥']

function buildSpawnCaption(data, extras = {}) {
  const level   = extras.level   || randInt(2, 50)
  const weather = extras.weather || WEATHER_BOOSTS[Math.floor(Math.random() * WEATHER_BOOSTS.length)]
  const mood    = extras.mood    || MOODS[Math.floor(Math.random() * MOODS.length)]
  const status  = extras.status  || STATUSES[Math.floor(Math.random() * STATUSES.length)]
  const maxHp   = data.hp || 45
  const curHp   = Math.floor(maxHp * (0.5 + Math.random() * 0.5))
  const pokeball  = extras.pokeball  ?? randInt(1, 8)
  const greatball = extras.greatball ?? randInt(0, 4)
  const ultraball = extras.ultraball ?? randInt(0, 2)
  const berry     = extras.berry     ?? randInt(0, 5)
  const ability = (data.abilities && data.abilities.length) ? data.abilities[0] : 'Unknown'

  return (
    `🎊 *A wild Pokémon has appeared!* 🎊\n\n` +
    `*📛 Name:* ${data.name}\n` +
    `*✨ Level:* ${level}\n` +
    `*⚡ Type:* ${data.types.join(' / ')}\n` +
    `*🔥 Ability:* ${ability}\n` +
    `*❤️ HP:* ${curHp}/${maxHp}\n` +
    `*⚔️ Attack:* ${data.attack || 50}\n` +
    `*🛡️ Defense:* ${data.defense || 45}\n` +
    `*💨 Speed:* ${data.speed || 45}\n\n` +
    `*📍 Location:* ${data.location}\n` +
    `*🌦️ Weather Boost:* ${weather}\n` +
    `*✨ Status:* ${status}\n\n` +
    `👀 The wild ${data.name} is staring at you… it looks ${mood}.\n\n` +
    `💭 It might flee if you hesitate too long!\n\n` +
    `*🎒 Your Items:*\n` +
    `*  🟡 Poké Ball × ${pokeball}*\n` +
    `*  🔵 Great Ball × ${greatball}*\n` +
    `*  🔴 Ultra Ball × ${ultraball}*\n` +
    `*  🍓 Berry × ${berry}*\n\n` +
    `🌀 What will you do?\n\n` +
    `> *#catch <slot> | <ball>* — Catch the Pokémon\n` +
    `> *.fight* — Battle it with your moves\n` +
    `> *.flee* — Escape safely (maybe…)`
  )
}

function buildDexCaption(data) {
  return (
    `📘 *Pokémon Info*\n\n` +
    `🆔 *ID:* ${data.id}\n` +
    `🔖 *Name:* ${data.name}\n\n` +
    `📏 *Height:* ${data.height} m\n` +
    `⚖️ *Weight:* ${data.weight} kg\n\n` +
    `🔄 *Type:* ${data.types.join(' / ')}\n` +
    `🌍 *Location:* ${data.location}\n\n` +
    `🎮 *Moves:*\n${data.moves.slice(0, 4).join('\n')}\n\n` +
    `🧬 *Abilities:*\n${data.abilities.join('\n')}\n\n` +
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
      `📜 *𝗣𝗢𝗞𝗘́𝗠𝗢𝗡 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗠𝗘𝗡𝗨* 📜\n\n` +
      `🌿 *START & PROFILE*\n> *#start* → Begin your Pokémon journey\n*#trainer* → View trainer profile card\n*#pdaily* → Claim daily rewards\n*#quests* → Active missions & rewards\n*#rank* → Global trainer ranking\n\n` +
      `🐾 *CATCH & TRAIN*\n> *#hunt* → Search & encounter wild Pokémon\n*#catch / #c <slot> --<ball type>* → Attempt capture\n*#team* → View active squad\n*#pc* → Pokémon storage system\n*#swap <a> <b>* → Rearrange team slots\n\n` +
      `⚔️ *BATTLES*\n> *#battle @user* → PvP trainer duel\n*#gym* → Challenge gym leaders\n*#raid* → Raid boss fights\n*#heal* → Restore entire team\n*#boost* → Temporary battle buff\n\n` +
      `🔄 *EVOLUTION & GROWTH*\n> *#evolve <slot>* → Evolve Pokémon\n*#train <slot>* → Train & gain XP\n*#moves <slot>* → View & manage moves\n*#learn <slot>* → Unlock new abilities\n*#stats <slot>* → Detailed Pokémon stats\n\n` +
      `🛒 *SHOP & ECONOMY*\n> *#mart* → PokéMart store\n*#mbuy <item>* → Purchase items\n*#use <item>* → Use item on Pokémon\n*#trade @user* → Start Pokémon trade\n*#gift <slot> @user* → Send Pokémon\n\n` +
      `🧠 *EXTRA SYSTEMS*\n> *#dex <name/id>* → Pokédex database\n*#event* → Special limited events\n*#legend* → Legendary tracker\n*#achieve* → Unlock achievements\n*#cooldown* → Check command timers`

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
    await db.updateUser(sender, { bio: `A trainer from ${region}` })
    await reply(
      `🌟 *WELCOME TO THE POKÉMON WORLD!*\n\n` +
      `👤 *Trainer:* ${u.name || pushName || sender}\n` +
      `🌍 *Assigned Region:* ${region}\n` +
      `🧭 *Team:* ${team}\n\n` +
      `🎒 *Your journey begins now!*\n\n` +
      `• *#hunt* — Search for wild Pokémon\n` +
      `• *#pdaily* — Claim your daily starter pack\n` +
      `• *#phelp* — View all Pokémon commands\n\n` +
      `_The shadows welcome you, Trainer._ 🖤`
    )
  },

  // ── #trainer ──────────────────────────────────────────────────
  async trainer({ sock, jid, msg, reply, sender, user, pushName }) {
    const u       = user || await db.getOrCreateUser(sender, pushName)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const region  = (u.bio || '').includes('from') ? u.bio.replace('A trainer from ', '') : 'Unknown'
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
      `📝 *Bio:* ${u.bio || 'No bio set.'}\n` +
      `📆 *Joined:* ${joined}`

    // Pick a "signature" Pokémon for this trainer — seeded from their phone number
    const seed    = parseInt(sender.replace(/\D/g, '').slice(-4) || '1') || 1
    const pokeId  = (seed % 898) + 1   // stay within Gen 1-8 for best artwork coverage
    const artUrl  = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeId}.png`

    try {
      await sock.sendMessage(jid, {
        image: { url: artUrl },
        caption: profileText,
      }, { quoted: msg })
    } catch {
      // Fallback: home-gen sprite (smaller, always available)
      const fallbackUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokeId}.png`
      try {
        await sock.sendMessage(jid, { image: { url: fallbackUrl }, caption: profileText }, { quoted: msg })
      } catch {
        await reply(profileText)
      }
    }
  },

  // ── #pdaily ───────────────────────────────────────────────────
  async pdaily({ reply, sender, user, pushName }) {
    const u  = user || await db.getOrCreateUser(sender, pushName)
    const cd = await db.getCooldown(sender, 'pdaily').catch(() => 0)
    if (cd > 0) {
      const hrs  = Math.floor(cd / 3600000)
      const mins = Math.floor((cd % 3600000) / 60000)
      return reply(`⏳ *POKÉMON DAILY ALREADY CLAIMED*\n\n⏰ Come back in *${hrs}h ${mins}m*\n\n_The Pokémon world refreshes each day._ 🖤`)
    }
    const coins = randInt(300, 800)
    const balls = randInt(2, 5)
    await db.updateUser(sender, { wallet: (u.wallet || 0) + coins })
    await db.setCooldown(sender, 'pdaily', CD_PDAILY)
    await reply(
      `🎁 *POKÉMON DAILY REWARDS*\n\n` +
      `👤 *Trainer:* ${u.name || sender}\n\n` +
      `💰 *+${coins} coins* added to wallet\n` +
      `🔴 *+${balls} Poké Balls* added to bag\n\n` +
      `🔥 *Streak:* ${(u.streak || 0) + 1} days\n\n` +
      `⏳ Come back in *24 hours*\n\n` +
      `_Keep training, Trainer!_ 🖤`
    )
  },

  // ── #quests ───────────────────────────────────────────────────
  async quests({ reply, sender, user }) {
    const u       = user || await db.getOrCreateUser(sender)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const caught  = (pokemon || []).length
    await reply(
      `📋 *ACTIVE QUESTS*\n\n` +
      `👤 *Trainer:* ${u.name || sender}\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `🐾 *Catch 5 Pokémon* — ${Math.min(caught, 5)}/5 ${caught >= 5 ? '✅' : '⬜'}\n   Reward: 500 coins\n\n` +
      `⚔️ *Win 3 Battles* — ${Math.min(u.pokemon_wins || 0, 3)}/3 ${(u.pokemon_wins || 0) >= 3 ? '✅' : '⬜'}\n   Reward: 1 Great Ball\n\n` +
      `🎯 *Catch a Rare Pokémon* — 0/1 ⬜\n   Reward: 200 gems\n\n` +
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
      `${medals[i] || `${i + 1}.`} *${u.name || u.phone}* — Lvl ${u.level || 1} | XP: ${(u.xp || 0).toLocaleString()}`
    ).join('\n')
    await reply(
      `🏆 *POKÉMON TRAINER RANKINGS*\n\n━━━━━━━━━━━━━━━━━\n\n${lines}\n\n━━━━━━━━━━━━━━━━━\n\n_Only the strongest claim the top._ 🖤`
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

  // ── Internal spawn ─────────────────────────────────────────────
  async spawnPokemon(sock, jid, msg) {
    const id   = randInt(1, MAX_POKEMON_ID)
    const data = await fetchPokeData(id).catch(() => null)

    if (!data) {
      pendingPokemon[jid] = { id, name: `Shadow-${id}`, types: ['Shadow'], baseXp: 60, spawnedAt: Date.now(), imageUrl: null, moves: ['Tackle'], abilities: ['Shadow Force'], height: '?', weight: '?', location: 'Unknown' }
      await sock.sendMessage(jid, {
        text: `🎊 *A wild Pokémon has appeared!*\n\n🆔 *Poke ID:* ${id}\n🔖 *Name:* Shadow-${id}\n\n💡 *Hint:*\n> Use *#catch <pokeslot> | <ball type>* to catch this pokemon`
      }, { quoted: msg })
      return
    }

    pendingPokemon[jid] = { ...data, spawnedAt: Date.now() }
    const caption = buildSpawnCaption(data)

    if (data.imageUrl) {
      try {
        await sock.sendMessage(jid, { image: { url: data.imageUrl }, caption }, { quoted: msg })
        setTimeout(() => { if (pendingPokemon[jid]?.id === id) delete pendingPokemon[jid] }, POKE_CATCH_WINDOW)
        return
      } catch {}
    }
    await sock.sendMessage(jid, { text: caption }, { quoted: msg })
    setTimeout(() => { if (pendingPokemon[jid]?.id === id) delete pendingPokemon[jid] }, POKE_CATCH_WINDOW)
  },

  // ── #spawnp (staff) ───────────────────────────────────────────
  async spawnp({ sock, jid, msg, reply, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const nameOrId = args[0]?.toLowerCase()
    if (!nameOrId) return reply('⚠️ Usage: *#spawnp <name or id>*')
    await reply(`🔍 Fetching *${nameOrId}* from PokéAPI...`)
    const data = await fetchPokeData(nameOrId).catch(() => null)
    if (!data) return reply(`❌ *${nameOrId}* not found on PokéAPI.`)
    pendingPokemon[jid] = { ...data, spawnedAt: Date.now() }
    const caption = buildSpawnCaption(data)
    try {
      await sock.sendMessage(jid, { image: { url: data.imageUrl }, caption }, { quoted: msg })
    } catch {
      await sock.sendMessage(jid, { text: caption }, { quoted: msg })
    }
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

    // Parse: #catch <slot> | <ball>  OR  #catch <slot> --<ball>
    const raw     = args.join(' ')
    const parts   = raw.split(/\||\-\-/)
    const slot    = parseInt(parts[0]?.trim()) || 1
    const ballRaw = (parts[1]?.trim()?.toLowerCase() || 'pokeball').replace(/\s+/g, '')
    const ballKey = Object.keys(BALL_RATES).find(k => k === ballRaw || k.startsWith(ballRaw)) || 'pokeball'
    const ballData = SHOP_ITEMS[ballKey] || SHOP_ITEMS.pokeball

    if (slot < 1 || slot > 6) return reply(`⚠️ Slot must be between 1 and 6.`)

    const u = user || await db.getOrCreateUser(sender)

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

    const xpGained = Math.floor(poke.baseXp * 0.05) + randInt(5, 15)
    const newXp    = (u.xp || 0) + xpGained
    const oldLvl   = u.level || 1
    const xpNeeded = oldLvl * 5000   // very hard — 5000 XP per user level
    const levelUp  = newXp >= xpNeeded
    const newLvl   = levelUp ? oldLvl + 1 : oldLvl

    await db.updateUser(sender, { xp: levelUp ? newXp - xpNeeded : newXp, level: newLvl })

    try {
      await db.addPokemon(sender, {
        pokemon_id: poke.id, name: poke.name, types: poke.types,
        level: 1, xp: 0, moves: poke.moves || [], abilities: poke.abilities || [],
        ball: ballKey, slot, in_party: true, base_xp: poke.baseXp,
        height: poke.height, weight: poke.weight, location: poke.location,
      })
    } catch {}

    await react('🎉')

    const caption =
      battleLog.join('\n') + '\n\n' +
      `🎉 *POKÉMON CAUGHT!*\n\n` +
      `📛 *${poke.name}* (No. ${poke.id})\n` +
      `⚡ *Type:* ${poke.types.join(' / ')}\n` +
      `🎯 *Ball Used:* ${ballData.emoji} ${ballData.name}\n` +
      `📍 *Party Slot:* #${slot}\n\n` +
      `⭐ *+${xpGained} XP gained!*\n` +
      (levelUp ? `\n🆙 *LEVEL UP!* ${oldLvl} → ${newLvl} 🎊\n` : '') +
      `\n_Konosuba grows stronger._ 🖤`

    if (poke.imageUrl) {
      try {
        await sock.sendMessage(jid, { image: { url: poke.imageUrl }, caption }, { quoted: msg })
        if (levelUp) await _sendLevelUpImage(sock, jid, msg, poke.name, newLvl)
        return
      } catch {}
    }
    await sock.sendMessage(jid, { text: caption }, { quoted: msg })
    if (levelUp) await _sendLevelUpImage(sock, jid, msg, poke.name, newLvl)
  },

  // ── #team ─────────────────────────────────────────────────────
  async team({ reply, sender, user }) {
    const u       = user || await db.getOrCreateUser(sender)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party).slice(0, 6)
    if (!party.length) return reply(`❌ *Your team is empty!*\n\nCatch some Pokémon with *#hunt*!`)
    const lines = party.map((p, i) =>
      `*#${i + 1}* ${p.name} | Lvl ${p.level || 1} | XP: ${p.xp || 0}\n     Type: ${Array.isArray(p.types) ? p.types.join('/') : p.types || 'N/A'}`
    ).join('\n\n')
    await reply(`⚗ *Team*\n\n👤 *${u.name || sender}*\n\n${lines}\n\n_Your squad awaits battle._ 🖤`)
  },

  // ── #party ────────────────────────────────────────────────────
  async party({ sock, jid, msg, reply, sender, user, pushName, args }) {
    const u       = user || await db.getOrCreateUser(sender, pushName)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party).slice(0, 6)

    if (args[0]) {
      const idx = parseInt(args[0]) - 1
      if (isNaN(idx) || idx < 0) return reply(`⚠️ Usage: *#party <slot>*`)
      const p = party[idx]
      if (!p) return reply(`❌ No Pokémon in slot #${idx + 1}`)
      const moves     = Array.isArray(p.moves) ? p.moves.join(', ') : p.moves || 'N/A'
      const abilities = Array.isArray(p.abilities) ? p.abilities.join(', ') : p.abilities || 'N/A'
      return reply(
        `📊 *POKÉMON STATS — Slot #${idx + 1}*\n\n` +
        `📛 *Name:* ${p.name}\n🆔 *No:* ${p.pokemon_id}\n🔮 *Level:* ${p.level || 1}\n🪄 *XP:* ${p.xp || 0}\n\n` +
        `🔄 *Type:* ${Array.isArray(p.types) ? p.types.join(' / ') : p.types}\n` +
        `📏 *Height:* ${p.height || '?'} m\n⚖️ *Weight:* ${p.weight || '?'} kg\n\n` +
        `🎮 *Moves:* ${moves}\n🧬 *Abilities:* ${abilities}\n🎱 *Ball:* ${p.ball || 'Poké Ball'}`
      )
    }

    const slots = Array.from({ length: 6 }, (_, i) => {
      const p = party[i]
      if (!p) return `#${i + 1}\n🎈 *Name:* (empty)\n🔮 *Level:* —\n🪄 *XP:* —`
      return `#${i + 1}\n🎈 *Name:* ${p.name}\n🔮 *Level:* ${p.level || 1}\n🪄 *XP:* ${p.xp || 0}`
    }).join('\n\n')

    const caption =
      `⚗ *Party*\n\n🎴 *ID:* ${sender.slice(-6)}\n🏮 *Username:* ${u.name || pushName || sender}\n🧧 *Tag:* @${sender}\n\n` +
      `${slots}\n\n[Use *#party <slot>* to see a Pokémon's stats]\n\n> Shadow Pokémon 👥`

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
    if (!stored.length) return reply(`📦 *PC STORAGE EMPTY*\n\nAll Pokémon are in your party.`)
    const lines = stored.map((p, i) =>
      `${i + 1}. *${p.name}* — Lvl ${p.level || 1} (${Array.isArray(p.types) ? p.types.join('/') : p.types})`
    ).join('\n')
    await reply(`📦 *PC STORAGE*\n\n${lines}`)
  },

  // ── #swap ─────────────────────────────────────────────────────
  async swap({ reply, sender, args }) {
    const [a, b] = [parseInt(args[0]), parseInt(args[1])]
    if (!a || !b || a === b || a < 1 || b < 1 || a > 6 || b > 6)
      return reply(`⚠️ Usage: *#swap <slot1> <slot2>*`)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const pa = party[a - 1], pb = party[b - 1]
    if (!pa) return reply(`❌ No Pokémon in slot #${a}`)
    if (!pb) return reply(`❌ No Pokémon in slot #${b}`)
    try { await db.updatePokemon(pa.id, { slot: b }); await db.updatePokemon(pb.id, { slot: a }) } catch {}
    await reply(`🔄 *SWAP COMPLETE!*\n\n#${a} ${pa.name} ↔️ #${b} ${pb.name}`)
  },

  // ── #dex ──────────────────────────────────────────────────────
  async dex({ sock, jid, msg, reply, args }) {
    const query = args[0]?.toLowerCase()
    if (!query) return reply(`📘 *POKÉDEX*\n\nUsage: *#dex <name or id>*`)
    await sock.sendMessage(jid, { text: `🔍 Searching Pokédex for *${query}*...` }, { quoted: msg })
    const data = await fetchPokeData(query).catch(() => null)
    if (!data) return reply(`❌ *${query}* not found in the Pokédex.`)
    const caption = buildDexCaption(data)
    if (data.imageUrl) {
      try {
        await sock.sendMessage(jid, { image: { url: data.imageUrl }, caption }, { quoted: msg })
        return
      } catch {}
    }
    await sock.sendMessage(jid, { text: caption }, { quoted: msg })
  },

  // ── #heal ─────────────────────────────────────────────────────
  async heal({ reply }) {
    await reply(`✨ *TEAM HEALED!*\n\n💚 All Pokémon fully restored!\n\n_The healing light washes over your team._ 🖤`)
  },

  // ── #boost ────────────────────────────────────────────────────
  async boost({ reply, sender }) {
    const cd = await db.getCooldown(sender, 'pboost').catch(() => 0)
    if (cd > 0) {
      const mins = Math.floor(cd / 60000)
      return reply(`⏳ Boost still active! *${mins}m* remaining.`)
    }
    await db.setCooldown(sender, 'pboost', 30 * 60)
    await reply(`⚡ *BATTLE BOOST ACTIVATED!*\n\n🔥 +25% ATK & SPD for 30 minutes!\n\n_Unleash the power within!_ 🖤`)
  },

  // ── #battle ───────────────────────────────────────────────────
  async battle({ sock, jid, msg, reply, sender, user, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply(`⚠️ Usage: *#battle @user*`)
    const opponentPhone = mentioned[0].split('@')[0]
    if (opponentPhone === sender) return reply(`❌ You can't battle yourself!`)
    const u = user || await db.getOrCreateUser(sender)
    const myPoke    = await db.getUserPokemon(sender).catch(() => [])
    const myParty   = (myPoke || []).filter(p => p.in_party)
    if (!myParty.length) return reply(`❌ You need Pokémon in your party! Use *#hunt*.`)
    const theirPoke = await db.getUserPokemon(opponentPhone).catch(() => [])
    const theirPart = (theirPoke || []).filter(p => p.in_party)
    if (!theirPart.length) return reply(`❌ @${opponentPhone} has no Pokémon in their party!`)
    const mine   = myParty[0]
    const theirs = theirPart[0]
    const win    = Math.random() > 0.5
    const log = [
      `⚔️ *TRAINER BATTLE!*\n`,
      `*${u.name || sender}* vs *@${opponentPhone}*\n`,
      `🔵 *${mine.name}* (Lvl ${mine.level || 1}) vs 🔴 *${theirs.name}* (Lvl ${theirs.level || 1})\n`,
      `━━━━━━━━━━━━━━━━━━`,
      `${mine.name} used *${Array.isArray(mine.moves) ? mine.moves[0] : 'Tackle'}*!`,
      `${theirs.name} used *${Array.isArray(theirs.moves) ? theirs.moves[0] : 'Scratch'}*!`,
      win ? `💥 ${mine.name} lands a *critical hit!*` : `💥 ${theirs.name} lands a *critical hit!*`,
      win ? `\n🏆 *${u.name || sender} WINS!*` : `\n💥 *@${opponentPhone} WINS!*`,
    ]
    if (win) {
      const xp = 50 + randInt(10, 30)
      await db.updateUser(sender, { xp: (u.xp || 0) + xp, pokemon_wins: (u.pokemon_wins || 0) + 1 })
      log.push(`\n⭐ *+${xp} XP* earned!`)
    } else {
      await db.updateUser(sender, { pokemon_losses: (u.pokemon_losses || 0) + 1 })
    }
    await sock.sendMessage(jid, { text: log.join('\n'), mentions: [mentioned[0]] }, { quoted: msg })
  },

  // ── #gym ──────────────────────────────────────────────────────
  async gym({ reply, sender, user }) {
    const leaders = ['Brock', 'Misty', 'Lt. Surge', 'Erika', 'Koga', 'Sabrina', 'Blaine', 'Giovanni']
    const leader  = leaders[Math.floor(Math.random() * leaders.length)]
    const win     = Math.random() > 0.4
    const u       = user || await db.getOrCreateUser(sender)
    if (win) {
      await db.updateUser(sender, { pokemon_badges: (u.pokemon_badges || 0) + 1, xp: (u.xp || 0) + 100 })
      await reply(`🏅 *GYM BATTLE — ${leader.toUpperCase()}!*\n\n🏆 *YOU WIN!*\n\n🥇 Badge earned! Total: ${(u.pokemon_badges || 0) + 1}\n⭐ +100 XP`)
    } else {
      await reply(`🏅 *GYM BATTLE — ${leader.toUpperCase()}!*\n\n💥 *DEFEAT!*\n\n_Train harder and return._ 🖤`)
    }
  },

  // ── #raid ─────────────────────────────────────────────────────
  async raid({ reply, sender, user }) {
    const bosses = [
      { name: 'Mega Mewtwo', xp: 500 }, { name: 'Shadow Kyogre', xp: 400 }, { name: 'Dark Rayquaza', xp: 450 },
    ]
    const boss = bosses[Math.floor(Math.random() * bosses.length)]
    const win  = Math.random() > 0.5
    const u    = user || await db.getOrCreateUser(sender)
    if (win) {
      await db.updateUser(sender, { xp: (u.xp || 0) + boss.xp, wallet: (u.wallet || 0) + 2000 })
      await reply(`🔥 *RAID BOSS — ${boss.name.toUpperCase()}!*\n\n🏆 *RAID CLEARED!*\n\n⭐ +${boss.xp} XP\n💰 +2,000 coins`)
    } else {
      await reply(`🔥 *RAID BOSS — ${boss.name.toUpperCase()}!*\n\n💔 *RAID FAILED!*\n\n_Gather more trainers and try again._ 🖤`)
    }
  },

  // ── #evolve ───────────────────────────────────────────────────
  async evolve({ sock, jid, msg, reply, sender, args }) {
    const slot    = parseInt(args[0]) || 1
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`❌ No Pokémon in slot #${slot}`)
    const lvl = p.level || 1
    if (lvl < 16) return reply(`❌ *${p.name}* is only level ${lvl}!\n\n_Pokémon evolve at levels 16 and 36._\n_Keep training with *#train ${slot}*!_ 🖤`)
    await reply(`✨ *${p.name}* is evolving…`)
    const evoName = await getPokeEvolutionTarget(p.pokemon_id, p.name.toLowerCase()).catch(() => null)
    if (!evoName) return reply(`❌ *${p.name}* has no further evolution — it's already at its final form! 🌟`)
    const newData = await fetchPokeData(evoName).catch(() => null)
    if (!newData) return reply(`❌ Could not fetch evolution data. Try again later.`)
    try {
      await db.updatePokemon(p.id, {
        name:        newData.name,
        pokemon_id:  newData.id,
        types:       newData.types,
        moves:       newData.moves,
        abilities:   newData.abilities,
      })
    } catch {}
    const caption =
      `🌟 *EVOLUTION COMPLETE!*\n\n` +
      `✨ *${p.name}* evolved into *${newData.name}*!\n\n` +
      `🔮 *Level:* ${lvl}\n` +
      `⚡ *Type:* ${newData.types.join(' / ')}\n` +
      `🧬 *Abilities:* ${newData.abilities.join(', ')}\n\n` +
      `_The power within has awakened._ 🖤`
    if (newData.imageUrl) {
      try { await sock.sendMessage(jid, { image: { url: newData.imageUrl }, caption }, { quoted: msg }); return } catch {}
    }
    await reply(caption)
  },

  // ── #train ────────────────────────────────────────────────────
  async train({ sock, jid, msg, reply, sender, args }) {
    const slot = parseInt(args[0]) || 1
    const cd   = await db.getCooldown(sender, `ptrain${slot}`).catch(() => 0)
    if (cd > 0) return reply(`⏳ Wait *${Math.floor(cd / 60000)}m* before training slot #${slot} again.`)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`❌ No Pokémon in slot #${slot}`)

    // Very hard XP — 1000 XP per pokemon level
    const xpGain = randInt(30, 80)
    const newXp  = (p.xp || 0) + xpGain
    const oldLvl = p.level || 1
    const newLvl = Math.floor(newXp / 1000) + 1
    const leveled = newLvl > oldLvl

    await db.setCooldown(sender, `ptrain${slot}`, 15 * 60)

    // Check for evolution at levels 16 and 36
    if (leveled && (newLvl === 16 || newLvl === 36)) {
      try {
        await db.updatePokemon(p.id, { xp: newXp, level: newLvl })
        const evoName = await getPokeEvolutionTarget(p.pokemon_id, p.name.toLowerCase())
        if (evoName) {
          const newData = await fetchPokeData(evoName).catch(() => null)
          if (newData) {
            await db.updatePokemon(p.id, {
              name:       newData.name,
              pokemon_id: newData.id,
              types:      newData.types,
              moves:      newData.moves,
              abilities:  newData.abilities,
            })
            const caption =
              `💪 *TRAINING COMPLETE!*\n\n📛 *${p.name}* trained hard!\n\n⭐ *+${xpGain} XP*\n🔮 *Level:* ${newLvl} 🆙\n\n` +
              `🌟 *EVOLUTION!*\n\n✨ *${p.name}* evolved into *${newData.name}*!\n⚡ *Type:* ${newData.types.join(' / ')}\n\n_The power within has awakened._ 🖤`
            if (newData.imageUrl) {
              try { await sock.sendMessage(jid, { image: { url: newData.imageUrl }, caption }, { quoted: msg }); return } catch {}
            }
            await reply(caption)
            return
          }
        }
      } catch {}
    }

    try { await db.updatePokemon(p.id, { xp: newXp, level: newLvl }) } catch {}
    await reply(
      `💪 *TRAINING COMPLETE!*\n\n📛 *${p.name}* trained hard!\n\n⭐ *+${xpGain} XP*\n🔮 *XP:* ${newXp}/${newLvl * 1000}` +
      (leveled ? `\n\n🆙 *LEVEL UP!* → Level ${newLvl} 🎊${newLvl >= 16 ? '\n\n_Pokémon can now evolve! Use *#evolve ' + slot + '*_' : ''}` : '') +
      `\n\n⏰ Train again in 15 minutes.\n_Very hard path to mastery…_ 🖤`
    )
  },

  // ── #moves ────────────────────────────────────────────────────
  async moves({ reply, sender, args }) {
    const slot    = parseInt(args[0]) || 1
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`❌ No Pokémon in slot #${slot}`)
    const moveList = Array.isArray(p.moves) ? p.moves : ['Tackle']
    await reply(`🎮 *${p.name.toUpperCase()} — MOVES*\n\n${moveList.map((m, i) => `${i + 1}. *${m}*`).join('\n')}\n\n_Use *#learn ${slot}* to unlock new moves._ 🖤`)
  },

  // ── #learn ────────────────────────────────────────────────────
  async learn({ reply, sender, args }) {
    const slot    = parseInt(args[0]) || 1
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`❌ No Pokémon in slot #${slot}`)
    const data     = await fetchPokeData(p.pokemon_id).catch(() => null)
    const allMoves = data?.moves || []
    const newMove  = allMoves[Math.floor(Math.random() * allMoves.length)] || 'Hyper Beam'
    const curMoves = Array.isArray(p.moves) ? [...p.moves] : ['Tackle']
    if (!curMoves.includes(newMove)) { curMoves.push(newMove); try { await db.updatePokemon(p.id, { moves: curMoves.slice(0, 8) }) } catch {} }
    await reply(`📚 *MOVE LEARNED!*\n\n📛 *${p.name}* learned *${newMove}*!`)
  },

  // ── #stats ────────────────────────────────────────────────────
  async stats({ reply, sender, args }) {
    const slot    = parseInt(args[0]) || 1
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`❌ No Pokémon in slot #${slot}`)
    const lvl = p.level || 1
    await reply(
      `📊 *DETAILED STATS — ${p.name.toUpperCase()}*\n\n` +
      `🆔 *No:* ${p.pokemon_id}\n🔮 *Level:* ${lvl}\n🪄 *XP:* ${p.xp || 0}/${lvl * 200}\n\n` +
      `❤️ *HP:* ${200 + lvl * 15}\n⚔️ *ATK:* ${50 + lvl * 5}\n🛡️ *DEF:* ${40 + lvl * 4}\n💨 *SPD:* ${45 + lvl * 3}\n\n` +
      `🔄 *Type:* ${Array.isArray(p.types) ? p.types.join(' / ') : p.types}\n` +
      `📏 *Height:* ${p.height || '?'} m\n⚖️ *Weight:* ${p.weight || '?'} kg`
    )
  },

  // ── #mart ─────────────────────────────────────────────────────
  async mart({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const coins    = Object.entries(SHOP_ITEMS).filter(([, v]) => !v.gem).map(([k, v]) => `${v.emoji} *${v.name}* — $${v.price}`).join('\n')
    const gemItems = Object.entries(SHOP_ITEMS).filter(([, v]) => v.gem).map(([k, v]) => `${v.emoji} *${v.name}* — ${v.price} gems`).join('\n')
    await reply(
      `🛒 *POKÉMART*\n\n💰 *Coins:* $${(u.wallet || 0).toLocaleString()}\n💎 *Gems:* ${u.gems || 0}\n\n━━━━━━━━━━━━━━━━━\n\n🏪 *ITEMS (Coins)*\n${coins}\n\n💜 *PREMIUM (Gems)*\n${gemItems}\n\n━━━━━━━━━━━━━━━━━\n\n💡 Use *#mbuy <item>* to purchase`
    )
  },

  // ── #mbuy ─────────────────────────────────────────────────────
  async mbuy({ reply, sender, user, args }) {
    const u   = user || await db.getOrCreateUser(sender)
    const key = args[0]?.toLowerCase()
    if (!key) return reply(`⚠️ Usage: *#mbuy <item>* — See *#mart* for items.`)
    const entry = Object.entries(SHOP_ITEMS).find(([k, v]) => k === key || v.name.toLowerCase().includes(key))
    if (!entry) return reply(`❌ Item "*${key}*" not found. Check *#mart*`)
    const [itemKey, item] = entry
    if (item.gem) {
      if ((u.gems || 0) < item.price) return reply(`❌ Need *${item.price} gems*`)
      await db.updateUser(sender, { gems: (u.gems || 0) - item.price })
    } else {
      if ((u.wallet || 0) < item.price) return reply(`❌ Need *$${item.price}*`)
      await db.updateUser(sender, { wallet: (u.wallet || 0) - item.price })
    }
    try { await db.addItem(sender, itemKey, 1) } catch {}
    await reply(`✅ *${item.emoji} ${item.name}* added to your bag!\n\n_Use *#use ${itemKey}* to activate it._ 🖤`)
  },

  // ── #use ──────────────────────────────────────────────────────
  async use({ reply, args }) {
    const key  = args[0]?.toLowerCase()
    if (!key) return reply(`⚠️ Usage: *#use <item>*`)
    const item = SHOP_ITEMS[key]
    if (!item) return reply(`❌ Item not found. Check *#mart*`)
    await reply(
      `✨ *ITEM USED!*\n\n${item.emoji} *${item.name}* activated!\n\n` +
      (item.type === 'heal' ? '💚 Team healed!' :
       item.type === 'boost' ? '⚡ Battle stats boosted!' :
       item.type === 'evolution' ? '🌟 Evolution stone ready! Use *#evolve <slot>*' : '✅ Effect applied!')
    )
  },

  // ── #trade ────────────────────────────────────────────────────
  async trade({ sock, jid, msg, reply, sender, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply(`⚠️ Usage: *#trade @user*`)
    await sock.sendMessage(jid, {
      text: `🔄 *TRADE REQUEST*\n\n*@${sender}* wants to trade with *@${mentioned[0].split('@')[0]}*!\n\n_Use *#gift* to send Pokémon directly._ 🖤`,
      mentions: [msg.key.participant || msg.key.remoteJid, mentioned[0]],
    }, { quoted: msg })
  },

  // ── #gift ─────────────────────────────────────────────────────
  async gift({ sock, jid, msg, reply, sender, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const slot = parseInt(args[0]) || 1
    if (!mentioned.length) return reply(`⚠️ Usage: *#gift <slot> @user*`)
    const targetPhone = mentioned[0].split('@')[0]
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`❌ No Pokémon in slot #${slot}`)
    try { await db.updatePokemon(p.id, { phone: targetPhone }) } catch {}
    await sock.sendMessage(jid, {
      text: `🎁 *POKÉMON GIFTED!*\n\n*@${sender}* sent *${p.name}* to *@${targetPhone}*!`,
      mentions: [msg.key.participant || msg.key.remoteJid, mentioned[0]],
    }, { quoted: msg })
  },

  // ── #event ────────────────────────────────────────────────────
  async event({ reply }) {
    await reply(`🎉 *SPECIAL EVENTS*\n\n🌑 *Shadow Festival* — Ongoing\n   Dark & Ghost type spawns boosted!\n\n⭐ *Legendary Weekend* — Every Fri–Sun\n   Legendary spawn rate x2\n\n_Check back often for new events!_ 🖤`)
  },

  // ── #legend ───────────────────────────────────────────────────
  async legend({ reply, sender }) {
    const pokemon     = await db.getUserPokemon(sender).catch(() => [])
    const legendaries = (pokemon || []).filter(p => (p.base_xp || 0) > 300)
    if (!legendaries.length) return reply(`🌟 *LEGENDARY TRACKER*\n\nNo Legendaries caught yet!\n\n_Keep hunting — they appear rarely._ 🖤`)
    const lines = legendaries.map(p => `✨ *${p.name}* — Lvl ${p.level || 1}`).join('\n')
    await reply(`🌟 *YOUR LEGENDARIES*\n\n${lines}\n\n_Rare power is yours._ 🖤`)
  },

  // ── #achieve ──────────────────────────────────────────────────
  async achieve({ reply, sender, user }) {
    const u       = user || await db.getOrCreateUser(sender)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const caught  = (pokemon || []).length
    const wins    = u.pokemon_wins || 0
    const badges  = u.pokemon_badges || 0
    const achievements = [
      { name: 'First Catch',     done: caught >= 1,  emoji: '🔴' },
      { name: 'Collector',       done: caught >= 10,  emoji: '🟠' },
      { name: 'Pokémon Master',  done: caught >= 50,  emoji: '🟡' },
      { name: 'First Battle',    done: wins >= 1,     emoji: '⚔️' },
      { name: 'Champion',        done: wins >= 10,    emoji: '🏆' },
      { name: 'Badge Collector', done: badges >= 4,   emoji: '🥇' },
      { name: 'Gym Master',      done: badges >= 8,   emoji: '🎖️' },
    ]
    const lines = achievements.map(a => `${a.done ? '✅' : '⬜'} ${a.emoji} ${a.name}`).join('\n')
    await reply(`🏅 *ACHIEVEMENTS*\n\n👤 *${u.name || sender}*\n\n${lines}\n\n📊 Progress: ${achievements.filter(a => a.done).length}/${achievements.length}`)
  },

  // ── #cooldown ─────────────────────────────────────────────────
  async cooldown({ reply, sender }) {
    const cmds = ['pdaily', 'hunt', 'pboost']
    const results = await Promise.all(cmds.map(async c => {
      const cd   = await db.getCooldown(sender, c).catch(() => 0)
      const mins = Math.floor(cd / 60000)
      const secs = Math.floor((cd % 60000) / 1000)
      return `${cd > 0 ? '⏳' : '✅'} *${c}* — ${cd > 0 ? `${mins}m ${secs}s` : 'Ready!'}`
    }))
    await reply(`⏱️ *COMMAND COOLDOWNS*\n\n${results.join('\n')}`)
  },

  // ── .setms / #setms ───────────────────────────────────────────
  async setms({ sock, jid, msg, reply, sender }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    if (!quoted || !quoted.stickerMessage) {
      return reply(`⚠️ *HOW TO USE:*\n\nReply to a *sticker* with *.setms*\n\nThis sticker will be sent whenever someone tags you!\n\n_Make it iconic._ 🖤`)
    }
    const stanzaId    = msg.message.extendedTextMessage.contextInfo.stanzaId
    const participant = msg.message.extendedTextMessage.contextInfo.participant || jid
    const stickerMsg  = { key: { remoteJid: jid, id: stanzaId, participant }, message: quoted }
    try {
      const { downloadMediaMessage } = require('@whiskeysockets/baileys')
      const buffer = await downloadMediaMessage(stickerMsg, 'buffer', {}, {
        logger: { level: () => {}, info: () => {}, warn: () => {}, error: () => {} },
        reuploadRequest: sock.updateMediaMessage,
      })
      const ms  = loadMS()
      ms[sender] = { data: buffer.toString('base64'), mime: 'image/webp', setAt: Date.now() }
      saveMS(ms)
      await reply(`✅ *MENTION STICKER SET!*\n\nWhen someone tags you, the bot will reply with your sticker!\n\nUse *.delms* to remove it. 🖤`)
    } catch (err) {
      await reply(`❌ Failed to save sticker: ${err.message}`)
    }
  },

  // ── .delms / #delms ───────────────────────────────────────────
  async delms({ reply, sender }) {
    const ms = loadMS()
    if (!ms[sender]) return reply(`⚠️ You don't have a mention sticker set.\n\nUse *.setms* by replying to a sticker.`)
    delete ms[sender]
    saveMS(ms)
    await reply(`🗑️ *MENTION STICKER REMOVED.*\n\n_You will no longer auto-reply to tags._ 🖤`)
  },

  // Expose for index.js mention sticker trigger
  getMentionStickers: loadMS,

  // ── .pokemon on/off (staff) ───────────────────────────────────
  async pokemon({ jid, reply, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const toggle = args[0]?.toLowerCase()
    if (toggle === 'on') {
      await db.updateGroup(jid, { pokemon_enabled: true })
      await reply(`✅ *Pokémon System ENABLED!*\n\nUse *#hunt* to start catching.`)
    } else if (toggle === 'off') {
      await db.updateGroup(jid, { pokemon_enabled: false })
      await reply(`❌ *Pokémon System DISABLED.*`)
    } else {
      await reply(`⚠️ Usage: *.pokemon on/off*`)
    }
  },

  // ── .fight — start wild Pokémon battle ───────────────────────
  async fight({ sock, jid, msg, reply, sender, user }) {
    const wild = pendingPokemon[jid]
    if (!wild) return reply(`❌ *No wild Pokémon here!*\n\nUse *#hunt* to find one first.`)
    if (Date.now() - wild.spawnedAt > POKE_CATCH_WINDOW) {
      delete pendingPokemon[jid]
      return reply(`❌ *The wild ${wild.name} fled!*\n\nUse *#hunt* to search again.`)
    }
    if (activeBattles[sender]) {
      const b = activeBattles[sender]
      return reply(
        `⚔️ *Already in battle!*\n\n` +
        `You're fighting *${b.wild.name}*!\n\n` +
        `*📋 Moves:*\n${b.moves.map((m, i) => `  *${i + 1}.* ${m}`).join('\n')}\n\n` +
        `> *.move <1-${b.moves.length}>* to attack  |  *.flee* to escape`
      )
    }

    const u = user || await db.getOrCreateUser(sender)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party = (pokemon || []).filter(p => p.in_party)
    if (!party.length) return reply(`❌ You need Pokémon in your party!\n\nCatch some first with *#hunt*.`)

    const myPoke    = party[0]
    const myLevel   = myPoke.level || 1
    const wildLevel = randInt(5, 45)
    const myMaxHp   = 80 + myLevel * 12
    const wildMaxHp = 60 + wildLevel * 8

    const moves = (Array.isArray(myPoke.moves) && myPoke.moves.length >= 2)
      ? myPoke.moves.slice(0, 4)
      : ['Tackle', 'Growl', 'Quick Attack', 'Scratch']

    activeBattles[sender] = {
      jid,
      wild:      { ...wild, level: wildLevel },
      myPokemon: myPoke,
      myHp: myMaxHp, myMaxHp,
      wildHp: wildMaxHp, wildMaxHp,
      moves,
      turn: 1,
    }

    const bar = (cur, max) => {
      const f = Math.max(0, Math.round(cur / max * 10))
      return '🟩'.repeat(f) + '⬜'.repeat(10 - f)
    }

    await sock.sendMessage(jid, {
      text:
        `⚔️ *WILD BATTLE!*\n\n` +
        `🌿 *Wild ${wild.name}* (Lv ${wildLevel})\n` +
        `❤️ ${bar(wildMaxHp, wildMaxHp)} ${wildMaxHp}/${wildMaxHp} HP\n\n` +
        `⚡ *${myPoke.name}* (Lv ${myLevel})\n` +
        `❤️ ${bar(myMaxHp, myMaxHp)} ${myMaxHp}/${myMaxHp} HP\n\n` +
        `━━━━━━━━━━━━━━\n` +
        `*📋 Your Moves:*\n` +
        moves.map((m, i) => `  *${i + 1}.* ${m}`).join('\n') +
        `\n\n> *.move <1-${moves.length}>* to attack  |  *.flee* to escape`,
    }, { quoted: msg })
  },

  // ── .move — use a move during wild battle ─────────────────────
  async move({ sock, jid, msg, reply, sender, user, args }) {
    const battle = activeBattles[sender]
    if (!battle) return reply(
      `❌ *Not in a battle!*\n\nUse *#hunt* to find a wild Pokémon, then *.fight* to battle it.`
    )
    if (battle.jid !== jid) return reply(`❌ Your active battle is in a different group.`)

    const bar = (cur, max) => {
      const f = Math.max(0, Math.round(cur / max * 10))
      return '🟩'.repeat(f) + '⬜'.repeat(10 - f)
    }

    const moveIdx  = Math.max(0, (parseInt(args[0]) || 1) - 1)
    const moveName = battle.moves[Math.min(moveIdx, battle.moves.length - 1)] || 'Tackle'

    // ── Player attacks ─────────────────────────────────────────
    const myAtk     = 15 + (battle.myPokemon.level || 1) * 3
    const crit      = Math.random() < 0.15
    const playerDmg = randInt(myAtk, myAtk + 15) + (crit ? 12 : 0)
    battle.wildHp   = Math.max(0, battle.wildHp - playerDmg)

    const log = [`⚔️ *TURN ${battle.turn}*\n`]
    log.push(`⚡ *${battle.myPokemon.name}* used *${moveName}*!`)
    log.push(crit ? `✨ *Critical hit!* (-${playerDmg} HP)` : `(-${playerDmg} HP)`)

    // ── Wild fainted? ──────────────────────────────────────────
    if (battle.wildHp <= 0) {
      const xpGain = 25 + battle.wild.level * 5
      const u = user || await db.getOrCreateUser(sender)
      await db.updateUser(sender, {
        xp:           (u.xp || 0) + xpGain,
        pokemon_wins: (u.pokemon_wins || 0) + 1,
      }).catch(() => {})
      delete activeBattles[sender]
      // Keep wild alive (weakened) so player can still catch it
      pendingPokemon[jid] = { ...battle.wild, spawnedAt: Date.now(), weakened: true }
      log.push(`\n💫 *Wild ${battle.wild.name} fainted!*\n`)
      log.push(`⭐ *+${xpGain} XP* earned!`)
      log.push(`\n🎯 *${battle.wild.name}* is weakened — easier to catch now!`)
      log.push(`Use *#catch <slot> | <ball>* to capture it! _(90 sec window)_`)
      return await sock.sendMessage(jid, { text: log.join('\n') }, { quoted: msg })
    }

    // ── Wild attacks back ──────────────────────────────────────
    const wildMoves = (Array.isArray(battle.wild.moves) && battle.wild.moves.length)
      ? battle.wild.moves
      : ['Tackle', 'Growl']
    const wildMove  = wildMoves[Math.floor(Math.random() * Math.min(4, wildMoves.length))]
    const wildAtk   = 8 + battle.wild.level * 2
    const wildCrit  = Math.random() < 0.10
    const wildDmg   = randInt(wildAtk, wildAtk + 10) + (wildCrit ? 8 : 0)
    battle.myHp     = Math.max(0, battle.myHp - wildDmg)
    battle.turn++

    log.push(`\n🌿 *Wild ${battle.wild.name}* used *${wildMove}*!`)
    log.push(wildCrit ? `💥 *Critical hit!* (-${wildDmg} HP)` : `(-${wildDmg} HP)`)

    // ── Player fainted? ────────────────────────────────────────
    if (battle.myHp <= 0) {
      delete activeBattles[sender]
      delete pendingPokemon[jid]
      log.push(`\n💔 *${battle.myPokemon.name} fainted!*`)
      log.push(`\n_The wild ${battle.wild.name} fled while you were down._ 🖤`)
      return await sock.sendMessage(jid, { text: log.join('\n') }, { quoted: msg })
    }

    // ── Battle continues — show HP bars + move menu ────────────
    log.push(`\n━━━━━━━━━━━━━━`)
    log.push(`🌿 *${battle.wild.name}* (Lv ${battle.wild.level})`)
    log.push(`❤️ ${bar(battle.wildHp, battle.wildMaxHp)} ${battle.wildHp}/${battle.wildMaxHp} HP`)
    log.push(``)
    log.push(`⚡ *${battle.myPokemon.name}* (Lv ${battle.myPokemon.level || 1})`)
    log.push(`❤️ ${bar(battle.myHp, battle.myMaxHp)} ${battle.myHp}/${battle.myMaxHp} HP`)
    log.push(`\n*📋 Moves:*\n${battle.moves.map((m, i) => `  *${i + 1}.* ${m}`).join('\n')}`)
    log.push(`\n> *.move <1-${battle.moves.length}>* to attack  |  *.flee* to escape`)
    await sock.sendMessage(jid, { text: log.join('\n') }, { quoted: msg })
  },

  // ── .flee — escape from wild battle ───────────────────────────
  async flee({ reply, sender, jid }) {
    const battle = activeBattles[sender]
    if (!battle) return reply(`❌ You're not in a battle.`)
    if (battle.jid !== jid) return reply(`❌ Your active battle is in a different group.`)

    // 30% chance the wild blocks escape
    if (Math.random() < 0.30) {
      return reply(
        `😤 *Can't escape!*\n\n` +
        `Wild *${battle.wild.name}* blocked your path!\n\n` +
        `❤️ Your HP: ${battle.myHp}/${battle.myMaxHp}\n\n` +
        `*📋 Moves:*\n${battle.moves.map((m, i) => `  *${i + 1}.* ${m}`).join('\n')}\n\n` +
        `> *.move <1-${battle.moves.length}>* to keep fighting`
      )
    }

    delete activeBattles[sender]
    await reply(
      `🏃 *Got away safely!*\n\n` +
      `You escaped from wild *${battle.wild.name}*.\n\n` +
      `_It's still out there — use *#catch* if you want to capture it!_ 🖤`
    )
  },

  // Legacy alias
  async wb(ctx) { return module.exports.hunt(ctx) },
}

// ── Level-up image via Pollinations (URL-based, no download) ─────
async function _sendLevelUpImage(sock, jid, msg, pokeName, newLvl) {
  try {
    const prompt = encodeURIComponent(`pokemon ${pokeName} level up glow effect, level ${newLvl}, golden light burst, dark background, anime art`)
    const url    = `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&nologo=true&model=turbo&seed=${Date.now() % 9999}`
    await sock.sendMessage(jid, {
      image: { url },
      caption: `🆙 *LEVEL UP!*\n\n✨ *${pokeName}* grew to Level *${newLvl}*!\n\n_Power evolves within the shadows._ 🖤`,
    }, { quoted: msg })
  } catch {}
}

// ── Party composite image (3×2 sprite grid using sharp) ──────────
async function _buildPartyImage(party) {
  let sharp
  try { sharp = require('sharp') } catch { return null }

  const COLS = 3, cellW = 160, cellH = 160
  const W = cellW * COLS, H = cellH * 2

  // SVG background with grid lines and slot labels
  const labels = Array.from({ length: 6 }, (_, i) => {
    const col = i % COLS, row = Math.floor(i / COLS)
    const cx  = col * cellW + cellW / 2
    const ty  = row * cellH + cellH - 12
    const p   = party[i]
    const txt = p ? `${p.name}  Lv${p.level || 1}` : '— empty —'
    const col2 = p ? '#b0b8e8' : '#3a3a5a'
    return `<text x="${cx}" y="${ty}" fill="${col2}" font-size="11" font-weight="bold" text-anchor="middle" font-family="Arial,sans-serif">${txt}</text>`
  }).join('\n')

  const bgSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#12122a"/>
        <stop offset="100%" stop-color="#1e1e42"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <line x1="${cellW}"     y1="0" x2="${cellW}"     y2="${H}" stroke="#2a2a5a" stroke-width="1.5"/>
    <line x1="${cellW * 2}" y1="0" x2="${cellW * 2}" y2="${H}" stroke="#2a2a5a" stroke-width="1.5"/>
    <line x1="0" y1="${cellH}" x2="${W}" y2="${cellH}" stroke="#2a2a5a" stroke-width="1.5"/>
    ${labels}
  </svg>`

  let base
  try { base = await sharp(Buffer.from(bgSvg)).png().toBuffer() } catch { return null }

  const composites = []
  for (let i = 0; i < Math.min(party.length, 6); i++) {
    const p = party[i]
    if (!p || !p.pokemon_id) continue
    const sprUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.pokemon_id}.png`
    try {
      const buf = await downloadBuffer(sprUrl, 8000)
      if (!buf) continue
      const col  = i % COLS, row = Math.floor(i / COLS)
      const left = col * cellW + 16
      const top  = row * cellH + 4
      const spr  = await sharp(buf)
        .resize(cellW - 32, cellH - 30, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
      composites.push({ input: spr, left, top })
    } catch {}
  }

  try {
    return composites.length > 0
      ? await sharp(base).composite(composites).png().toBuffer()
      : base
  } catch { return null }
}
