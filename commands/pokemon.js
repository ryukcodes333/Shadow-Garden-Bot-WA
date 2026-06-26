const db = require('../database')
const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')
const { buildBattleImage, buildBattleChallenge } = require('../battleHelper')

const PHELP_IMAGE = path.join(__dirname, '../assets/phelp.jpg')
const PMENU_IMAGE = path.join(__dirname, '../assets/pmenu.jpg')

// ── Pending wild pokemon & battles ───────────────────────────────
const pendingPokemon    = {}
const activeBattles     = {}
const pendingChallenges = {}  // key: `${jid}:${challengerPhone}`
const pvpBattles        = {}  // key: phone number (both players point to same obj)
const pendingStarters   = {}  // key: phone → { expiresAt }
const pendingGymBattle  = {}  // key: phone → { gym, battle state }
const pendingLearnChoice = {} // key: phone → { slot, moveName, pokemon }

// ── Gym progression data ──────────────────────────────────────────
const GYM_DATA = [
  { name: 'Pewter Gym',   leader: 'Brock',    badge: 'Boulder Badge', type: 'Rock',     typeEmoji: '🪨', nextUnlock: 'Cerulean',  coins: 3000, xp: 500, minPokemon: 3, recLevel: 12, leaderPokemon: [{ name: 'Geodude', level: 12 }, { name: 'Onix', level: 14 }] },
  { name: 'Cerulean Gym', leader: 'Misty',    badge: 'Cascade Badge', type: 'Water',    typeEmoji: '💧', nextUnlock: 'Vermilion', coins: 4000, xp: 700, minPokemon: 3, recLevel: 18, leaderPokemon: [{ name: 'Staryu', level: 18 }, { name: 'Starmie', level: 21 }] },
  { name: 'Vermilion Gym',leader: 'Lt. Surge',badge: 'Thunder Badge',  type: 'Electric', typeEmoji: '⚡', nextUnlock: 'Celadon',  coins: 5000, xp: 900, minPokemon: 3, recLevel: 25, leaderPokemon: [{ name: 'Voltorb', level: 21 }, { name: 'Pikachu', level: 18 }, { name: 'Raichu', level: 24 }] },
  { name: 'Celadon Gym',  leader: 'Erika',    badge: 'Rainbow Badge',  type: 'Grass',    typeEmoji: '🌿', nextUnlock: 'Fuchsia',  coins: 6000, xp: 1100, minPokemon: 4, recLevel: 29, leaderPokemon: [{ name: 'Victreebel', level: 29 }, { name: 'Tangela', level: 24 }, { name: 'Vileplume', level: 29 }] },
  { name: 'Fuchsia Gym',  leader: 'Koga',     badge: 'Soul Badge',     type: 'Poison',   typeEmoji: '☠️', nextUnlock: 'Saffron',  coins: 7000, xp: 1300, minPokemon: 4, recLevel: 37, leaderPokemon: [{ name: 'Koffing', level: 37 }, { name: 'Muk', level: 39 }, { name: 'Weezing', level: 43 }] },
  { name: 'Saffron Gym',  leader: 'Sabrina',  badge: 'Marsh Badge',    type: 'Psychic',  typeEmoji: '🔮', nextUnlock: 'Cinnabar', coins: 8000, xp: 1500, minPokemon: 5, recLevel: 43, leaderPokemon: [{ name: 'Kadabra', level: 38 }, { name: 'Mr. Mime', level: 37 }, { name: 'Venomoth', level: 38 }, { name: 'Alakazam', level: 43 }] },
  { name: 'Cinnabar Gym', leader: 'Blaine',   badge: 'Volcano Badge',  type: 'Fire',     typeEmoji: '🔥', nextUnlock: 'Viridian', coins: 9000, xp: 1800, minPokemon: 5, recLevel: 47, leaderPokemon: [{ name: 'Growlithe', level: 42 }, { name: 'Ponyta', level: 40 }, { name: 'Rapidash', level: 42 }, { name: 'Arcanine', level: 47 }] },
  { name: 'Viridian Gym', leader: 'Giovanni', badge: 'Earth Badge',    type: 'Ground',   typeEmoji: '🌍', nextUnlock: 'Elite Four', coins: 12000, xp: 2500, minPokemon: 6, recLevel: 50, leaderPokemon: [{ name: 'Rhyhorn', level: 45 }, { name: 'Dugtrio', level: 42 }, { name: 'Nidoqueen', level: 44 }, { name: 'Nidoking', level: 45 }, { name: 'Rhydon', level: 50 }] },
]

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

  // Real level-up moves sorted by level learned — no more headbutt on everything
  const realMoves = (poke.moves || [])
    .filter(m => m.version_group_details?.some(v => v.move_learn_method?.name === 'level-up' && v.level_learned_at > 0))
    .sort((a, b) => {
      const la = Math.min(...a.version_group_details.filter(v => v.move_learn_method?.name === 'level-up').map(v => v.level_learned_at))
      const lb = Math.min(...b.version_group_details.filter(v => v.move_learn_method?.name === 'level-up').map(v => v.level_learned_at))
      return la - lb
    })
    .slice(0, 4)
    .map(m => capName(m?.move?.name))
  // Fallback if no level-up moves found
  const moveset = realMoves.length ? realMoves : (poke.moves || []).slice(0, 4).map(m => capName(m?.move?.name))

  return {
    id:          poke.id,
    name:        capName(poke.name),
    types:       (poke.types || []).map(t => capName(t?.type?.name)),
    baseXp:      poke.base_experience || 50,
    height:      ((poke.height || 0) / 10).toFixed(1),
    weight:      ((poke.weight || 0) / 10).toFixed(1),
    moves:       moveset,
    abilities:   (poke.abilities || []).map(a => capName(a?.ability?.name)),
    hp:          getStat('hp'),
    attack:      getStat('attack'),
    defense:     getStat('defense'),
    sp_atk:      getStat('special-attack'),
    sp_def:      getStat('special-defense'),
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

  // ── .pmenu — POKÉVERSE command menu ─────────────────────────────
  async pmenu({ sock, jid, msg }) {
    const menuText =
      `\`\`\`🌟 POKÉVERSE 🌟\`\`\`\n\n` +
      `*🌍 ADVENTURE*\n` +
      `┣ .scout\n` +
      `      └ \`Search for loots\`\n` +
      `┣ .hunt\n` +
      `      └ \`Search for a wild Pokémon\`\n` +
      `┣ .catch <slot> <ball>\n` +
      `      └ \`Attempt to catch a Pokémon\`\n` +
      `┣ .fight\n` +
      `      └ \`Attack the wild Pokémon\`\n` +
      `┣ .flee\n` +
      `      └ \`Escape from battle\`\n` +
      `┗ .dex <name/id>\n` +
      `      └ \`View PokéLab information\`\n\n` +
      `*⚔️ BATTLE*\n` +
      `┣ .battle @user\n` +
      `      └ \`Challenge another trainer\`\n` +
      `┣ .move <1-4>\n` +
      `      └ \`Use a move in battle\`\n` +
      `┣ .gym\n` +
      `      └ \`Challenge Gym Leaders\`\n` +
      `┗ .raid\n` +
      `      └ \`Join a Raid Battle\`\n\n` +
      `*🐾 PARTY & PC*\n` +
      `┣ .party\n` +
      `      └ \`View your active team\`\n` +
      `┣ .party <slot>\n` +
      `      └ \`View Pokémon details\`\n` +
      `┣ .moveset <slot>\n` +
      `      └ \`View move information\`\n` +
      `┣ .pc\n` +
      `      └ \`Access PC storage\`\n` +
      `┣ .swap <a> <b>\n` +
      `      └ \`Rearrange party slots\`\n` +
      `┣ .topc <slot>\n` +
      `      └ \`Send Pokémon to PC\`\n` +
      `┗ .toparty <slot>\n` +
      `      └ \`Move Pokémon to party\`\n\n` +
      `*🔄 TRAINING*\n` +
      `┣ .train <slot>\n` +
      `      └ \`Gain XP and level up\`\n` +
      `┣ .evolve <slot>\n` +
      `      └ \`Evolve a Pokémon\`\n` +
      `┣ .learn <slot>\n` +
      `      └ \`Learn a new move\`\n` +
      `┣ .heal\n` +
      `      └ \`Heal your entire team\`\n` +
      `┗ .boost\n` +
      `      └ \`Activate a temporary buff\`\n\n` +
      `*👤 TRAINER*\n` +
      `┣ .start\n` +
      `      └ \`Begin your Pokémon journey\`\n` +
      `┣ .trainer\n` +
      `      └ \`View trainer profile\`\n` +
      `┣ .pdaily\n` +
      `      └ \`Claim daily rewards\`\n` +
      `┣ .quests\n` +
      `      └ \`View active quests\`\n` +
      `┣ .rank\n` +
      `      └ \`Check global rankings\`\n` +
      `┗ .cooldown\n` +
      `      └ \`View command cooldowns\`\n\n` +
      `*🛒 SHOP*\n` +
      `┣ .mart\n` +
      `      └ \`Open the PokéMart\`\n` +
      `┣ .mbuy <item>\n` +
      `      └ \`Purchase an item\`\n` +
      `┣ .use <item>\n` +
      `      └ \`Use an item\`\n` +
      `┣ .trade @user\n` +
      `      └ \`Trade with another trainer\`\n` +
      `┗ .gift <slot> @user\n` +
      `      └ \`Gift a Pokémon\``

    try {
      const imgBuf = fs.readFileSync(PMENU_IMAGE)
      await sock.sendMessage(jid, { image: imgBuf, caption: menuText }, { quoted: msg })
    } catch {
      await sock.sendMessage(jid, { text: menuText }, { quoted: msg })
    }
  },

  // ── #phelp — backward-compat alias for .pmenu ────────────────
  async phelp(ctx) { return module.exports.pmenu(ctx) },

  // ── #start — Professor Oak registration flow ──────────────────
  async start({ sock, jid, msg, reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    if ((pokemon || []).some(p => p.in_party)) {
      return reply(
        `🌟 *Your journey is already underway, Trainer!*\n\n` +
        `👤 *${u.name || pushName || sender}*, your adventure continues.\n\n` +
        `> Use *.trainer* to view your profile\n` +
        `> Use *.pmenu* to see all commands\n\n` +
        `_The Pokémon world awaits._ 🖤`
      )
    }
    pendingStarters[sender] = { expiresAt: Date.now() + 5 * 60 * 1000 }
    await reply(
      `🌿 *Professor Oak appears...*\n\n` +
      `_"Ah, there you are! I've been waiting for you."_\n\n` +
      `_"Welcome to the world of POKÉMON! My name is Oak — people call me the Pokémon Professor."_\n\n` +
      `_"This world is inhabited by creatures called Pokémon. We people live alongside them. Some battle with their Pokémon. Some train them. Me? I study them."_\n\n` +
      `_"Now, ${u.name || pushName || 'young Trainer'}, your very own Pokémon adventure is about to unfold!"_\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `*🎒 Choose your Starter Pokémon:*\n\n` +
      `🌿 *Bulbasaur* — Grass / Poison type\n` +
      `   _"Calm and dependable. A trusted partner."_\n\n` +
      `🔥 *Charmander* — Fire type\n` +
      `   _"Brave and fierce. Born to battle."_\n\n` +
      `💧 *Squirtle* — Water type\n` +
      `   _"Witty and determined. Built for strategy."_\n\n` +
      `⭐ *Eevee* — Normal type\n` +
      `   _"Adaptable and mysterious. Full of potential."_\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `> Type *.pick <name>* to choose your starter!\n` +
      `> Example: *.pick Charmander*\n\n` +
      `_"Choose wisely. A Pokémon is a companion for life."_ 🌟\n\n` +
      `⏳ *This offer expires in 5 minutes.*`
    )
  },

  // ── .pick — starter selection ─────────────────────────────────
  async pick({ sock, jid, msg, reply, sender, pushName, user, args }) {
    const pending = pendingStarters[sender]
    if (!pending || Date.now() > pending.expiresAt) {
      delete pendingStarters[sender]
      return reply(
        `⚠️ *No starter selection pending!*\n\n` +
        `Use *.start* to begin your Pokémon journey.`
      )
    }
    const choice = (args[0] || '').toLowerCase().trim()
    const STARTERS = {
      bulbasaur:  { id: 1,   name: 'Bulbasaur',  emoji: '🌿', desc: 'the Seed Pokémon' },
      charmander: { id: 4,   name: 'Charmander', emoji: '🔥', desc: 'the Lizard Pokémon' },
      squirtle:   { id: 7,   name: 'Squirtle',   emoji: '💧', desc: 'the Tiny Turtle Pokémon' },
      eevee:      { id: 133, name: 'Eevee',       emoji: '⭐', desc: 'the Evolution Pokémon' },
    }
    const starter = STARTERS[choice]
    if (!starter) {
      return reply(
        `⚠️ *Invalid starter choice!*\n\n` +
        `Please choose one of:\n` +
        `🌿 *.pick Bulbasaur*\n` +
        `🔥 *.pick Charmander*\n` +
        `💧 *.pick Squirtle*\n` +
        `⭐ *.pick Eevee*`
      )
    }
    const existing = await db.getUserPokemon(sender).catch(() => [])
    if ((existing || []).some(p => p.in_party)) {
      delete pendingStarters[sender]
      return reply(`⚠️ You already have a Pokémon! Use *.trainer* to view your profile.`)
    }
    const u = user || await db.getOrCreateUser(sender, pushName)
    const data = await fetchPokeData(starter.id).catch(() => null)
    const NATURE_LIST = ['Hardy','Lonely','Brave','Adamant','Naughty','Bold','Docile','Relaxed','Impish','Lax','Timid','Hasty','Serious','Jolly','Naive','Modest','Mild','Quiet','Bashful','Rash','Calm','Gentle','Sassy','Careful','Quirky']
    const pokeData = {
      name:       starter.name,
      pokemon_id: starter.id,
      types:      data?.types      || [],
      moves:      data?.moves      || ['Tackle', 'Growl'],
      abilities:  data?.abilities  || [],
      level:      5,
      xp:         0,
      nature:     NATURE_LIST[Math.floor(Math.random() * NATURE_LIST.length)],
      hp:         data?.hp      || 45,
      attack:     data?.attack  || 49,
      defense:    data?.defense || 49,
      sp_atk:     data?.sp_atk || 45,
      sp_def:     data?.sp_def || 45,
      speed:      data?.speed  || 45,
      in_party:   true,
      fainted:    false,
      current_hp: data?.hp || 45,
      height:     data?.height || '?',
      weight:     data?.weight || '?',
    }
    try {
      await db.createPokemon(sender, pokeData)
    } catch (e) {
      return reply(`⚠️ Failed to save your starter: ${e.message}`)
    }
    delete pendingStarters[sender]
    const artUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${starter.id}.png`
    const caption =
      `${starter.emoji} *${starter.name.toUpperCase()} chosen!*\n\n` +
      `_Professor Oak smiles warmly..._\n\n` +
      `_"So, ${starter.name}! An excellent choice!"_\n\n` +
      `*🐾 ${starter.emoji} ${starter.name}* — ${starter.desc}\n` +
      `├ *Level:* 5\n` +
      `├ *Type:* ${(data?.types || []).join(' / ') || '?'}\n` +
      `├ *Nature:* ${pokeData.nature}\n` +
      `└ *Moves:* ${(data?.moves || ['Tackle']).slice(0, 3).join(', ')}\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `_"Take good care of it. It will be your partner through thick and thin."_ 🌟\n\n` +
      `> Use *.trainer* to view your trainer profile\n` +
      `> Use *.scout* to search for wild Pokémon\n` +
      `> Use *.pmenu* to see all commands\n\n` +
      `*Your adventure begins now!* 🎉`
    try {
      await sock.sendMessage(jid, { image: { url: artUrl }, caption }, { quoted: msg })
    } catch {
      await reply(caption)
    }
  },

  // ── #trainer — new layout ─────────────────────────────────────
  async trainer({ sock, jid, msg, reply, sender, user, pushName }) {
    const u       = user || await db.getOrCreateUser(sender, pushName)
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party).slice(0, 6)

    const badges   = u.pokemon_badges || 0
    const badgeRow = badges > 0 ? '⬡'.repeat(Math.min(badges, 8)) + ` (${badges}/8)` : '*(none yet)*'
    const coins    = (u.wallet || 0).toLocaleString()
    const caught   = (pokemon || []).length
    const hunts    = u.hunt_count || 0
    const partner  = party[0]
    const joined   = u.created_at
      ? new Date(u.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Unknown'

    const wins = u.pokemon_wins || 0
    let rank = '🌱 Rookie Trainer'
    if      (badges >= 8 || wins >= 50) rank = '🏆 Pokémon Master'
    else if (badges >= 4 || wins >= 20) rank = '⭐ Elite Trainer'
    else if (badges >= 1 || wins >= 5)  rank = '🔰 Gym Challenger'

    let invLines = '*(empty)*'
    try {
      const inv = await db.getInventory(sender)
      if (inv && typeof inv === 'object' && Object.keys(inv).length) {
        const items = Object.entries(inv)
          .filter(([, qty]) => qty > 0)
          .map(([key, qty]) => {
            const item = SHOP_ITEMS[key]
            return item ? `${item.emoji} *${item.name}* × ${qty}` : `• ${key} × ${qty}`
          })
        if (items.length) invLines = items.join('\n')
      }
    } catch {}

    const trainerId = '#' + sender.replace(/\D/g, '').slice(-8).padStart(8, '0')

    const profileText =
      `*🐾 Trainer Profile 🐾*\n\n` +
      `*👤 Name:* ${u.name || pushName || sender}\n` +
      `*🆔 Trainer ID:* ${trainerId}\n` +
      `*🏆 Rank:* ${rank}\n\n` +
      `*🏅 Gym Badges:* ${badgeRow}\n` +
      `*💰 PokéCoins:* ${coins}\n` +
      `*🎯 Pokémon Caught:* ${caught}\n` +
      `*🌿 Hunts Completed:* ${hunts}\n\n` +
      `*🐾 Partner Pokémon*\n` +
      (partner
        ? `${partner.name} • Lv. ${partner.level || 1} ❤️`
        : '*(no partner yet — use .start)*') +
      `\n\n` +
      `*🎒 Inventory*\n${invLines}\n\n` +
      `✨ *Journey Started:* ${joined}\n\n` +
      `_"Every Pokémon Master starts somewhere."_`

    const pokeId = partner?.pokemon_id
      || ((parseInt(sender.replace(/\D/g, '').slice(-4) || '1') || 1) % 898) + 1
    const artUrl  = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeId}.png`
    const fallUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokeId}.png`

    try {
      await sock.sendMessage(jid, { image: { url: artUrl }, caption: profileText }, { quoted: msg })
    } catch {
      try {
        await sock.sendMessage(jid, { image: { url: fallUrl }, caption: profileText }, { quoted: msg })
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

  // ── .scout — sequential wild encounter ───────────────────────
  async scout({ sock, jid, msg, reply, sender }) {
    const cd = await db.getCooldown(sender, 'hunt').catch(() => 0)
    if (cd > 0) {
      const mins = Math.floor(cd / 60000)
      const secs = Math.floor((cd % 60000) / 1000)
      return reply(`⏳ *SCOUT COOLDOWN*\n\n⏰ Wait *${mins}m ${secs}s* before scouting again.\n\n_The Pokémon are hiding. Give them time._ 🖤`)
    }
    if (pendingPokemon[jid]) {
      return reply(`⚠️ A wild Pokémon is already nearby!\n\nUse *#catch <slot>* to capture it first!`)
    }
    await db.setCooldown(sender, 'hunt', CD_HUNT)
    // Track hunt count
    try {
      const u = await db.getOrCreateUser(sender)
      await db.updateUser(sender, { hunt_count: (u.hunt_count || 0) + 1 })
    } catch {}

    const sleep = ms => new Promise(res => setTimeout(res, ms))
    await sock.sendMessage(jid, { text: '🌲 *The forest falls silent...*' }, { quoted: msg })
    await sleep(1800)

    // 40% find rate
    if (Math.random() >= 0.40) {
      const NO_FIND = [
        'The tall grass rustled, but nothing was there.',
        'You heard footsteps... turned out to be the wind.',
        'A shadow moved in the bushes — just a leaf.',
        'The Pokémon escaped into the deep forest.',
        'Heavy rain washed away all tracks.',
        'Too noisy — the Pokémon scattered.',
        'You searched every corner... found nothing.',
        'The area seems abandoned today.',
      ]
      return sock.sendMessage(jid, { text: `🌿 *Nothing found...*\n\n> ${NO_FIND[Math.floor(Math.random() * NO_FIND.length)]}` })
    }

    await sock.sendMessage(jid, { text: '❗ *SOMETHING MOVED IN THE BUSHES* ❗' })
    await sleep(1600)

    // Spawn in scout style
    const id   = randInt(1, MAX_POKEMON_ID)
    const data = await fetchPokeData(id).catch(() => null)

    if (!data) {
      pendingPokemon[jid] = { id, name: `Shadow-${id}`, types: ['Shadow'], baseXp: 60, spawnedAt: Date.now(), imageUrl: null, moves: ['Tackle'], abilities: ['Shadow Force'], height: '?', weight: '?' }
      setTimeout(() => { if (pendingPokemon[jid]?.id === id) delete pendingPokemon[jid] }, POKE_CATCH_WINDOW)
      return sock.sendMessage(jid, {
        text:
          `✨ *A wild Pokémon emerges!*\n\n` +
          `❓ *Shadow-${id}* • Lv. ${randInt(3, 30)}\n` +
          `🔹 Unknown\n\n` +
          `*⚔️ Choose an action*\n` +
          `> *.dex* — View PokéLab data\n` +
          `> *#catch <slot>* — Attempt capture\n` +
          `> *.fight <slot>* — Start a battle\n` +
          `> *.flee* — Leave quietly`,
      }, { quoted: msg })
    }

    pendingPokemon[jid] = { ...data, spawnedAt: Date.now() }
    setTimeout(() => { if (pendingPokemon[jid]?.id === id) delete pendingPokemon[jid] }, POKE_CATCH_WINDOW)

    const rarity  = getRarity(data.baseXp)
    const wildLvl = randInt(3, 30)
    const caption =
      `✨ *A wild Pokémon emerges!*\n\n` +
      `${rarity.emoji} *${data.name}* • Lv. ${wildLvl}\n` +
      `${rarity.emoji} *${rarity.rarity.charAt(0).toUpperCase() + rarity.rarity.slice(1)}*\n` +
      `_"${data.description || 'A mysterious Pokémon stares at you.'}"_\n\n` +
      `*⚔️ Choose an action*\n` +
      `> *.dex ${data.name.toLowerCase()}* — View PokéLab data\n` +
      `> *#catch <slot>* — Attempt capture\n` +
      `> *.fight <slot>* — Start a battle\n` +
      `> *.flee* — Leave quietly`

    if (data.imageUrl) {
      try {
        await sock.sendMessage(jid, { image: { url: data.imageUrl }, caption }, { quoted: msg })
        return
      } catch {}
    }
    await sock.sendMessage(jid, { text: caption }, { quoted: msg })
  },

  // ── #hunt — legacy alias → scout ─────────────────────────────
  async hunt(ctx) { return module.exports.scout(ctx) },

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
        hp: poke.hp || 45, attack: poke.attack || 45, defense: poke.defense || 45,
        sp_atk: poke.sp_atk || 45, sp_def: poke.sp_def || 45, speed: poke.speed || 45,
        nature: ['Hardy','Lonely','Brave','Adamant','Naughty','Bold','Docile','Relaxed','Impish','Lax','Timid','Hasty','Serious','Jolly','Naive','Modest','Mild','Quiet','Bashful','Rash','Calm','Gentle','Sassy','Careful','Quirky'][Math.floor(Math.random()*25)],
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
      if (isNaN(idx) || idx < 0) return reply(`⚠️ Usage: *.party <slot>*`)
      const p = party[idx]
      if (!p) return reply(`⚠️ No Pokémon in slot #${idx + 1}`)

      const types   = Array.isArray(p.types) ? p.types.join(' / ') : (p.types || '?')
      const ability = Array.isArray(p.abilities) ? (p.abilities[0] || 'Unknown') : (p.abilities || 'Unknown')
      const nature  = p.nature || 'Unknown'
      const maxHp   = p.hp || 45
      const curHp   = p.current_hp ?? maxHp
      const xpReq   = (p.level || 1) * 100

      // Gender based on pokemon_id parity (genderless set)
      const GENDERLESS_IDS = new Set([81,82,100,101,120,121,137,233,292,337,338,343,344,374,375,376,436,437,462,474,479,599,600,601,602,603,604,622,623,703,808,809])
      const gender = GENDERLESS_IDS.has(p.pokemon_id) ? '⚲' : (p.pokemon_id % 2 === 0 ? '♀' : '♂')

      const statusFlag = p.fainted ? '💀' : curHp < maxHp * 0.25 ? '⚠️' : '✅'
      const statusText = p.fainted ? '💀 Fainted' : '💚 Healthy'
      const mood = MOODS[Math.abs((p.pokemon_id || 1) + (p.level || 1)) % MOODS.length] || 'Content'

      // IV % derived consistently from stats
      const ivPct = Math.min(100, Math.round(((p.attack || 45) + (p.defense || 45) + (p.speed || 45)) / 3 / 45 * 100 * 0.7 + ((p.pokemon_id || 1) * 7 % 30)))
      // Type emoji map
      const TYPE_EMOJI = { fire:'🔥', water:'💧', grass:'🌿', electric:'⚡', psychic:'🔮', ghost:'👻', dragon:'🐉', dark:'🌑', fighting:'👊', poison:'☠️', ground:'🌍', rock:'🪨', ice:'❄️', bug:'🐛', flying:'🦅', normal:'⭐', steel:'⚙️', fairy:'✨' }
      const typeArr = Array.isArray(p.types) ? p.types : (p.types ? [p.types] : ['normal'])
      const typeEmoji = TYPE_EMOJI[(typeArr[0] || 'normal').toLowerCase()] || '⭐'
      // Moves list
      const moves = Array.isArray(p.moves) ? p.moves : []
      const move1 = moves[0] || '—'
      const move2 = moves[1] || '—'
      const move3 = moves[2] || '—'
      const move4 = moves[3] || '—'

      const caption =
        `*🐾 Party | Slot #${idx + 1}*\n\n` +
        `${typeEmoji} ${p.name} ${gender} • Lv.${p.level || 1}\n\n` +
        `*❤️ HP:* ${curHp}/${maxHp}\n` +
        `*💎 IV:* ${ivPct}%\n` +
        `*✨ Nature:* ${nature}\n` +
        `*🎖️ Ability:* ${ability}\n` +
        `*🎒 Item:* None\n` +
        `*🌟 Shiny:* No\n\n` +
        `*📊 Stats*\n` +
        `* ATK ${p.attack || 0}\n` +
        `* DEF ${p.defense || 0}\n` +
        `* SPA ${p.sp_atk || 0}\n` +
        `* SPD ${p.sp_def || 0}\n` +
        `* SPE ${p.speed || 0}\n\n` +
        `*🎮 Moves*\n` +
        `* ${move1}\n` +
        `* ${move2}\n` +
        `* ${move3}\n` +
        `* ${move4}\n\n` +
        `> *Use .moves <slot> to see Pokemon moves*`

      const artUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.pokemon_id}.png`
      const sprUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.pokemon_id}.png`
      const imgBuf = await downloadBuffer(artUrl, 12000).catch(() => null)
        || await downloadBuffer(sprUrl, 8000).catch(() => null)
      if (imgBuf) return await sock.sendMessage(jid, { image: imgBuf, caption }, { quoted: msg })
      return await sock.sendMessage(jid, { text: caption }, { quoted: msg })
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
    if (!query) return reply(`🔬 *POKÉLAB*\n\nUsage: *#dex <name or id>*`)

    await sock.sendMessage(jid, { text: `🔍 *Searching PokéLab for* *${query}*...` }, { quoted: msg })

    const data = await fetchPokeData(query).catch(() => null)
    if (!data) return reply(`📭 *${query}* not found in the PokéLab.`)

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
  async heal({ reply, sender }) {
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    if (!party.length) return reply(`❗ You have no Pokémon in your party!`)
    let healed = 0
    for (const p of party) {
      const maxHp = (p.hp || 45) + (p.level || 1) * 5
      try {
        await db.updatePokemon(p._id, { current_hp: maxHp, fainted: false })
        healed++
      } catch {}
    }
    await reply(`🌟 Success! You have successfully healed *${healed} Pokémons* in your party.`)
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

      const cMaxHp = 200 + (myParty[0]?.level || 1) * 15
      const oMaxHp = 200 + (theirParty[0]?.level || 1) * 15
      const vsImg = await buildBattleChallenge({
        challengerName:      user?.name || sender,
        challengerAvatarBuf: challengerAvatar,
        opponentName:        opponentUser?.name || opponentPhone,
        opponentAvatarBuf:   opponentAvatar,
        challengerPokeName:  myParty[0]?.name       || null,
        challengerPokeLevel: myParty[0]?.level       || 1,
        challengerPokeId:    myParty[0]?.pokemon_id  || null,
        challengerHp:        cMaxHp,
        challengerMaxHp:     cMaxHp,
        opponentPokeName:    theirParty[0]?.name      || null,
        opponentPokeLevel:   theirParty[0]?.level      || 1,
        opponentPokeId:      theirParty[0]?.pokemon_id || null,
        opponentHp:          oMaxHp,
        opponentMaxHp:       oMaxHp,
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
    const u       = user || await db.getOrCreateUser(sender)
    const badges  = u.pokemon_badges || 0
    const gymIdx  = Math.min(badges, GYM_DATA.length - 1)
    const gym     = GYM_DATA[gymIdx]

    if (badges >= 8) {
      return reply(
        `🏆 *All 8 Badges Collected!*\n\n` +
        `You have conquered all Kanto Gyms!\n\n` +
        `1️⃣ Pewter ✅  2️⃣ Cerulean ✅  3️⃣ Vermilion ✅  4️⃣ Celadon ✅\n` +
        `5️⃣ Fuchsia ✅  6️⃣ Saffron ✅  7️⃣ Cinnabar ✅  8️⃣ Viridian ✅\n\n` +
        `↓ Elite Four → Champion\n\n` +
        `💡 Use \`.raid\` to take on Raid Bosses!`
      )
    }

    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const maxLvl  = party.reduce((m, p) => Math.max(m, p.level || 1), 0)

    const BADGE_NUMS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣']
    const progressLine = BADGE_NUMS.slice(0, 8).map((n, i) => i < badges ? `${n}✅` : n).join('  ')

    await reply(
      `🏟️ ${gym.name}\n\n` +
      `👤 Leader: ${gym.leader}\n` +
      `${gym.typeEmoji} Type: ${gym.type}\n\n` +
      `Your Team\n` +
      `• Pokémon: ${party.length}/6\n` +
      `• Highest Lv: ${maxLvl || '—'}\n\n` +
      `Requirements\n` +
      `${party.length >= gym.minPokemon ? '✔' : '✘'} At least ${gym.minPokemon} Pokémon\n` +
      `${maxLvl >= gym.recLevel ? '✔' : '✘'} Recommended Lv. ${gym.recLevel}+\n\n` +
      `Rewards\n` +
      `🏅 ${gym.badge}\n` +
      `💰 ${gym.coins.toLocaleString()} PokéCoins\n` +
      `✨ ${gym.xp} XP\n\n` +
      `Badge Progress:\n${progressLine}\n\n` +
      `💡 Use \`.challenge\` to battle ${gym.leader}.`
    )
  },

  // ── .challenge [gym#] — start gym battle ──────────────────────
  async challenge({ reply, sender, user, args }) {
    const u       = user || await db.getOrCreateUser(sender)
    const badges  = u.pokemon_badges || 0

    // Accept optional gym number arg (1-indexed)
    let gymIdx = badges
    if (args[0]) {
      const requested = parseInt(args[0]) - 1
      if (isNaN(requested) || requested < 0 || requested >= GYM_DATA.length) {
        return reply(`❗ Invalid gym number. Use \`.gyms\` to see available gyms (1–8).`)
      }
      if (requested > badges) {
        return reply(`🔒 You haven't unlocked Gym ${requested + 1} yet!\n\nYou have *${badges}* badge${badges !== 1 ? 's' : ''}. Earn more by defeating gym leaders in order.\n\n💡 Use \`.gyms\` to see your progress.`)
      }
      gymIdx = Math.min(requested, GYM_DATA.length - 1)
    } else {
      gymIdx = Math.min(badges, GYM_DATA.length - 1)
    }

    const gym = GYM_DATA[gymIdx]

    if (badges >= 8) return reply(`🏆 You've already conquered all 8 Gyms! Use \`.raid\` for raid bosses.`)
    if (pendingGymBattle[sender]) return reply(`❗ You're already in a Gym battle! Use \`.move <1-4>\` to fight or \`.heal\` to reset.`)

    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party && !p.fainted)
    if (party.length < gym.minPokemon) return reply(`❗ You need at least ${gym.minPokemon} healthy Pokémon to challenge ${gym.leader}!`)

    const myLead     = party[0]
    const myMaxHp    = (myLead.hp || 45) + (myLead.level || 1) * 5
    const gymPoke    = gym.leaderPokemon[0]
    const gymMaxHp   = (gymPoke.level || 12) * 8 + 30

    pendingGymBattle[sender] = {
      gym,
      gymPokeIdx:  0,
      myPokemon:   myLead,
      myHp:        myMaxHp,
      myMaxHp,
      gymPokemon:  gymPoke,
      gymHp:       gymMaxHp,
      gymMaxHp,
      turn:        1,
      moves:       Array.isArray(myLead.moves) && myLead.moves.length ? myLead.moves : ['Tackle', 'Growl'],
    }

    await reply(
      `🏟️ Gym Battle Started!\n\n` +
      `Leader ${gym.leader} challenges you!\n\n` +
      `👤 ${gym.leader} sent out\n` +
      `${gym.typeEmoji} ${gymPoke.name} Lv.${gymPoke.level}\n\n` +
      `Choose a move:\n` +
      (pendingGymBattle[sender].moves.map((m, i) => `* ${m}`).join('\n')) +
      `\n\n💡 Use \`.move <1-${pendingGymBattle[sender].moves.length}>\` to attack!`
    )
  },

  // ── .gyms — see all available gyms ───────────────────────────
  async gyms({ reply, sender, user }) {
    const u      = user || await db.getOrCreateUser(sender)
    const badges = u.pokemon_badges || 0
    const BADGE_NUMS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣']
    const gymLines = GYM_DATA.map((g, i) => {
      const earned  = i < badges
      const current = i === badges
      const locked  = i > badges
      const status  = earned ? '✅' : current ? '⚔️' : '🔒'
      return (
        `${status} *Gym ${i + 1}* — ${g.name}\n` +
        `   👤 ${g.leader}  ${g.typeEmoji} ${g.type}  Rec. Lv.${g.recLevel}\n` +
        `   🏅 ${g.badge}${current ? `\n   💡 _Use \`.challenge ${i + 1}\` to battle!_` : ''}`
      )
    }).join('\n\n')
    await reply(
      `🏟️ *Kanto Gym League*\n\n` +
      `👤 Trainer: ${u.name || sender}\n` +
      `🏅 Badges: ${badges}/8\n\n` +
      `${gymLines}\n\n` +
      `Legend: ✅ Cleared  ⚔️ Current  🔒 Locked`
    )
  },

  // ── .badges — view earned badges ──────────────────────────────
  async badges({ reply, sender, user }) {
    const u      = user || await db.getOrCreateUser(sender)
    const badges = u.pokemon_badges || 0
    const BADGE_NUMS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣']
    const badgeLines = GYM_DATA.map((g, i) => {
      const earned = i < badges
      return `${BADGE_NUMS[i]} *${g.badge}* — ${g.leader} (${g.type})\n   ${earned ? '✅ Earned' : '🔒 Locked'}`
    }).join('\n\n')
    await reply(
      `🏅 *Badge Collection*\n\n` +
      `👤 ${u.name || sender}\n` +
      `Badges: ${badges}/8\n\n` +
      `${badgeLines}\n\n` +
      (badges >= 8
        ? `🏆 All badges collected! The Elite Four awaits!`
        : `💡 Use \`.gym\` to view your current Gym.`)
    )
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
    if (!p) return reply(`❗ No Pokémon in slot #${slot}`)
    const lvl = p.level || 1

    // ── Fetch evolution chain to get requirement ──────────────────
    let evoName    = null
    let reqLevel   = null
    let reqOther   = null
    try {
      const species  = await fetchJSON(`https://pokeapi.co/api/v2/pokemon-species/${p.pokemon_id}`)
      if (species?.evolution_chain?.url) {
        const chain = await fetchJSON(species.evolution_chain.url)
        if (chain?.chain) {
          function findEvo(node) {
            const nodeName = (node.species?.name || '').toLowerCase()
            const match    = nodeName === p.name.toLowerCase() || (node.species?.url || '').includes(`/${p.pokemon_id}/`)
            if (match && node.evolves_to?.length > 0) {
              const next    = node.evolves_to[0]
              const details = next.evolution_details?.[0] || {}
              evoName  = next.species.name
              reqLevel = details.min_level || null
              if (details.item?.name)              reqOther = `Use ${capName(details.item.name)}`
              else if (details.trigger?.name === 'trade') reqOther = 'Trade the Pokémon'
              else if (details.min_happiness)      reqOther = `Friendship ≥ ${details.min_happiness}`
              return true
            }
            for (const child of (node.evolves_to || [])) { if (findEvo(child)) return true }
            return false
          }
          findEvo(chain.chain)
        }
      }
    } catch {}

    // ── Check if eligible ─────────────────────────────────────────
    // Map PokéAPI item names → our shop item keys
    const STONE_MAP = {
      'fire-stone':    'firestone',
      'water-stone':   'waterstone',
      'thunder-stone': 'thunderstone',
      'leaf-stone':    'leafstone',
      'moon-stone':    'moonstone',
      'sun-stone':     'sunstone',
      'dawn-stone':    'dawnstone',
      'dusk-stone':    'duskstone',
      'shiny-stone':   'shinystone',
    }

    // Determine what requirement is needed
    let needsStone   = null  // the shop key of required stone
    let levelOk      = !reqLevel || lvl >= reqLevel
    let stoneOk      = true

    // Check if reqOther is a stone requirement
    if (reqOther) {
      // Look for stone match in reqOther string
      for (const [apiName, shopKey] of Object.entries(STONE_MAP)) {
        if (reqOther.toLowerCase().includes(apiName.replace(/-/g, ' ')) ||
            reqOther.toLowerCase().includes(shopKey)) {
          needsStone = shopKey
          break
        }
      }
      if (needsStone) {
        // Check if player has it in bag
        let inv = {}
        try { inv = await db.getInventory(sender) || {} } catch {}
        stoneOk = (inv[needsStone] || 0) > 0
      } else {
        // Non-stone requirement (trade, friendship) — block with info
        stoneOk = false
      }
    }

    const canEvolve = evoName && levelOk && stoneOk

    if (!evoName) {
      return reply(
        `❗ ${p.name} can't evolve yet.\n\n` +
        `Requirements:\n` +
        `┣ Level: ${lvl}/—\n` +
        `┗ Other: Already at final form\n\n` +
        `> 💡 Use \`.party ${slot}\` to view your Pokémon.`
      )
    }

    if (!levelOk) {
      return reply(
        `❗ ${p.name} can't evolve yet.\n\n` +
        `Requirements:\n` +
        `┣ Level: ${lvl}/${reqLevel} ✘\n` +
        `┗ Other: ${reqOther || '—'}\n\n` +
        `> 💡 Keep training with \`.train ${slot}\`!`
      )
    }

    if (needsStone && !stoneOk) {
      const stoneItem = SHOP_ITEMS[needsStone]
      return reply(
        `❗ ${p.name} needs a stone to evolve!\n\n` +
        `Requirements:\n` +
        `┣ Level: ${lvl} ✔\n` +
        `┗ Stone: ${stoneItem?.emoji || '💎'} ${stoneItem?.name || capName(needsStone)} ✘\n\n` +
        `💡 Buy it from \`.mart\` then use \`.use ${needsStone} ${slot}\` to evolve!`
      )
    }

    if (!stoneOk) {
      return reply(
        `❗ ${p.name} can't evolve yet.\n\n` +
        `Requirements:\n` +
        `┣ Level: ${lvl} ✔\n` +
        `┗ Other: ${reqOther}\n\n` +
        `> 💡 Use \`.party ${slot}\` to view your Pokémon.`
      )
    }

    // Consume the stone if one was used
    if (needsStone) {
      let inv = {}
      try { inv = await db.getInventory(sender) || {} } catch {}
      const newQty = Math.max(0, (inv[needsStone] || 1) - 1)
      try { await db.addItem(sender, needsStone, -1) } catch {
        try { await db.updateInventory(sender, { [needsStone]: newQty }) } catch {}
      }
    }

    await reply(`✨ *${p.name}* is evolving…`)
    const newData = await fetchPokeData(evoName).catch(() => null)
    if (!newData) return reply(`❗ Could not fetch evolution data. Try again later.`)

    // ── Get level-up moves for evolved form filtered to current level ──
    let evolvedMoves = newData.moves
    try {
      const rawPoke = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${newData.id}`)
      if (rawPoke?.moves) {
        const eligible = (rawPoke.moves || [])
          .filter(m => m.version_group_details?.some(v => v.move_learn_method?.name === 'level-up' && v.level_learned_at > 0 && v.level_learned_at <= lvl))
          .sort((a, b) => {
            const la = Math.min(...a.version_group_details.filter(v => v.move_learn_method?.name === 'level-up').map(v => v.level_learned_at))
            const lb = Math.min(...b.version_group_details.filter(v => v.move_learn_method?.name === 'level-up').map(v => v.level_learned_at))
            return lb - la
          })
          .slice(0, 4)
          .map(m => capName(m.move.name))
        if (eligible.length) evolvedMoves = eligible
      }
    } catch {}

    try {
      await db.updatePokemon(p._id, {
        name:        newData.name,
        pokemon_id:  newData.id,
        types:       newData.types,
        moves:       evolvedMoves,
        abilities:   newData.abilities,
      })
    } catch {}

    const evoAbility = newData.abilities?.[0] || 'Unknown'
    const ivPct      = Math.min(100, Math.round(((p.attack || 45) + (p.defense || 45) + (p.speed || 45)) / 3 / 45 * 100 * 0.7 + ((p.pokemon_id || 1) * 7 % 30)))

    const caption =
      `✨ Evolution Complete!\n\n` +
      `${p.name} evolved into ${newData.name}!\n\n` +
      `📈 Level: ${lvl}\n` +
      `🎖️ Ability: ${evoAbility}\n` +
      `💎 IV: ${ivPct}%\n\n` +
      `🎉 Congratulations! Your Pokémon has grown stronger.`

    // ── Evolution scene image via Pollinations ──────────────────
    const evoPrompt = encodeURIComponent(
      `Create a dramatic Pokémon evolution scene in a vertical (9:16) game-art style. Show ${p.name} on the left transforming into ${newData.name} on the right. Bright white and blue evolution energy spirals around the Pokémon with glowing particles, lightning-like arcs, and a radiant aura. The background is a dark, mystical forest with soft bokeh lights and magical effects. The transition between the two Pokémon should be seamless, with energy obscuring the middle to emphasize transformation. Highly detailed, vibrant colors, cinematic lighting, dynamic composition, no text, no watermark, polished game artwork`
    )
    const evoImgUrl = `https://image.pollinations.ai/prompt/${evoPrompt}?width=576&height=1024&nologo=true&model=turbo&seed=${Date.now() % 9999}`
    try {
      await sock.sendMessage(jid, { image: { url: evoImgUrl }, caption }, { quoted: msg })
      return
    } catch {}
    // Fallback to official artwork
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
    if (!p) return reply(`❗ No Pokémon in slot #${slot}`)
    if (p.fainted) return reply(`❗ *${p.name}* has fainted! Use \`.heal\` first.`)

    await db.setCooldown(sender, `ptrain${slot}`, 15 * 60)

    const myLvl = p.level || 1

    // ── Pick a wild opponent 1–5 levels lower (min level 1) ──────
    const WILD_POOL = [
      { name: 'Rattata', id: 19 }, { name: 'Pidgey', id: 16 }, { name: 'Caterpie', id: 10 },
      { name: 'Weedle', id: 13 }, { name: 'Spearow', id: 21 }, { name: 'Ekans', id: 23 },
      { name: 'Sandshrew', id: 27 }, { name: 'Nidoran', id: 32 }, { name: 'Clefairy', id: 35 },
      { name: 'Jigglypuff', id: 39 }, { name: 'Zubat', id: 41 }, { name: 'Oddish', id: 43 },
      { name: 'Paras', id: 46 }, { name: 'Venonat', id: 48 }, { name: 'Diglett', id: 50 },
      { name: 'Meowth', id: 52 }, { name: 'Psyduck', id: 54 }, { name: 'Mankey', id: 56 },
      { name: 'Growlithe', id: 58 }, { name: 'Poliwag', id: 60 }, { name: 'Abra', id: 63 },
      { name: 'Machop', id: 66 }, { name: 'Bellsprout', id: 69 }, { name: 'Tentacool', id: 72 },
    ]
    const wild    = WILD_POOL[Math.floor(Math.random() * WILD_POOL.length)]
    const wildLvl = Math.max(1, myLvl - randInt(1, 5))

    // ── Simulate battle outcome (higher level = better chance) ────
    const myPower   = myLvl * 10 + randInt(0, 30)
    const wildPower = wildLvl * 10 + randInt(0, 30)
    const won       = myPower >= wildPower

    // ── XP: truly random 300–800, larger range if opponent was close ──
    const xpGain = won ? randInt(300, 800) : randInt(80, 200)
    const newXp  = (p.xp || 0) + xpGain
    const oldLvl = myLvl
    const newLvl = Math.min(100, Math.floor(Math.sqrt(newXp / 50)) + 1)
    const leveled = newLvl > oldLvl

    // ── Build battle log lines ────────────────────────────────────
    const myMove   = Array.isArray(p.moves) && p.moves[0] ? p.moves[0] : 'Tackle'
    const wildMove = 'Tackle'
    const myDmg    = randInt(20 + myLvl * 2, 35 + myLvl * 3)
    const wildDmg  = randInt(10 + wildLvl, 20 + wildLvl * 2)

    const battleLog =
      `${p.name} used *${myMove}*! -${myDmg} HP\n` +
      `${wild.name} used *${wildMove}*! -${wildDmg} HP\n` +
      (won
        ? `💥 ${wild.name} fainted! *${p.name}* wins!`
        : `😵 *${p.name}* barely survived and fled!`)

    // ── Save XP/level ─────────────────────────────────────────────
    const updates = { xp: newXp, level: newLvl }
    if (!won) {
      const curHp = (p.current_hp || (p.hp || 45) + myLvl * 5)
      updates.current_hp = Math.max(1, curHp - Math.floor(wildDmg * 0.4))
    }
    try { await db.updatePokemon(p._id, updates) } catch {}

    // ── Level-up evolution check ──────────────────────────────────
    if (leveled) {
      try {
        const evoName = await getPokeEvolutionTarget(p.pokemon_id, p.name.toLowerCase())
        if (evoName) {
          const newData = await fetchPokeData(evoName).catch(() => null)
          if (newData && newLvl >= (newData.evoLevel || 16)) {
            await db.updatePokemon(p._id, {
              name: newData.name, pokemon_id: newData.id,
              types: newData.types, moves: newData.moves, abilities: newData.abilities,
            }).catch(() => {})
            const caption =
              `⚔️ *Training Battle — Lv.${wildLvl} ${wild.name}*\n\n${battleLog}\n\n` +
              `✨ *+${xpGain} XP* | 🆙 Level ${newLvl}\n\n` +
              `🌟 *${p.name}* evolved into *${newData.name}*!\n\n⏰ Train again in 15 minutes.`
            if (newData.imageUrl) {
              try { await sock.sendMessage(jid, { image: { url: newData.imageUrl }, caption }, { quoted: msg }); return } catch {}
            }
            return reply(caption)
          }
        }
      } catch {}
    }

    const xpBar   = newLvl * 50
    const xpNext  = (newLvl + 1) * (newLvl + 1) * 50
    const lvlLine = leveled ? `\n\n🆙 *LEVEL UP!* ${oldLvl} → ${newLvl} 🎊` : ''
    const evoHint = leveled && newLvl >= 16 ? `\n💡 Use \`.evolve ${slot}\` — may be eligible!` : ''

    await reply(
      `⚔️ *Training Battle — Lv.${wildLvl} ${wild.name}*\n\n` +
      `${battleLog}\n\n` +
      `${won ? '🏆 *Victory!*' : '🏃 *Ran away!*'}\n\n` +
      `✨ *+${xpGain} XP*\n` +
      `📊 XP: ${newXp} | Lv.${newLvl}` +
      `${lvlLine}${evoHint}\n\n` +
      `⏰ Train again in 15 minutes.`
    )
  },

  // ── #moves ────────────────────────────────────────────────────
  // ── .moves / .moveset — full PokéAPI move detail ─────────────
  async moves({ reply, sender, args, pushName }) {
    const slot    = parseInt(args[0]) || 1
    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`❗ No Pokémon in party slot #${slot}\n\nUse \`.party\` to see your team.`)

    const moveList = Array.isArray(p.moves) && p.moves.length ? p.moves : ['Tackle']

    const GENDERLESS_IDS2 = new Set([81,82,100,101,120,121,137,233,292,337,338,343,344,374,375,376,436,437,462,474,479,489,490,599,600,601,615,622,623,703,707,720,774,781,786,787,788,789,790,791,792,800,801,802,803,804,805,806])
    const gender = GENDERLESS_IDS2.has(p.pokemon_id) ? '⚧️' : (p.pokemon_id % 2 === 0 ? '♂️' : '♀️')

    const SLOT_NUMS = ['1️⃣','2️⃣','3️⃣','4️⃣']

    const moveDetails = await Promise.all(
      moveList.slice(0, 4).map(async (moveName) => {
        try {
          const slug = moveName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
          const data = await fetchJSON(`https://pokeapi.co/api/v2/move/${slug}`)
          const enEffect = (data?.effect_entries || []).find(e => e.language?.name === 'en')
          return {
            name:     moveName,
            pp:       data?.pp        != null ? data.pp        : '—',
            maxPp:    data?.pp        != null ? data.pp        : '—',
            type:     data?.type?.name ? capName(data.type.name) : '?',
            cat:      data?.damage_class?.name ? capName(data.damage_class.name) : 'Status',
            power:    data?.power    != null ? data.power    : '—',
            accuracy: data?.accuracy != null ? data.accuracy + '%' : '—',
            desc:     enEffect?.short_effect?.replace(/\$effect_chance/g, data?.effect_chance || '?') || 'No description.',
          }
        } catch {
          return { name: moveName, pp: '—', maxPp: '—', type: '?', cat: 'Status', power: '—', accuracy: '—', desc: 'No description.' }
        }
      })
    )

    const moveBlocks = moveDetails.map((m, i) =>
      `${SLOT_NUMS[i]} ${m.name}\n` +
      `├ PP: ${m.pp}/${m.maxPp}\n` +
      `├ Type: ${m.type} (${m.cat})\n` +
      `├ Power: ${m.power}\n` +
      `├ Accuracy: ${m.accuracy}\n` +
      `┗ Description: ${m.desc}`
    ).join('\n\n')

    await reply(
      `🌟 Pokemon Moves 🌟\n\n` +
      `🌿 ${p.name} ${gender} • Party Slot #${slot}\n\n` +
      `⚔️ Moves\n\n` +
      `${moveBlocks}\n\n` +
      `💡 Use .moveinfo <move> for more information about any move.`
    )
  },

  // alias: .moveset → same as .moves
  async moveset(ctx) { return module.exports.moves(ctx) },

  // ── .moveinfo <move name> — single move detail ─────────────────
  async moveinfo({ reply, args }) {
    if (!args[0]) return reply(`❗ Usage: \`.moveinfo <move name>\`\n\nExample: \`.moveinfo flamethrower\``)
    const moveName = args.join(' ').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    let data = null
    try { data = await fetchJSON(`https://pokeapi.co/api/v2/move/${moveName}`) } catch {}
    if (!data || !data.name) return reply(`❗ Move *${args.join(' ')}* not found.\n\nCheck spelling and try again.`)
    const enEffect = (data.effect_entries || []).find(e => e.language?.name === 'en')
    const desc = enEffect?.short_effect?.replace(/\$effect_chance/g, data.effect_chance || '?') || 'No description.'
    const type = data.type?.name ? capName(data.type.name) : '?'
    const cat  = data.damage_class?.name ? capName(data.damage_class.name) : 'Status'
    const pp   = data.pp != null ? data.pp : '—'
    const pwr  = data.power != null ? data.power : '—'
    const acc  = data.accuracy != null ? data.accuracy + '%' : '—'
    await reply(
      `*🔍 Move Info:*\n\n` +
      `⚔️ ${capName(data.name.replace(/-/g, ' '))}\n\n` +
      `💧 PP: ${pp}/${pp}\n` +
      `⚡ Type: ${type} (${cat})\n` +
      `💥 Power: ${pwr}\n` +
      `🎯 Accuracy: ${acc}\n\n` +
      `> 📖 ${desc}`
    )
  },

  // ── #learn — full 4-step move-learning flow ──────────────────
  async learn({ reply, sender, args }) {
    if (!args[0]) return reply(`❗ Usage: \`.learn <slot>\`\n\nUse \`.party\` to view your team slots.`)
    const slot = parseInt(args[0])
    if (isNaN(slot) || slot < 1) return reply(`❗ Invalid slot. Use \`.party\` to view your team.`)

    const pokemon = await db.getUserPokemon(sender).catch(() => [])
    const party   = (pokemon || []).filter(p => p.in_party)
    const p       = party[slot - 1]
    if (!p) return reply(`❗ No Pokémon in slot #${slot}. Use \`.party\` to view your team.`)

    const curMoves   = Array.isArray(p.moves) ? p.moves : ['Tackle']
    const currentLvl = p.level || 1

    // ── Step 3: .learn <slot> <move> forget <n> — replace a move ──
    if (args.length >= 4 && args[2]?.toLowerCase() === 'forget') {
      const moveName  = args[1].replace(/-/g, ' ')
      const forgetIdx = parseInt(args[3]) - 1
      if (isNaN(forgetIdx) || forgetIdx < 0 || forgetIdx >= curMoves.length) {
        return reply(`❗ Invalid slot to forget. Use a number from 1 to ${curMoves.length}.`)
      }
      const forgotten  = curMoves[forgetIdx]
      const newMoves   = [...curMoves]
      newMoves[forgetIdx] = capName(moveName)
      try { await db.updatePokemon(p._id, { moves: newMoves }) } catch {}
      return reply(
        `📚 *Move Replaced!*\n\n` +
        `${p.name} forgot *${forgotten}*\n` +
        `and learned *${capName(moveName)}*!\n\n` +
        `🎮 Current Moves:\n` +
        newMoves.map((m, i) => `${i + 1}. ${m}`).join('\n') +
        `\n\n> Use \`.moves ${slot}\` to view move details.`
      )
    }

    // ── Step 2: .learn <slot> <move> — teach a specific move ──────
    if (args.length >= 2) {
      const moveName = args.slice(1).join(' ').replace(/-/g, ' ')
      const moveSlug = moveName.toLowerCase().replace(/\s+/g, '-')

      // Validate the move exists for this Pokémon
      let moveData = null
      try {
        moveData = await fetchJSON(`https://pokeapi.co/api/v2/move/${moveSlug}`)
      } catch {}
      if (!moveData || !moveData.name) return reply(`❗ Move *${moveName}* not found. Check \`.learn ${slot}\` for available moves.`)

      if (curMoves.includes(capName(moveName))) {
        return reply(`❗ ${p.name} already knows *${capName(moveName)}*!`)
      }

      // If slot available, just add
      if (curMoves.length < 4) {
        const newMoves = [...curMoves, capName(moveName)]
        try { await db.updatePokemon(p._id, { moves: newMoves }) } catch {}
        return reply(
          `📚 *Move Learned!*\n\n` +
          `${p.name} learned *${capName(moveName)}*!\n\n` +
          `🎮 Current Moves:\n` +
          newMoves.map((m, i) => `${i + 1}. ${m}`).join('\n') +
          `\n\n> Use \`.moves ${slot}\` to view move details.`
        )
      }

      // Already 4 moves — ask to forget one
      pendingLearnChoice[sender] = { slot, moveName: capName(moveName), pokemon: p }
      return reply(
        `📚 ${p.name} already knows 4 moves!\n\n` +
        `Which move should ${p.name} forget to learn *${capName(moveName)}*?\n\n` +
        curMoves.map((m, i) => `${i + 1}. ${m}`).join('\n') +
        `\n\n💡 Use \`.learn ${slot} ${moveSlug} forget <1-4>\` to replace a move.`
      )
    }

    // ── Step 1: .learn <slot> — show learnable moves ───────────────
    let learnableMoves = []
    try {
      const rawPoke = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${p.pokemon_id}`)
      if (rawPoke?.moves) {
        learnableMoves = (rawPoke.moves || [])
          .filter(m => m.version_group_details?.some(v =>
            v.move_learn_method?.name === 'level-up' &&
            v.level_learned_at > 0 &&
            v.level_learned_at <= currentLvl + 10
          ))
          .sort((a, b) => {
            const la = Math.min(...a.version_group_details.filter(v => v.move_learn_method?.name === 'level-up').map(v => v.level_learned_at))
            const lb = Math.min(...b.version_group_details.filter(v => v.move_learn_method?.name === 'level-up').map(v => v.level_learned_at))
            return la - lb
          })
          .map(m => ({ name: capName(m.move.name), slug: m.move.name, level: Math.min(...m.version_group_details.filter(v => v.move_learn_method?.name === 'level-up').map(v => v.level_learned_at)) }))
          .filter(m => !curMoves.includes(m.name))
          .slice(0, 10)
      }
    } catch {}

    if (!learnableMoves.length) {
      return reply(
        `📚 *${p.name}* — Available Moves\n\n` +
        `No new moves available at Lv.${currentLvl}.\n\n` +
        `🎮 Current Moves:\n` +
        curMoves.map((m, i) => `${i + 1}. ${m}`).join('\n') +
        `\n\n> Train more to unlock new moves!`
      )
    }

    const moveLines = learnableMoves.map((m, i) => `${i + 1}. *${m.name}* (Lv.${m.level})`).join('\n')
    await reply(
      `📚 *${p.name}* — Available Moves (Lv.${currentLvl})\n\n` +
      `${moveLines}\n\n` +
      `🎮 Current Moves:\n` +
      curMoves.map((m, i) => `${i + 1}. ${m}`).join('\n') +
      `\n\n💡 Use \`.learn ${slot} <move name>\` to teach a move.`
    )
  },

  // ── .bag — view Pokémon bag inventory ────────────────────────
  async bag({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const username = u.name || sender

    let inventory = {}
    try { inventory = await db.getInventory(sender) || {} } catch {}

    // Category order and classification
    const CATEGORY_ORDER = ['Poké Balls', 'Medicine', 'Berries', 'Evolution Items', 'Held Items', 'Key Items', 'Miscellaneous']
    const ITEM_CATEGORIES = {
      'pokeball': 'Poké Balls', 'greatball': 'Poké Balls', 'ultraball': 'Poké Balls',
      'masterball': 'Poké Balls', 'safariball': 'Poké Balls', 'netball': 'Poké Balls',
      'diveball': 'Poké Balls', 'nestball': 'Poké Balls', 'repeatball': 'Poké Balls',
      'timerball': 'Poké Balls', 'luxuryball': 'Poké Balls', 'premierball': 'Poké Balls',
      'potion': 'Medicine', 'superpotion': 'Medicine', 'hyperpotion': 'Medicine',
      'maxpotion': 'Medicine', 'fullrestore': 'Medicine', 'revive': 'Medicine',
      'maxrevive': 'Medicine', 'antidote': 'Medicine', 'awakening': 'Medicine',
      'burnheal': 'Medicine', 'iceheal': 'Medicine', 'fullheal': 'Medicine',
      'elixir': 'Medicine', 'maxelixir': 'Medicine', 'ether': 'Medicine', 'maxether': 'Medicine',
      'sitrusberry': 'Berries', 'oranberry': 'Berries', 'lumberry': 'Berries',
      'rawstberry': 'Berries', 'cheriberry': 'Berries', 'chestoberry': 'Berries',
      'pechaberry': 'Berries', 'aspearberry': 'Berries', 'leppaberry': 'Berries',
      'firestonex': 'Evolution Items', 'waterstone': 'Evolution Items', 'thunderstone': 'Evolution Items',
      'leafstone': 'Evolution Items', 'moonstone': 'Evolution Items', 'sunstone': 'Evolution Items',
      'dawnstone': 'Evolution Items', 'duskstone': 'Evolution Items', 'shinystone': 'Evolution Items',
      'firestone': 'Evolution Items', 'icerock': 'Evolution Items', 'kingsrock': 'Held Items',
      'metalcoat': 'Held Items', 'upgrade': 'Held Items', 'deepseatooth': 'Held Items',
      'deepseascale': 'Held Items', 'dragonscale': 'Held Items', 'prismscale': 'Held Items',
      'boostx': 'Medicine', 'boost': 'Medicine',
    }

    // Filter items with qty > 0
    const allItems = Object.entries(inventory).filter(([, qty]) => qty > 0)

    if (!allItems.length) {
      return reply(`🎒 Your Pokémon Bag is empty.`)
    }

    // Sort by category then alphabetically
    const categorised = {}
    for (const [key, qty] of allItems) {
      const normKey = key.toLowerCase().replace(/[-_\s]/g, '')
      const cat = ITEM_CATEGORIES[normKey] || 'Miscellaneous'
      if (!categorised[cat]) categorised[cat] = []
      const shopItem = SHOP_ITEMS[key] || SHOP_ITEMS[normKey]
      const emoji    = shopItem?.emoji || '📦'
      const name     = shopItem?.name  || capName(key.replace(/[-_]/g, ' '))
      categorised[cat].push({ emoji, name, qty })
    }

    // Build sorted flat list
    const sortedItems = []
    for (const cat of CATEGORY_ORDER) {
      if (!categorised[cat]) continue
      categorised[cat].sort((a, b) => a.name.localeCompare(b.name))
      for (const item of categorised[cat]) sortedItems.push(item)
    }

    // Pagination — 20 items per page
    const PAGE_SIZE = 20
    const page      = Math.max(1, parseInt(args[0]) || 1)
    const totalPages = Math.ceil(sortedItems.length / PAGE_SIZE)
    const pageItems  = sortedItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    const lines = pageItems.map((item, i) =>
      `*${(page - 1) * PAGE_SIZE + i + 1}. ${item.emoji} ${item.name}* - \`${item.qty}\``
    ).join('\n')

    const pageNote = totalPages > 1 ? `\n\nPage ${page}/${totalPages} — Use \`.bag ${page + 1}\` for next` : ''

    await reply(
      `🎒 @${username}'s *Pokémon Bag* 📦\n\n` +
      `${lines}` +
      `${pageNote}`
    )
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
  async use(ctx) {
    const { reply, args, sender } = ctx
    const key  = args[0]?.toLowerCase()
    if (!key) return reply(`❗ Usage: \`.use <item> [slot]\`\n\nExample: \`.use firestone 1\``)
    const item = SHOP_ITEMS[key]
    if (!item) return reply(`📭 Item not found. Check \`.mart\``)

    // ── Evolution stone — route straight to evolve ─────────────
    if (item.type === 'evolution') {
      const slot = parseInt(args[1]) || 1
      // Check player actually has it
      let inv = {}
      try { inv = await db.getInventory(sender) || {} } catch {}
      if ((inv[key] || 0) < 1) {
        return reply(`❗ You don't have a ${item.emoji} *${item.name}* in your bag!\n\n💡 Buy one from \`.mart\``)
      }
      // Delegate to evolve with the same context + slot arg
      const fakeCtx = { ...ctx, args: [String(slot)] }
      return module.exports.evolve(fakeCtx)
    }

    // ── Heal item ───────────────────────────────────────────────
    if (item.type === 'heal') {
      let inv = {}
      try { inv = await db.getInventory(sender) || {} } catch {}
      if ((inv[key] || 0) < 1) return reply(`❗ You don't have ${item.emoji} *${item.name}* in your bag!`)
      try { await db.addItem(sender, key, -1) } catch {}
      try {
        const pokemon = await db.getUserPokemon(sender).catch(() => [])
        const party   = (pokemon || []).filter(p => p.in_party)
        for (const p of party) {
          const maxHp = (p.hp || 45) + (p.level || 1) * 5
          await db.updatePokemon(p._id, { current_hp: maxHp, fainted: false }).catch(() => {})
        }
      } catch {}
      return reply(`✨ *Item Used!*\n\n${item.emoji} *${item.name}* activated!\n💚 Your team has been healed!`)
    }

    // ── Boost item ──────────────────────────────────────────────
    if (item.type === 'boost') {
      let inv = {}
      try { inv = await db.getInventory(sender) || {} } catch {}
      if ((inv[key] || 0) < 1) return reply(`❗ You don't have ${item.emoji} *${item.name}* in your bag!`)
      try { await db.addItem(sender, key, -1) } catch {}
      return reply(`✨ *Item Used!*\n\n${item.emoji} *${item.name}* activated!\n⚡ Battle stats boosted for the next fight!`)
    }

    return reply(`✨ *Item Used!*\n\n${item.emoji} *${item.name}* activated!\n✅ Effect applied!`)
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
    // ── Gym battle handling ─────────────────────────────────────
    const gymState = pendingGymBattle[sender]
    if (gymState) {
      const moveIdx = Math.max(0, (parseInt(args[0]) || 1) - 1)
      const myMoves = gymState.moves
      const moveName = myMoves[Math.min(moveIdx, myMoves.length - 1)] || 'Tackle'
      const gym = gymState.gym

      const myLvl   = gymState.myPokemon.level || 1
      const baseDmg = 18 + myLvl * 2
      const crit    = Math.random() < 0.10
      const myDmg   = Math.round((baseDmg + Math.floor(Math.random() * 15)) * (crit ? 1.5 : 1))

      const gymBaseDmg = 15 + (gymState.gymPokemon.level || 10) * 2
      const gymDmg     = Math.round(gymBaseDmg + Math.floor(Math.random() * 12))

      gymState.gymHp = Math.max(0, gymState.gymHp - myDmg)
      gymState.myHp  = Math.max(0, gymState.myHp  - gymDmg)

      // ── Gym Pokémon fainted ────────────────────────────
      if (gymState.gymHp <= 0) {
        gymState.gymPokeIdx++
        if (gymState.gymPokeIdx >= gym.leaderPokemon.length) {
          // ── All gym Pokémon defeated — WIN ─────────────
          delete pendingGymBattle[sender]
          const u = user || await db.getOrCreateUser(sender).catch(() => ({}))
          await db.updateUser(sender, {
            pokemon_badges: (u.pokemon_badges || 0) + 1,
            xp:     (u.xp || 0) + gym.xp,
            wallet: (u.wallet || 0) + gym.coins,
          }).catch(() => {})
          const newBadges = (u.pokemon_badges || 0) + 1
          const BADGE_NUMS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣']
          const progress = BADGE_NUMS.slice(0, 8).map((n, i) => i < newBadges ? `${n}✅` : n).join('  ')
          return reply(
            `🏆 *Victory!*\n\n` +
            `${gym.leader} was defeated!\n\n` +
            `🏅 *${gym.badge}* earned!\n` +
            `💰 +${gym.coins.toLocaleString()} PokéCoins\n` +
            `✨ +${gym.xp} XP\n\n` +
            `Badges: ${progress}\n\n` +
            (newBadges < 8
              ? `💡 Use \`.gym\` to view your next Gym.`
              : `🌟 All 8 badges! You're a Pokémon Champion!`)
          )
        }
        // ── Next gym Pokémon ───────────────────────────────
        const nextGymPoke = gym.leaderPokemon[gymState.gymPokeIdx]
        const nextMaxHp   = (nextGymPoke.level || 10) * 8 + 30
        gymState.gymPokemon = nextGymPoke
        gymState.gymHp      = nextMaxHp
        gymState.gymMaxHp   = nextMaxHp
        return reply(
          `💥 ${gym.leader}: \"${gymState.myPokemon.name} scored a direct hit!\"\n\n` +
          `${gym.leader} sent out *${nextGymPoke.name}* Lv.${nextGymPoke.level}!\n\n` +
          `HP: ${gymState.myHp}/${gymState.myMaxHp} (yours)\n\n` +
          `💡 Use \`.move <1-${myMoves.length}>\` to continue!`
        )
      }

      // ── My Pokémon fainted ─────────────────────────────
      if (gymState.myHp <= 0) {
        delete pendingGymBattle[sender]
        return reply(
          `💔 *Defeat!*\n\n` +
          `${gymState.myPokemon.name} fainted!\n\n` +
          `${gym.leader}: \"You have talent, young trainer. Come back stronger!\"\n\n` +
          `💡 Heal with \`.heal\` and try \`.challenge\` again.`
        )
      }

      // ── Battle continues ───────────────────────────────
      const myHpBar  = '█'.repeat(Math.ceil(gymState.myHp / gymState.myMaxHp * 10)) + '░'.repeat(10 - Math.ceil(gymState.myHp / gymState.myMaxHp * 10))
      const gymHpBar = '█'.repeat(Math.ceil(gymState.gymHp / gymState.gymMaxHp * 10)) + '░'.repeat(10 - Math.ceil(gymState.gymHp / gymState.gymMaxHp * 10))
      return reply(
        `⚔️ *Gym Battle — ${gym.leader}*\n\n` +
        `${gym.typeEmoji} ${gymState.gymPokemon.name} Lv.${gymState.gymPokemon.level}\n` +
        `HP [${gymHpBar}] ${gymState.gymHp}/${gymState.gymMaxHp}\n\n` +
        `⭐ ${gymState.myPokemon.name} Lv.${myLvl}\n` +
        `HP [${myHpBar}] ${gymState.myHp}/${gymState.myMaxHp}\n\n` +
        `${gymState.myPokemon.name} used *${moveName}*! -${myDmg} HP${crit ? ' ✨Crit!' : ''}\n` +
        `${gymState.gymPokemon.name} used attack! -${gymDmg} HP\n\n` +
        `💡 Use \`.move <1-${myMoves.length}>\` to continue!\n` +
        myMoves.map((m, i) => `${i + 1}. ${m}`).join('  ')
      )
    }

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

  // ── .seedpokemon — staff command to fetch real moves/stats from PokéAPI ──
  async seedpokemon({ reply, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('❗ Staff only.')
    const nameOrId = (args[0] || '').toLowerCase().trim()
    if (!nameOrId) return reply('⚠️ Usage: *.seedpokemon <name or id>*\n\nExample: .seedpokemon pikachu')
    await reply(`⏳ Fetching *${nameOrId}* from PokéAPI...`)
    const poke = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${nameOrId}`)
    if (!poke) return reply(`❗ *"${nameOrId}"* not found on PokéAPI.\n\nCheck the spelling and try again.`)
    const getStat = (n) => (poke.stats || []).find(s => s?.stat?.name === n)?.base_stat || 0
    // Real level-up moves sorted by level
    const levelMoves = (poke.moves || [])
      .filter(m => m.version_group_details?.some(v => v.move_learn_method?.name === 'level-up' && v.level_learned_at > 0))
      .sort((a, b) => {
        const la = Math.min(...a.version_group_details.filter(v => v.move_learn_method?.name === 'level-up').map(v => v.level_learned_at))
        const lb = Math.min(...b.version_group_details.filter(v => v.move_learn_method?.name === 'level-up').map(v => v.level_learned_at))
        return la - lb
      })
      .map(m => capName(m.move.name))
    const entry = {
      id:         poke.id,
      name:       capName(poke.name),
      types:      (poke.types || []).map(t => capName(t.type.name)),
      hp:         getStat('hp'),         attack:  getStat('attack'),
      defense:    getStat('defense'),    sp_atk:  getStat('special-attack'),
      sp_def:     getStat('special-defense'), speed: getStat('speed'),
      moves:      levelMoves.slice(0, 4),
      all_moves:  levelMoves,
      abilities:  (poke.abilities || []).map(a => capName(a.ability.name)),
      base_xp:    poke.base_experience || 50,
      imageUrl:   poke.sprites?.other?.['official-artwork']?.front_default || poke.sprites?.front_default || null,
    }
    // Persist to local dex JSON
    const DEX_FILE = path.join(__dirname, '../pokemon_dex.json')
    let dex = {}
    try { dex = JSON.parse(fs.readFileSync(DEX_FILE, 'utf8')) } catch {}
    dex[entry.name.toLowerCase()] = entry
    dex[String(entry.id)] = entry
    try { fs.writeFileSync(DEX_FILE, JSON.stringify(dex, null, 2)) } catch (e) { return reply(`❗ Failed to save: ${e.message}`) }
    const moveList = entry.moves.length
      ? entry.moves.map((m, i) => `├ ${m}`).join('\n').replace(/├ ([^\n]*)$/, '└ $1')
      : '└ None'
    return reply(
      `✅ *${entry.name}* seeded to PokéDex!\n\n` +
      `📜 *POKÉMON INFO*\n` +
      `├ *ID:* #${entry.id}\n` +
      `├ *Type:* ${entry.types.join(' / ')}\n` +
      `└ *Abilities:* ${entry.abilities.join(', ')}\n\n` +
      `📊 *STATS*\n` +
      `├ HP: ${entry.hp}  ATK: ${entry.attack}  DEF: ${entry.defense}\n` +
      `└ SP.ATK: ${entry.sp_atk}  SP.DEF: ${entry.sp_def}  SPD: ${entry.speed}\n\n` +
      `✨ *REAL MOVES* (${levelMoves.length} total, first 4 shown)\n` +
      `${moveList}\n\n` +
      `_Pokémon will now spawn with real moves when caught._`
    )
  },
}

// ── Pokémon cry text map ──────────────────────────────────────────
function getPokeCry(pokeName) {
  const name = (pokeName || '').toLowerCase().replace(/[^a-z]/g, '')
  const CRIES = {
    pikachu:'Pika... Pikaaaa ⚡', raichu:'Raichu!! ⚡', bulbasaur:'Bulba... Bulbasauuur 🌿',
    ivysaur:'Ivyyy~saur 🌿', venusaur:'VENUSAUR!! 🌿', charmander:'Char... Charmander 🔥',
    charmeleon:'Charmeleon!! 🔥', charizard:'CHAAAAR— ZAAARD 🔥',
    squirtle:'Squirtle squirtle~ 💧', wartortle:'Wartor~tle! 💧', blastoise:'BLASTOISE!! 💧',
    caterpie:'Cater~pie! 🐛', metapod:'...Metapod 🐛', butterfree:'Butter~FREE! 🦋',
    pidgey:'Pidgey pid~ 🐦', pidgeot:'PIDGEOT!! 🐦', rattata:'Ratta~ta! 🐭',
    jigglypuff:'Jigglyyy~puff ♪', meowth:'Meooowth~ 🪙', psyduck:'Psy~duck... 🦆',
    gengar:'Geeeen~ gar~ 👻', machamp:'MACHAMP!! 💪', geodude:'Geoooo~dude 🪨',
    graveler:'Gravel~er!! 🪨', golem:'GOLEM!! 🪨', slowpoke:'...slow... poke... 💤',
    magnemite:'Magne~mite ⚡', haunter:'Haunt~er... 👻', alakazam:'ALAKAZAM!! 🥄',
    machoke:'Machoooke! 💪', rapidash:'Rapid~ash!! 🔥', slowbro:'...Slow~bro ♥',
    snorlax:'*yawn*... Snooor... lax... 💤', lapras:'Laapras~ 🌊', eevee:'Vee~! Eeevee! 🌟',
    vaporeon:'Vapo~reon 💧', jolteon:'Jolteeeeon ⚡', flareon:'FLAREON!! 🔥',
    porygon:'...Pory~gon 💾', omanyte:'Omany~te 🌊', omastar:'OMASTAR!! 🌊',
    mewtwo:'...👁️ *the air grows cold*', mew:'Mew~ 🎀',
    chikorita:'Chiko~ ritaaaa 🍃', bayleef:'Bayleef! 🍃', meganium:'MEGANIUM!! 🌸',
    cyndaquil:'Quil~! Cyndaquiiil 🔥', quilava:'Quila~va!! 🔥', typhlosion:'TYPHLOSION!! 🔥',
    totodile:'Toto~! Diiiiile 💧', croconaw:'Croco~naw!! 💧', feraligatr:'FERALIGATR!! 💧',
    pichu:'Pi~! Pichu 🐭', cleffa:'Clef~fa~ ✨', igglybuff:'Iggly~buff ♪',
    togepi:'Toge~pi! ✨', togetic:'Togetic!! ✨', ampharos:'AMPHA~ROS!! ⚡',
    umbreon:'Umb~... Umbreon 🌑', espeon:'Espe~on 🌙', sylveon:'Vee~! Sylveeon 🎀',
    leafeon:'Leafeeon 🍃', glaceon:'Glace~on ❄️', flareon2:'FLAREON!!',
    scizor:'SCIZOR!! ✂️', heracross:'Hera~cross!! 🦅', sneasel:'Snea~sel 🌑',
    tyranitar:'TYRANITAR!! 🏔️', lugia:'Luuu~gia... 🕊️', hooh:'HO~OH!! 🔥',
    celebi:'Celebi~ ✨', treecko:'Treee~ cko 🌿', grovyle:'Grovyle! 🌿', sceptile:'SCEPTILE!! 🌿',
    torchic:'Tor~chic! 🔥', combusken:'Combus~ken! 🔥', blaziken:'BLAZIKEN!! 🔥',
    mudkip:'Muuud~kip 💧', marshtomp:'Marsh~tomp! 💧', swampert:'SWAMPERT!! 💧',
    ralts:'Ralts~ 💫', kirlia:'Kir~lia 💫', gardevoir:'Garde~voir 💫',
    shroomish:'Shrooo~mish 🍄', breloom:'BRELOOM!! 🍄', slakoth:'...slaaak... oth 💤',
    slaking:'SLAKING!! 💪', nincada:'Ninca~da 🐛', ninjask:'NINJASK!! 🐛',
    shedinja:'...she~din~ja... 👁️', meditite:'Medi~tite 🧘', medicham:'MEDICHAM!! 🧘',
    electrike:'Electri~ke ⚡', manectric:'MANECTRIC!! ⚡', plusle:'Plu~sle! ⚡', minun:'Mi~nun! ⚡',
    roselia:'Rose~lia 🌹', wailord:'WAAAILORD!!! 🐋', numel:'Nu~mel 🔥', camerupt:'CAMERUPT!! 🔥',
    torkoal:'Torkoal... 🔥', trapinch:'Trap~inch 🏜️', vibrava:'Vibra~va 🐉', flygon:'FLYGON!! 🐉',
    cacnea:'Cac~nea 🌵', zangoose:'Zan~goose!! ⚔️', seviper:'Seeeeviper 🐍',
    lunatone:'Luuuna~tone 🌙', solrock:'SOL~ROCK!! ☀️', baltoy:'Bal~toy 🌀', claydol:'CLAYDOL!! 🌀',
    salamence:'SALAAAAMENCE!! 🐉', bagon:'Ba~gon 🐉', shelgon:'Shel~gon 🐉',
    beldum:'...bel~dum 🤖', metang:'Me~tang 🤖', metagross:'... METAGROSS. 🤖',
    regirock:'REG~I~ROCK 🪨', regice:'REG~I~ICE ❄️', registeel:'REG~I~STEEL 🤖',
    latias:'Lati~as! 💫', latios:'LATIOS!! 💫', kyogre:'KYOOOOOGRE!! 🌊',
    groudon:'GROUNDOOOON!! 🔥', rayquaza:'RAAAAAAYQUAZA!!! 🌌', jirachi:'Jirachi~ 🌟',
    deoxys:'Deox~ys... 👾', lucario:'Lu~cario! 🔵', riolu:'Ri~olu~ 🔵',
    garchomp:'CHOOOMP!! 💢', gible:'Gib~le 🐊', gabite:'Gab~ite 🐊',
    dialga:'DIAAAALGA!! ⏰', palkia:'PALKIAAAA!! 🌀', giratina:'...giratina... 👻',
    darkrai:'Dark~raiiii 🌑', arceus:'...👁️ *the god pokémon stares back at you*',
    zoroark:'ZOROARK!! 🎭', zorua:'Zo~rua~ 🎭', oshawott:'Osha~wott! 💧',
    snivy:'Sniiiivy 🌿', tepig:'Te~pig! 🔥', reshiram:'RESHIIIIRAM!! 🔥',
    zekrom:'ZEKROOOM!! ⚡', kyurem:'Kyuuu~rem ❄️', greninja:'Gren~ja! 💦',
    froakie:'Fro~a~kie 💧', frogadier:'Froga~dier! 💧', chespin:'Ches~pin 🌿',
    fennekin:'Fenne~kin! 🔥', braixen:'Braix~en! 🔥', delphox:'DELPHOX!! 🔥',
    sylveon2:'Vee!', togekiss:'Toge~kiss!! ✨', noivern:'NOIVEEERN!! 🎵',
    xerneas:'Xerneas~ ✨', yveltal:'YVEEELTAL!! 💀', zygarde:'Zyg~arde 🐍',
    decidueye:'Deci~dueye! 🏹', incineroar:'INCINEROAR!! 🔥', primarina:'Prima~rina~ 🌊',
    mimikyu:'...mimi~kyu... 👻', kommo_o:'KOM~MO~O!! 🐉', necrozma:'NECROZMA!! 🌟',
    zacian:'ZACIAN!! ⚔️', zamazenta:'ZAMAZENTA!! 🛡️', eternatus:'ETERNATUS!! 💀',
  }
  const key = name.replace(/-/g, '_')
  if (CRIES[key]) return CRIES[key]
  if (CRIES[name]) return CRIES[name]
  // Generic fallback: stutter first half then full name caps
  const half = pokeName.slice(0, Math.ceil(pokeName.length / 2))
  return `${half}~... ${pokeName.toUpperCase()}!! 🔥`
}

// ── Natural language battle: "Pikachu use thunderbolt!" ──────────
async function handleNaturalLanguageBattle(sock, jid, msg, sender, textRaw, senderJid) {
  const pvp  = pvpBattles[sender]
  const wild = activeBattles[sender]
  if (!pvp && !wild) return false
  if ((pvp || wild).jid !== jid) return false

  const text = textRaw.trim()
  const reply = (t) => sock.sendMessage(jid, { text: t }, { quoted: msg })

  // Pattern: "… use[s] <move name>[!?.]"
  const moveMatch = text.match(/\buse[s]?\s+([\w][\w\s'-]{0,30}?)(?:\s*[!?.,])*$/i)
  if (moveMatch) {
    const attempt = moveMatch[1].trim().toLowerCase()
    const isChallenger = pvp ? sender === pvp.challengerPhone : false
    const myPoke = pvp ? (isChallenger ? pvp.challengerPoke : pvp.opponentPoke) : wild?.myPokemon
    if (!myPoke) return false
    const moves = Array.isArray(myPoke.moves) && myPoke.moves.length ? myPoke.moves : ['Tackle']
    // Match move by name (exact, then partial)
    let idx = moves.findIndex(m => m.toLowerCase() === attempt)
    if (idx === -1) idx = moves.findIndex(m => m.toLowerCase().includes(attempt))
    if (idx === -1) idx = moves.findIndex(m => attempt.includes(m.toLowerCase().split(' ')[0]))
    if (idx === -1) return false
    // Send Pokémon cry, then execute move
    await sock.sendMessage(jid, { text: getPokeCry(myPoke.name) }, { quoted: msg })
    await module.exports.move({ sock, jid, msg, reply, sender, senderJid, user: null, args: [String(idx + 1)] })
    return true
  }

  // Pattern: just Pokémon name (cry response, no move executed)
  const nameTry = text.replace(/[!?.,~\s]+$/g, '').toLowerCase()
  if (nameTry.length >= 3 && nameTry.length <= 20 && !/\s{2,}/.test(nameTry)) {
    const isChallenger = pvp ? sender === pvp.challengerPhone : false
    const myPoke = pvp ? (isChallenger ? pvp.challengerPoke : pvp.opponentPoke) : wild?.myPokemon
    if (myPoke) {
      const pn = myPoke.name.toLowerCase()
      if (pn === nameTry || pn.startsWith(nameTry.slice(0, 4)) || nameTry.startsWith(pn.slice(0, 4))) {
        await sock.sendMessage(jid, { text: getPokeCry(myPoke.name) }, { quoted: msg })
        return true
      }
    }
  }
  return false
}

module.exports.handleNaturalLanguageBattle = handleNaturalLanguageBattle

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

// ── Party composite image — modern card design ───────────────────────────────
async function _buildPartyImage(party, trainerName) {
  let sharp
  try { sharp = require('sharp') } catch { return null }

  const TYPE_COLORS = {
    normal: '#9A9A7A', fire: '#E8601C', water: '#2A70E0', electric: '#E8C010',
    grass: '#3CAA28', ice: '#60C8C8', fighting: '#C03028', poison: '#8828A0',
    ground: '#D0A030', flying: '#8068E0', psychic: '#E82060', bug: '#78A010',
    rock: '#A88830', ghost: '#584878', dragon: '#4020D8', dark: '#504838',
    steel: '#9898B8', fairy: '#D85898',
  }
  const tc   = (t) => TYPE_COLORS[(t || 'normal').toLowerCase()] || '#2A70E0'
  const esc  = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const FONT = 'Arial, Helvetica, sans-serif'
  const trainer = esc((trainerName || 'TRAINER').toUpperCase().slice(0, 20))

  // ── Layout constants ──────────────────────────────────────────
  const HEADER_H = 76
  const CELL_W   = 530
  const CELL_H   = 270
  const W        = 2 * CELL_W          // 1060
  const H        = HEADER_H + 3 * CELL_H  // 886
  const SPR_SZ   = 168
  const SPR_PAD  = 10
  const TX       = SPR_PAD + SPR_SZ + 18  // where text block starts

  // ── Fetch PokéAPI base stats in parallel ──────────────────────
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

  // ── Build gradient defs for all 6 cards ──────────────────────
  let defs = `
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#06061a"/>
      <stop offset="100%" stop-color="#10102a"/>
    </linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0c0c20"/>
      <stop offset="100%" stop-color="#09091a"/>
    </linearGradient>`

  // Per-card gradients
  for (let i = 0; i < 6; i++) {
    const p      = party[i]
    const types  = p ? (Array.isArray(p.types) ? p.types : [p.types || 'normal']) : ['normal']
    const c1     = tc(types[0])
    const c2     = types[1] ? tc(types[1]) : c1
    defs += `
    <linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1" gradientUnits="userSpaceOnUse" x1="${(i%2)*CELL_W}" y1="${HEADER_H+Math.floor(i/2)*CELL_H}" x2="${(i%2)*CELL_W+CELL_W}" y2="${HEADER_H+Math.floor(i/2)*CELL_H+CELL_H}">
      <stop offset="0%" stop-color="${c1}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${c2}" stop-opacity="0.06"/>
    </linearGradient>`
  }

  // ── Build card cells ──────────────────────────────────────────
  let cellsSvg = ''
  for (let i = 0; i < 6; i++) {
    const col    = i % 2
    const row    = Math.floor(i / 2)
    const X      = col * CELL_W
    const Y      = HEADER_H + row * CELL_H
    const p      = party[i]
    const st     = apiStats[i]
    const slotTxt = `0${i + 1}`.slice(-2)

    if (p) {
      const types    = Array.isArray(p.types) ? p.types : [p.types || 'normal']
      const color1   = tc(types[0])
      const lvl      = p.level || 1
      const pName    = esc((p.name || '???').toUpperCase().slice(0, 13))
      const xp       = p.xp || 0
      const xpNeeded = Math.max(1, (lvl + 1) * (lvl + 1) * 50)
      const xpPct    = Math.min(1, xp / xpNeeded)
      const xpBarW   = Math.max(4, Math.round(xpPct * (CELL_W - 10)))

      // ── Stat bars ──
      const BAR_START = X + TX + 38
      const BAR_W     = CELL_W - TX - 56
      const statRows  = [
        ['HP',  st?.hp  ?? 45, 250, '#28D860'],
        ['ATK', st?.atk ?? 49, 190, '#F07020'],
        ['DEF', st?.def ?? 49, 250, '#3878F0'],
        ['SPD', st?.spd ?? 45, 200, '#E8C820'],
      ].map(([lbl, val, mx, clr], bi) => {
        const bY = Y + 120 + bi * 34
        const fw = Math.max(6, Math.round(val / mx * BAR_W))
        return `
          <text x="${X + TX}" y="${bY + 11}" fill="#8888b8" font-size="12" font-weight="700" font-family="${FONT}">${lbl}</text>
          <rect x="${BAR_START}" y="${bY}" width="${BAR_W}" height="13" rx="6" fill="#0e0e24"/>
          <rect x="${BAR_START}" y="${bY}" width="${fw}" height="13" rx="6" fill="${clr}" opacity="0.92"/>
          <text x="${BAR_START + BAR_W + 6}" y="${bY + 11}" fill="#6666a0" font-size="10" font-weight="700" font-family="${FONT}">${val}</text>`
      }).join('')

      // ── Type badges ──
      const typeBadges = types.slice(0, 2).map((t, ti) => {
        const bx = X + TX + ti * 94
        return `
          <rect x="${bx}" y="${Y + 78}" width="86" height="24" rx="12" fill="${tc(t)}"/>
          <text x="${bx + 43}" y="${Y + 95}" fill="white" font-size="12" font-weight="800" text-anchor="middle" font-family="${FONT}">${esc(t.toUpperCase())}</text>`
      }).join('')

      // ── Shiny badge ──
      const shinyBadge = p.shiny
        ? `<rect x="${X + TX}" y="${Y + 57}" width="70" height="18" rx="9" fill="#b8860b"/>
           <text x="${X + TX + 35}" y="${Y + 70}" fill="#FFD700" font-size="10" font-weight="800" text-anchor="middle" font-family="${FONT}">✦ SHINY</text>`
        : ''

      // ── HP bar at very bottom ──
      const hpCur  = p.current_hp ?? ((p.hp || 45) + lvl * 5)
      const hpMax  = (p.hp || 45) + lvl * 5
      const hpPct  = Math.min(1, Math.max(0, hpCur / hpMax))
      const hpW    = Math.max(4, Math.round(hpPct * (CELL_W - 10)))
      const hpClr  = hpPct > 0.5 ? '#28D860' : hpPct > 0.25 ? '#F0C820' : '#E82830'

      cellsSvg += `
        <rect x="${X}" y="${Y}" width="${CELL_W}" height="${CELL_H}" fill="#101022"/>
        <rect x="${X}" y="${Y}" width="${CELL_W}" height="${CELL_H}" fill="url(#g${i})"/>
        <rect x="${X}" y="${Y}" width="7" height="${CELL_H}" fill="${color1}"/>
        <rect x="${X}" y="${Y}" width="${CELL_W}" height="2" fill="${color1}" opacity="0.35"/>
        <rect x="${X}" y="${Y + CELL_H - 1}" width="${CELL_W}" height="1" fill="#1c1c32"/>
        <text x="${X + 12}" y="${Y + 22}" fill="${color1}" font-size="13" font-weight="700" font-family="${FONT}" opacity="0.65">${slotTxt}</text>
        <text x="${X + TX}" y="${Y + 52}" fill="white" font-size="26" font-weight="900" font-family="${FONT}" letter-spacing="1">${pName}</text>
        ${shinyBadge}
        ${typeBadges}
        ${statRows}
        <rect x="${X + 5}" y="${Y + CELL_H - 14}" width="${CELL_W - 10}" height="9" rx="4" fill="#0a0a1e"/>
        <rect x="${X + 5}" y="${Y + CELL_H - 14}" width="${xpBarW}" height="9" rx="4" fill="#6060e8" opacity="0.75"/>
        <text x="${X + 10}" y="${Y + CELL_H - 5}" fill="#4040a0" font-size="8" font-weight="700" font-family="${FONT}">XP</text>
        <rect x="${X + CELL_W - 64}" y="${Y + 10}" width="56" height="26" rx="13" fill="#090920" stroke="${color1}" stroke-width="1.5" stroke-opacity="0.7"/>
        <text x="${X + CELL_W - 36}" y="${Y + 28}" fill="${color1}" font-size="14" font-weight="900" text-anchor="middle" font-family="${FONT}">Lv${lvl}</text>`
    } else {
      cellsSvg += `
        <rect x="${X}" y="${Y}" width="${CELL_W}" height="${CELL_H}" fill="#0b0b1c"/>
        <rect x="${X}" y="${Y + CELL_H - 1}" width="${CELL_W}" height="1" fill="#181830"/>
        <rect x="${X + 18}" y="${Y + 18}" width="${CELL_W - 36}" height="${CELL_H - 36}" rx="8" fill="none" stroke="#1c1c34" stroke-width="1.5" stroke-dasharray="10,5"/>
        <text x="${X + CELL_W / 2}" y="${Y + CELL_H / 2 - 6}" fill="#222238" font-size="36" font-weight="700" text-anchor="middle" font-family="${FONT}">○</text>
        <text x="${X + CELL_W / 2}" y="${Y + CELL_H / 2 + 22}" fill="#22223a" font-size="13" font-weight="700" text-anchor="middle" font-family="${FONT}">EMPTY SLOT</text>`
    }
  }

  // ── Full SVG ──────────────────────────────────────────────────
  const bgSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>${defs}
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect width="${W}" height="${HEADER_H}" fill="url(#hdr)"/>
    <rect width="${W}" height="5" fill="#00C8FF"/>
    <rect y="${HEADER_H - 1}" width="${W}" height="1" fill="#181830"/>
    <text x="22" y="48" fill="white" font-size="32" font-weight="900" font-family="${FONT}" letter-spacing="2">KONO</text>
    <text x="122" y="48" fill="#00C8FF" font-size="32" font-weight="900" font-family="${FONT}" letter-spacing="2">SUBA</text>
    <rect x="250" y="26" width="2" height="28" rx="1" fill="#00C8FF" opacity="0.35"/>
    <text x="264" y="47" fill="#55668a" font-size="14" font-weight="700" font-family="${FONT}" letter-spacing="1">PARTY OVERVIEW</text>
    <text x="${W - 18}" y="48" fill="#404060" font-size="13" font-weight="600" font-family="${FONT}" text-anchor="end">TRAINER  ${trainer}</text>
    <rect x="${CELL_W}" y="${HEADER_H}" width="2" height="${H - HEADER_H}" fill="#181830"/>
    ${cellsSvg}
  </svg>`

  let base
  try { base = await sharp(Buffer.from(bgSvg)).png().toBuffer() } catch { return null }

  // ── Composite Pokémon sprites ─────────────────────────────────
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
      const left = col * CELL_W + SPR_PAD + 7
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
