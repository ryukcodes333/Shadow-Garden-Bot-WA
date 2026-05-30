const db = require('../database')
const fs = require('fs')
const path = require('path')
const https = require('https')
const http  = require('http')

// ── In-memory state ───────────────────────────────────────────────
const pendingPokemon   = {}   // jid → { ...pokemonData, spawnedAt, weakened }
const activeBattles    = {}   // sender → battle session
const pvpChallenges    = {}   // challengerSender → { targetSender, jid, expiresAt }

// ── Constants ─────────────────────────────────────────────────────
const CATCH_WINDOW_MS  = 90 * 1000
const HUNT_SUCCESS_PCT = 0.05   // 5% chance

// Baby/starter/common pokemon get higher spawn weight at low levels
const BABY_POKEMON_IDS = [
  172, 173, 174, 175, 238, 239, 240, 298, 360, 406, 433, 438, 439, 440, 446, 447, 458,
  // Regular starters and commons
  1, 4, 7, 25, 35, 39, 52, 54, 56, 58, 60, 63, 66, 69, 74, 77, 79, 81, 84, 86, 88, 90,
  92, 96, 98, 100, 102, 104, 109, 111, 113, 114, 116, 118, 120, 123, 127, 128,
]

const WILD_POKEMON_POOL = [
  // id, name, type, base_hp, base_atk, moves, evolves_at_level (0 = no evolve)
  { id:1,   name:'Bulbasaur',   type:'Grass/Poison', hp:45, atk:49, moves:['Tackle','Vine Whip','Leech Seed','Razor Leaf'],               evolvesAt:16, evolvesTo:2   },
  { id:2,   name:'Ivysaur',     type:'Grass/Poison', hp:60, atk:62, moves:['Vine Whip','Razor Leaf','Sleep Powder','Solar Beam'],         evolvesAt:32, evolvesTo:3   },
  { id:3,   name:'Venusaur',    type:'Grass/Poison', hp:80, atk:82, moves:['Solar Beam','Petal Dance','Earthquake','Sludge Bomb'],        evolvesAt:0,  evolvesTo:null },
  { id:4,   name:'Charmander',  type:'Fire',         hp:39, atk:52, moves:['Scratch','Ember','Growl','Metal Claw'],                       evolvesAt:16, evolvesTo:5   },
  { id:5,   name:'Charmeleon',  type:'Fire',         hp:58, atk:64, moves:['Ember','Fire Fang','Slash','Flamethrower'],                   evolvesAt:36, evolvesTo:6   },
  { id:6,   name:'Charizard',   type:'Fire/Flying',  hp:78, atk:84, moves:['Flamethrower','Fire Blast','Fly','Dragon Rage'],             evolvesAt:0,  evolvesTo:null },
  { id:7,   name:'Squirtle',    type:'Water',        hp:44, atk:48, moves:['Tackle','Water Gun','Withdraw','Bubble'],                     evolvesAt:16, evolvesTo:8   },
  { id:8,   name:'Wartortle',   type:'Water',        hp:59, atk:63, moves:['Water Gun','Bite','Rapid Spin','Surf'],                      evolvesAt:36, evolvesTo:9   },
  { id:9,   name:'Blastoise',   type:'Water',        hp:79, atk:83, moves:['Surf','Hydro Pump','Ice Beam','Flash Cannon'],               evolvesAt:0,  evolvesTo:null },
  { id:25,  name:'Pikachu',     type:'Electric',     hp:35, atk:55, moves:['Thundershock','Quick Attack','Tail Whip','Thunder Wave'],    evolvesAt:0,  evolvesTo:26, stoneEvolve:'Thunder Stone' },
  { id:26,  name:'Raichu',      type:'Electric',     hp:60, atk:90, moves:['Thunderbolt','Thunder','Quick Attack','Iron Tail'],          evolvesAt:0,  evolvesTo:null },
  { id:39,  name:'Jigglypuff',  type:'Normal/Fairy', hp:115,atk:45, moves:['Sing','Doubleslap','Rest','Body Slam'],                     evolvesAt:0,  evolvesTo:40, stoneEvolve:'Moon Stone' },
  { id:52,  name:'Meowth',      type:'Normal',       hp:40, atk:45, moves:['Scratch','Bite','Pay Day','Slash'],                         evolvesAt:28, evolvesTo:53  },
  { id:54,  name:'Psyduck',     type:'Water',        hp:50, atk:52, moves:['Scratch','Water Gun','Confusion','Disable'],                evolvesAt:33, evolvesTo:55  },
  { id:58,  name:'Growlithe',   type:'Fire',         hp:55, atk:70, moves:['Bite','Ember','Roar','Flame Wheel'],                        evolvesAt:0,  evolvesTo:59, stoneEvolve:'Fire Stone' },
  { id:63,  name:'Abra',        type:'Psychic',      hp:25, atk:20, moves:['Teleport','Confusion'],                                     evolvesAt:16, evolvesTo:64  },
  { id:64,  name:'Kadabra',     type:'Psychic',      hp:40, atk:35, moves:['Confusion','Psybeam','Recover','Psychic'],                  evolvesAt:36, evolvesTo:65  },
  { id:65,  name:'Alakazam',    type:'Psychic',      hp:55, atk:50, moves:['Psychic','Recover','Reflect','Future Sight'],              evolvesAt:0,  evolvesTo:null },
  { id:74,  name:'Geodude',     type:'Rock/Ground',  hp:40, atk:80, moves:['Tackle','Rock Throw','Defense Curl','Magnitude'],          evolvesAt:25, evolvesTo:75  },
  { id:79,  name:'Slowpoke',    type:'Water/Psychic',hp:90, atk:65, moves:['Confusion','Water Gun','Yawn','Amnesia'],                  evolvesAt:37, evolvesTo:80  },
  { id:92,  name:'Gastly',      type:'Ghost/Poison', hp:30, atk:35, moves:['Lick','Night Shade','Hypnosis','Mean Look'],               evolvesAt:25, evolvesTo:93  },
  { id:93,  name:'Haunter',     type:'Ghost/Poison', hp:45, atk:50, moves:['Shadow Ball','Hypnosis','Dream Eater','Night Shade'],      evolvesAt:36, evolvesTo:94  },
  { id:94,  name:'Gengar',      type:'Ghost/Poison', hp:60, atk:65, moves:['Shadow Ball','Sludge Bomb','Thunderbolt','Hypnosis'],      evolvesAt:0,  evolvesTo:null },
  { id:113, name:'Chansey',     type:'Normal',       hp:250,atk:5,  moves:['Softboiled','Egg Bomb','Minimize','Double Slap'],          evolvesAt:0,  evolvesTo:242  },
  { id:116, name:'Horsea',      type:'Water',        hp:30, atk:40, moves:['Bubble','Water Gun','Smokescreen','Agility'],             evolvesAt:32, evolvesTo:117  },
  { id:129, name:'Magikarp',    type:'Water',        hp:20, atk:10, moves:['Splash','Tackle'],                                        evolvesAt:20, evolvesTo:130  },
  { id:130, name:'Gyarados',    type:'Water/Flying', hp:95, atk:125,moves:['Surf','Ice Beam','Hyper Beam','Thrash'],                  evolvesAt:0,  evolvesTo:null },
  { id:133, name:'Eevee',       type:'Normal',       hp:55, atk:55, moves:['Tackle','Sand Attack','Tail Whip','Quick Attack'],        evolvesAt:0,  evolvesTo:134, stoneEvolve:'Fire Stone' },
  { id:143, name:'Snorlax',     type:'Normal',       hp:160,atk:110,moves:['Body Slam','Rest','Hyper Beam','Yawn'],                   evolvesAt:0,  evolvesTo:null },
  { id:147, name:'Dratini',     type:'Dragon',       hp:41, atk:64, moves:['Wrap','Leer','Thunder Wave','Dragon Rage'],              evolvesAt:30, evolvesTo:148  },
  { id:148, name:'Dragonair',   type:'Dragon',       hp:61, atk:84, moves:['Slam','Dragon Rage','Agility','Hyper Beam'],             evolvesAt:55, evolvesTo:149  },
  { id:149, name:'Dragonite',   type:'Dragon/Flying',hp:91, atk:134,moves:['Dragon Claw','Hyper Beam','Thunder','Fire Punch'],        evolvesAt:0,  evolvesTo:null },
  { id:172, name:'Pichu',       type:'Electric',     hp:20, atk:35, moves:['Thundershock','Charm','Tail Whip','Sweet Kiss'],         evolvesAt:0,  evolvesTo:25, friendEvolve:true },
  { id:174, name:'Igglybuff',   type:'Normal/Fairy', hp:90, atk:30, moves:['Sing','Charm','Pound','Sweet Kiss'],                    evolvesAt:0,  evolvesTo:39, friendEvolve:true },
  { id:175, name:'Togepi',      type:'Fairy',        hp:35, atk:20, moves:['Growl','Charm','Metronome','Sweet Kiss'],               evolvesAt:0,  evolvesTo:176, friendEvolve:true },
  { id:179, name:'Mareep',      type:'Electric',     hp:55, atk:40, moves:['Thundershock','Cotton Spore','Thunder Wave','Signal Beam'],evolvesAt:15,evolvesTo:180  },
  { id:193, name:'Yanma',       type:'Bug/Flying',   hp:65, atk:65, moves:['Wing Attack','Quick Attack','Ancient Power','Air Slash'],evolvesAt:0,  evolvesTo:469  },
  { id:197, name:'Umbreon',     type:'Dark',         hp:95, atk:65, moves:['Moonlight','Dark Pulse','Bite','Quick Attack'],          evolvesAt:0,  evolvesTo:null },
  { id:228, name:'Houndour',    type:'Dark/Fire',    hp:45, atk:60, moves:['Ember','Bite','Howl','Flamethrower'],                   evolvesAt:24, evolvesTo:229  },
  { id:229, name:'Houndoom',    type:'Dark/Fire',    hp:75, atk:90, moves:['Flamethrower','Crunch','Dark Pulse','Fire Blast'],      evolvesAt:0,  evolvesTo:null },
  { id:246, name:'Larvitar',    type:'Rock/Ground',  hp:50, atk:64, moves:['Bite','Sandstorm','Rock Slide','Earthquake'],           evolvesAt:30, evolvesTo:247  },
  { id:247, name:'Pupitar',     type:'Rock/Ground',  hp:70, atk:84, moves:['Rock Slide','Crunch','Earthquake','Hyper Beam'],        evolvesAt:55, evolvesTo:248  },
  { id:248, name:'Tyranitar',   type:'Rock/Dark',    hp:100,atk:134,moves:['Crunch','Stone Edge','Earthquake','Dragon Dance'],      evolvesAt:0,  evolvesTo:null },
  { id:252, name:'Treecko',     type:'Grass',        hp:40, atk:45, moves:['Pound','Absorb','Quick Attack','Leaf Blade'],           evolvesAt:16, evolvesTo:253  },
  { id:255, name:'Torchic',     type:'Fire',         hp:45, atk:60, moves:['Scratch','Ember','Growl','Flame Charge'],               evolvesAt:16, evolvesTo:256  },
  { id:258, name:'Mudkip',      type:'Water',        hp:50, atk:70, moves:['Tackle','Water Gun','Mud-Slap','Muddy Water'],          evolvesAt:16, evolvesTo:259  },
  { id:280, name:'Ralts',       type:'Psychic/Fairy',hp:28, atk:25, moves:['Growl','Confusion','Double Team','Calm Mind'],          evolvesAt:20, evolvesTo:281  },
  { id:304, name:'Aron',        type:'Steel/Rock',   hp:50, atk:70, moves:['Tackle','Iron Defense','Metal Claw','Iron Head'],       evolvesAt:32, evolvesTo:305  },
  { id:333, name:'Swablu',      type:'Normal/Flying',hp:45, atk:40, moves:['Peck','Growl','Astonish','Sing'],                       evolvesAt:35, evolvesTo:334  },
  { id:371, name:'Bagon',       type:'Dragon',       hp:45, atk:75, moves:['Rage','Bite','Headbutt','Dragon Breath'],               evolvesAt:30, evolvesTo:372  },
  { id:374, name:'Beldum',      type:'Steel/Psychic',hp:40, atk:55, moves:['Take Down'],                                            evolvesAt:20, evolvesTo:375  },
  { id:387, name:'Turtwig',     type:'Grass',        hp:55, atk:68, moves:['Tackle','Absorb','Razor Leaf','Crunch'],               evolvesAt:18, evolvesTo:388  },
  { id:390, name:'Chimchar',    type:'Fire',         hp:44, atk:58, moves:['Scratch','Ember','Taunt','Mach Punch'],                 evolvesAt:14, evolvesTo:391  },
  { id:393, name:'Piplup',      type:'Water',        hp:53, atk:51, moves:['Pound','Bubble','Peck','Bubblebeam'],                   evolvesAt:16, evolvesTo:394  },
  { id:447, name:'Riolu',       type:'Fighting',     hp:40, atk:70, moves:['Quick Attack','Force Palm','Endure','Aura Sphere'],    evolvesAt:0,  evolvesTo:448, friendEvolve:true },
  { id:495, name:'Snivy',       type:'Grass',        hp:45, atk:45, moves:['Tackle','Vine Whip','Wrap','Leaf Tornado'],             evolvesAt:17, evolvesTo:496  },
  { id:501, name:'Oshawott',    type:'Water',        hp:55, atk:55, moves:['Tackle','Water Gun','Razor Shell','Aqua Jet'],          evolvesAt:17, evolvesTo:502  },
  { id:504, name:'Patrat',      type:'Normal',       hp:45, atk:55, moves:['Tackle','Bite','Detect','Work Up'],                    evolvesAt:20, evolvesTo:505  },
  { id:610, name:'Axew',        type:'Dragon',       hp:46, atk:87, moves:['Scratch','Dragon Rage','Slash','Dragon Dance'],        evolvesAt:38, evolvesTo:611  },
  { id:633, name:'Deino',       type:'Dark/Dragon',  hp:52, atk:65, moves:['Tackle','Dragon Rage','Bite','Hyper Voice'],           evolvesAt:50, evolvesTo:634  },
  { id:650, name:'Chespin',     type:'Grass',        hp:56, atk:61, moves:['Tackle','Vine Whip','Pin Missile','Take Down'],        evolvesAt:16, evolvesTo:651  },
  { id:653, name:'Fennekin',    type:'Fire',         hp:40, atk:45, moves:['Scratch','Ember','Howl','Flame Charge'],               evolvesAt:16, evolvesTo:654  },
  { id:656, name:'Froakie',     type:'Water',        hp:41, atk:56, moves:['Pound','Bubble','Quick Attack','Water Pulse'],         evolvesAt:16, evolvesTo:657  },
  { id:722, name:'Rowlet',      type:'Grass/Flying', hp:68, atk:55, moves:['Tackle','Leafage','Growl','Peck'],                     evolvesAt:17, evolvesTo:723  },
  { id:725, name:'Litten',      type:'Fire',         hp:45, atk:65, moves:['Scratch','Ember','Growl','Lick'],                      evolvesAt:17, evolvesTo:726  },
  { id:728, name:'Popplio',     type:'Water',        hp:50, atk:54, moves:['Pound','Water Gun','Growl','Disarming Voice'],         evolvesAt:17, evolvesTo:729  },
  { id:810, name:'Grookey',     type:'Grass',        hp:50, atk:65, moves:['Scratch','Branch Poke','Growl','Razor Leaf'],         evolvesAt:16, evolvesTo:811  },
  { id:813, name:'Scorbunny',   type:'Fire',         hp:50, atk:71, moves:['Tackle','Ember','Growl','Quick Attack'],              evolvesAt:16, evolvesTo:814  },
  { id:816, name:'Sobble',      type:'Water',        hp:50, atk:40, moves:['Pound','Water Gun','Tearful Look','Liquidation'],     evolvesAt:16, evolvesTo:817  },
]

function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)) }

function hpBar(current, max, len = 12) {
  const pct    = Math.max(0, current / max)
  const filled = Math.round(pct * len)
  const bar    = '█'.repeat(filled) + '░'.repeat(len - filled)
  const dot    = pct > 0.6 ? '💚' : pct > 0.3 ? '🟡' : '🔴'
  return `${dot} \`${bar}\``
}

function downloadBuffer(url, timeoutMs = 12000) {
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

// Spawn a random Pokémon — baby/low-level weighted heavily
function spawnWildPokemon(playerLevel = 1) {
  // Select from pool — weight toward baby/starter pokemon at low player levels
  const maxId = Math.min(251 + playerLevel * 10, 900)
  const eligible = WILD_POKEMON_POOL.filter(p => p.id <= Math.max(251, maxId))
  const pool = eligible.length > 0 ? eligible : WILD_POKEMON_POOL

  // Higher weight for baby pokemon
  let chosen
  if (Math.random() < 0.4) {
    // 40% chance to pick from baby/starter pool
    const babyPool = pool.filter(p => BABY_POKEMON_IDS.includes(p.id))
    chosen = babyPool.length > 0
      ? babyPool[Math.floor(Math.random() * babyPool.length)]
      : pool[Math.floor(Math.random() * pool.length)]
  } else {
    chosen = pool[Math.floor(Math.random() * pool.length)]
  }

  const level = Math.max(1, randInt(1, Math.max(1, Math.min(playerLevel + 5, 40))))
  const scaledHp = Math.floor(chosen.hp + level * 3)
  return {
    pokemon_id: chosen.id,
    name: chosen.name,
    type: chosen.type,
    level,
    hp: scaledHp,
    maxHp: scaledHp,
    atk: chosen.atk + level * 2,
    moves: chosen.moves,
    evolvesAt: chosen.evolvesAt,
    evolvesTo: chosen.evolvesTo,
    stoneEvolve: chosen.stoneEvolve || null,
    friendEvolve: chosen.friendEvolve || false,
  }
}

// Check if a pokemon in party should evolve by level
function checkLevelEvolution(pokemon) {
  const template = WILD_POKEMON_POOL.find(p => p.id === pokemon.pokemon_id)
  if (!template) return null
  if (!template.evolvesAt || template.evolvesAt === 0) return null
  if (template.stoneEvolve || template.friendEvolve) return null  // not level-based
  const level = pokemon.level || 1
  if (level >= template.evolvesAt && template.evolvesTo) {
    const evoTarget = WILD_POKEMON_POOL.find(p => p.id === template.evolvesTo)
    return evoTarget || null
  }
  return null
}

// Generate battle image using Pollinations
async function fetchBattleImage(myPokemon, wildPokemon) {
  try {
    const myName   = (myPokemon?.name || 'trainer pokemon').toLowerCase()
    const wildName = (wildPokemon?.name || 'wild pokemon').toLowerCase()
    const prompt   = `pokemon battle scene ${myName} vs ${wildName} forest nature background lush green trees dramatic lighting anime style pokemon game art high detail`
    const url      = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=640&height=360&nologo=true&model=flux&seed=${Date.now()%9999}`
    return await downloadBuffer(url, 20000)
  } catch { return null }
}

async function fetchPvpBattleImage(p1name, p2name) {
  try {
    const prompt = `epic pokemon pvp battle ${p1name.toLowerCase()} vs ${p2name.toLowerCase()} stadium arena dramatic lighting crowd anime art style cinematic`
    const url    = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=640&height=360&nologo=true&model=flux&seed=${Date.now()%9999}`
    return await downloadBuffer(url, 20000)
  } catch { return null }
}

module.exports = {
  // ── .hunt ────────────────────────────────────────────────────────
  async hunt({ sock, jid, msg, reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender, pushName)

    const cdMs = await db.getCooldown(sender, 'hunt')
    if (cdMs > 0) {
      const mins = Math.floor(cdMs / 60000)
      const secs = Math.floor((cdMs % 60000) / 1000)
      return reply(`⏳ *Hunt cooldown:* ${mins}m ${secs}s remaining.\n\n_The wild needs time to recover._ 🖤`)
    }

    await db.setCooldown(sender, 'hunt', 3 * 60)

    // 5% success rate
    if (Math.random() > HUNT_SUCCESS_PCT) {
      const noFindLines = [
        '🌿 You searched the tall grass... nothing stirred.',
        '🌲 The forest was quiet. Not even a rustle.',
        '🍃 You heard something, but it vanished before you could see it.',
        '⛺ You spotted tracks, but the trail went cold.',
        '🌧️ The rain washed away all traces. Hunt failed.',
        '🌑 Too dark to find anything today.',
        '🔇 Silence. The wild Pokémon sensed you coming.',
        '🐾 You found paw prints... but the Pokémon was long gone.',
        '🌿 *A shape moved through the grass!* But it got away.',
      ]
      const line = noFindLines[Math.floor(Math.random() * noFindLines.length)]
      return reply(`${line}\n\n_Success rate: 5%  |  Try again in 3 minutes!_ 🖤`)
    }

    // Found one!
    const pokemon = spawnWildPokemon(u.level || 1)
    pendingPokemon[jid] = { ...pokemon, spawnedAt: Date.now(), weakened: false }

    const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.pokemon_id}.png`
    const evolveLine = pokemon.evolvesAt
      ? `_Evolves at Level ${pokemon.evolvesAt}_`
      : '_Does not evolve by level_'

    const caption =
      `🌿 *A wild ${pokemon.name} appeared!*\n\n` +
      `📊 Level: ${pokemon.level}  •  🔷 ${pokemon.type}\n` +
      `❤️ HP: ${pokemon.hp}/${pokemon.maxHp}\n\n` +
      `${evolveLine}\n\n` +
      `━━━━━━━━━━━━━━━━\n\n` +
      `📌 *#catch <slot> | <ball>* to capture  _(90s window)_\n` +
      `📌 *#fight <slot>* to battle it first\n\n` +
      `_Slots: 1–6  |  Balls: normal, great, ultra, master_`

    try {
      const spriteData = await downloadBuffer(spriteUrl, 8000)
      if (spriteData && spriteData.length > 500) {
        await sock.sendMessage(jid, { image: spriteData, caption }, { quoted: msg })
        return
      }
    } catch {}
    await reply(caption)
  },

  // ── #catch ───────────────────────────────────────────────────────
  async catch({ sock, jid, msg, reply, sender, user, pushName, args }) {
    const u = user || await db.getOrCreateUser(sender, pushName)

    const wild = pendingPokemon[jid]
    if (!wild) return reply('❌ No wild Pokémon here right now. Use *.hunt* to find one!')
    if (Date.now() - wild.spawnedAt > CATCH_WINDOW_MS)
      return reply('❌ The Pokémon fled! The catch window expired. Use *.hunt* to find another.')

    const slotArg = args[0] ? parseInt(args[0]) : 1
    const ballArg = (args[1] || 'normal').toLowerCase()
    const slot    = Math.max(1, Math.min(6, slotArg || 1))

    const ballRates = { normal: 0.35, great: 0.55, ultra: 0.75, master: 1.0 }
    const ballCosts = { normal: 0, great: 50, ultra: 150, master: 500 }

    const catchRate  = ballRates[ballArg] || 0.35
    const ballCost   = ballCosts[ballArg] || 0
    const bonusRate  = wild.weakened ? 0.25 : 0
    const finalRate  = Math.min(0.95, catchRate + bonusRate)

    if (ballCost > 0 && (u.wallet || 0) < ballCost)
      return reply(`❌ A ${ballArg} ball costs $${ballCost}. You only have $${u.wallet || 0}.`)
    if (ballCost > 0) await db.updateUser(sender, { wallet: (u.wallet || 0) - ballCost })

    const caught = Math.random() < finalRate
    if (!caught) {
      return reply(
        `🎯 *MISS!*\n\n` +
        `The ${ballArg} ball wobbled... and the wild *${wild.name}* broke free!\n\n` +
        `_(Catch rate was ${Math.round(finalRate * 100)}%)_\n\n` +
        `Try again! Catch window: ~${Math.max(0, Math.floor((CATCH_WINDOW_MS - (Date.now() - wild.spawnedAt)) / 1000))}s left`
      )
    }

    delete pendingPokemon[jid]

    // Build caught pokemon data
    const caughtPokemon = {
      name:       wild.name,
      pokemon_id: wild.pokemon_id,
      level:      wild.level,
      xp:         0,
      hp:         wild.maxHp,
      maxHp:      wild.maxHp,
      atk:        wild.atk,
      moves:      wild.moves,
      evolvesAt:  wild.evolvesAt,
      evolvesTo:  wild.evolvesTo,
      stoneEvolve:wild.stoneEvolve || null,
      friendEvolve:wild.friendEvolve || false,
      caughtAt:   Date.now(),
    }

    // Add to party
    let party = []
    try { party = JSON.parse(u.pokemon_party || '[]') } catch {}
    party = party.filter(Boolean)
    if (slot <= party.length) party[slot - 1] = caughtPokemon
    else party.push(caughtPokemon)
    if (party.length > 6) party = party.slice(0, 6)

    await db.updateUser(sender, {
      pokemon_party: JSON.stringify(party),
      pokemon_caught: (u.pokemon_caught || 0) + 1,
    })

    const evolveLine = caughtPokemon.evolvesAt
      ? `🔄 Evolves at Level *${caughtPokemon.evolvesAt}*`
      : caughtPokemon.stoneEvolve
        ? `💎 Evolves with *${caughtPokemon.stoneEvolve}*`
        : `✅ Final form`

    await reply(
      `✅ *Gotcha! ${wild.name} was caught!*\n\n` +
      `📊 Level: ${wild.level}  •  🔷 ${wild.type}\n` +
      `${evolveLine}\n` +
      `📍 Placed in slot *${slot}*\n\n` +
      `_Use *.party* to view your Pokémon._ 🖤`
    )
  },

  // ── .party ───────────────────────────────────────────────────────
  async party({ reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    let party = []
    try { party = JSON.parse(u.pokemon_party || '[]') } catch {}
    party = party.filter(Boolean)
    if (!party.length) return reply('📦 *Your party is empty!*\n\nUse *.hunt* to find Pokémon. 🖤')

    const lines = party.map((p, i) => {
      const evolveLine = p.evolvesAt && p.level < p.evolvesAt
        ? `└ Evolves at Lv ${p.evolvesAt}`
        : p.stoneEvolve
          ? `└ Evolves with ${p.stoneEvolve}`
          : p.evolvesTo ? '└ Max evolution reached ✓' : ''
      return `*Slot ${i+1}:* ${p.name}  Lv.${p.level||1}\n   ❤️ ${p.hp||p.maxHp}/${p.maxHp||100} HP  |  ⚔️ ${p.atk} ATK\n   ${evolveLine}`
    }).join('\n\n')

    await reply(`🎴 *POKÉMON PARTY*\n\n👤 *${u.name||pushName||sender}*\n\n${lines}\n\n_Use *.pokedex <slot>* for details  |  *.hunt* to catch more_`)
  },

  // ── .pokedex ──────────────────────────────────────────────────────
  async pokedex({ reply, sender, user, pushName, args }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    let party = []
    try { party = JSON.parse(u.pokemon_party || '[]') } catch {}
    party = party.filter(Boolean)
    const slotIdx = Math.max(0, (parseInt(args[0]) || 1) - 1)
    const p = party[slotIdx]
    if (!p) return reply(`❌ No Pokémon in slot ${slotIdx + 1}. Use *.party* to see your team.`)

    const evolveLine = p.evolvesAt && p.level < p.evolvesAt
      ? `🔄 Evolves at Level *${p.evolvesAt}* (${p.evolvesAt - p.level} levels away)`
      : p.stoneEvolve
        ? `💎 Use a *${p.stoneEvolve}* to evolve`
        : p.evolvesTo ? `✅ Already at highest level-based evolution` : `✅ Final form`

    await reply(
      `📖 *POKÉDEX — Slot ${slotIdx+1}*\n\n` +
      `🏷 Name: *${p.name}*  (ID: #${p.pokemon_id})\n` +
      `🔷 Type: ${p.type||'Normal'}\n` +
      `📊 Level: ${p.level||1}  |  XP: ${p.xp||0}\n` +
      `❤️ HP: ${p.hp||p.maxHp}/${p.maxHp}\n` +
      `⚔️ ATK: ${p.atk}\n` +
      `${evolveLine}\n\n` +
      `🎮 *Moves:*\n${(p.moves||[]).map((m,i)=>`  ${i+1}. ${m}`).join('\n')}\n\n` +
      `_Use *.evolve <slot>* if ready to evolve. *.release <slot>* to release._`
    )
  },

  // ── .evolve ───────────────────────────────────────────────────────
  async evolve({ reply, sender, user, pushName, args }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    let party = []
    try { party = JSON.parse(u.pokemon_party || '[]') } catch {}
    party = party.filter(Boolean)
    const slotIdx = Math.max(0, (parseInt(args[0]) || 1) - 1)
    const p = party[slotIdx]
    if (!p) return reply(`❌ No Pokémon in slot ${slotIdx + 1}.`)

    const evoTarget = checkLevelEvolution(p)
    if (!evoTarget) {
      const template = WILD_POKEMON_POOL.find(t => t.id === p.pokemon_id)
      if (!template || !template.evolvesTo) return reply(`❌ *${p.name}* doesn't evolve or has no registered evolution.`)
      if (template.stoneEvolve) return reply(`❌ *${p.name}* evolves with a *${template.stoneEvolve}*, not by level.\n\n_Use *.useitem <slot> <stone>* to evolve it._`)
      if (template.friendEvolve) return reply(`❌ *${p.name}* evolves through high friendship.\n\n_Keep battling with it to raise friendship!_`)
      if (template.evolvesAt && p.level < template.evolvesAt) return reply(`❌ *${p.name}* needs to reach Level *${template.evolvesAt}* to evolve!\n\n_Currently Level ${p.level} — ${template.evolvesAt - p.level} more levels to go._`)
      return reply(`❌ *${p.name}* cannot evolve right now.`)
    }

    // Perform evolution
    const oldName = p.name
    party[slotIdx] = {
      ...p,
      name:       evoTarget.name,
      pokemon_id: evoTarget.id,
      maxHp:      Math.floor(evoTarget.hp + (p.level||1) * 3),
      hp:         Math.floor(evoTarget.hp + (p.level||1) * 3),
      atk:        evoTarget.atk + (p.level||1) * 2,
      moves:      evoTarget.moves,
      evolvesAt:  evoTarget.evolvesAt,
      evolvesTo:  evoTarget.evolvesTo,
      stoneEvolve:evoTarget.stoneEvolve || null,
    }
    await db.updateUser(sender, { pokemon_party: JSON.stringify(party) })

    const nextEvo = evoTarget.evolvesAt ? `🔄 Next evolution at Level *${evoTarget.evolvesAt}*` : `✅ *${evoTarget.name}* is the final form!`
    await reply(
      `🌟 *EVOLUTION!*\n\n` +
      `✨ *${oldName}* evolved into *${evoTarget.name}*!\n\n` +
      `📊 New stats:\n` +
      `❤️ HP: ${party[slotIdx].maxHp}\n` +
      `⚔️ ATK: ${party[slotIdx].atk}\n` +
      `🎮 Moves: ${evoTarget.moves.join(', ')}\n\n` +
      `${nextEvo}\n\n` +
      `_Congratulations!_ 🖤`
    )
  },

  // ── .release ─────────────────────────────────────────────────────
  async release({ reply, sender, user, pushName, args }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    let party = []
    try { party = JSON.parse(u.pokemon_party || '[]') } catch {}
    party = party.filter(Boolean)
    const slotIdx = Math.max(0, (parseInt(args[0]) || 1) - 1)
    const p = party[slotIdx]
    if (!p) return reply(`❌ No Pokémon in slot ${slotIdx + 1}.`)
    party.splice(slotIdx, 1)
    await db.updateUser(sender, { pokemon_party: JSON.stringify(party) })
    await reply(`👋 *${p.name}* was released back to the wild.\n\n_Goodbye, ${p.name}!_ 🖤`)
  },

  // ── #fight (wild battle using party slot) ─────────────────────────
  async fight({ sock, jid, msg, reply, sender, user, pushName, args }) {
    const u = user || await db.getOrCreateUser(sender, pushName)

    if (activeBattles[sender]) return reply(`⚔️ You're already in a battle! Use *.move <1–4>* to attack or *.flee* to escape.`)

    let party = []
    try { party = JSON.parse(u.pokemon_party || '[]') } catch {}
    party = party.filter(Boolean)

    const slotArg = parseInt(args[0]) || 1
    const myPokemon = party[Math.max(0, slotArg - 1)]
    if (!myPokemon) return reply(`❌ No Pokémon in slot ${slotArg}. Use *.party* to see your team.`)

    const wild = pendingPokemon[jid]
    if (!wild) return reply(`❌ No wild Pokémon to fight! Use *.hunt* to find one first.`)
    if (Date.now() - wild.spawnedAt > CATCH_WINDOW_MS)
      return reply(`❌ That Pokémon fled! Use *.hunt* again.`)

    const myMaxHp  = myPokemon.maxHp || 100
    const wildMaxHp= wild.maxHp || wild.hp
    activeBattles[sender] = {
      jid, myPokemon, myHp: myMaxHp, myMaxHp, wild, wildHp: wildMaxHp, wildMaxHp,
      moves: myPokemon.moves || ['Tackle','Growl'], turn: 1,
    }

    const caption =
      `⚔️ *BATTLE STARTED!*\n\n` +
      `🌿 *Wild ${wild.name}* (Lv ${wild.level})\n${hpBar(wildMaxHp, wildMaxHp)} ${wildMaxHp}/${wildMaxHp} HP\n\n` +
      `⚡ *${myPokemon.name}* (Lv ${myPokemon.level||1})\n${hpBar(myMaxHp, myMaxHp)} ${myMaxHp}/${myMaxHp} HP\n\n` +
      `📋 *Moves:*\n${(myPokemon.moves||['Tackle']).map((m,i)=>`  *${i+1}.* ${m}`).join('\n')}\n\n` +
      `> *.move <1–${(myPokemon.moves||['Tackle']).length}>* to attack  |  *.flee* to escape`

    try {
      const battleImg = await fetchBattleImage(myPokemon, wild)
      if (battleImg && battleImg.length > 500) {
        await sock.sendMessage(jid, { image: battleImg, caption }, { quoted: msg })
        return
      }
    } catch {}
    await sock.sendMessage(jid, { text: caption }, { quoted: msg })
  },

  // ── .move (battle turn) ───────────────────────────────────────────
  async move({ sock, jid, msg, reply, sender, user, args }) {
    const battle = activeBattles[sender]
    if (!battle) return reply(`❌ You're not in a battle. Use *.hunt* then *#fight <slot>* to start one.`)
    if (battle.jid !== jid) return reply(`❌ Your active battle is in a different group.`)

    const moveIdx  = Math.max(0, (parseInt(args[0]) || 1) - 1)
    const moveName = battle.moves[Math.min(moveIdx, battle.moves.length - 1)] || 'Tackle'

    // Player attacks
    const myAtk     = 15 + (battle.myPokemon.level || 1) * 3
    const crit      = Math.random() < 0.15
    const playerDmg = randInt(myAtk, myAtk + 15) + (crit ? 12 : 0)
    battle.wildHp   = Math.max(0, battle.wildHp - playerDmg)

    const log = [`⚔️ *TURN ${battle.turn}*\n`]
    log.push(`⚡ *${battle.myPokemon.name}* used *${moveName}*!`)
    log.push(crit ? `✨ *Critical hit!* (-${playerDmg} HP)` : `(-${playerDmg} HP)`)

    if (battle.wildHp <= 0) {
      const xpGain = 25 + battle.wild.level * 5
      const u = user || await db.getOrCreateUser(sender)
      let party = []
      try { party = JSON.parse(u.pokemon_party || '[]') } catch {}
      party = party.filter(Boolean)
      const partyIdx = party.findIndex(p => p.name === battle.myPokemon.name)
      let evolutionMsg = ''
      if (partyIdx !== -1) {
        party[partyIdx].xp   = (party[partyIdx].xp || 0) + xpGain
        party[partyIdx].level = (party[partyIdx].level || 1) + Math.floor(xpGain / 100)
        // Check level evolution
        const evoTarget = checkLevelEvolution(party[partyIdx])
        if (evoTarget) evolutionMsg = `\n\n🌟 *${party[partyIdx].name}* can now evolve! Use *.evolve ${partyIdx + 1}*`
        await db.updateUser(sender, { pokemon_party: JSON.stringify(party), pokemon_wins: (u.pokemon_wins||0)+1 })
      } else {
        await db.updateUser(sender, { pokemon_wins: (u.pokemon_wins||0)+1 })
      }
      delete activeBattles[sender]
      pendingPokemon[jid] = { ...battle.wild, spawnedAt: Date.now(), weakened: true }
      log.push(`\n💫 *Wild ${battle.wild.name} fainted!*\n`)
      log.push(`⭐ *+${xpGain} XP* earned!${evolutionMsg}`)
      log.push(`\n🎯 *${battle.wild.name}* is weakened — use *#catch <slot>* to capture! _(90s window)_`)
      return await sock.sendMessage(jid, { text: log.join('\n') }, { quoted: msg })
    }

    const wildMoves = (Array.isArray(battle.wild.moves) && battle.wild.moves.length) ? battle.wild.moves : ['Tackle','Growl']
    const wildMove  = wildMoves[Math.floor(Math.random() * Math.min(4, wildMoves.length))]
    const wildAtk   = 8 + battle.wild.level * 2
    const wildCrit  = Math.random() < 0.10
    const wildDmg   = randInt(wildAtk, wildAtk + 10) + (wildCrit ? 8 : 0)
    battle.myHp     = Math.max(0, battle.myHp - wildDmg)
    battle.turn++

    log.push(`\n🌿 *Wild ${battle.wild.name}* used *${wildMove}*!`)
    log.push(wildCrit ? `💥 *Critical hit!* (-${wildDmg} HP)` : `(-${wildDmg} HP)`)

    if (battle.myHp <= 0) {
      delete activeBattles[sender]
      delete pendingPokemon[jid]
      log.push(`\n💔 *${battle.myPokemon.name} fainted!*`)
      log.push(`\n_The wild ${battle.wild.name} fled._ 🖤`)
      return await sock.sendMessage(jid, { text: log.join('\n') }, { quoted: msg })
    }

    log.push(`\n━━━━━━━━━━━━━━`)
    log.push(`🌿 *${battle.wild.name}* (Lv ${battle.wild.level})`)
    log.push(`❤️ ${hpBar(battle.wildHp, battle.wildMaxHp)} ${battle.wildHp}/${battle.wildMaxHp} HP`)
    log.push(``)
    log.push(`⚡ *${battle.myPokemon.name}* (Lv ${battle.myPokemon.level || 1})`)
    log.push(`❤️ ${hpBar(battle.myHp, battle.myMaxHp)} ${battle.myHp}/${battle.myMaxHp} HP`)
    log.push(`\n*📋 Moves:*\n${battle.moves.map((m, i) => `  *${i + 1}.* ${m}`).join('\n')}`)
    log.push(`\n> *.move <1–${battle.moves.length}>* to attack  |  *.flee* to escape`)
    await sock.sendMessage(jid, { text: log.join('\n') }, { quoted: msg })
  },

  // ── .flee ─────────────────────────────────────────────────────────
  async flee({ reply, sender, jid }) {
    const battle = activeBattles[sender]
    if (!battle) return reply(`❌ You're not in a battle.`)
    if (battle.jid !== jid) return reply(`❌ Your active battle is in a different group.`)
    if (Math.random() < 0.30) {
      return reply(`😤 *Can't escape!*\n\nWild *${battle.wild.name}* blocked your path!\n\n❤️ Your HP: ${battle.myHp}/${battle.myMaxHp}\n\n*📋 Moves:*\n${battle.moves.map((m,i)=>`  *${i+1}.* ${m}`).join('\n')}\n\n> *.move <1–${battle.moves.length}>* to keep fighting`)
    }
    delete activeBattles[sender]
    await reply(`🏃 *Got away safely!*\n\nYou escaped from wild *${battle.wild.name}*.\n\n_It's still out there — use *#catch* if you want it!_ 🖤`)
  },

  // ── #battle @user — PvP challenge ────────────────────────────────
  async battle({ sock, jid, msg, reply, sender, user, pushName, mentionedJid, args }) {
    const u = user || await db.getOrCreateUser(sender, pushName)

    // #battle accept / #battle decline
    if (args[0]?.toLowerCase() === 'accept') {
      // Find a challenge targeting this user
      const challengerSender = Object.keys(pvpChallenges).find(
        cs => pvpChallenges[cs]?.targetSender === sender && pvpChallenges[cs]?.jid === jid
      )
      if (!challengerSender) return reply('❌ No pending battle challenge for you right now.')
      const challenge = pvpChallenges[challengerSender]
      if (Date.now() > challenge.expiresAt) {
        delete pvpChallenges[challengerSender]
        return reply('❌ That challenge has expired.')
      }

      delete pvpChallenges[challengerSender]

      // Load both users
      const challenger = await db.getOrCreateUser(challengerSender)
      let myParty = []; let theirParty = []
      try { myParty = JSON.parse(u.pokemon_party || '[]').filter(Boolean) } catch {}
      try { theirParty = JSON.parse(challenger.pokemon_party || '[]').filter(Boolean) } catch {}

      if (!myParty.length) return reply('❌ You have no Pokémon to battle with! Use *.hunt* to catch one.')
      if (!theirParty.length) return reply(`❌ ${challenger.name || challengerSender} has no Pokémon to battle with!`)

      const myPoke    = myParty[0]
      const theirPoke = theirParty[0]

      // Simple stat-based PvP battle resolution
      const myScore    = (myPoke.atk || 50) + (myPoke.level || 1) * 5 + Math.random() * 50
      const theirScore = (theirPoke.atk || 50) + (theirPoke.level || 1) * 5 + Math.random() * 50
      const winner     = myScore >= theirScore ? u : challenger
      const loser      = myScore >= theirScore ? challenger : u
      const winnerPoke = myScore >= theirScore ? myPoke : theirPoke
      const loserPoke  = myScore >= theirScore ? theirPoke : myPoke

      const prizeCoins = 200 + Math.floor(Math.random() * 300)
      await db.updateUser(myScore >= theirScore ? sender : challengerSender, { wallet: ((winner.wallet||0) + prizeCoins) })

      const battleCaption =
        `⚔️ *PVP BATTLE!*\n\n` +
        `🆚 *${u.name||'Player 1'}* vs *${challenger.name||'Player 2'}*\n\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `🏆 *${winner.name||'Winner'}* wins!\n` +
        `💥 *${winnerPoke.name}* defeated *${loserPoke.name}*!\n\n` +
        `💰 *+${prizeCoins} coins* earned!\n\n` +
        `_${loserPoke.name} fought bravely..._ 🖤`

      try {
        const battleImg = await fetchPvpBattleImage(winnerPoke.name, loserPoke.name)
        if (battleImg && battleImg.length > 500) {
          await sock.sendMessage(jid, { image: battleImg, caption: battleCaption }, { quoted: msg })
          return
        }
      } catch {}
      await sock.sendMessage(jid, { text: battleCaption }, { quoted: msg })
      return
    }

    if (args[0]?.toLowerCase() === 'decline') {
      const challengerSender = Object.keys(pvpChallenges).find(
        cs => pvpChallenges[cs]?.targetSender === sender && pvpChallenges[cs]?.jid === jid
      )
      if (challengerSender) delete pvpChallenges[challengerSender]
      return reply('❌ Battle challenge declined.')
    }

    // Send a battle challenge
    const targetJid = mentionedJid?.[0]
    if (!targetJid) return reply('📌 *Usage:* `#battle @user` to challenge someone.\n\nOr reply to their message with `#battle`.')

    let party = []
    try { party = JSON.parse(u.pokemon_party || '[]').filter(Boolean) } catch {}
    if (!party.length) return reply('❌ You need at least 1 Pokémon in your party! Use *.hunt* to catch one.')

    const targetSender = targetJid.split('@')[0] + '@s.whatsapp.net'
    pvpChallenges[sender] = { targetSender, jid, expiresAt: Date.now() + 60000 }

    const myPoke = party[0]
    await sock.sendMessage(jid, {
      text:
        `⚔️ *BATTLE CHALLENGE!*\n\n` +
        `*${u.name || pushName || 'Someone'}* challenges @${targetJid.split('@')[0]} to a Pokémon battle!\n\n` +
        `🎴 Their lead: *${myPoke.name}* (Lv ${myPoke.level || 1})\n\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `✅ Reply *#battle accept* to fight!\n` +
        `❌ Reply *#battle decline* to refuse.\n\n` +
        `_Challenge expires in 60 seconds._ 🖤`,
      mentions: [targetJid],
    }, { quoted: msg })
  },

  // ── #pheal — heal party ───────────────────────────────────────────
  async pheal({ reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    const healCost = 300
    if ((u.wallet || 0) < healCost) return reply(`❌ Healing costs $${healCost}. You have $${u.wallet || 0}.`)
    let party = []; try { party = JSON.parse(u.pokemon_party || '[]').filter(Boolean) } catch {}
    if (!party.length) return reply('❌ No Pokémon to heal.')
    party = party.map(p => ({ ...p, hp: p.maxHp || 100 }))
    await db.updateUser(sender, { pokemon_party: JSON.stringify(party), wallet: (u.wallet || 0) - healCost })
    await reply(`💊 *Party Healed!*\n\nAll Pokémon restored to full HP!\n💰 -$${healCost}\n\n_${party.map(p=>p.name).join(', ')} are ready for battle!_ 🖤`)
  },

  // ── Legacy aliases ────────────────────────────────────────────────
  async wb(ctx) { return module.exports.hunt(ctx) },
}
