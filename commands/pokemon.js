const db = require('../database')
const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')
const { buildBattleImage, buildBattleChallenge } = require('../battleHelper')

const PHELP_IMAGE = path.join(__dirname, '../assets/phelp.jpg')

// ── Pending wild pokemon & battles ───────────────────────────────
const pendingPokemon    = {}
const activeBattles     = {}
const pendingChallenges = {}  // key: `${jid}:${challengerPhone}`
const pvpBattles        = {}  // key: phone number (both players point to same obj)

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

const WEATHER_BATTLE_EFFECTS = {
  'Sunny ☀️':  ['Strong sunlight scorches the field!',      'Fire-type moves are boosted this battle!'],
  'Rainy 🌧️':  ['Heavy rain drenches the battlefield!',      'Water-type moves are boosted this battle!'],
  'Windy 🌬️':  ['Strong winds sweep the arena!',             'Flying-type moves are boosted this battle!'],
  'Cloudy ⛅':  ['Thick clouds block the sunlight.',          'No special weather effects active.'],
  'Snowy ❄️':  ['Blizzard conditions rage across the field!','Ice-type moves are boosted this battle!'],
  'Foggy 🌫️':  ['Dense fog reduces visibility!',             'Accuracy of all moves is slightly reduced.'],
  'Stormy ⚡':  ['Thunder crashes across the battlefield!',   'Electric-type moves are boosted this battle!'],
}

const BATTLE_FORMATS = ['Singles (1v1)', 'Doubles (2v2)', 'Ranked Singles', 'Casual Battle']

const PVP_EXPIRE_MS = 2 * 60 * 1000  // 2 minutes

function buildBattleStatus(battle, currentPhone) {
  const TB = '\`\`\`'
  const isChallenger = currentPhone === battle.challengerPhone
  const myPoke    = isChallenger ? battle.challengerPoke  : battle.opponentPoke
  const theirPoke = isChallenger ? battle.opponentPoke    : battle.challengerPoke
  const myHp      = isChallenger ? battle.challengerHp    : battle.opponentHp
  const myMaxHp   = isChallenger ? battle.challengerMaxHp : battle.opponentMaxHp
  const theirHp   = isChallenger ? battle.opponentHp      : battle.challengerHp
  const theirMaxHp= isChallenger ? battle.opponentMaxHp   : battle.challengerMaxHp
  const type1 = Array.isArray(myPoke.types)    ? myPoke.types.join('/')    : (myPoke.types    || 'Normal')
  const type2 = Array.isArray(theirPoke.types) ? theirPoke.types.join('/') : (theirPoke.types || 'Normal')
  const effects = WEATHER_BATTLE_EFFECTS[battle.weather] || ['The battle rages on!', 'Stay sharp, Trainer!']
  return (
    `*🌦️ Weather Effect: ${battle.weather}*\n` +
    `_${effects[0]}_\n` +
    `_${effects[1]}_\n\n` +
    `*⚔️ Battle Status*\n\n` +
    `${myPoke.name} Lv.${myPoke.level || 1} | ${myHp}/${myMaxHp} HP | ${type1}\n` +
    `${theirPoke.name} Lv.${theirPoke.level || 1} | ${theirHp}/${theirMaxHp} HP | ${type2}\n\n` +
    `*Choose your next move, Trainer!*\n\n` +
    `${TB}#battle fight${TB} - View ${myPoke.name}'s moves\n\n` +
    `${TB}#battle pokemon${TB} - Switch your active Pokémon\n\n` +
    `${TB}#battle forfeit${TB} - Surrender the match\n\n` +
    `${TB}#move {move number}${TB} - Choose your move `
  )
}
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
    // pdaily: modest daily for Pokémon players — Pokéballs are the main reward
    const coins = randInt(20, 50)   // was 3–8 (too stingy)
    const balls = randInt(3, 7)     // 3–7 Poké Balls per day
    const streak = (u.streak || 0) + 1
    // Bonus balls on streak milestones
    const bonusBalls = streak % 7 === 0 ? 3 : 0  // +3 on every 7-day streak
    await db.updateUser(sender, { wallet: (u.wallet || 0) + coins, streak })
    await db.trackCurrencyGenerated(coins).catch(() => {})
    await db.setCooldown(sender, 'pdaily', CD_PDAILY)
    await reply(
      `🎁 *POKÉMON DAILY REWARDS*\n\n` +
      `👤 *Trainer:* ${u.name || sender}\n\n` +
      `💰 *+${coins} coins* added to wallet\n` +
      `🔴 *+${balls + bonusBalls} Poké Balls* added to bag${bonusBalls > 0 ? ` (includes +${bonusBalls} streak bonus!)` : ''}\n\n` +
      `🔥 *Streak:* ${streak} days\n\n` +
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
    // 40/100 chance of finding a Pokémon
    if (Math.random() >= 0.40) {
      const NO_FIND_REASONS = [
        'The tall grass rustled, but nothing was there.',
        'You heard footsteps... turned out to be the wind.',
        'A shadow moved in the bushes — just a leaf.',
        'The Pokémon escaped into the deep forest.',
        'Heavy rain washed away all tracks.',
        'Too noisy — the Pokémon scattered.',
        'You searched every corner... but found nothing.',
        'The area seems abandoned today.',
      ]
      return reply(`🍃 You searched the entire area and couldn't find a pokemon to catch.\n> ${NO_FIND_REASONS[Math.floor(Math.random() * NO_FIND_REASONS.length)]}`)
    }
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
    if (!data) return reply(`📭 *${nameOrId}* not found on PokéAPI.`)
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
    if (!poke) return reply(`⚠️ *No wild Pokémon here!*\n\nUse *#hunt* to search for one.`)
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

    // ── Player XP: minimal (1–3 XP) — catching does NOT level up the trainer quickly ──
    // Full XP progression happens through .work, .fish, .daily, etc.
    const trainerXpGain = Math.floor(Math.random() * 3) + 1  // 1–3 XP
    const oldLvl        = u.level || 1
    const trainerXpNeeded = oldLvl * 300  // matches economy.js xpForLevel formula
    const newTrainerXp  = (u.xp || 0) + trainerXpGain
    const levelUp       = newTrainerXp >= trainerXpNeeded
    const newLvl        = levelUp ? oldLvl + 1 : oldLvl
    await db.updateUser(sender, {
      xp:    levelUp ? newTrainerXp - trainerXpNeeded : newTrainerXp,
      level: newLvl,
    })

    const currentParty = await db.getUserPokemon(sender).catch(() => [])
    const partyCount   = (currentParty || []).filter(p => p.in_party).length
    const partyFull    = partyCount >= 6
    const inParty      = !partyFull

    // ── Pokémon XP: award to the lead/buddy party Pokémon (slot 1) ──
    // This keeps Pokémon XP progression separate from player XP.
    // Pokémon XP scales with the caught Pokémon's rarity.
    let buddyPokeXpLine = ''
    const buddy = currentParty.find(p => p.in_party)
    if (buddy) {
      const pokeXpByRarity = {
        legendary: Math.floor(Math.random() * 241) + 240,  // 240–480
        epic:      Math.floor(Math.random() * 121) + 120,  // 120–240
        rare:      Math.floor(Math.random() * 61)  + 60,   // 60–120
        common:    Math.floor(Math.random() * 31)  + 30,   // 30–60
      }
      const pokeXpGain   = pokeXpByRarity[rarity] || pokeXpByRarity.common
      const buddyNewXp   = (buddy.xp || 0) + pokeXpGain
      const POKE_LVL_XP  = (buddy.level || 1) * 100   // 100 XP per current level to level up
      const pokeLevelUp  = buddyNewXp >= POKE_LVL_XP
      const newPokeLevel = pokeLevelUp ? (buddy.level || 1) + 1 : (buddy.level || 1)
      await db.updatePokemon(buddy._id, {
        xp:    pokeLevelUp ? buddyNewXp - POKE_LVL_XP : buddyNewXp,
        level: newPokeLevel,
      }).catch(() => {})
      console.log(`[pokemon] catch XP: ${buddy.name} +${pokeXpGain}XP (rarity=${rarity})`)
      buddyPokeXpLine = `\n⭐ *${buddy.name}* gained *+${pokeXpGain} XP*!` +
        (pokeLevelUp ? ` (Lv.${buddy.level || 1} → ${newPokeLevel} 🎊)` : '')
    }

    try {
      await db.addPokemon(sender, {
        pokemon_id: poke.id, name: poke.name, types: poke.types,
        level: 1, xp: 0, moves: poke.moves || [], abilities: poke.abilities || [],
        ball: ballKey, slot: inParty ? slot : null, in_party: inParty, base_xp: poke.baseXp,
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
      (inParty ? `📍 *Party Slot:* #${slot}\n` : `📦 *Sent to PC* (party full 6/6)\n`) + '\n' +
      buddyPokeXpLine +
      (levelUp ? `\n🆙 *TRAINER LEVEL UP!* ${oldLvl} → ${newLvl} 🎊\n` : '') +
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
    if (!party.length) return reply(`📭 *Your team is empty!*\n\nCatch some Pokémon with *#hunt*!`)
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
      if (!p) return reply(`⚠️ No Pokémon in slot #${idx + 1}`)
      const pMoves = Array.isArray(p.moves) ? p.moves : (p.moves ? [p.moves] : [])
      const moveLines = pMoves.length
        ? pMoves.map(m => `├ ${m}`).join('\n').replace(/├ ([^]+)$/, '└ $1')
        : '└ None'
      const types   = Array.isArray(p.types) ? p.types.join(' / ') : (p.types || '?')
      const xpReq   = (p.level || 1) * 50
      const caption =
        `📜 *POKÉMON INFO*\n` +
        `├ *Name:* ${p.name}\n` +
        `├ *Type:* ${types}\n` +
        `├ *Level:* ${p.level || 1}\n` +
        `├ *XP:* ${p.xp || 0}/${xpReq}\n` +
        `└ *Nature:* ${p.nature || 'Unknown'}\n\n` +
        `❤️ *Status:* ${p.fainted ? 'Fainted' : 'Healthy'}\n\n` +
        `📊 *STATS*\n` +
        `├ HP: ${p.current_hp ?? p.hp ?? 0}/${p.hp || 0}\n` +
        `├ ATK: ${p.attack || 0}\n` +
        `├ DEF: ${p.defense || 0}\n` +
        `├ SP. ATK: ${p.sp_atk || 0}\n` +
        `├ SP. DEF: ${p.sp_def || 0}\n` +
        `└ SPD: ${p.speed || 0}\n\n` +
        `✨ *MOVES*\n` +
        `${moveLines}\n\n` +
        `💡 Use *.party ${idx + 1} moves* to view move details.`

      // Native WA link preview via OG endpoint — mini card visible to ALL users
      const pName  = (p.name || 'pokemon').replace(/^\w/, c => c.toUpperCase())
      const types  = Array.isArray(p.types) ? p.types.join(' / ') : (p.types || '?')
      const params = new URLSearchParams({ name: pName, level: p.level || 1, types })
      const ogUrl  = `https://konosubacommunity.onrender.com/pokemon/${p.pokemon_id}?${params}`
      return await sock.sendMessage(jid, {
        text: `${caption}\n\n${ogUrl}`,
      }, { quoted: msg })
    }

    const partyLines = Array.from({ length: 6 }, (_, i) => {
      const p = party[i]
      if (!p) return `${i + 1}. *(empty)*`
      return `${i + 1}. ${p.name} Lv.${p.level || 1}`
    }).join('\n')

    const caption =
      `*🐾 Your Party 🐾*\n\n${partyLines}\n\n` +
      `> Use ".topc <slot>" to move your desired pokemon from your party to your pc.`

    const imgBuf = await _buildPartyImage(party, u.name || pushName || sender).catch(() => null)
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
    if (!stored.length) return reply(`📦 *PC STORAGE EMPTY*\n\nAll Pokémon are in your party.\n\n_Use .topc <party slot> to move one here._`)
    const lines = stored.map((p, i) => {
      const types = Array.isArray(p.types) ? p.types.join('/') : (p.types || '?')
      return `○ PC-${i + 1} 📦 ${p.name}\n└ \`Lvl ${p.level || 1} • ${types}\``
    }).join('\n\n')
    await reply(
      `*📦 YOUR STORED POKÉMON (${stored.length})*\n\n` +
      lines +
      `\n\n⚙️ 𝗔𝗖𝗧𝗜𝗢𝗡𝗦\n` +
      `> ○ .t2party <pc-slot>\n> └ Move Pokémon from PC to Party.\n\n` +
      `> ○ .topc <party-slot>\n> └ Move Pokémon from Party to PC.`
    )
  },

  // ── #topc ─────────────────────────────────────────────────────
  async topc({ reply, sender, args }) {
    const slot = parseInt(args[0])
    if (!slot || slot < 1 || slot > 6)
      return reply(`⚠️ Usage: *#topc <slot>* (1–6)\n\nMoves a Pokémon from your party to PC storage.\nUse *#party* to see your party slots.`)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party).slice(0, 6)
    if (party.length <= 1)
      return reply(`🚫 *Can't move your last Pokémon to PC!*\n\nYour party must have at least 1 Pokémon.`)
    const p = party[slot - 1]
    if (!p) return reply(`⚠️ No Pokémon in party slot #${slot}.\n\nUse *#party* to see your party.`)
    try { await db.updatePokemon(p._id, { in_party: false }) } catch (e) { return reply(`⚠️ Failed: ${e.message}`) }
    await reply(
      `📦 *MOVED TO PC!*\n\n` +
      `*${p.name}* (Lvl ${p.level || 1}) has been stored in the PC.\n\n` +
      `🏷️ Party is now ${party.length - 1}/6\n\n` +
      `_Use *#toparty <pc-slot>* to bring it back._`
    )
  },

  // ── #toparty ──────────────────────────────────────────────────
  async toparty({ reply, sender, args }) {
    const pcSlot = parseInt(args[0])
    if (!pcSlot || pcSlot < 1)
      return reply(`⚠️ Usage: *#toparty <pc-slot>*\n\nUse *#pc* to see your stored Pokémon and their slot numbers.`)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party).slice(0, 6)
    if (party.length >= 6)
      return reply(`⚠️ *Party is full! (6/6)*\n\nUse *#topc <slot>* to move a Pokémon to PC first.`)
    const stored = (pokemon || []).filter(p => !p.in_party)
    const p      = stored[pcSlot - 1]
    if (!p) return reply(`⚠️ No Pokémon in PC slot #${pcSlot}.\n\nUse *#pc* to see your stored Pokémon.`)
    try { await db.updatePokemon(p._id, { in_party: true }) } catch (e) { return reply(`⚠️ Failed: ${e.message}`) }
    await reply(
      `⚗️ *ADDED TO PARTY!*\n\n` +
      `*${p.name}* (Lvl ${p.level || 1}) has joined your party!\n\n` +
      `🏷️ Party is now ${party.length + 1}/6\n\n` +
      `_Use *#party* to view your team._`
    )
  },

  // ── #swap ─────────────────────────────────────────────────────
  async swap({ reply, sender, args }) {
    const [a, b] = [parseInt(args[0]), parseInt(args[1])]
    if (!a || !b || a === b || a < 1 || b < 1 || a > 6 || b > 6)
      return reply(`⚠️ Usage: *#swap <slot1> <slot2>*`)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const pa = party[a - 1], pb = party[b - 1]
    if (!pa) return reply(`⚠️ No Pokémon in slot #${a}`)
    if (!pb) return reply(`⚠️ No Pokémon in slot #${b}`)
    try { await db.updatePokemon(pa._id, { slot: b }); await db.updatePokemon(pb._id, { slot: a }) } catch {}
    await reply(`🔄 *SWAP COMPLETE!*\n\n#${a} ${pa.name} ↔️ #${b} ${pb.name}`)
  },

  // ── #dex ──────────────────────────────────────────────────────
  async dex({ sock, jid, msg, reply, args }) {
    const NATURES = [
      'Hardy','Lonely','Brave','Adamant','Naughty',
      'Bold','Docile','Relaxed','Impish','Lax',
      'Timid','Hasty','Serious','Jolly','Naive',
      'Modest','Mild','Quiet','Bashful','Rash',
      'Calm','Gentle','Sassy','Careful','Quirky',
    ]

    const query = args[0]?.toLowerCase()
    if (!query) return reply(`📘 *POKÉDEX*\n\nUsage: *#dex <name or id>*`)

    await sock.sendMessage(jid, { text: `🔍 *Searching Pokédex for* *${query}*...` }, { quoted: msg })

    const data = await fetchPokeData(query).catch(() => null)
    if (!data) return reply(`📭 *${query}* not found in the Pokédex.`)

    // ── Species-stable nature & level (seeded by pokemon_id for consistency) ──
    const nature    = NATURES[data.id % NATURES.length]
    const wildLevel = 5 + (data.id % 56)          // deterministic wild level 5–60
    const ability   = data.abilities?.[0] || 'Unknown'
    const typeStr   = (data.types || []).join(' / ')

    // ── Fetch owners who have caught this species ──────────────────────────
    const owners   = await db.getPokemonOwnersBySpeciesId(data.id, 5).catch(() => [])
    const ownerJids = owners.map(o => `${o.phone}@s.whatsapp.net`)

    let ownersBlock
    if (!owners.length) {
      ownersBlock = `*👥 Owners:* None yet`
    } else {
      const lines = owners.map((o, i) => {
        const isLast = i === owners.length - 1
        const prefix = isLast ? '   └' : '   ├'
        return `${prefix} 👤 @${o.phone}`
      })
      ownersBlock = `*👥 Owners:*\n${lines.join('\n')}`
    }

    // ── Build caption (user's exact template) ──────────────────────────────
    const caption =
      `📘 *Pokémon Info* 📘\n\n` +
      `*🧧 Name:* ${data.name}\n` +
      `*⚡ Type:* ${typeStr}\n` +
      `*⭐ Level:* ${wildLevel}\n` +
      `*❤️ HP:* ${data.hp}\n` +
      `*✨ Nature:* ${nature}\n` +
      `*🎯 Ability:* ${ability}\n\n` +
      ownersBlock

    // ── Download image as buffer for full-quality (upscaled) send ──────────
    let imgBuf = null
    if (data.imageUrl) {
      // Prefer official artwork (up to 475×475 PNG — highest quality available)
      imgBuf = await downloadBuffer(data.imageUrl, 18000).catch(() => null)
    }

    if (imgBuf) {
      await sock.sendMessage(jid, {
        image:    imgBuf,
        caption,
        mimetype: 'image/png',
        mentions: ownerJids,
      }, { quoted: msg })
    } else {
      // Fallback: send via URL (no buffer download available)
      if (data.imageUrl) {
        try {
          await sock.sendMessage(jid, {
            image:    { url: data.imageUrl },
            caption,
            mentions: ownerJids,
          }, { quoted: msg })
          return
        } catch {}
      }
      // Final fallback: text only
      await sock.sendMessage(jid, { text: caption, mentions: ownerJids }, { quoted: msg })
    }
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
  async battle({ sock, jid, msg, reply, sender, senderJid, user, args }) {
    const TB       = '\`\`\`'
    const subCmd   = args[0]?.toLowerCase()
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []

    // ── Cleanup expired challenges ────────────────────────────
    for (const key of Object.keys(pendingChallenges)) {
      if (Date.now() > pendingChallenges[key].expiresAt) delete pendingChallenges[key]
    }

    // ── #battle @user — Issue a challenge ─────────────────────
    if (mentioned.length > 0 && (!subCmd || subCmd.startsWith('@'))) {
      const opponentJid    = mentioned[0]
      const opponentJidNum = opponentJid.split('@')[0]
      if (opponentJidNum === sender) return reply(`🚫 You can't challenge yourself!`)

      // Resolve canonical (web-registered) phone from DB to avoid LID/JID mismatch
      const opponentUser  = await db.getUserByJid(opponentJid).catch(() => null)
      const opponentPhone = opponentUser?.phone || opponentJidNum

      const [myPoke, theirPoke] = await Promise.all([
        db.getUserPokemon(sender).catch(() => []),
        db.getUserPokemon(opponentPhone).catch(() => []),
      ])
      const myParty    = (myPoke   || []).filter(p => p.in_party)
      const theirParty = (theirPoke || []).filter(p => p.in_party)
      if (!myParty.length)    return reply(`📭 You need at least 1 Pokémon to battle.`)
      if (!theirParty.length) return reply(`📭 @${opponentPhone} has no Pokémon in their party.`)

      // Cancel any existing challenge from this sender in this jid
      for (const key of Object.keys(pendingChallenges)) {
        if (key.startsWith(`${jid}:${sender}`)) delete pendingChallenges[key]
      }

      const weather     = WEATHER_BOOSTS[Math.floor(Math.random() * WEATHER_BOOSTS.length)]
      const battleFmt   = BATTLE_FORMATS[Math.floor(Math.random() * BATTLE_FORMATS.length)]
      const expiresAt   = Date.now() + PVP_EXPIRE_MS
      const challengeKey = `${jid}:${sender}`

      const myTeamNames    = myParty.slice(0, 3).map(p => p.name).join(', ')
      const theirTeamNames = theirParty.slice(0, 3).map(p => p.name).join(', ')

      pendingChallenges[challengeKey] = {
        jid, challengerPhone: sender, challengerJid: senderJid,
        opponentPhone, opponentJid,
        weather, battleFmt,
        myParty, theirParty,
        expiresAt,
      }

      const text =
        `⚔️ *Battle Request!*\n\n` +
        `*@${sender}* has challenged *@${opponentPhone}* to a Pokémon battle! ⚔️\n\n` +
        `⚔️ Match Setup\n\n` +
        `- *Format:* ${battleFmt}\n` +
        `- *Weather:* ${weather}\n\n` +
        `*🔥 Teams Ready*\n\n` +
        `*@${sender}:* ${myTeamNames},\n\n` +
        `*@${opponentPhone}:* ${theirTeamNames},\n\n` +
        `*@${opponentPhone},* do you accept the challenge?\n\n` +
        `${TB}#battle accept${TB} - Accept and begin battle\n` +
        `${TB}#battle decline${TB} - Decline the challenge\n\n` +
        `⏳ This request will expire in *2 minutes*`

      // Fetch profile pictures for VS image (silent fallback if unavailable)
      let challengerAvatar = null, opponentAvatar = null
      try {
        const url = await sock.profilePictureUrl(senderJid, 'image').catch(() => null)
        if (url) challengerAvatar = await downloadBuffer(url, 8000).catch(() => null)
      } catch {}
      try {
        const url = await sock.profilePictureUrl(opponentJid, 'image').catch(() => null)
        if (url) opponentAvatar = await downloadBuffer(url, 8000).catch(() => null)
      } catch {}

      const vsImg = await buildBattleChallenge({
        challengerName:     user?.name || sender,
        challengerAvatarBuf: challengerAvatar,
        opponentName:       opponentUser?.name || opponentPhone,
        opponentAvatarBuf:  opponentAvatar,
      }).catch(() => null)

      if (vsImg) {
        return await sock.sendMessage(jid, {
          image: vsImg, caption: text, mimetype: 'image/png',
          mentions: [senderJid, opponentJid],
        }, { quoted: msg })
      }
      return await sock.sendMessage(jid, {
        text,
        mentions: [senderJid, opponentJid],
      }, { quoted: msg })
    }

    // ── #battle accept ────────────────────────────────────────
    if (subCmd === 'accept') {
      // Find a pending challenge in this jid targeting the sender
      const challengeKey = Object.keys(pendingChallenges).find(k => {
        const c = pendingChallenges[k]
        return c.jid === jid && c.opponentPhone === sender
      })
      if (!challengeKey) return reply(`⚠️ No pending battle challenge for you in this group.`)

      const challenge = pendingChallenges[challengeKey]
      delete pendingChallenges[challengeKey]

      const { challengerPhone, challengerJid, opponentJid: oppJid, weather, battleFmt, myParty, theirParty } = challenge

      const cPoke = myParty[0]
      const oPoke = theirParty[0]
      const cMaxHp = 200 + (cPoke.level || 1) * 15
      const oMaxHp = 200 + (oPoke.level || 1) * 15

      const battle = {
        jid,
        challengerPhone,
        challengerJid,
        opponentPhone: sender,
        opponentJid: oppJid,
        weather,
        battleFmt,
        challengerParty: myParty,
        opponentParty:   theirParty,
        challengerPoke:  cPoke,
        opponentPoke:    oPoke,
        challengerHp:    cMaxHp,
        challengerMaxHp: cMaxHp,
        opponentHp:      oMaxHp,
        opponentMaxHp:   oMaxHp,
        turn:            challengerPhone,
        challengerSwitchUsed: false,
        opponentSwitchUsed:   false,
      }
      pvpBattles[challengerPhone] = battle
      pvpBattles[sender]          = battle

      // "Challenge Accepted" message
      await sock.sendMessage(jid, {
        text: `🌟 Challenge Accepted. Good luck trainer 🧧`,
        mentions: [challengerJid, oppJid],
      }, { quoted: msg })

      // Battle status + image
      const effects  = WEATHER_BATTLE_EFFECTS[weather] || ['The battle begins!', 'Good luck!']
      const statusText =
        buildBattleStatus(battle, challengerPhone) +
        `\n\n*@${challengerPhone}, your turn awaits... ⏳*`

      let imgBuf = null
      try {
        imgBuf = await buildBattleImage({
          myName:    cPoke.name,    myLevel:   cPoke.level || 1,
          myHp:      cMaxHp,        myMaxHp:   cMaxHp,
          myId:      cPoke.pokemon_id || null,
          wildName:  oPoke.name,    wildLevel: oPoke.level || 1,
          wildHp:    oMaxHp,        wildMaxHp: oMaxHp,
          wildId:    oPoke.pokemon_id || null,
          logLines:  [effects[0], effects[1]],
        })
      } catch {}

      if (imgBuf) {
        return await sock.sendMessage(jid, {
          image:    imgBuf,
          caption:  statusText,
          mimetype: 'image/png',
          mentions: [challengerJid, oppJid],
        }, { quoted: msg })
      }
      return await sock.sendMessage(jid, {
        text: statusText, mentions: [challengerJid, oppJid],
      }, { quoted: msg })
    }

    // ── #battle decline ───────────────────────────────────────
    if (subCmd === 'decline') {
      const challengeKey = Object.keys(pendingChallenges).find(k => {
        const c = pendingChallenges[k]
        return c.jid === jid && c.opponentPhone === sender
      })
      if (!challengeKey) return reply(`⚠️ No pending challenge for you to decline.`)
      const challenge = pendingChallenges[challengeKey]
      delete pendingChallenges[challengeKey]
      return await sock.sendMessage(jid, {
        text: `⚠️ *@${sender}* declined the battle challenge from *@${challenge.challengerPhone}*.`,
        mentions: [senderJid, challenge.challengerJid],
      }, { quoted: msg })
    }

    // ── #battle fight — show current pokemon's moves ──────────
    if (subCmd === 'fight') {
      const battle = pvpBattles[sender]
      if (!battle) return reply(`📭 You're not in a PvP battle.`)
      const isChallenger = sender === battle.challengerPhone
      const myPoke = isChallenger ? battle.challengerPoke : battle.opponentPoke
      const moves  = Array.isArray(myPoke.moves) ? myPoke.moves : ['Tackle']
      const list   = moves.map((m, i) => `*${i + 1}.* ${m}`).join('\n')
      return reply(`🎮 *${myPoke.name.toUpperCase()} — MOVES*\n\n${list}\n\nUse *#move <number>* to attack!`)
    }

    // ── #battle pokemon — show switchable pokemon ─────────────
    if (subCmd === 'pokemon') {
      const battle = pvpBattles[sender]
      if (!battle) return reply(`📭 You're not in a PvP battle.`)
      const isChallenger = sender === battle.challengerPhone
      const myParty = isChallenger ? battle.challengerParty : battle.opponentParty
      const myPoke  = isChallenger ? battle.challengerPoke  : battle.opponentPoke
      const others  = myParty.filter(p => p.name !== myPoke.name)
      if (!others.length) return reply(`⚠️ No other Pokémon to switch to!`)
      const list = others.map((p, i) => {
        const hp = 200 + (p.level || 1) * 15
        return `*${i + 1}.* ${p.name} Lv.${p.level || 1} | HP: ${hp}`
      }).join('\n')
      return reply(`🔄 *SWITCH POKÉMON*\n\n${list}\n\n_Type *#battle switch <number>* to switch._`)
    }

    // ── #battle switch <n> — allowed only ONCE per match ────────
    if (subCmd === 'switch') {
      const battle = pvpBattles[sender]
      if (!battle) return reply(`📭 You're not in a PvP battle.`)
      if (battle.turn !== sender) return reply(`⏳ It's not your turn!`)
      const isChallenger = sender === battle.challengerPhone
      const switchUsedKey = isChallenger ? 'challengerSwitchUsed' : 'opponentSwitchUsed'
      if (battle[switchUsedKey]) return reply(`⚠️ You've already used your switch for this match!`)
      const myParty = isChallenger ? battle.challengerParty : battle.opponentParty
      const myPoke  = isChallenger ? battle.challengerPoke  : battle.opponentPoke
      const others  = myParty.filter(p => p.name !== myPoke.name)
      const idx     = (parseInt(args[1]) || 1) - 1
      const newPoke = others[idx]
      if (!newPoke) return reply(`⚠️ Invalid selection.`)
      const newMaxHp = 200 + (newPoke.level || 1) * 15
      battle[switchUsedKey] = true
      if (isChallenger) {
        battle.challengerPoke  = newPoke
        battle.challengerHp    = newMaxHp
        battle.challengerMaxHp = newMaxHp
      } else {
        battle.opponentPoke  = newPoke
        battle.opponentHp    = newMaxHp
        battle.opponentMaxHp = newMaxHp
      }
      battle.turn = isChallenger ? battle.opponentPhone : battle.challengerPhone
      return reply(`🔄 *Switched to ${newPoke.name}!*\n\n_(Switch used — you cannot switch again this match)_\nYour opponent's turn now.`)
    }

    // ── #battle forfeit ───────────────────────────────────────
    if (subCmd === 'forfeit') {
      const battle = pvpBattles[sender]
      if (!battle) return reply(`📭 You're not in a PvP battle.`)
      const winnerId = sender === battle.challengerPhone ? battle.opponentPhone : battle.challengerPhone
      const winnerJid = sender === battle.challengerPhone ? battle.opponentJid : battle.challengerJid
      delete pvpBattles[battle.challengerPhone]
      delete pvpBattles[battle.opponentPhone]
      const u = user || await db.getOrCreateUser(sender)
      await db.updateUser(sender,    { pokemon_losses: (u.pokemon_losses || 0) + 1 }).catch(() => {})
      const w = await db.getOrCreateUser(winnerId).catch(() => ({}))
      await db.updateUser(winnerId, { pokemon_wins: (w.pokemon_wins || 0) + 1, xp: (w.xp || 0) + 3 }).catch(() => {})
      return await sock.sendMessage(jid, {
        text: `🏳️ *@${sender}* has forfeited the battle!\n\n🏆 *@${winnerId}* wins! +3 XP`,
        mentions: [senderJid, winnerJid],
      }, { quoted: msg })
    }

    // ── Default ───────────────────────────────────────────────
    return reply('Please mention a user you want to battle.')
  },

  // ── #gym ──────────────────────────────────────────────────────
  async gym({ reply, sender, user }) {
    const leaders = ['Brock', 'Misty', 'Lt. Surge', 'Erika', 'Koga', 'Sabrina', 'Blaine', 'Giovanni']
    const leader  = leaders[Math.floor(Math.random() * leaders.length)]
    const win     = Math.random() > 0.4
    const u       = user || await db.getOrCreateUser(sender)
    if (win) {
      await db.updateUser(sender, { pokemon_badges: (u.pokemon_badges || 0) + 1, xp: (u.xp || 0) + 2 })
      await reply(`🏅 *GYM BATTLE — ${leader.toUpperCase()}!*\n\n🏆 *YOU WIN!*\n\n🥇 Badge earned! Total: ${(u.pokemon_badges || 0) + 1}\n⭐ +2 XP`)
    } else {
      await reply(`🏅 *GYM BATTLE — ${leader.toUpperCase()}!*\n\n💥 *DEFEAT!*\n\n_Train harder and return._ 🖤`)
    }
  },

  // ── #raid ─────────────────────────────────────────────────────
  async raid({ reply, sender, user }) {
    const remaining = await db.getCooldown(sender, 'praid').catch(() => 0)
    if (remaining > 0) {
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      return reply(`⏳ *RAID COOLDOWN*\n\n🕒 Wait: ${mins}m ${secs}s\n\n_The boss needs time to respawn._ 🖤`)
    }
    const bosses = [
      { name: 'Mega Mewtwo', xp: 3 }, { name: 'Shadow Kyogre', xp: 4 }, { name: 'Dark Rayquaza', xp: 3 },
    ]
    const boss = bosses[Math.floor(Math.random() * bosses.length)]
    const win  = Math.random() > 0.5
    const u    = user || await db.getOrCreateUser(sender)
    await db.setCooldown(sender, 'praid', 6 * 60)
    if (win) {
      await db.updateUser(sender, { xp: (u.xp || 0) + boss.xp, wallet: (u.wallet || 0) + 8 })
      await reply(`🔥 *RAID BOSS — ${boss.name.toUpperCase()}!*\n\n🏆 *RAID CLEARED!*\n\n⭐ +${boss.xp} XP\n💰 +8 coins\n\n⏳ Next raid in 6 minutes.`)
    } else {
      await reply(`🔥 *RAID BOSS — ${boss.name.toUpperCase()}!*\n\n💔 *RAID FAILED!*\n\n_Gather more trainers and try again._ 🖤\n\n⏳ Next attempt in 6 minutes.`)
    }
  },

  // ── #evolve ───────────────────────────────────────────────────
  async evolve({ sock, jid, msg, reply, sender, args }) {
    const slot    = parseInt(args[0]) || 1
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`⚠️ No Pokémon in slot #${slot}`)
    const lvl = p.level || 1
    if (lvl < 16) return reply(`⚠️ *${p.name}* is only level ${lvl}!\n\n_Pokémon evolve at levels 16 and 36._\n_Keep training with *#train ${slot}*!_ 🖤`)
    await reply(`✨ *${p.name}* is evolving…`)
    const evoName = await getPokeEvolutionTarget(p.pokemon_id, p.name.toLowerCase()).catch(() => null)
    if (!evoName) return reply(`⚠️ *${p.name}* has no further evolution — it's already at its final form! 🌟`)
    const newData = await fetchPokeData(evoName).catch(() => null)
    if (!newData) return reply(`⚠️ Could not fetch evolution data. Try again later.`)
    try {
      await db.updatePokemon(p._id, {
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
    if (!p) return reply(`⚠️ No Pokémon in slot #${slot}`)

    // Very hard XP — 1000 XP per pokemon level
    const xpGain = randInt(1, 2)
    const newXp  = (p.xp || 0) + xpGain
    const oldLvl = p.level || 1
    const newLvl = Math.floor(newXp / 1000) + 1
    const leveled = newLvl > oldLvl

    await db.setCooldown(sender, `ptrain${slot}`, 15 * 60)

    // Check for evolution at levels 16 and 36
    if (leveled && (newLvl === 16 || newLvl === 36)) {
      try {
        await db.updatePokemon(p._id, { xp: newXp, level: newLvl })
        const evoName = await getPokeEvolutionTarget(p.pokemon_id, p.name.toLowerCase())
        if (evoName) {
          const newData = await fetchPokeData(evoName).catch(() => null)
          if (newData) {
            await db.updatePokemon(p._id, {
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

    try { await db.updatePokemon(p._id, { xp: newXp, level: newLvl }) } catch {}
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
    if (!p) return reply(`⚠️ No Pokémon in slot #${slot}`)
    const moveList = Array.isArray(p.moves) ? p.moves : ['Tackle']
    await reply(`🎮 *${p.name.toUpperCase()} — MOVES*\n\n${moveList.map((m, i) => `${i + 1}. *${m}*`).join('\n')}\n\n_Use *#learn ${slot}* to unlock new moves._ 🖤`)
  },

  // ── #learn ────────────────────────────────────────────────────
  async learn({ reply, sender, args }) {
    const slot    = parseInt(args[0]) || 1
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`⚠️ No Pokémon in slot #${slot}`)
    const data     = await fetchPokeData(p.pokemon_id).catch(() => null)
    const allMoves = data?.moves || []
    const newMove  = allMoves[Math.floor(Math.random() * allMoves.length)] || 'Hyper Beam'
    const curMoves = Array.isArray(p.moves) ? [...p.moves] : ['Tackle']
    if (!curMoves.includes(newMove)) { curMoves.push(newMove); try { await db.updatePokemon(p._id, { moves: curMoves.slice(0, 8) }) } catch {} }
    await reply(`📚 *MOVE LEARNED!*\n\n📛 *${p.name}* learned *${newMove}*!`)
  },

  // ── #stats ────────────────────────────────────────────────────
  async stats({ reply, sender, args }) {
    const slot    = parseInt(args[0]) || 1
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`⚠️ No Pokémon in slot #${slot}`)
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
    if (!entry) return reply(`📭 Item "*${key}*" not found. Check *#mart*`)
    const [itemKey, item] = entry
    if (item.gem) {
      if ((u.gems || 0) < item.price) return reply(`⚠️ Need *${item.price} gems*`)
      await db.updateUser(sender, { gems: (u.gems || 0) - item.price })
    } else {
      if ((u.wallet || 0) < item.price) return reply(`⚠️ Need *$${item.price}*`)
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
    if (!item) return reply(`📭 Item not found. Check *#mart*`)
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
    if (!mentioned.length) return reply('Please mention a user to trade with.')
    await sock.sendMessage(jid, {
      text: `🔄 *TRADE REQUEST*\n\n*@${sender}* wants to trade with *@${mentioned[0].split('@')[0]}*!\n\n_Use *#gift* to send Pokémon directly._ 🖤`,
      mentions: [msg.key.participant || msg.key.remoteJid, mentioned[0]],
    }, { quoted: msg })
  },

  // ── #gift ─────────────────────────────────────────────────────
  async gift({ sock, jid, msg, reply, sender, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const slot = parseInt(args[0]) || 1
    if (!mentioned.length) return reply('Please mention a user to gift your Pokémon to.')
    const targetPhone = mentioned[0].split('@')[0]
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`⚠️ No Pokémon in slot #${slot}`)
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
      await reply(`⚠️ Failed to save sticker: ${err.message}`)
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
      await reply(`⚠️ *Pokémon System DISABLED.*`)
    } else {
      await reply(`⚠️ Usage: *.pokemon on/off*`)
    }
  },

  // ── .fight — start wild Pokémon battle ───────────────────────
  async fight({ sock, jid, msg, reply, sender, user }) {
    const wild = pendingPokemon[jid]
    if (!wild) return reply(`⚠️ *No wild Pokémon here!*\n\nUse *#hunt* to find one first.`)
    if (Date.now() - wild.spawnedAt > POKE_CATCH_WINDOW) {
      delete pendingPokemon[jid]
      return reply(`⚠️ *The wild ${wild.name} fled!*\n\nUse *#hunt* to search again.`)
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
    if (!party.length) return reply(`⚠️ You need Pokémon in your party!\n\nCatch some first with *#hunt*.`)

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

    const moveMenu =
      `*📋 Moves:*\n` +
      moves.map((m, i) => `  *${i + 1}.* ${m}`).join('\n') +
      `\n\n> *.move <1-${moves.length}>* to attack  |  *.flee* to escape`

    // ── Try to send a Pokemon-style battle scene image ─────────
    try {
      const imgBuf = await buildBattleImage({
        myName:    myPoke.name,
        myLevel,
        myHp:      myMaxHp,
        myMaxHp,
        myId:      myPoke.pokemon_id || myPoke.id || null,
        wildName:  wild.name,
        wildLevel,
        wildHp:    wildMaxHp,
        wildMaxHp,
        wildId:    wild.id || null,
        logLines:  [`A wild ${wild.name} appeared!`],
      })
      if (imgBuf) {
        await sock.sendMessage(jid, {
          image:   imgBuf,
          caption: `⚔️ *WILD BATTLE!*\n\n${moveMenu}`,
          mimetype: 'image/png',
        }, { quoted: msg })
        return
      }
    } catch {}

    // ── Fallback: text HP bars ─────────────────────────────────
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
        `━━━━━━━━━━━━━━\n${moveMenu}`,
    }, { quoted: msg })
  },

  // ── .move — use a move during wild OR pvp battle ──────────────
  async move({ sock, jid, msg, reply, sender, senderJid, user, args }) {
    // ── PvP battle handling ─────────────────────────────────────
    const pvp = pvpBattles[sender]
    if (pvp && pvp.jid === jid) {
      if (pvp.turn !== sender) return reply(`⏳ It's not your turn yet! Wait for your opponent.`)

      const isChallenger = sender === pvp.challengerPhone
      const myPoke    = isChallenger ? pvp.challengerPoke  : pvp.opponentPoke
      const theirPoke = isChallenger ? pvp.opponentPoke    : pvp.challengerPoke
      const myHpKey   = isChallenger ? 'challengerHp'      : 'opponentHp'
      const theirHpKey= isChallenger ? 'opponentHp'        : 'challengerHp'
      const theirPhone= isChallenger ? pvp.opponentPhone   : pvp.challengerPhone
      const theirJid  = isChallenger ? pvp.opponentJid     : pvp.challengerJid

      const moves    = Array.isArray(myPoke.moves) && myPoke.moves.length ? myPoke.moves : ['Tackle']
      const moveIdx  = Math.max(0, (parseInt(args[0]) || 1) - 1)
      const moveName = moves[Math.min(moveIdx, moves.length - 1)] || 'Tackle'

      const lvl      = myPoke.level || 1
      const baseDmg  = 20 + lvl * 2
      const crit     = Math.random() < 0.10
      const dmg      = Math.round(randInt(baseDmg, baseDmg + 15) * (crit ? 1.5 : 1))

      pvp[theirHpKey] = Math.max(0, pvp[theirHpKey] - dmg)

      const logLines = [
        `${myPoke.name} used ${moveName}!`,
        crit ? `✨ Critical hit! -${dmg} HP` : `-${dmg} HP`,
      ]

      // ── Opponent fainted ──────────────────────────────────
      if (pvp[theirHpKey] <= 0) {
        delete pvpBattles[pvp.challengerPhone]
        delete pvpBattles[pvp.opponentPhone]

        const u = user || await db.getOrCreateUser(sender).catch(() => ({}))
        const w = await db.getOrCreateUser(theirPhone).catch(() => ({}))
        await Promise.all([
          db.updateUser(sender,     { pokemon_wins:   (u.pokemon_wins   || 0) + 1, xp: (u.xp || 0) + 27 }).catch(() => {}),
          db.updateUser(theirPhone, { pokemon_losses: (w.pokemon_losses || 0) + 1 }).catch(() => {}),
        ])

        const endText =
          `💥 *${theirPoke.name} fainted!*\n\n` +
          `🏆 *@${sender}* wins the battle!\n⭐ +27 XP earned!`

        let imgBuf = null
        try {
          imgBuf = await buildBattleImage({
            myName:    myPoke.name,    myLevel:   myPoke.level || 1,
            myHp:      pvp[myHpKey],   myMaxHp:   isChallenger ? pvp.challengerMaxHp : pvp.opponentMaxHp,
            myId:      myPoke.pokemon_id || null,
            wildName:  theirPoke.name, wildLevel: theirPoke.level || 1,
            wildHp:    0,              wildMaxHp: isChallenger ? pvp.opponentMaxHp : pvp.challengerMaxHp,
            wildId:    theirPoke.pokemon_id || null,
            logLines:  [`${theirPoke.name} fainted!`, `@${sender} wins!`],
          })
        } catch {}

        if (imgBuf) {
          return await sock.sendMessage(jid, {
            image: imgBuf, caption: endText, mimetype: 'image/png',
            mentions: [senderJid, theirJid],
          }, { quoted: msg })
        }
        return await sock.sendMessage(jid, {
          text: endText, mentions: [senderJid, theirJid],
        }, { quoted: msg })
      }

      // ── Battle continues — switch turn ────────────────────
      pvp.turn = theirPhone

      const statusText =
        buildBattleStatus(pvp, theirPhone) +
        `\n\n*@${theirPhone}, your turn awaits... ⏳*`

      let imgBuf = null
      try {
        imgBuf = await buildBattleImage({
          myName:    pvp.challengerPoke.name,    myLevel:   pvp.challengerPoke.level || 1,
          myHp:      pvp.challengerHp,           myMaxHp:   pvp.challengerMaxHp,
          myId:      pvp.challengerPoke.pokemon_id || null,
          wildName:  pvp.opponentPoke.name,      wildLevel: pvp.opponentPoke.level || 1,
          wildHp:    pvp.opponentHp,             wildMaxHp: pvp.opponentMaxHp,
          wildId:    pvp.opponentPoke.pokemon_id || null,
          logLines,
        })
      } catch {}

      if (imgBuf) {
        return await sock.sendMessage(jid, {
          image: imgBuf, caption: statusText, mimetype: 'image/png',
          mentions: [senderJid, theirJid],
        }, { quoted: msg })
      }
      return await sock.sendMessage(jid, {
        text: statusText, mentions: [senderJid, theirJid],
      }, { quoted: msg })
    }

    // ── Wild battle handling ────────────────────────────────────
    const battle = activeBattles[sender]
    if (!battle) return reply(
      `📭 *Not in a battle!*\n\nUse *#hunt* to find a wild Pokémon, then *.fight* to battle it.`
    )
    if (battle.jid !== jid) return reply(`⚠️ Your active battle is in a different group.`)

    const moveIdx  = Math.max(0, (parseInt(args[0]) || 1) - 1)
    const moveName = battle.moves[Math.min(moveIdx, battle.moves.length - 1)] || 'Tackle'

    // ── Player attacks ─────────────────────────────────────────
    const myAtk     = 15 + (battle.myPokemon.level || 1) * 3
    const crit      = Math.random() < 0.15
    const playerDmg = randInt(myAtk, myAtk + 15) + (crit ? 12 : 0)
    battle.wildHp   = Math.max(0, battle.wildHp - playerDmg)

    const logLines = [
      `${battle.myPokemon.name} used ${moveName}!`,
      crit ? `✨ Critical hit! (-${playerDmg} HP)` : `(-${playerDmg} HP)`,
    ]

    // ── Wild fainted? ──────────────────────────────────────────
    if (battle.wildHp <= 0) {
      const xpGain = 1
      const u = user || await db.getOrCreateUser(sender)
      await db.updateUser(sender, {
        xp:           (u.xp || 0) + xpGain,
        pokemon_wins: (u.pokemon_wins || 0) + 1,
      }).catch(() => {})
      delete activeBattles[sender]
      pendingPokemon[jid] = { ...battle.wild, spawnedAt: Date.now(), weakened: true }

      const faintText =
        `💫 *Wild ${battle.wild.name} fainted!*\n\n` +
        `⭐ *+${xpGain} XP* earned!\n\n` +
        `🎯 *${battle.wild.name}* is weakened — use *#catch <slot> | <ball>* to capture it! _(90 sec)_`

      try {
        const imgBuf = await buildBattleImage({
          myName:    battle.myPokemon.name,
          myLevel:   battle.myPokemon.level || 1,
          myHp:      battle.myHp,
          myMaxHp:   battle.myMaxHp,
          myId:      battle.myPokemon.pokemon_id || battle.myPokemon.id || null,
          wildName:  battle.wild.name,
          wildLevel: battle.wild.level,
          wildHp:    0,
          wildMaxHp: battle.wildMaxHp,
          wildId:    battle.wild.id || null,
          logLines:  [`${battle.wild.name} fainted!`, `+${xpGain} XP earned!`],
        })
        if (imgBuf) {
          await sock.sendMessage(jid, { image: imgBuf, caption: faintText, mimetype: 'image/png' }, { quoted: msg })
          return
        }
      } catch {}

      return await sock.sendMessage(jid, {
        text: `⚔️ *TURN ${battle.turn}*\n\n` +
          `⚡ *${battle.myPokemon.name}* used *${moveName}*!\n` +
          (crit ? `✨ *Critical hit!* (-${playerDmg} HP)\n\n` : `(-${playerDmg} HP)\n\n`) +
          faintText,
      }, { quoted: msg })
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

    logLines.push(`${battle.wild.name} used ${wildMove}!`)
    logLines.push(wildCrit ? `💥 Critical hit! (-${wildDmg} HP)` : `(-${wildDmg} HP)`)

    // ── Player fainted? ────────────────────────────────────────
    if (battle.myHp <= 0) {
      delete activeBattles[sender]
      delete pendingPokemon[jid]
      const faintText = `💔 *${battle.myPokemon.name} fainted!*\n\n_The wild ${battle.wild.name} fled._ 🖤`

      try {
        const imgBuf = await buildBattleImage({
          myName:    battle.myPokemon.name,
          myLevel:   battle.myPokemon.level || 1,
          myHp:      0,
          myMaxHp:   battle.myMaxHp,
          myId:      battle.myPokemon.pokemon_id || battle.myPokemon.id || null,
          wildName:  battle.wild.name,
          wildLevel: battle.wild.level,
          wildHp:    battle.wildHp,
          wildMaxHp: battle.wildMaxHp,
          wildId:    battle.wild.id || null,
          logLines:  [`${battle.myPokemon.name} fainted!`],
        })
        if (imgBuf) {
          await sock.sendMessage(jid, { image: imgBuf, caption: faintText, mimetype: 'image/png' }, { quoted: msg })
          return
        }
      } catch {}

      return await sock.sendMessage(jid, {
        text: `⚔️ *TURN ${battle.turn}*\n\n` +
          logLines.map(l => l.startsWith('✨') || l.startsWith('💥') ? l : `  ${l}`).join('\n') +
          `\n\n${faintText}`,
      }, { quoted: msg })
    }

    // ── Battle continues — send battle scene image ─────────────
    const moveMenu =
      `*📋 Moves:*\n` +
      battle.moves.map((m, i) => `  *${i + 1}.* ${m}`).join('\n') +
      `\n\n> *.move <1-${battle.moves.length}>* to attack  |  *.flee* to escape`

    try {
      const imgBuf = await buildBattleImage({
        myName:    battle.myPokemon.name,
        myLevel:   battle.myPokemon.level || 1,
        myHp:      battle.myHp,
        myMaxHp:   battle.myMaxHp,
        myId:      battle.myPokemon.pokemon_id || battle.myPokemon.id || null,
        wildName:  battle.wild.name,
        wildLevel: battle.wild.level,
        wildHp:    battle.wildHp,
        wildMaxHp: battle.wildMaxHp,
        wildId:    battle.wild.id || null,
        logLines,
      })
      if (imgBuf) {
        await sock.sendMessage(jid, {
          image:    imgBuf,
          caption:  `⚔️ *TURN ${battle.turn - 1}*\n\n${moveMenu}`,
          mimetype: 'image/png',
        }, { quoted: msg })
        return
      }
    } catch {}

    // ── Fallback: text HP bars ─────────────────────────────────
    const bar = (cur, max) => {
      const f = Math.max(0, Math.round(cur / max * 10))
      return '🟩'.repeat(f) + '⬜'.repeat(10 - f)
    }
    const fullLog = [
      `⚔️ *TURN ${battle.turn - 1}*\n`,
      ...logLines,
      `\n━━━━━━━━━━━━━━`,
      `🌿 *${battle.wild.name}* (Lv ${battle.wild.level})`,
      `❤️ ${bar(battle.wildHp, battle.wildMaxHp)} ${battle.wildHp}/${battle.wildMaxHp} HP`,
      ``,
      `⚡ *${battle.myPokemon.name}* (Lv ${battle.myPokemon.level || 1})`,
      `❤️ ${bar(battle.myHp, battle.myMaxHp)} ${battle.myHp}/${battle.myMaxHp} HP`,
      `\n${moveMenu}`,
    ]
    await sock.sendMessage(jid, { text: fullLog.join('\n') }, { quoted: msg })
  },

  // ── .flee — escape from wild battle ───────────────────────────
  async flee({ reply, sender, jid }) {
    const battle = activeBattles[sender]
    if (!battle) return reply(`📭 You're not in a battle.`)
    if (battle.jid !== jid) return reply(`⚠️ Your active battle is in a different group.`)

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
  async mb(ctx) { return module.exports.move(ctx) },
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

// ── JSON helper for PokéAPI ──────────────────────────────────────────────────
async function downloadJson(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null) }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end',  () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { resolve(null) }
      })
      res.on('error', () => resolve(null))
    })
    req.on('error',   () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
  })
}

// ── Party composite image (2-col, stat bars, official artwork) ───────────────
async function _buildPartyImage(party, trainerName) {
  let sharp
  try { sharp = require('sharp') } catch { return null }

  const TYPE_COLORS = {
    normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
    grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
    ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
    rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
    steel: '#B8B8D0', fairy: '#EE99AC',
  }
  const tc  = (t) => TYPE_COLORS[(t || 'normal').toLowerCase()] || '#6890F0'
  const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const trainer = esc((trainerName || 'ME').toUpperCase().slice(0, 18))

  const HEADER_H = 58, CELL_W = 495, CELL_H = 230
  const W = 2 * CELL_W, H = HEADER_H + 3 * CELL_H  // 990 × 748
  const ACCENT_W = 5, SPR_SZ = 128, SPR_PAD = 10
  const STATS_X  = ACCENT_W + SPR_SZ + SPR_PAD + 10  // ≈153 from cell-left

  // Fetch PokéAPI base stats for each slot in parallel
  const apiStats = await Promise.all(
    Array.from({ length: 6 }, async (_, i) => {
      const p = party[i]
      if (!p?.pokemon_id) return null
      try {
        const d = await downloadJson(`https://pokeapi.co/api/v2/pokemon/${p.pokemon_id}`)
        if (!d?.stats) return null
        return {
          hp:  d.stats[0]?.base_stat ?? 45,
          atk: d.stats[1]?.base_stat ?? 49,
          def: d.stats[2]?.base_stat ?? 49,
          spd: d.stats[5]?.base_stat ?? 45,
        }
      } catch { return null }
    })
  )

  let cellsSvg = ''
  for (let i = 0; i < 6; i++) {
    const col = i % 2, row = Math.floor(i / 2)
    const X   = col * CELL_W, Y = HEADER_H + row * CELL_H
    const p   = party[i]
    const st  = apiStats[i]

    if (p) {
      const types  = Array.isArray(p.types) ? p.types : (p.types ? [p.types] : ['normal'])
      const accent = tc(types[0])
      const lvl    = p.level || 1
      const pName  = esc(p.name.toUpperCase().slice(0, 13))

      const typeBadges = types.slice(0, 2).map((t, ti) => {
        const bx = X + STATS_X + ti * 90
        return `<rect x="${bx}" y="${Y + 56}" width="80" height="19" rx="9" fill="${tc(t)}" opacity="0.88"/>
          <text x="${bx + 40}" y="${Y + 69}" fill="white" font-size="10" font-weight="bold" text-anchor="middle" font-family="'Courier New',monospace">${esc(t.toUpperCase())}</text>`
      }).join('\n        ')

      const BAR_W = CELL_W - STATS_X - 50
      const bars = [
        ['HP',  st?.hp  ?? 45, 250, '#48D840'],
        ['ATK', st?.atk ?? 49, 185, '#F08030'],
        ['DEF', st?.def ?? 49, 250, '#6890F0'],
        ['SPD', st?.spd ?? 45, 180, '#F8D030'],
      ].map(([lbl, val, mx, clr], bi) => {
        const bY = Y + 88 + bi * 30
        const fw = Math.max(4, Math.round(val / mx * BAR_W))
        return `<text x="${X + STATS_X}" y="${bY + 9}" fill="#707090" font-size="10" font-family="'Courier New',monospace">${lbl}</text>
          <text x="${X + CELL_W - 14}" y="${bY + 9}" fill="#9090A8" font-size="10" font-family="'Courier New',monospace" text-anchor="end">${val}</text>
          <rect x="${X + STATS_X + 28}" y="${bY}" width="${BAR_W}" height="9" rx="4" fill="#1c1c30"/>
          <rect x="${X + STATS_X + 28}" y="${bY}" width="${fw}" height="9" rx="4" fill="${clr}"/>`
      }).join('\n        ')

      cellsSvg += `
        <rect x="${X}" y="${Y}" width="${CELL_W}" height="${CELL_H}" fill="#181828"/>
        <rect x="${X}" y="${Y}" width="${ACCENT_W}" height="${CELL_H}" fill="${accent}"/>
        <rect x="${X + ACCENT_W}" y="${Y}" width="3" height="${CELL_H}" fill="${accent}" opacity="0.20"/>
        <text x="${X + STATS_X}" y="${Y + 40}" fill="white" font-size="19" font-weight="bold" font-family="'Courier New',monospace">${pName}</text>
        <rect x="${X + CELL_W - 72}" y="${Y + 20}" width="52" height="22" rx="11" fill="#252535"/>
        <text x="${X + CELL_W - 46}" y="${Y + 36}" fill="#8888b0" font-size="12" font-weight="bold" text-anchor="middle" font-family="'Courier New',monospace">Lv${lvl}</text>
        ${typeBadges}
        ${bars}
        <line x1="${X}" y1="${Y + CELL_H - 1}" x2="${X + CELL_W}" y2="${Y + CELL_H - 1}" stroke="#222232" stroke-width="1"/>`
    } else {
      cellsSvg += `
        <rect x="${X}" y="${Y}" width="${CELL_W}" height="${CELL_H}" fill="#0f0f1e"/>
        <rect x="${X + 8}" y="${Y + 8}" width="${CELL_W - 16}" height="${CELL_H - 16}" rx="6" fill="none" stroke="#252535" stroke-width="1.5" stroke-dasharray="8,4"/>
        <circle cx="${X + 68}" cy="${Y + CELL_H / 2}" r="24" fill="#181828" stroke="#2a2a40" stroke-width="1.5"/>
        <text x="${X + 68}" y="${Y + CELL_H / 2 + 8}" fill="#333350" font-size="24" font-weight="bold" text-anchor="middle" font-family="'Courier New',monospace">+</text>
        <text x="${X + 108}" y="${Y + CELL_H / 2 - 4}" fill="#303048" font-size="14" font-family="'Courier New',monospace">NO DATA</text>
        <text x="${X + 108}" y="${Y + CELL_H / 2 + 16}" fill="#303048" font-size="12" font-family="'Courier New',monospace">EMPTY SLOT</text>
        <line x1="${X}" y1="${Y + CELL_H - 1}" x2="${X + CELL_W}" y2="${Y + CELL_H - 1}" stroke="#1a1a28" stroke-width="1"/>`
    }
  }

  const bgSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0c0c1c"/><stop offset="100%" stop-color="#101020"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect x="0" y="0" width="${W}" height="${HEADER_H}" fill="#090918"/>
    <rect x="0" y="0" width="${W}" height="3" fill="#00BFFF"/>
    <rect x="0" y="0" width="6" height="${HEADER_H}" fill="#00BFFF"/>
    <text x="18" y="38" fill="#00BFFF" font-size="26" font-weight="bold" font-family="'Courier New',monospace">|</text>
    <text x="36" y="38" fill="white" font-size="22" font-weight="bold" font-family="'Courier New',monospace">KONO</text>
    <text x="134" y="38" fill="#00BFFF" font-size="22" font-weight="bold" font-family="'Courier New',monospace">SUBA</text>
    <text x="228" y="38" fill="#00BFFF" font-size="18" font-weight="bold" font-family="'Courier New',monospace"> // ACTIVE</text>
    <line x1="468" y1="32" x2="${W - 220}" y2="32" stroke="#00BFFF" stroke-width="1" stroke-dasharray="6,4" opacity="0.38"/>
    <text x="${W - 16}" y="38" fill="#606080" font-size="13" font-family="'Courier New',monospace" text-anchor="end">TRAINER: ${trainer}</text>
    <line x1="${CELL_W}" y1="${HEADER_H}" x2="${CELL_W}" y2="${H}" stroke="#1e1e30" stroke-width="2"/>
    ${cellsSvg}
  </svg>`

  let base
  try { base = await sharp(Buffer.from(bgSvg)).png().toBuffer() } catch { return null }

  const spriteJobs = await Promise.all(
    Array.from({ length: 6 }, async (_, i) => {
      const p = party[i]
      if (!p?.pokemon_id) return null
      const artUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.pokemon_id}.png`
      const sprUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.pokemon_id}.png`
      let buf = await downloadBuffer(artUrl, 10000).catch(() => null)
      if (!buf) buf = await downloadBuffer(sprUrl, 8000).catch(() => null)
      return buf ? { buf, idx: i } : null
    })
  )

  const composites = []
  for (const job of spriteJobs) {
    if (!job) continue
    const { buf, idx } = job
    const col = idx % 2, row = Math.floor(idx / 2)
    try {
      const spr = await sharp(buf)
        .resize(SPR_SZ, SPR_SZ, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
        .png().toBuffer()
      const left = col * CELL_W + ACCENT_W + SPR_PAD
      const top  = HEADER_H + row * CELL_H + Math.round((CELL_H - SPR_SZ) / 2)
      composites.push({ input: spr, left, top })
    } catch {}
  }

  try {
    return composites.length
      ? await sharp(base).composite(composites).png().toBuffer()
      : base
  } catch { return null }
}
