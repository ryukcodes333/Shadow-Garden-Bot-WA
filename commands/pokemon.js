const db = require('../database')
  const http = require('http')
  const https = require('https')

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
  

const POKEMON_CATCH_WINDOW = 90 * 1000

const pendingPokemon = {}

const TYPES = ['Fire','Water','Grass','Electric','Psychic','Dark','Ice','Dragon','Normal','Fighting','Ghost','Steel']

function randInt(a,b){ return a+Math.floor(Math.random()*(b-a+1)) }

function pickType() {
  return TYPES[Math.floor(Math.random()*TYPES.length)]
}

async function fetchPokemon(nameOrId) {
  const mod = await import('node-fetch')
  const fetch = mod.default || mod
  const url = `https://pokeapi.co/api/v2/pokemon/${nameOrId}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) return null
  return res.json()
}

module.exports = {
  async spawnPokemon(sock, jid) {
    const id = randInt(1, 898)
    let data = null
    try { data = await fetchPokemon(id) } catch(e) {}

    if (!data) {
      // Fallback: spawn a generic shadow pokemon
      const fakeName = `Shadow-${id}`
      const fakeTypes = [pickType()]
      pendingPokemon[jid] = {
        id, name: fakeName, types: fakeTypes,
        baseXp: 50, spawnedAt: Date.now(),
      }
      await sock.sendMessage(jid, {
        text:
          `🌑 *A WILD POKÉMON APPEARED!*\n\n` +
          `🎴 *${fakeName}*\n` +
          `⚡ Type: ${fakeTypes.join('/')}\n\n` +
          `💬 Type *.pokecatch* to capture it!\n` +
          `⏱️ You have 90 seconds!\n\n` +
          `_The shadows are watching._ 🖤`
      })
      return
    }

    // Safe access to sprites
    const sprite = data.sprites?.front_default ||
                   data.sprites?.other?.['official-artwork']?.front_default ||
                   null

    const name  = data.name?.charAt(0).toUpperCase() + (data.name?.slice(1)||'')
    const types = (data.types||[]).map(t => {
      const tn = t?.type?.name || 'Normal'
      return tn.charAt(0).toUpperCase() + tn.slice(1)
    })
    const baseXp = data.base_experience || 50

    pendingPokemon[jid] = {
      id, name, types, baseXp, spawnedAt: Date.now(),
    }

    const caption =
      `🌑 *A WILD POKÉMON APPEARED!*\n\n` +
      `🎴 *${name}* (No. ${id})\n` +
      `⚡ Type: ${types.join('/')}\n` +
      `⭐ Base EXP: ${baseXp}\n\n` +
      `💬 Type *.pokecatch* to capture it!\n` +
      `⏱️ You have 90 seconds!\n\n` +
      `_The shadows are watching._ 🖤`

    if (sprite) {
      await sock.sendMessage(jid, { image: { url: sprite }, caption })
    } else {
      await sock.sendMessage(jid, { text: caption })
    }

    // Auto-expire
    setTimeout(() => {
      if (pendingPokemon[jid]?.spawnedAt === pendingPokemon[jid]?.spawnedAt) {
        delete pendingPokemon[jid]
      }
    }, POKEMON_CATCH_WINDOW)
  },

  async pokecatch({ reply, react, sender, user }) {
    const jidKeys = Object.keys(pendingPokemon)
    // Find pending in same group (this ctx doesn't have jid easily — use sender's context)
    // We need to find this by jid — will be passed via ctx
    await reply(`💡 Use this command in the group where the Pokémon appeared!`)
  },

  // jid-aware version called from main index handler
  async pokecatchInGroup({ jid, reply, react, sender, user }) {
    const pokemon = pendingPokemon[jid]
    if (!pokemon) {
      return reply(`❌ No Pokémon to catch right now!\n\nWait for one to appear… 🌑`)
    }
    if (Date.now() - pokemon.spawnedAt > POKEMON_CATCH_WINDOW) {
      delete pendingPokemon[jid]
      return reply(`⏱️ Too slow! The Pokémon fled!\n\n_Be quicker next time._ 🖤`)
    }
    delete pendingPokemon[jid]
    const caught = Math.random() < 0.6
    if (!caught) {
      return reply(`💨 *POKÉMON FLED!*\n\n*${pokemon.name}* escaped the Pokéball!\n\n_Try again next time._ 🖤`)
    }
    const u = user || await db.getOrCreateUser(sender)
    const xpGained = pokemon.baseXp + randInt(5,20)
    await db.updateUser(sender, { xp: (u.xp||0)+xpGained })
    await react('🎉')
    await reply(
      `🎉 *POKÉMON CAUGHT!*\n\n` +
      `✅ *${pokemon.name}* (No. ${pokemon.id})\n` +
      `⚡ Type: ${pokemon.types.join('/')}\n\n` +
      `⭐ +${xpGained} XP gained!\n\n` +
      `_The shadow garden grows stronger._ 🖤`
    )
  },
}
