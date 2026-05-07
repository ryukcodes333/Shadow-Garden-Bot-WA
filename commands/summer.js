const db = require('../database')

const SUMMER_EVENTS = [
  { name: 'Beach Party', reward: 50, description: 'You attended a beach party!' },
  { name: 'Sandcastle Contest', reward: 75, description: 'Built an epic sandcastle!' },
  { name: 'Surfing Wave', reward: 100, description: 'Caught a perfect wave!' },
  { name: 'BBQ Cookout', reward: 60, description: 'Grilled the best burgers!' },
  { name: 'Volleyball Match', reward: 80, description: 'Won the volleyball tournament!' },
  { name: 'Treasure Hunt', reward: 150, description: 'Found buried summer treasure!' },
  { name: 'Sunset Race', reward: 120, description: 'Raced against the sunset!' },
]

const SUMMER_SHOP = {
  sunscreen: { name: '☀️ Sunscreen', price: 50, description: '+50% token earning' },
  surfboard: { name: '🏄 Surfboard', price: 200, description: 'Surf events reward 2x' },
  umbrella: { name: '☂️ Beach Umbrella', price: 100, description: 'Protection for all events' },
  icecream: { name: '🍦 Ice Cream', price: 30, description: 'Instant 30 tokens' },
  sunglasses: { name: '🕶️ Sunglasses', price: 150, description: 'Look cool, earn more' },
}

async function getTokens(phone) {
  const data = await db.getSummerTokens(phone)
  return data?.tokens || 0
}

async function addTokens(phone, amount) {
  const current = await getTokens(phone)
  await db.setSummerTokens(phone, current + amount)
  return current + amount
}

module.exports = {
  async summer({ reply, sender }) {
    const tokens = await getTokens(sender)
    await reply(`☀️ *SUMMER FESTIVAL*\n\n👤 *Player:* ${sender}\n\n🌊 *Summer Tokens:* ${tokens} 🎫\n\n━━━━━━━━━━━━━━━\n\n🎮 *Available Commands:*\n🌊 *.swim* — Dive into the sea\n🏄 *.surf* — Catch a wave\n🏖️ *.beachvolley* — Play volleyball\n☀️ *.sunbathe* — Relax and earn\n🍦 *.icecream* — Grab a treat\n🎡 *.carnival* — Play carnival games\n🏰 *.sandcastle* — Build a castle\n🎫 *.summertoken* — Check tokens\n🏆 *.summerlb* — Leaderboard\n🛍️ *.summershop* — Token shop\n\n_The summer awaits… dive in._ 🖤`)
  },

  async summertoken({ reply, sender }) {
    const tokens = await getTokens(sender)
    await reply(`🎫 *SUMMER TOKENS*\n\n👤 *Player:* ${sender}\n\n🌟 *Tokens:* ${tokens} 🎫\n\n💡 Earn more with:\n• .swim • .surf • .beachvolley\n• .sunbathe • .sandcastle\n\n_Collect them all before summer ends._ 🖤`)
  },

  async swim({ reply, sender }) {
    const remaining = await db.getCooldown(sender, 'swim')
    if (remaining > 0) {
      const mins = Math.floor(remaining / 60000)
      return reply(`⏳ You're too tired to swim again!\n\nWait ${mins}m before swimming.\n\n_Rest is part of the journey._ 🖤`)
    }
    const event = SUMMER_EVENTS[Math.floor(Math.random() * SUMMER_EVENTS.length)]
    const bonus = Math.random() < 0.2 ? 20 : 0
    const total = event.reward + bonus
    const newTotal = await addTokens(sender, total)
    await db.setCooldown(sender, 'swim', 30 * 60)
    await reply(`🏊 *SWIMMING*\n\n${event.description}\n\n🌊 You dove into the summer sea!\n\n━━━━━━━━━━━━━━━\n\n🎫 *Tokens Earned:* +${total}\n${bonus > 0 ? '🍀 Lucky bonus: +20 tokens!' : ''}\n📊 *Total Tokens:* ${newTotal} 🎫\n\n⏳ Cooldown: 30 minutes\n\n_The sea rewards the brave._ 🖤`)
  },

  async surf({ reply, sender }) {
    const remaining = await db.getCooldown(sender, 'surf')
    if (remaining > 0) return reply(`⏳ Wait ${Math.floor(remaining / 60000)}m to surf again.`)
    const success = Math.random() > 0.3
    const tokens = success ? Math.floor(Math.random() * 80) + 50 : Math.floor(Math.random() * 20) + 5
    const newTotal = await addTokens(sender, tokens)
    await db.setCooldown(sender, 'surf', 45 * 60)
    await reply(`🏄 *SURFING*\n\n${success ? '🌊 You caught the perfect wave! Epic ride!' : '💦 You wiped out but had fun!'}\n\n🎫 *Tokens:* +${tokens}\n📊 *Total:* ${newTotal} 🎫\n\n_The wave picks its rider._ 🖤`)
  },

  async beachvolley({ reply, sender }) {
    const remaining = await db.getCooldown(sender, 'beachvolley')
    if (remaining > 0) return reply(`⏳ Wait ${Math.floor(remaining / 60000)}m for next match.`)
    const win = Math.random() > 0.5
    const tokens = win ? Math.floor(Math.random() * 60) + 40 : Math.floor(Math.random() * 20) + 10
    const newTotal = await addTokens(sender, tokens)
    await db.setCooldown(sender, 'beachvolley', 30 * 60)
    await reply(`🏐 *BEACH VOLLEYBALL*\n\n${win ? '🏆 Your team won the match!' : '😤 You lost, but played great!'}\n\n🎫 *Tokens:* +${tokens}\n📊 *Total:* ${newTotal} 🎫\n\n_Sand and sun — the summer battlefield._ 🖤`)
  },

  async sunbathe({ reply, sender }) {
    const remaining = await db.getCooldown(sender, 'sunbathe')
    if (remaining > 0) return reply(`⏳ Still relaxing! Wait ${Math.floor(remaining / 60000)}m.`)
    const tokens = Math.floor(Math.random() * 30) + 20
    const newTotal = await addTokens(sender, tokens)
    await db.setCooldown(sender, 'sunbathe', 20 * 60)
    await reply(`☀️ *SUNBATHING*\n\n😎 You relaxed under the summer sun…\n\n🎫 *Tokens:* +${tokens}\n📊 *Total:* ${newTotal} 🎫\n\n_Rest fuels the spirit._ 🖤`)
  },

  async icecream({ reply, sender }) {
    const remaining = await db.getCooldown(sender, 'icecream')
    if (remaining > 0) return reply(`⏳ No ice cream yet! Wait ${Math.floor(remaining / 60000)}m.`)
    const flavors = ['Vanilla', 'Chocolate', 'Strawberry', 'Mango', 'Shadow Black']
    const flavor = flavors[Math.floor(Math.random() * flavors.length)]
    const tokens = 30
    const newTotal = await addTokens(sender, tokens)
    await db.setCooldown(sender, 'icecream', 15 * 60)
    await reply(`🍦 *ICE CREAM*\n\n🍦 You got a *${flavor}* ice cream!\n\n🎫 *Tokens:* +${tokens}\n📊 *Total:* ${newTotal} 🎫\n\n_Sweet like the summer._ 🖤`)
  },

  async carnival({ reply, sender }) {
    const remaining = await db.getCooldown(sender, 'carnival')
    if (remaining > 0) return reply(`⏳ Carnival closes in ${Math.floor(remaining / 60000)}m!`)
    const games = ['Ring Toss', 'Duck Pond', 'Whack-a-Mole', 'Shooting Gallery', 'Balloon Darts']
    const game = games[Math.floor(Math.random() * games.length)]
    const win = Math.random() > 0.4
    const tokens = win ? Math.floor(Math.random() * 70) + 30 : Math.floor(Math.random() * 15) + 5
    const newTotal = await addTokens(sender, tokens)
    await db.setCooldown(sender, 'carnival', 25 * 60)
    await reply(`🎡 *CARNIVAL*\n\n🎠 You played *${game}*!\n${win ? '🏆 You won a prize!' : '😅 Better luck next game!'}\n\n🎫 *Tokens:* +${tokens}\n📊 *Total:* ${newTotal} 🎫\n\n_The carnival hides secrets._ 🖤`)
  },

  async sandcastle({ reply, sender }) {
    const remaining = await db.getCooldown(sender, 'sandcastle')
    if (remaining > 0) return reply(`⏳ Sand is still drying! Wait ${Math.floor(remaining / 60000)}m.`)
    const sizes = ['Tiny', 'Medium', 'Large', 'Massive', 'Epic']
    const size = sizes[Math.floor(Math.random() * sizes.length)]
    const tokens = sizes.indexOf(size) * 20 + 30
    const newTotal = await addTokens(sender, tokens)
    await db.setCooldown(sender, 'sandcastle', 40 * 60)
    await reply(`🏰 *SANDCASTLE BUILT*\n\n🏖️ You built a *${size} Sandcastle*!\n\n🎫 *Tokens:* +${tokens}\n📊 *Total:* ${newTotal} 🎫\n\n_Art rises even from sand._ 🖤`)
  },

  async summerlb({ reply }) {
    const lb = await db.getSummerLeaderboard(10)
    if (!lb.length) return reply('📊 No summer data yet. Start playing!')
    const list = lb.map((u, i) => `${i + 1}. ${u.phone} — ${u.tokens} 🎫`).join('\n')
    await reply(`🏆 *SUMMER LEADERBOARD*\n\n${list}\n\n_The summer crowns its champions._ 🖤`)
  },

  async summershop({ reply, sender, args, user }) {
    const action = args[0]?.toLowerCase()
    const itemKey = args[1]?.toLowerCase()
    if (!action || action === 'list') {
      const items = Object.entries(SUMMER_SHOP).map(([k, v]) => `• *.summershop buy ${k}* — ${v.name} (${v.price} 🎫)\n  ${v.description}`).join('\n')
      return reply(`🛍️ *SUMMER SHOP*\n\n${items}\n\n💡 Use *.summershop buy <item>* to purchase.\n\n_Spend wisely under the sun._ 🖤`)
    }
    if (action === 'buy') {
      if (!itemKey || !SUMMER_SHOP[itemKey]) return reply('❌ Item not found. Use *.summershop* to see items.')
      const item = SUMMER_SHOP[itemKey]
      const tokens = await getTokens(sender)
      if (tokens < item.price) return reply(`❌ Not enough tokens! You have ${tokens} 🎫, need ${item.price} 🎫.`)
      await addTokens(sender, -item.price)
      await reply(`✅ *PURCHASED*\n\n${item.name}\n${item.description}\n\n🎫 Spent: ${item.price} tokens\n📊 Remaining: ${tokens - item.price} 🎫\n\n_The summer rewards the wise shopper._ 🖤`)
    }
  },
}
