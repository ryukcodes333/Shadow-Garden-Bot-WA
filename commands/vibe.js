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
    await reply(
      `🔥 *Vibe Check*\n\n` +
      `👤 ${name}\n\n` +
      `📊 Score\n└ *${pct}%*\n\n` +
      `✨ Status\n└ ${getRandom(VIBES)}\n\n` +
      `> ${pct >= 70 ? 'Your vibe is immaculate. 🌟' : pct >= 40 ? 'Could go either way. 😐' : 'Log off and reset. 💀'}`
    )
  },

  async vibecheck({ reply, pushName, sender }) {
    return module.exports.vibe({ reply, pushName, sender })
  },

  async energy({ reply, pushName, sender }) {
    const name = pushName || sender
    await reply(
      `⚡ *Energy Level*\n\n` +
      `👤 ${name}\n\n` +
      `🔋 Level\n└ ${getRandom(ENERGY_LEVELS)}\n\n` +
      `> ${getRandom(['Power through 💪', 'Rest up 😴', 'Drink water 💧', 'Touch some grass 🌿'])}`
    )
  },

  async aura({ reply, pushName, sender }) {
    const name = pushName || sender
    const pct  = getPercent()
    await reply(
      `🔮 *Aura Reading*\n\n` +
      `👤 ${name}\n\n` +
      `✨ Type\n└ ${getRandom(AURA_TYPES)}\n\n` +
      `📊 Intensity\n└ *${pct}%*\n\n` +
      `> ${pct >= 80 ? 'Powerful presence. Stay dangerous. 🌑' : pct >= 50 ? 'Growing aura. Keep going. ✨' : 'Weak aura. Seek training. 💀'}`
    )
  },

  async rizz({ reply, pushName, sender, args, msg }) {
    const mentioned = msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    const name = (args.length && !mentioned) ? args.join(' ') : (pushName || sender)
    const score = getPercent()
    await reply(
      `😎 *Rizz Rating*\n\n` +
      `👤 ${name}\n\n` +
      `✨ Score\n└ *${score}/100*\n\n` +
      `💬 ${getRandom(RIZZ_LEVELS)}\n\n` +
      `> ${score >= 80 ? 'Undeniable. 👑' : score >= 50 ? 'Rizz is a lifestyle. 😎' : 'There is no school for this. 🏫'}`
    )
  },

  async sigma({ reply, pushName, sender }) {
    const name   = pushName || sender
    const traits = []
    const count  = Math.floor(Math.random() * 3) + 2
    const pool   = [...SIGMA_TRAITS]
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length)
      traits.push(`└ ${pool.splice(idx, 1)[0]}`)
    }
    await reply(
      `🐺 *Sigma Analysis*\n\n` +
      `👤 ${name}\n\n` +
      `🔩 Traits\n${traits.join('\n')}\n\n` +
      `> Sigma grindset confirmed. 🔩`
    )
  },

  async ratio({ reply }) {
    await reply(`📉 ${getRandom(RATIO_LINES)}`)
  },

  async npc({ reply, pushName, sender }) {
    const name = pushName || sender
    await reply(
      `🤖 *NPC Report*\n\n` +
      `👤 ${name}\n\n` +
      `📜 Verdict\n└ ${getRandom(NPC_LINES)}\n\n` +
      `> Main character privileges: revoked.`
    )
  },

  async cope({ reply }) {
    await reply(`😂 ${getRandom(COPE_LINES)}`)
  },

  async mood({ reply, pushName, sender }) {
    const name = pushName || sender
    await reply(
      `🎭 *Mood Reading*\n\n` +
      `👤 ${name}\n\n` +
      `😶 Current Mood\n└ ${getRandom(MOOD_LINES)}\n\n` +
      `> vibes don't lie.`
    )
  },

  async lowkey({ reply, pushName, sender }) {
    const name = pushName || sender
    await reply(
      `🤫 *Lowkey Status*\n\n` +
      `👤 ${name}\n\n` +
      `📊 Lowkey Meter\n└ *${getPercent()}%*\n\n` +
      `> ${getRandom(['Moving in silence. 🌑', 'Too lowkey for this group. 😐', 'They don\'t see you coming. 👀', 'Ghost mode activated. 👻'])}`
    )
  },

  async slay({ reply, pushName, sender }) {
    const name = pushName || sender
    await reply(
      `💅 *Slay Report*\n\n` +
      `👤 ${name}\n\n` +
      `📊 Slay Level\n└ *${getPercent()}%*\n\n` +
      `> ${getRandom(['Unmatched. ✨', 'Undeniable. 🌟', 'Fearless. 🔥', 'The moment. 👑'])}`
    )
  },

  async ghost({ reply, pushName, sender }) {
    const name  = pushName || sender
    const score = getPercent()
    await reply(
      `👻 *Ghost Score*\n\n` +
      `👤 ${name}\n\n` +
      `📊 Ghosting Level\n└ *${score}%*\n\n` +
      `> ${score >= 70 ? 'Certified ghost. Nobody can find you. 👻' : score >= 40 ? 'Part-time ghost. Online when convenient. 😐' : 'You reply too fast. Red flag. 🚩'}`
    )
  },

  async toxic({ reply, pushName, sender }) {
    const name = pushName || sender
    const pct  = getPercent()
    await reply(
      `☢️ *Toxicity Level*\n\n` +
      `👤 ${name}\n\n` +
      `📊 Toxic Rating\n└ *${pct}%*\n\n` +
      `> ${pct >= 80 ? 'Maximum toxicity. Get help. ☢️' : pct >= 50 ? 'Moderately toxic. Manageable. 😐' : 'Surprisingly wholesome. 🕊️'}`
    )
  },

  async real({ reply, pushName, sender }) {
    const name = pushName || sender
    await reply(
      `💯 *Realness Check*\n\n` +
      `👤 ${name}\n\n` +
      `📊 Realness\n└ *${getPercent()}%*\n\n` +
      `> ${getRandom(['No cap. 💯', 'Genuinely real. 🙌', 'Authenticity detected. ✅', 'One of a kind. 🌟'])}`
    )
  },

  async sus({ reply, pushName, sender }) {
    const name = pushName || sender
    const pct  = getPercent()
    await reply(
      `🔴 *Sus Meter*\n\n` +
      `👤 ${name}\n\n` +
      `📊 Suspicion\n└ *${pct}%*\n\n` +
      `> ${pct >= 70 ? 'Very sus. 🔴 Emergency meeting called.' : pct >= 40 ? 'Slightly sus. 🟡 Keep an eye on them.' : 'Clear. 🟢 Not sus at all.'}`
    )
  },

  async clout({ reply, pushName, sender }) {
    const name = pushName || sender
    const pct  = getPercent()
    await reply(
      `📊 *Clout Report*\n\n` +
      `👤 ${name}\n\n` +
      `📈 Clout Level\n└ *${pct}%*\n\n` +
      `> ${pct >= 80 ? "Mega clout. Don't let it go to your head. 👑" : pct >= 50 ? 'Mid-tier clout. Work harder. 📈' : 'Zero clout. Grind more. 💀'}`
    )
  },

  // ── New commands from spec ──────────────────────────────────────────────

  async hornycheck({ reply, pushName, sender, args, msg }) {
    const ctxName = msg?.message?.extendedTextMessage?.contextInfo?.pushName
    const name = ctxName || (args.length ? args.join(' ') : (pushName || sender))
    const pct  = getPercent()
    await reply(
      `🔥 *Horny Meter*\n\n` +
      `👤 ${name}\n\n` +
      `📊 Result\n└ *${pct}%*\n\n` +
      `😂 ${pct >= 80 ? 'Touch grass immediately 🌿' : pct >= 50 ? 'Manageable… barely 😅' : 'Surprisingly tame 🕊️'}`
    )
  },

  async simp({ reply, pushName, sender, args, msg }) {
    const ctxName = msg?.message?.extendedTextMessage?.contextInfo?.pushName
    const name = ctxName || (args.length ? args.join(' ') : (pushName || sender))
    const pct  = getPercent()
    await reply(
      `💘 *Simp Analysis*\n\n` +
      `👤 ${name}\n\n` +
      `📊 Simp Level\n└ *${pct}%*\n\n` +
      `😂 ${pct >= 80 ? 'Certified simp. No saving you. 💀' : pct >= 50 ? 'Mid simp behaviour. Recoverable. 😐' : 'Not a simp. Based. 💪'}`
    )
  },

  async pickupline({ reply }) {
    const lines = [
      "Are you a magnet? Because I'm attracted to you.",
      "Do you have a map? I keep getting lost in your eyes.",
      "Is your name Google? Because you've got everything I'm searching for.",
      "Are you WiFi? Because I'm feeling a connection.",
      "Do you believe in love at first text? Because… hi.",
      "Are you a parking ticket? Because you've got fine written all over you.",
      "Is your dad a baker? Because you're a cutie pie.",
      "Are you a camera? Because every time I look at you, I smile.",
      "Do you have a Band-Aid? Because I just scraped my knee falling for you.",
      "Are you from Japan? Because I'm tryna get in Ja-pants.",
    ]
    const line = lines[Math.floor(Math.random() * lines.length)]
    await reply(`😘 *"${line}"*`)
  },

  async relationship({ reply, pushName, sender, args, msg }) {
    const ctxName = msg?.message?.extendedTextMessage?.contextInfo?.pushName
    const name = ctxName || (args.length ? args.join(' ') : (pushName || sender))
    const pct  = getPercent()
    await reply(
      `💞 *Relationship Status*\n\n` +
      `👤 ${name}\n\n` +
      `❤️ Compatibility\n└ *${pct}%*\n\n` +
      `💬 ${pct >= 80 ? 'Soulmate material 💍' : pct >= 50 ? 'Could work with effort 🤝' : 'Stay single for now 💀'}`
    )
  },

  async match({ reply, pushName, sender, args, msg }) {
    const ctxName = msg?.message?.extendedTextMessage?.contextInfo?.pushName
    const other   = ctxName || (args.length ? args.join(' ') : 'Someone Special')
    const pct     = getPercent()
    const me      = pushName || sender
    await reply(
      `💘 *Match Found*\n\n` +
      `👥 ${me} × ${other}\n\n` +
      `❤️ Match Rate\n└ *${pct}%*\n\n` +
      `💬 ${pct >= 80 ? 'This is it. 💍' : pct >= 50 ? 'There\'s potential. 🌹' : 'Keep looking. 💀'}`
    )
  },

  async kiss({ reply, pushName, sender, args, msg }) {
    const ctxName = msg?.message?.extendedTextMessage?.contextInfo?.pushName
    const target  = ctxName || (args.length ? args.join(' ') : null)
    if (!target) return reply('⚠️ Tag or quote someone to kiss!')
    const me = pushName || sender
    await reply(`😘 *${me} kissed ${target}*\n\n💞 Cute!`)
  },

  async hug({ reply, pushName, sender, args, msg }) {
    const ctxName = msg?.message?.extendedTextMessage?.contextInfo?.pushName
    const target  = ctxName || (args.length ? args.join(' ') : null)
    if (!target) return reply('⚠️ Tag or quote someone to hug!')
    const me = pushName || sender
    await reply(`🤗 *${me} hugged ${target}*\n\n💖 Friendship +100`)
  },

  async cuddle({ reply, pushName, sender, args, msg }) {
    const ctxName = msg?.message?.extendedTextMessage?.contextInfo?.pushName
    const target  = ctxName || (args.length ? args.join(' ') : null)
    if (!target) return reply('⚠️ Tag or quote someone to cuddle!')
    const me = pushName || sender
    await reply(`🧸 *${me} cuddled ${target}*\n\n✨ Cozy vibes.`)
  },

  async slap({ reply, pushName, sender, args, msg }) {
    const ctxName = msg?.message?.extendedTextMessage?.contextInfo?.pushName
    const target  = ctxName || (args.length ? args.join(' ') : null)
    if (!target) return reply('⚠️ Tag or quote someone to slap!')
    const me = pushName || sender
    await reply(`👋 *${me} slapped ${target}*\n\n😂 Ouch.`)
  },

  async waifu({ reply }) {
    const waifus = [
      { name: 'Zero Two', rating: 10, series: 'Darling in the FranXX' },
      { name: 'Rem', rating: 10, series: 'Re:Zero' },
      { name: 'Megumin', rating: 10, series: 'Konosuba' },
      { name: 'Aqua', rating: 8, series: 'Konosuba' },
      { name: 'Asuna', rating: 9, series: 'Sword Art Online' },
      { name: 'Mikasa', rating: 10, series: 'Attack on Titan' },
      { name: 'Hinata', rating: 9, series: 'Naruto' },
      { name: 'Nezuko', rating: 10, series: 'Demon Slayer' },
      { name: 'Tohru', rating: 9, series: 'Dragon Maid' },
      { name: 'Darkness', rating: 8, series: 'Konosuba' },
    ]
    const w = waifus[Math.floor(Math.random() * waifus.length)]
    await reply(
      `💖 *Today\'s Waifu*\n\n` +
      `🌸 ${w.name}\n` +
      `📺 ${w.series}\n\n` +
      `⭐ Rating\n└ ${w.rating}/10`
    )
  },

  async husbando({ reply }) {
    const husbandos = [
      { name: 'Levi Ackerman', rating: 10, series: 'Attack on Titan' },
      { name: 'Gojo Satoru', rating: 10, series: 'Jujutsu Kaisen' },
      { name: 'Zenitsu', rating: 8, series: 'Demon Slayer' },
      { name: 'Kazuma', rating: 8, series: 'Konosuba' },
      { name: 'Itachi', rating: 10, series: 'Naruto' },
      { name: 'Spike Spiegel', rating: 9, series: 'Cowboy Bebop' },
      { name: 'Zoro', rating: 10, series: 'One Piece' },
      { name: 'Saitama', rating: 9, series: 'One Punch Man' },
      { name: 'Edward Elric', rating: 9, series: 'Fullmetal Alchemist' },
      { name: 'Gilgamesh', rating: 8, series: 'Fate' },
    ]
    const h = husbandos[Math.floor(Math.random() * husbandos.length)]
    await reply(
      `💙 *Today\'s Husbando*\n\n` +
      `🌟 ${h.name}\n` +
      `📺 ${h.series}\n\n` +
      `⭐ Rating\n└ ${h.rating}/10`
    )
  },

  async confess({ reply, args }) {
    const msg = args.join(' ')
    if (!msg) return reply('⚠️ Usage: .confess <your message>')
    const id = Math.floor(Math.random() * 90000) + 10000
    await reply(
      `💌 *Anonymous Confession Sent*\n\n` +
      `🆔 Confession ID\n└ #${id}\n\n` +
      `_Your identity is hidden. 🖤_`
    )
  },
}
