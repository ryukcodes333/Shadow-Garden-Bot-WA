const VIBES = [
  'Immaculate ✨', 'On another level 🔥', 'Certified W 🏆', 'Radiating 💫',
  'Absolutely vibing 🎵', 'Unmatched energy ⚡', 'Peak form 💪', 'Living rent-free 🧠',
  'Off the charts 📈', 'Too hot to handle 🌡️', 'God-tier 👑', 'Legendary 🌟',
  'Just a regular day 😐', 'Mid honestly 😶', 'Could be better 💀', 'Barely surviving 🥀',
  'Big W 🎯', 'Touched grass recently 🌿', 'Chronically online 📱', 'Built different 🔩',
]

const ENERGY_LEVELS = [
  '0% — Fully dead 💀', '10% — Barely breathing 😮‍💨', '25% — Low battery 🪫',
  '50% — Charging ⚡', '75% — Online 💻', '90% — Locked in 🔒', '100% — PEAK 🔥',
  '110% — Glitched 🤖', '999% — Beyond human 👾',
]

const AURA_TYPES = [
  'Shadow Aura 🌑', 'Golden Aura 🌟', 'Toxic Aura ☢️', 'Chaotic Aura 🌀',
  'Peaceful Aura 🕊️', 'Mysterious Aura 🔮', 'Villain Aura 😈', 'Main Character Aura 🎬',
  'NPC Aura 🤖', 'God Aura 👑', 'Cursed Aura 💀', 'Pure Aura ✨',
]

const RIZZ_LEVELS = [
  'No rizz detected ❌', 'Rizz: 0/10 💀', 'Rizz: 3/10 😐', 'Rizz: 5/10 😏',
  'Rizz: 7/10 😎', 'Rizz: 9/10 🔥', 'Rizz: 10/10 👑', 'Unmatched rizz 🌟',
  'Rizz so powerful it\'s illegal 👮', 'Omega rizz unlocked 🔓',
]

const SIGMA_TRAITS = [
  'Lone wolf 🐺', 'Doesn\'t need validation 😐', 'Built the grid 🔩', 'Sleeps 16 hours a day 💤',
  'Has a plan 📋', 'Works in silence 🤫', 'Exits group chats 🚪', 'Eats alone 🍽️',
  'Already 10 steps ahead ♟️', 'Certified sigma grindset ⚙️',
]

const COPE_LINES = [
  'Seethe and cope 😂', 'Skill issue tbh 🤷', 'Touch grass 🌿', 'L + ratio 📉',
  'Didn\'t ask 🙄', 'The delusion 😭', 'It\'s giving desperate 💀', 'Not you coping again 😂',
  'The audacity 😤', 'You are so cooked 🔥',
]

const RATIO_LINES = [
  'Ratio 📉', 'Ratio + L 💀', 'Ratio + skill issue 🤦', 'Ratio + no cap 📉',
  'Ratio + go outside 🚪', 'Ratio + you dropped this 👑', 'Ratio + W for me 🏆',
  'Ratio + malding 😡', 'Ratio + NPC behaviour 🤖',
]

const MOOD_LINES = [
  '😶 Blank', '😤 Annoyed', '💀 Done with everything', '🥺 Soft hours',
  '😈 Menacing', '🧘 At peace', '🤡 Clowning', '🔥 On fire',
  '😴 Sleepy', '👑 Royalty', '🌧️ Rainy day energy', '⚡ Hyperfocused',
]

const NPC_LINES = [
  'You are 100% NPC behaviour 🤖', 'NPC dialogue detected 📜', 'Following the main character as usual 😐',
  'Side quest accepted 📋', 'NPC detected in the wild 🔍', 'Your quest: stand in the corner 🚶',
  'Background character energy 🎬', 'NPC spawned 🌐',
]

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getPercent() {
  return Math.floor(Math.random() * 101)
}

module.exports = {
  async vibe({ reply, pushName, sender }) {
    const name = pushName || sender
    const pct  = getPercent()
    await reply(`🔥 *Vibe Check — ${name}*\n\nVibe Score: *${pct}%*\nStatus: ${getRandom(VIBES)}\n\n> ${pct >= 70 ? 'Your vibe is immaculate. 🌟' : pct >= 40 ? 'Could go either way. 😐' : 'Log off and reset. 💀'}`)
  },

  async vibecheck({ reply, pushName, sender }) {
    return module.exports.vibe({ reply, pushName, sender })
  },

  async energy({ reply, pushName, sender }) {
    const name = pushName || sender
    await reply(`⚡ *Energy Level — ${name}*\n\n${getRandom(ENERGY_LEVELS)}\n\n> ${getRandom(['Power through 💪', 'Rest up 😴', 'Drink water 💧', 'Touch some grass 🌿'])}`)
  },

  async aura({ reply, pushName, sender }) {
    const name = pushName || sender
    const pct  = getPercent()
    await reply(`🔮 *Aura Reading — ${name}*\n\nType: *${getRandom(AURA_TYPES)}*\nIntensity: *${pct}%*\n\n> ${pct >= 80 ? 'Powerful presence. Stay dangerous. 🌑' : pct >= 50 ? 'Growing aura. Keep going. ✨' : 'Weak aura. Seek training. 💀'}`)
  },

  async rizz({ reply, pushName, sender }) {
    const name = pushName || sender
    await reply(`😏 *Rizz Level — ${name}*\n\n${getRandom(RIZZ_LEVELS)}\n\n> ${getRandom(['You either have it or you don\'t. 🎯', 'Rizz is a lifestyle. 😎', 'Stay confident. 💪', 'There is no school for this. 🏫'])}`)
  },

  async sigma({ reply, pushName, sender }) {
    const name = pushName || sender
    const traits = []
    const count  = Math.floor(Math.random() * 3) + 2
    const pool   = [...SIGMA_TRAITS]
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length)
      traits.push(`• ${pool.splice(idx, 1)[0]}`)
    }
    await reply(`🐺 *Sigma Analysis — ${name}*\n\n${traits.join('\n')}\n\n> Sigma grindset confirmed. 🔩`)
  },

  async ratio({ reply, pushName, sender }) {
    await reply(`📉 ${getRandom(RATIO_LINES)}`)
  },

  async npc({ reply, pushName, sender }) {
    const name = pushName || sender
    await reply(`🤖 *NPC Report — ${name}*\n\n${getRandom(NPC_LINES)}\n\n> Main character privileges: revoked.`)
  },

  async cope({ reply }) {
    await reply(`😂 ${getRandom(COPE_LINES)}`)
  },

  async mood({ reply, pushName, sender }) {
    const name = pushName || sender
    await reply(`🎭 *Mood Reading — ${name}*\n\n${getRandom(MOOD_LINES)}\n\n> vibes don't lie.`)
  },

  async lowkey({ reply, pushName, sender }) {
    const name = pushName || sender
    await reply(`🤫 *Lowkey Status — ${name}*\n\nLowkey meter: *${getPercent()}%*\n\n> ${getRandom(['Moving in silence. 🌑', 'Too lowkey for this group. 😐', 'They don\'t see you coming. 👀', 'Ghost mode activated. 👻'])}`)
  },

  async slay({ reply, pushName, sender }) {
    const name = pushName || sender
    await reply(`💅 ${name} is *slaying* at ${getPercent()}%.\n\n> ${getRandom(['Unmatched. ✨', 'Undeniable. 🌟', 'Fearless. 🔥', 'The moment. 👑'])}`)
  },

  async ghost({ reply, pushName, sender }) {
    const name  = pushName || sender
    const score = getPercent()
    await reply(`👻 *Ghost Score — ${name}*\n\nGhosting: *${score}%*\n\n> ${score >= 70 ? 'Certified ghost. Nobody can find you. 👻' : score >= 40 ? 'Part-time ghost. Online when convenient. 😐' : 'You reply too fast. Red flag. 🚩'}`)
  },

  async toxic({ reply, pushName, sender }) {
    const name = pushName || sender
    const pct  = getPercent()
    await reply(`☢️ *Toxicity Level — ${name}*\n\nToxic: *${pct}%*\n\n> ${pct >= 80 ? 'Maximum toxicity. Get help. ☢️' : pct >= 50 ? 'Moderately toxic. Manageable. 😐' : 'Surprisingly wholesome. 🕊️'}`)
  },

  async real({ reply, pushName, sender }) {
    const name = pushName || sender
    await reply(`💯 *Realness Check — ${name}*\n\nReal: *${getPercent()}%*\n\n> ${getRandom(['No cap. 💯', 'Genuinely real. 🙌', 'Authenticity detected. ✅', 'One of a kind. 🌟'])}`)
  },

  async sus({ reply, pushName, sender }) {
    const name = pushName || sender
    const pct  = getPercent()
    await reply(`🔴 *Sus Meter — ${name}*\n\nSuspicion: *${pct}%*\n\n> ${pct >= 70 ? 'Very sus. 🔴 Emergency meeting called.' : pct >= 40 ? 'Slightly sus. 🟡 Keep an eye on them.' : 'Clear. 🟢 Not sus at all.'}`)
  },

  async clout({ reply, pushName, sender }) {
    const name = pushName || sender
    const pct  = getPercent()
    await reply(`📊 *Clout Report — ${name}*\n\nClout level: *${pct}%*\n\n> ${pct >= 80 ? 'Mega clout. Don\'t let it go to your head. 👑' : pct >= 50 ? 'Mid-tier clout. Work harder. 📈' : 'Zero clout. Grind more. 💀'}`)
  },
}
