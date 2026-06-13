const db   = require('../database')
const fs   = require('fs')
const path = require('path')

const BANK_CARD_IMG    = path.join(__dirname, '../assets/bankcard.png')
const TXN_APPROVED_IMG = path.join(__dirname, '../assets/txnapproved.jpg')
const DIG_IMG          = path.join(__dirname, '../assets/coin.png')
const FISH_IMG         = path.join(__dirname, '../assets/fish.png')

// ── Economy constants ──────────────────────────────────────────────────────
// Daily: small guaranteed reward, tier-scaled by streak
const DAILY_COINS = [50, 75, 100, 125, 150]   // was [20,23,26,30,35]
const DAILY_GEMS  = [1, 1, 1, 2, 2]
const DAILY_XP    = 10                          // was 21 — reduced significantly

// XP formula: xpForLevel(level) = level * 300
// Gives: Lv1→2: 300xp | Lv5→6: 1500xp | Lv10→11: 3000xp | Lv20→21: 6000xp
function xpForLevel(level) {
  return Math.max(1, level) * 300
}

// ── Shop items (money sinks) ───────────────────────────────────────────────
const SHOP_ITEMS  = {
  sword:      { name: 'Sword',           price: 1200,  type: 'weapon',    emoji: '⚔️' },
  shield:     { name: 'Shield',          price: 1000,  type: 'weapon',    emoji: '🛡️' },
  bow:        { name: 'Bow',             price: 850,   type: 'weapon',    emoji: '🏹' },
  dagger:     { name: 'Dagger',          price: 700,   type: 'weapon',    emoji: '🗡️' },
  axe:        { name: 'Battle Axe',      price: 1600,  type: 'weapon',    emoji: '🪓' },
  staff_wep:  { name: 'Magic Staff',     price: 1800,  type: 'weapon',    emoji: '🪄' },
  spear:      { name: 'Spear',           price: 1400,  type: 'weapon',    emoji: '🔱' },
  armor:      { name: 'Iron Armor',      price: 2000,  type: 'armor',     emoji: '🥋' },
  helmet:     { name: 'Steel Helmet',    price: 1100,  type: 'armor',     emoji: '⛑️' },
  boots:      { name: 'Shadow Boots',    price: 900,   type: 'armor',     emoji: '👟' },
  potion:     { name: 'Health Potion',   price: 250,   type: 'consumable', emoji: '🧪' },
  elixir:     { name: 'Mana Elixir',     price: 300,   type: 'consumable', emoji: '💙' },
  energy:     { name: 'Energy Drink',    price: 200,   type: 'consumable', emoji: '⚡' },
  antidote:   { name: 'Antidote',        price: 220,   type: 'consumable', emoji: '💊' },
  bomb:       { name: 'Shadow Bomb',     price: 500,   type: 'consumable', emoji: '💣' },
  ticket:     { name: 'Luck Ticket',     price: 400,   type: 'tool',      emoji: '🎟️' },
  pickaxe:    { name: 'Pickaxe',         price: 700,   type: 'tool',      emoji: '⛏️' },
  fishingrod: { name: 'Fishing Rod',     price: 550,   type: 'tool',      emoji: '🎣' },
  map:        { name: 'Treasure Map',    price: 1200,  type: 'tool',      emoji: '🗺️' },
  lantern:    { name: 'Shadow Lantern',  price: 450,   type: 'tool',      emoji: '🏮' },
  ring:       { name: 'Power Ring',      price: 2400,  type: 'accessory', emoji: '💍' },
  amulet:     { name: 'Mana Amulet',     price: 2200,  type: 'accessory', emoji: '📿' },
  cloak:      { name: 'Shadow Cloak',    price: 3000,  type: 'accessory', emoji: '🧣' },
  bank_note:      { name: 'Bank Note',         price: 10000,  type: 'banking', emoji: '💵' },
  bank_note_100k: { name: 'Bank Note (100K)',  price: 50000,  type: 'banking', emoji: '💴' },
  bank_note_500k: { name: 'Bank Note (500K)',  price: 100000, type: 'banking', emoji: '💶' },
  bank_note_1m:   { name: 'Bank Note (1M)',    price: 500000, type: 'banking', emoji: '💷' },
}

// ── Cooldowns (in seconds) ─────────────────────────────────────────────────
const CD_DAILY  = 24 * 3600
const CD_WORK   = 20 * 60
const CD_FISH   =  2 * 60
const CD_DIG    =  2 * 60
const CD_BEG    = 5  * 60
const CD_CRIME  = 15 * 60
const CD_ROB    = 30 * 60
const CD_HEIST  = 90 * 60
const CD_BONUS  = 4  * 3600

// ── Pending .pay confirmations ─────────────────────────────────────────────
const pendingPay = {}

// ── Helpers ────────────────────────────────────────────────────────────────
async function checkCooldown(sender, cmd, reply) {
  const remaining = await db.getCooldown(sender, cmd)
  if (remaining > 0) {
    const hrs  = Math.floor(remaining / 3600000)
    const mins = Math.floor((remaining % 3600000) / 60000)
    const secs = Math.floor((remaining % 60000) / 1000)
    const parts = []
    if (hrs > 0)  parts.push(`${hrs}h`)
    if (mins > 0) parts.push(`${mins}m`)
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)
    await reply(`⏳ You are on cooldown for *${parts.join(' ')}*.`)
    return true
  }
  return false
}

// Apply XP and level-up, returns { xpAdded, newLevel, leveledUp }
async function applyXP(sender, currentUser, xpAdd) {
  try {
    const u      = currentUser || await db.getOrCreateUser(sender)
    const oldLvl = u.level || 1
    const rawXp  = (u.xp || 0) + xpAdd
    const needed = xpForLevel(oldLvl)
    if (rawXp >= needed) {
      const newLvl = oldLvl + 1
      await db.updateUser(sender, { xp: rawXp - needed, level: newLvl })
      console.log(`[economy] XP: ${sender} leveled up ${oldLvl} → ${newLvl}`)
      return { xpAdded: xpAdd, newLevel: newLvl, leveledUp: true, oldLevel: oldLvl }
    }
    await db.updateUser(sender, { xp: rawXp })
    return { xpAdded: xpAdd, newLevel: oldLvl, leveledUp: false, oldLevel: oldLvl }
  } catch (err) {
    console.error('[economy] applyXP error:', err.message)
    return { xpAdded: 0, newLevel: 1, leveledUp: false, oldLevel: 1 }
  }
}

module.exports = {
  async bal({ sock, msg, jid, reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const total = (u.wallet || 0) + (u.bank || 0)
    const caption =
      `💰 𝗔𝗖𝗖𝗢𝗨𝗡𝗧 𝗕𝗔𝗟𝗔𝗡𝗖𝗘 💰\n\n` +
      `🏦 𝗕𝗮𝗻𝗸: \`\`\`${(u.bank || 0).toLocaleString()}\`\`\`\n` +
      `👛 𝗪𝗮𝗹𝗹𝗲𝘁: \`\`\`${(u.wallet || 0).toLocaleString()}\`\`\`\n\n` +
      `💫 𝗧𝗼𝘁𝗮𝗹: \`\`\`${total.toLocaleString()}\`\`\`\n\n` +
      `> Buy a *💵 Bank Note* to increase your bank capacity.`
    try {
      const imgBuf = fs.readFileSync(BANK_CARD_IMG)
      await sock.sendMessage(jid, { image: imgBuf, caption, mentions: [`${sender}@s.whatsapp.net`] }, { quoted: msg })
    } catch {
      await sock.sendMessage(jid, { text: caption, mentions: [`${sender}@s.whatsapp.net`] }, { quoted: msg })
    }
  },
  async balance(ctx) { return module.exports.bal(ctx) },
  async wallet(ctx)  { return module.exports.bal(ctx) },

  async bankbal({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    await reply(`🏦 *Bank Balance*\n\n\`\`\`\n🏦 Bank  : £${(u.bank||0).toLocaleString()}\n💵 Wallet: £${(u.wallet||0).toLocaleString()}\n\`\`\``)
  },

  async gems({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    await reply(`💎 *${u.name || sender}'s Gems*\n\n${u.gems || 0} 💎`)
  },

  // ── .daily ───────────────────────────────────────────────────────────────
  async daily({ reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    const cooldown = await db.getCooldown(sender, 'daily')
    if (cooldown > 0) {
      const hrs  = Math.floor(cooldown / 3600000)
      const mins = Math.floor((cooldown % 3600000) / 60000)
      return reply(`⏳ You are on cooldown for *${hrs}h ${mins}m*.`)
    }
    const tier      = Math.min(Math.floor((u.streak || 0) / 7), DAILY_COINS.length - 1)
    const coins     = DAILY_COINS[tier]
    const gems      = DAILY_GEMS[tier]
    const newStreak = (u.streak || 0) + 1
    await db.updateUser(sender, {
      wallet: (u.wallet || 0) + coins,
      gems:   (u.gems   || 0) + gems,
      streak: newStreak,
      last_daily: new Date().toISOString(),
    })
    const xpResult = await applyXP(sender, null, DAILY_XP)
    await db.setCooldown(sender, 'daily', CD_DAILY)
    console.log(`[economy] daily: ${sender} +£${coins} +${DAILY_XP}XP streak=${newStreak}`)
    await db.trackCurrencyGenerated(coins)
    await reply(
      `🌟 *Daily Reward Claimed!*\n\n` +
      `💰 +£${coins}\n` +
      `💎 +${gems} gems\n` +
      `⭐ +${DAILY_XP} XP\n` +
      `🔥 Streak: ${newStreak} days\n` +
      (xpResult.leveledUp ? `\n🆙 *LEVEL UP!* ${xpResult.oldLevel} → ${xpResult.newLevel} 🎊\n` : '') +
      `\n_Come back in 24 hours!_`
    )
  },
  async claim(ctx) { return module.exports.daily(ctx) },

  // ── .weekly ──────────────────────────────────────────────────────────────
  // Weekly = 5–7x daily reward
  async weekly({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const remaining = await db.getCooldown(sender, 'weekly')
    if (remaining > 0) {
      const hrs = Math.floor(remaining / 3600000)
      const mins = Math.floor((remaining % 3600000) / 60000)
      return reply(`⏳ You are on cooldown for *${hrs}h ${mins}m*.`)
    }
    const coins = Math.floor(Math.random() * 201) + 350  // 350–550 base, steak adds more
    const weeklyXp = 50
    await db.updateUser(sender, { wallet: (u.wallet || 0) + coins })
    const xpResult = await applyXP(sender, null, weeklyXp)
    await db.setCooldown(sender, 'weekly', 7 * 24 * 3600)
    await db.trackCurrencyGenerated(coins)
    console.log(`[economy] weekly: ${sender} +£${coins} +${weeklyXp}XP`)
    await reply(
      `📅 *Weekly Reward!*\n\n` +
      `💰 +£${coins.toLocaleString()}\n` +
      `⭐ +${weeklyXp} XP\n` +
      (xpResult.leveledUp ? `\n🆙 *LEVEL UP!* ${xpResult.oldLevel} → ${xpResult.newLevel} 🎊\n` : '') +
      `\n_Come back in 7 days!_`
    )
  },

  // ── .monthly ─────────────────────────────────────────────────────────────
  // Monthly = 4–5x weekly reward
  async monthly({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const remaining = await db.getCooldown(sender, 'monthly')
    if (remaining > 0) {
      const days = Math.floor(remaining / 86400000)
      const hrs  = Math.floor((remaining % 86400000) / 3600000)
      return reply(`⏳ You are on cooldown for *${days}d ${hrs}h*.`)
    }
    const coins = Math.floor(Math.random() * 1001) + 1750  // 1750–2750
    const monthlyXp = 200
    await db.updateUser(sender, { wallet: (u.wallet || 0) + coins })
    const xpResult = await applyXP(sender, null, monthlyXp)
    await db.setCooldown(sender, 'monthly', 30 * 24 * 3600)
    await db.trackCurrencyGenerated(coins)
    console.log(`[economy] monthly: ${sender} +£${coins} +${monthlyXp}XP`)
    await reply(
      `🗓️ *Monthly Reward!*\n\n` +
      `💰 +£${coins.toLocaleString()}\n` +
      `⭐ +${monthlyXp} XP\n` +
      (xpResult.leveledUp ? `\n🆙 *LEVEL UP!* ${xpResult.oldLevel} → ${xpResult.newLevel} 🎊\n` : '') +
      `\n_Come back in 30 days!_`
    )
  },

  // ── .work ────────────────────────────────────────────────────────────────
  // Low-medium income, reliable source
  async work({ reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    if (await checkCooldown(sender, 'work', reply)) return
    const jobs   = ['hacked a server', 'sold rare items', 'completed a bounty', 'trained disciples', 'patrolled the shadows', 'decoded encrypted files', 'delivered a package', 'repaired shadow gear', 'escorted a merchant', 'decrypted intel files']
    const job    = jobs[Math.floor(Math.random() * jobs.length)]
    const earned = Math.floor(Math.random() * 31) + 15   // 15–45 coins
    const workXp = Math.floor(Math.random() * 4) + 5     // 5–8 XP
    await db.updateUser(sender, { wallet: (u.wallet || 0) + earned })
    const xpResult = await applyXP(sender, null, workXp)
    await db.setCooldown(sender, 'work', CD_WORK)
    await db.trackCurrencyGenerated(earned)
    console.log(`[economy] work: ${sender} +£${earned} +${workXp}XP`)
    await reply(
      `💼 *Work Complete!*\n\n` +
      `You ${job}\n` +
      `💰 +£${earned}\n` +
      `⭐ +${workXp} XP\n` +
      (xpResult.leveledUp ? `\n🆙 *LEVEL UP!* ${xpResult.oldLevel} → ${xpResult.newLevel} 🎊\n` : '') +
      `\n⏳ Next work in *20 minutes*`
    )
  },

  // ── .dig ─────────────────────────────────────────────────────────────────
  // Main grinding command — tiered rewards
  async dig({ sock, msg, jid, reply, replyImage, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    if (await checkCooldown(sender, 'dig', reply)) return

    const roll   = Math.random()
    let result, earned = 0, gems = 0, digXp = Math.floor(Math.random() * 3) + 2  // 2–4 XP

    if (roll < 0.02) {
      // Legendary (2%): Shadow Crystal
      earned = Math.floor(Math.random() * 1301) + 200  // 200–1500
      gems   = 2
      result = `a *Shadow Crystal* ✨ (legendary find!)`
    } else if (roll < 0.08) {
      // Rare (6%): gem + decent coins
      earned = Math.floor(Math.random() * 41) + 40   // 40–80
      gems   = 1
      result = `a rare gem! 💎 +${earned} coins`
    } else if (roll < 0.25) {
      // Uncommon (17%): decent coins
      earned = Math.floor(Math.random() * 21) + 15   // 15–35
      result = `${earned} coins worth of buried treasure 🪙`
    } else if (roll < 0.55) {
      // Common (30%): small coins
      earned = Math.floor(Math.random() * 11) + 5    // 5–15
      result = `a rusty coin worth £${earned}`
    } else {
      // Nothing (45%)
      result = 'nothing useful 😐'
    }

    if (earned > 0) await db.updateUser(sender, { wallet: (u.wallet || 0) + earned })
    if (gems > 0)   await db.updateUser(sender, { gems: (u.gems || 0) + gems })
    if (earned > 0) await db.trackCurrencyGenerated(earned)
    const xpResult = await applyXP(sender, null, digXp)
    await db.setCooldown(sender, 'dig', CD_DIG)

    let caption = `⛏️ *Digging Result*\n\nYou found: ${result}`
    if (digXp > 0) caption += `\n⭐ +${digXp} XP`
    if (xpResult.leveledUp) caption += `\n🆙 *LEVEL UP!* ${xpResult.oldLevel} → ${xpResult.newLevel} 🎊`
    if (earned === 0 && gems === 0) caption += `\n\n_You did not catch anything this time._`
    await reply(caption)
  },

  // ── .fish ────────────────────────────────────────────────────────────────
  // Main grinding command — tiered catch rates
  async fish({ sock, msg, jid, reply, replyImage, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    if (await checkCooldown(sender, 'fish', reply)) return

    // Weighted catch table: common→frequent, rare→uncommon, legendary→very rare
    const catches = [
      { label: '🐟 Common Fish',     weight: 28, coins: [5, 15]   },
      { label: '🐠 Tropical Fish',   weight: 22, coins: [10, 25]  },
      { label: '🐡 Puffer Fish',     weight: 14, coins: [15, 30]  },
      { label: '🦐 Shrimp',          weight: 12, coins: [8, 18]   },
      { label: '👢 Old Boot',        weight: 10, coins: [0, 0]    },
      { label: '🌿 Seaweed',         weight: 7,  coins: [0, 0]    },
      { label: '🦈 Shark!',          weight: 4,  coins: [50, 100] },
      { label: '💎 Shadow Pearl',    weight: 2,  coins: [120, 200] },
      { label: '🐉 Sea Serpent Egg', weight: 1,  coins: [500, 1500] },
    ]
    const totalWeight = catches.reduce((a, c) => a + c.weight, 0)
    let rand = Math.random() * totalWeight, caught = catches[catches.length - 1]
    for (const c of catches) { rand -= c.weight; if (rand <= 0) { caught = c; break } }

    const coins   = caught.coins[0] + Math.floor(Math.random() * (caught.coins[1] - caught.coins[0] + 1))
    const fishXp  = Math.floor(Math.random() * 3) + 2  // 2–4 XP

    if (coins > 0) {
      await db.updateUser(sender, { wallet: (u.wallet || 0) + coins })
      await db.trackCurrencyGenerated(coins)
    }
    const xpResult = await applyXP(sender, null, fishXp)
    await db.setCooldown(sender, 'fish', CD_FISH)

    let caption = `🎣 *Fishing Result*\n\nCaught: *${caught.label}*`
    if (coins > 0) caption += `\n💰 +£${coins} Eris`
    else caption += `\n\n_You did not catch anything this time._`
    caption += `\n⭐ +${fishXp} XP`
    if (xpResult.leveledUp) caption += `\n🆙 *LEVEL UP!* ${xpResult.oldLevel} → ${xpResult.newLevel} 🎊`
    await reply(caption)
  },

  // ── .beg ─────────────────────────────────────────────────────────────────
  async beg({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    if (await checkCooldown(sender, 'beg', reply)) return
    const success = Math.random() < 0.5
    const coins   = success ? Math.floor(Math.random() * 1499) + 2 : 0
    if (success) {
      await db.updateUser(sender, { wallet: (u.wallet || 0) + coins })
      await db.trackCurrencyGenerated(coins)
    }
    await db.setCooldown(sender, 'beg', CD_BEG)
    await reply(success ? `🙏 Someone felt generous — *+£${coins}*` : `🚶 Nobody stopped to help.`)
  },

  // ── .crime ───────────────────────────────────────────────────────────────
  // 40% success, negative expected value due to fines, 15min CD
  async crime({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const remaining = await db.getCooldown(sender, 'crime')
    if (remaining > 0) {
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      return reply(`⏳ You are on cooldown for *${mins}m ${secs}s*.`)
    }

    const success = Math.random() < 0.40  // 40% success rate
    await db.setCooldown(sender, 'crime', CD_CRIME)

    if (success) {
      const gain   = Math.floor(Math.random() * 41) + 40  // 40–80 coins
      const crimeXp = Math.floor(Math.random() * 4) + 3   // 3–6 XP
      await db.updateUser(sender, { wallet: (u.wallet || 0) + gain })
      await db.trackCurrencyGenerated(gain)
      const xpResult = await applyXP(sender, null, crimeXp)
      const acts = ['robbed a merchant', 'pickpocketed a noble', 'hacked a guild vault', 'stole a shipment', 'conned a trader', 'looted an abandoned estate']
      await reply(
        `🦹 *Crime Successful!*\n\n` +
        `You ${acts[Math.floor(Math.random() * acts.length)]}.\n` +
        `💰 +£${gain}\n` +
        `⭐ +${crimeXp} XP` +
        (xpResult.leveledUp ? `\n🆙 *LEVEL UP!* ${xpResult.oldLevel} → ${xpResult.newLevel} 🎊` : '')
      )
    } else {
      const fine = Math.min(Math.floor(Math.random() * 31) + 20, u.wallet || 0)  // 20–50 coins fine
      await db.updateUser(sender, { wallet: Math.max(0, (u.wallet || 0) - fine) })
      await db.trackCurrencyRemoved(fine)
      await reply(`👮 *Caught!*\n\nYou were caught and fined *£${fine}*. Better luck next time.`)
    }
  },

  // ── .rob ─────────────────────────────────────────────────────────────────
  // Only steal 3–8% wallet. Never destroy player progress.
  // 40% success rate. Failure results in fine. 30min cooldown.
  async rob({ sock, msg, jid, reply, sender, user, args }) {
    // Accept a @mention OR a quoted message as the target
    const mentioned          = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const quotedParticipant  = msg.message?.extendedTextMessage?.contextInfo?.participant
    let target, tp
    if (mentioned.length) {
      target = mentioned[0]
      tp     = target.split('@')[0].split(':')[0]
    } else if (quotedParticipant) {
      target = quotedParticipant
      tp     = quotedParticipant.split('@')[0].split(':')[0]
    } else {
      return reply('⚠️ Mention or *quote* a user to rob them.')
    }

    // ── Resolve @lid to real phone number ────────────────────────────────────
    // WhatsApp sends @lid JIDs for some participants. Resolve to real @s.whatsapp.net
    // so DB lookups and message mentions use the actual phone number.
    const isGroup = jid?.endsWith('@g.us')
    if (target.endsWith('@lid') && isGroup) {
      try {
        const meta    = await sock.groupMetadata(jid).catch(() => null)
        const matched = (meta?.participants || []).find(p => p.lid === target || p.id === target)
        if (matched?.id && matched.id.endsWith('@s.whatsapp.net')) {
          target = matched.id
          tp     = matched.id.split('@')[0]
        }
      } catch {}
    }

    const u = user || await db.getOrCreateUser(sender)
    const remaining = await db.getCooldown(sender, 'rob')
    if (remaining > 0) {
      const mins = Math.floor(remaining / 60000)
      return reply(`⏳ You are on cooldown for *${mins}m*.`)
    }

    if (tp === sender) return reply("🪞 You can't rob yourself.")

    const tu = await db.getOrCreateUser(tp)
    const targetWallet = tu.wallet || 0

    // Minimum $200 to be robbed (protects early players)
    if (targetWallet < 200) return reply(`🪙 Target has nothing worth stealing. (Need £200+ in wallet)`)

    const success = Math.random() < 0.40  // 40% success
    await db.setCooldown(sender, 'rob', CD_ROB)

    // Build a proper @s.whatsapp.net JID for mentions (never pass a @lid to mentions)
    const mentionJid = target.endsWith('@s.whatsapp.net') ? target : `${tp}@s.whatsapp.net`

    if (success) {
      // Steal only 3–8% of wallet (never destroys progress)
      const pct    = 0.03 + Math.random() * 0.05
      const stolen = Math.max(1, Math.floor(targetWallet * pct))
      await db.updateUser(tp,     { wallet: (tu.wallet || 0) - stolen })
      await db.updateUser(sender, { wallet: (u.wallet  || 0) + stolen })
      console.log(`[economy] rob: ${sender} stole £${stolen} (${(pct*100).toFixed(1)}%) from ${tp}`)
      await sock.sendMessage(jid, {
        text: `🦹 *Rob Successful!*\n\nYou stole *£${stolen.toLocaleString()}* from @${tp}!\n_(${(pct*100).toFixed(1)}% of their wallet)_`,
        mentions: [mentionJid],
      }, { quoted: msg })
    } else {
      const fine = Math.min(Math.floor(Math.random() * 101) + 100, u.wallet || 0)  // 100–200 fine
      await db.updateUser(sender, { wallet: Math.max(0, (u.wallet || 0) - fine) })
      await db.trackCurrencyRemoved(fine)
      await sock.sendMessage(jid, {
        text: `👮 *Your robbery attempt failed.*\n\nYou failed to rob @${tp} and paid a *£${fine}* fine.`,
        mentions: [mentionJid],
      }, { quoted: msg })
    }
  },

  // ── .heist ───────────────────────────────────────────────────────────────
  // 30% success, high reward, 90min cooldown
  // Failure is intentionally common to prevent farming
  async heist({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const remaining = await db.getCooldown(sender, 'heist')
    if (remaining > 0) {
      const mins = Math.floor(remaining / 60000)
      return reply(`⏳ You are on cooldown for *${mins}m*.`)
    }

    const success = Math.random() < 0.30  // 30% success — failure is common
    const reward  = Math.floor(Math.random() * 601) + 600  // 600–1200 coins
    await db.setCooldown(sender, 'heist', CD_HEIST)

    if (success) {
      const heistXp = Math.floor(Math.random() * 16) + 15  // 15–30 XP
      await db.updateUser(sender, { wallet: (u.wallet || 0) + reward })
      await db.trackCurrencyGenerated(reward)
      const xpResult = await applyXP(sender, null, heistXp)
      const targets = ['Shadow Bank vault', 'merchant convoy', 'guild treasury', 'noble estate', 'forbidden archive']
      await reply(
        `💰 *Heist Successful!*\n\n` +
        `Your crew cracked the ${targets[Math.floor(Math.random() * targets.length)]} and got away with *£${reward.toLocaleString()}*!\n` +
        `⭐ +${heistXp} XP` +
        (xpResult.leveledUp ? `\n🆙 *LEVEL UP!* ${xpResult.oldLevel} → ${xpResult.newLevel} 🎊` : '')
      )
    } else {
      // Heist failed — loss is capped to protect player progress
      const maxLoss = Math.floor((u.wallet || 0) * 0.15)  // Never lose more than 15% wallet
      const loss    = Math.min(Math.floor(reward * 0.25), maxLoss, u.wallet || 0)
      await db.updateUser(sender, { wallet: Math.max(0, (u.wallet || 0) - loss) })
      if (loss > 0) await db.trackCurrencyRemoved(loss)
      await reply(
        `🚨 *The heist failed.*\n\n` +
        `The guards caught your crew. You lost *£${loss.toLocaleString()}* in the chaos.\n\n` +
        `_Lay low for 90 minutes before trying again._`
      )
    }
  },

  // ── .bonus ───────────────────────────────────────────────────────────────
  async bonus({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const remaining = await db.getCooldown(sender, 'bonus')
    if (remaining > 0) {
      const hrs  = Math.floor(remaining / 3600000)
      const mins = Math.floor((remaining % 3600000) / 60000)
      return reply(`⏳ You are on cooldown for *${hrs}h ${mins}m*.`)
    }
    const coins = Math.floor(Math.random() * 16) + 10  // 10–25 coins
    await db.updateUser(sender, { wallet: (u.wallet || 0) + coins })
    await db.setCooldown(sender, 'bonus', CD_BONUS)
    await db.trackCurrencyGenerated(coins)
    await reply(`🎁 *Bonus Collected!*\n\n💰 +£${coins}\n\n_Next bonus in 4 hours._`)
  },

  // ── .pay / .donate ────────────────────────────────────────────────────────
  async pay({ sock, msg, jid, reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)

    const ctxInfo           = msg.message?.extendedTextMessage?.contextInfo
    const mentioned         = ctxInfo?.mentionedJid || []
    const quotedParticipant = ctxInfo?.participant

    let targetJid   = null
    let targetPhone = null
    if (mentioned.length) {
      targetJid   = mentioned[0]
      targetPhone = targetJid.split('@')[0].split(':')[0]
    } else if (quotedParticipant) {
      targetJid   = quotedParticipant
      targetPhone = quotedParticipant.split('@')[0].split(':')[0]
    }

    if (!targetPhone) return reply('Please mention a user or quote their message to pay.')
    if (targetPhone === sender) return reply("🪞 You can't send money to yourself.")

    const amount = parseInt(args.find(a => !isNaN(parseInt(a))))
    if (!amount || amount <= 0) return reply('⚠️ Invalid amount provided.')
    if (amount > (u.wallet || 0)) return reply(`💸 Your wallet only has £${(u.wallet || 0).toLocaleString()}`)

    pendingPay[sender] = { toPhone: targetPhone, toJid: targetJid, amount, expiresAt: Date.now() + 60000 }
    setTimeout(() => { if (pendingPay[sender]?.toPhone === targetPhone) delete pendingPay[sender] }, 60000)

    const senderJid = msg.key.participant || msg.key.remoteJid || `${sender}@s.whatsapp.net`
    await sock.sendMessage(jid, {
      text: `⚠️ You are about to transfer £${amount.toLocaleString()} to @${targetPhone}. Kindly reply with *Yes* to continue transaction, or *No* to cancel this transaction`,
      mentions: [senderJid, targetJid],
    }, { quoted: msg })
  },
  async donate(ctx) { return module.exports.pay(ctx) },

  async handlePayConfirm(sender, confirmed, { sock, msg, jid }) {
    const pending = pendingPay[sender]
    if (!pending) return false
    if (Date.now() > pending.expiresAt) {
      delete pendingPay[sender]
      await sock.sendMessage(jid, { text: '⚠️ Payment expired.' }, { quoted: msg })
      return true
    }
    if (!confirmed) {
      delete pendingPay[sender]
      await sock.sendMessage(jid, { text: '⚠️ Payment cancelled.' }, { quoted: msg })
      return true
    }

    const { toPhone, toJid, amount } = pending
    delete pendingPay[sender]

    const u = await db.getOrCreateUser(sender)
    if (amount > (u.wallet || 0)) {
      await sock.sendMessage(jid, { text: `⚠️ Not enough coins. You have £${(u.wallet || 0).toLocaleString()}` }, { quoted: msg })
      return true
    }

    const tu = await db.getOrCreateUser(toPhone)
    await db.updateUser(sender, { wallet: (u.wallet  || 0) - amount })
    await db.updateUser(toPhone, { wallet: (tu.wallet || 0) + amount })

    const senderJid = msg.key.participant || msg.key.remoteJid || `${sender}@s.whatsapp.net`
    const caption =
      `*💸 TRANSACTION APPROVED ✅*\n\n` +
      `*From:* @${sender}\n` +
      `*To:* @${toPhone}\n` +
      `*Amount:* £${amount.toLocaleString()}\n\n` +
      `_Processed by Konosuba Bank_ 🖤`

    const mentions = [senderJid, toJid]
    try {
      const buf = fs.readFileSync(TXN_APPROVED_IMG)
      await sock.sendMessage(jid, { image: buf, caption, mentions }, { quoted: msg })
    } catch {
      await sock.sendMessage(jid, { text: caption, mentions }, { quoted: msg })
    }
    return true
  },

  // ── .withdraw / .deposit ─────────────────────────────────────────────────
  async withdraw({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = args[0]?.toLowerCase() === 'all' ? u.bank : parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: `.withdraw <amount>` or `.withdraw all`')
    if (amount > (u.bank || 0)) return reply(`🏦 You only have £${(u.bank || 0).toLocaleString()}`)
    await db.updateUser(sender, { wallet: (u.wallet || 0) + amount, bank: (u.bank || 0) - amount })
    await reply(`🏧 Withdrew *£${amount.toLocaleString()}* from your bank.\n\n💵 Wallet: £${((u.wallet||0)+amount).toLocaleString()} | 🏦 Bank: £${((u.bank||0)-amount).toLocaleString()}`)
  },
  async wid(ctx) { return module.exports.withdraw(ctx) },

  async withdrawall({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = u.bank || 0
    if (amount <= 0) return reply('🏦 Your bank is empty.')
    await db.updateUser(sender, { wallet: (u.wallet || 0) + amount, bank: 0 })
    await reply(`🏧 Withdrew *£${amount.toLocaleString()}* from your bank.\n\n💵 Wallet: £${((u.wallet||0)+amount).toLocaleString()} | 🏦 Bank: $0`)
  },

  async deposit({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = args[0]?.toLowerCase() === 'all' ? u.wallet : parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: `.deposit <amount>` or `.deposit all`')
    if (amount > (u.wallet || 0)) return reply(`💸 Your wallet only has £${(u.wallet || 0).toLocaleString()}`)
    const bankLimit = u.bank_limit || 50000
    if ((u.bank || 0) + amount > bankLimit) {
      const space = Math.max(0, bankLimit - (u.bank || 0))
      return reply(
        `🏦 Bank full! You can only deposit more once you upgrade.\n\n` +
        `🏦 Bank: £${(u.bank||0).toLocaleString()} / £${bankLimit.toLocaleString()}\n` +
        `📥 Space remaining: £${space.toLocaleString()}\n\n` +
        `💵 Buy a *Bank Note* from *.shop* to increase your limit!`
      )
    }
    await db.updateUser(sender, { wallet: (u.wallet || 0) - amount, bank: (u.bank || 0) + amount })
    await reply(`🎉 Deposited *£${amount.toLocaleString()}* to your bank.\n\n💵 Wallet: £${((u.wallet||0)-amount).toLocaleString()} | 🏦 Bank: £${((u.bank||0)+amount).toLocaleString()}`)
  },
  async dep(ctx) { return module.exports.deposit(ctx) },

  // ── .shop / .market / .buy / .sell / .use / .inv ─────────────────────────
  async market({ reply, sender, user }) {
    const u      = user || await db.getOrCreateUser(sender)
    const byType = {}
    for (const [k, v] of Object.entries(SHOP_ITEMS)) {
      if (!byType[v.type]) byType[v.type] = []
      byType[v.type].push([k, v])
    }
    const typeEmojis = { weapon:'⚔️', armor:'🥋', consumable:'🧪', tool:'🔧', accessory:'💍', banking:'🏦' }
    const typeLabels = { weapon:'Weapons', armor:'Armor', consumable:'Consumables', tool:'Tools', accessory:'Accessories', banking:'Banking' }
    let sections = ''
    for (const [type, entries] of Object.entries(byType)) {
      const lines = entries.map(([k, v]) => `  ${v.emoji} *${v.name}* - £${v.price.toLocaleString()}  \`.buy ${k}\``).join('\n')
      sections += `\n${typeEmojis[type]||'🛒'} *${typeLabels[type]||type}*\n${lines}\n`
    }
    await reply(
      `🏪 *Konosuba Market*\n\n` +
      `💰 Wallet: £${(u.wallet||0).toLocaleString()} | 💎 Gems: ${u.gems||0}\n` +
      `━━━━━━━━━━━━━━━━━━━━` +
      sections +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_Use *.buy <item_key>* to purchase_`
    )
  },
  async shop(ctx) { return module.exports.market(ctx) },

  async buy({ reply, sender, user, args }) {
    const u       = user || await db.getOrCreateUser(sender)
    const itemKey = args[0]?.toLowerCase()
    if (!itemKey) return reply('⚠️ Usage: `.buy <item>` — check `.shop` for items')
    const item    = Object.entries(SHOP_ITEMS).find(([k, v]) => k === itemKey || v.name.toLowerCase() === itemKey)
    if (!item) return reply("📦 That item doesn't exist. Check `.shop`")
    const [, data] = item
    if (data.gems) {
      if ((u.gems || 0) < data.price) return reply(`⚠️ Not enough gems. Need ${data.price} 💎, you have ${u.gems || 0}.`)
      await db.updateUser(sender, { gems: (u.gems || 0) - data.price })
      await db.trackCurrencyRemoved(0)  // gem sink (gem not coin)
    } else {
      if ((u.wallet || 0) < data.price) return reply(`⚠️ Not enough coins. Need £${data.price.toLocaleString()}, you have £${(u.wallet || 0).toLocaleString()}`)
      await db.updateUser(sender, { wallet: (u.wallet || 0) - data.price })
      await db.trackCurrencyRemoved(data.price)
    }
    await db.addItem(sender, data.name)
    await reply(`✅ *Purchased!*\n\n${data.emoji} *${data.name}* added to your inventory.`)
  },

  async inv({ reply, sender, user }) {
    const u     = user || await db.getOrCreateUser(sender)
    const items = await db.getInventory(sender)
    if (!items.length) return reply(`🎒 *${u.name || sender}'s Inventory*\n\n_Your inventory is full. Just kidding — it's empty!_ Visit \`.shop\` to stock up.`)
    await reply(`🎒 *${u.name || sender}'s Inventory*\n\n${items.map(i => `• ${i.item} ×${i.quantity}`).join('\n')}`)
  },
  async bag(ctx) { return module.exports.inv(ctx) },

  async sell({ reply, sender, user, args }) {
    const itemName = args.join(' ')
    if (!itemName) return reply('⚠️ Usage: `.sell <item>`')
    const items    = await db.getInventory(sender)
    const found    = items.find(i => i.item.toLowerCase() === itemName.toLowerCase())
    if (!found) return reply('⚠️ You don\'t own that item.')
    const shopItem  = Object.values(SHOP_ITEMS).find(s => s.name.toLowerCase() === itemName.toLowerCase())
    const sellPrice = shopItem ? Math.floor(shopItem.price * 0.55) : 30  // 55% resale value
    await db.removeItem(sender, found.item)
    const u = user || await db.getOrCreateUser(sender)
    await db.updateUser(sender, { wallet: (u.wallet || 0) + sellPrice })
    await db.trackCurrencyGenerated(sellPrice)
    await reply(`💰 Sold *${found.item}* for £${sellPrice.toLocaleString()}`)
  },

  async use({ reply, sender, args }) {
    const itemName = args.join(' ')
    if (!itemName) return reply('⚠️ Usage: `.use <item>`')
    const items    = await db.getInventory(sender)
    const found    = items.find(i => i.item.toLowerCase() === itemName.toLowerCase())
    if (!found) return reply('⚠️ You don\'t own that item.')
    const bankNoteMap = {
      'bank note':        50000,
      'bank note (100k)': 100000,
      'bank note (500k)': 500000,
      'bank note (1m)':   1000000,
    }
    const itemLower = found.item.toLowerCase()
    if (bankNoteMap[itemLower] !== undefined) {
      const u        = await db.getOrCreateUser(sender)
      const increase = bankNoteMap[itemLower]
      const current  = u.bank_limit || 50000
      await db.updateUser(sender, { bank_limit: current + increase })
      await db.removeItem(sender, found.item)
      return reply(
        `✅ *Bank Note Used!*\n\n` +
        `🏦 Bank limit increased by *£${increase.toLocaleString()}*\n` +
        `💳 New limit: *£${(current + increase).toLocaleString()}*`
      )
    }
    await db.removeItem(sender, found.item)
    await reply(`✨ Used *${found.item}*.`)
  },

  // ── .register / .reg ─────────────────────────────────────────────────────
  async register({ reply, sender, pushName, args }) {
    const existing = await db.getUser(sender).catch(() => null)
    if (existing && existing.bio && existing.bio !== '') return reply('⚠️ Already registered.')
    const raw     = args.join(' ')
    const pipeIdx = raw.indexOf('|')
    if (pipeIdx === -1) return reply('⚠️ Usage: `.reg <name> | <password>`')
    const name     = raw.slice(0, pipeIdx).trim() || pushName || sender
    const password = raw.slice(pipeIdx + 1).trim()
    if (!password) return reply('⚠️ Password cannot be empty.')
    const userDoc = await db.getOrCreateUser(sender, name).catch(() => null)
    if (!userDoc) return reply('⚠️ Registration failed. Database may be offline. Try again shortly.')
    await db.updateUser(sender, { name, password, bio: 'Konosuba Member' }).catch(() => {})
    await reply(
      `✅ *REGISTERED!*\n\n` +
      `Welcome to the Konosuba family, *${name}*!\n\n` +
      `📱 *Phone:* ${sender.split('@')[0]}\n` +
      `🔑 *Password:* ${password}\n\n` +
      `Type *.p* to view your profile card.\n\n` +
      `_Your adventure begins now._ ✦`
    )
  },
  async reg(ctx) { return module.exports.register(ctx) },

  async setname({ reply, sender, args }) {
    const name = args.join(' ')
    if (!name) return reply('⚠️ Usage: `.setname <name>`')
    await db.updateUser(sender, { name })
    await reply(`✅ Name set to *${name}*`)
  },

  async bio({ reply, sender, args }) {
    const bio = args.join(' ')
    if (!bio) return reply('⚠️ Usage: `.bio <your bio>`')
    await db.updateUser(sender, { bio })
    await reply(`✅ *Bio updated!*`)
  },

  async setage({ reply, sender, args }) {
    const age = parseInt(args[0])
    if (!age || age < 1 || age > 120) return reply('⚠️ Invalid age. Usage: `.setage <1-120>`')
    await db.updateUser(sender, { age })
    await reply(`✅ Age set to ${age}`)
  },

  // ── .stats ───────────────────────────────────────────────────────────────
  async stats({ reply, sender, args, msg }) {
    const mentioned   = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const targetPhone = mentioned.length ? mentioned[0].split('@')[0] : sender
    const u           = await db.getOrCreateUser(targetPhone)
    const xpNeeded    = xpForLevel(u.level || 1)
    await reply(
      `👤 *${u.name || targetPhone}*\n\n` +
      `📊 Lv.${u.level || 1} | ⭐ ${u.xp || 0}/${xpNeeded} XP | 🎖️ ${u.role || 'Member'}\n` +
      `💰 £${(u.wallet || 0).toLocaleString()} | 🏦 £${(u.bank || 0).toLocaleString()} | 💎 ${u.gems || 0}\n` +
      `🔥 Streak: ${u.streak || 0} days`
    )
  },
  async pstats(ctx) { return module.exports.stats(ctx) },

  // ── .cds ─────────────────────────────────────────────────────────────────
  async cds({ reply, sender }) {
    const commands = ['daily', 'work', 'fish', 'dig', 'beg', 'weekly', 'monthly', 'crime', 'rob', 'heist', 'bonus', 'raid', 'dungeon', 'quest']
    const lines    = []
    for (const cmd of commands) {
      const remaining = await db.getCooldown(sender, cmd)
      if (remaining > 0) {
        const hrs  = Math.floor(remaining / 3600000)
        const mins = Math.floor((remaining % 3600000) / 60000)
        const secs = Math.floor((remaining % 60000) / 1000)
        const parts = []
        if (hrs > 0)  parts.push(`${hrs}h`)
        if (mins > 0) parts.push(`${mins}m`)
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)
        lines.push(`⏳ *.${cmd}* — ${parts.join(' ')}`)
      }
    }
    if (!lines.length) await reply(`✅ *All commands are ready!*\n\nNo active cooldowns.`)
    else await reply(`⏱️ *Active Cooldowns*\n\n${lines.join('\n')}`)
  },
  async bc(ctx)        { return module.exports.cds(ctx) },
  async cooldowns(ctx) { return module.exports.cds(ctx) },

  // ── .bal / .richlist / .leaderboard ──────────────────────────────────────
  async richlist({ reply }) {
    const rich = await db.getRichList(10)
    if (!rich.length) return reply('No users found yet.')
    const cards = rich.map((u, i) => {
      const hasRealName = u.name && u.name !== u.phone && !/^\d{10,}$/.test(u.name)
      const display     = hasRealName ? u.name : `@${u.phone}`
      const total       = (u.wallet || 0) + (u.bank || 0)
      return (
        `═══════════════\n` +
        `║ *#${i + 1}  🔖 ${display}*\n` +
        `║ *💰 Wallet:* £${(u.wallet || 0).toLocaleString()}\n` +
        `║ *🏦 Bank:* £${(u.bank || 0).toLocaleString()}\n` +
        `║ *💫 Total:* £${total.toLocaleString()}\n` +
        `═══════════════`
      )
    })
    await reply(`╔═════════╗\n    🏆 Tᴏᴘ 10 Rɪᴄʜᴇsᴛ\n╚═════════╝\n\n${cards.join('\n\n')}`)
  },
  async richLg(ctx) { return module.exports.richlist(ctx) },

  async leaderboard({ reply }) {
    const board = await db.getLeaderboard(10)
    if (!board.length) return reply('Leaderboard is empty.')
    const cards = board.map((u, i) => {
      const hasRealName = u.name && u.name !== u.phone && !/^\d{10,}$/.test(u.name)
      const display     = hasRealName ? u.name : `@${u.phone}`
      return (
        `═══════════════\n` +
        `║ *#${i + 1}  🔖 ${display}*\n` +
        `║ *✨ Level:* ${u.level || 1}\n` +
        `║ *⭐ XP:* ${(u.xp || 0).toLocaleString()}\n` +
        `═══════════════`
      )
    })
    await reply(`╔═════════╗\n    🏆 Tᴏᴘ 10 Lᴇᴠᴇʟs\n╚═════════╝\n\n${cards.join('\n\n')}`)
  },
  async lb(ctx) { return module.exports.leaderboard(ctx) },

  async topmoney({ reply }) { return module.exports.richlist({ reply }) },
  async topbank({ reply })  { return module.exports.richlist({ reply }) },

  async roast({ reply }) {
    const roasts = [
      'Your wallet is so empty even the moths left.',
      "You're the human equivalent of a participation trophy.",
      'Your grinding skills are as slow as your internet.',
      'Even the dungeon boss pities you.',
      "Your balance is a negative number of brain cells.",
    ]
    await reply(`🔥 ${roasts[Math.floor(Math.random() * roasts.length)]}`)
  },

  // ── .membership ──────────────────────────────────────────────────────────
  async membership({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    await reply(`👑 *Membership Status*\n\n${u.name || sender}: ${u.premium ? '✅ Premium Member' : '👤 Regular Member'}`)
  },
  async memb(ctx)    { return module.exports.membership(ctx) },
  async premium(ctx) { return module.exports.membership(ctx) },
  async prem(ctx)    { return module.exports.membership(ctx) },

  async premiumbal({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    await reply(`💎 *Premium Balance*\n\n${u.name || sender}\n${u.gems || 0} gems | Premium: ${u.premium ? '✅ Active' : '❌ Inactive'}`)
  },
  async pbal(ctx) { return module.exports.premiumbal(ctx) },

  // ── .achievements ────────────────────────────────────────────────────────
  async achievements({ reply, sender, user }) {
    const u   = user || await db.getOrCreateUser(sender)
    const ach = []
    if ((u.wallet || 0) + (u.bank || 0) >= 10000) ach.push('💰 *Coin Hoarder* — Net worth over $10,000')
    if ((u.wallet || 0) + (u.bank || 0) >= 100000) ach.push('💎 *Shadow Millionaire* — Net worth over $100,000')
    if ((u.streak || 0) >= 7)  ach.push('🔥 *Week Warrior* — 7-day daily streak')
    if ((u.streak || 0) >= 30) ach.push('🏆 *Monthly Master* — 30-day daily streak')
    if ((u.level  || 1) >= 10) ach.push('📈 *Veteran* — Reached level 10')
    if ((u.level  || 1) >= 25) ach.push('🌟 *Shadow Elite* — Reached level 25')
    await reply(
      `🏆 *Achievements*\n\n` +
      (ach.length ? ach.join('\n') : '_No achievements yet. Keep playing!_')
    )
  },

  // ── .upgrade / .prestige / .bankupgrade stubs ────────────────────────────
  async upgrade({ reply })     { await reply('⚙️ *Upgrade System*\n\n_Upgrades coming soon! Stay tuned._') },
  async prestige({ reply })    { await reply('✨ *Prestige*\n\n_Prestige system coming soon! Keep grinding._') },
  async bankupgrade({ reply }) { await reply('🏦 *Bank Upgrade*\n\n_Bank upgrades coming soon!_') },

  // ── .loan / .repay ───────────────────────────────────────────────────────
  async loan({ sock, msg, jid, reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const existing = await db.getLoan(sender).catch(() => null)
    if (existing) {
      const due = new Date(existing.due_date).toLocaleDateString('en-GB')
      return reply(
        `🏦 *ACTIVE LOAN*\n\n` +
        `You already have an outstanding loan!\n\n` +
        `*Tier:* ${existing.tier}\n` +
        `*Original:* £${(existing.amount || 0).toLocaleString()}\n` +
        `*Remaining:* £${(existing.total_due || 0).toLocaleString()}\n` +
        `*Due:* ${due}\n\n` +
        `Use *.repay <amount>* to pay it back.`
      )
    }
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) {
      const tier = db.getLoanTierForLevel(u.level || 1)
      const { max, interest } = db.LOAN_TIERS[tier]
      return reply(
        `🏦 *KONOSUBA BANK — LOAN*\n\n` +
        `*Your Tier:* ${tier}\n` +
        `*Max Loan:* £${max.toLocaleString()}\n` +
        `*Interest Rate:* ${(interest * 100).toFixed(0)}%\n\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `🥉 *Bronze* (Lv 1–9) — Max $5,000 | 10%\n` +
        `🔵 *Silver* (Lv 10–24) — Max $15,000 | 8%\n` +
        `🟢 *Gold* (Lv 25–49) — Max $50,000 | 6%\n` +
        `✨ *Shadow* (Lv 50+) — Max $150,000 | 4%\n\n` +
        `Usage: *.loan <amount>*`
      )
    }
    const tier = db.getLoanTierForLevel(u.level || 1)
    const { max, interest } = db.LOAN_TIERS[tier]
    if (amount > max) return reply(`❌ Your *${tier}* tier max loan is £${max.toLocaleString()}.`)
    const total_due = Math.ceil(amount * (1 + interest))
    const loan = await db.createLoan(sender, amount, tier)
    await db.updateUser(sender, { wallet: (u.wallet || 0) + amount })
    await db.trackCurrencyGenerated(amount)
    await reply(
      `✅ *LOAN APPROVED!*\n\n` +
      `🏦 *Konosuba Bank*\n\n` +
      `*Tier:* ${tier}\n` +
      `*Amount:* £${amount.toLocaleString()}\n` +
      `*Interest:* ${(interest * 100).toFixed(0)}%\n` +
      `*Total Due:* £${total_due.toLocaleString()}\n` +
      `*Due Date:* ${new Date(loan.due_date).toLocaleDateString('en-GB')}\n\n` +
      `💵 £${amount.toLocaleString()} added to your wallet.\n\n` +
      `Use *.repay <amount>* to pay back your loan. 🖤`
    )
  },

  async repay({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const existing = await db.getLoan(sender).catch(() => null)
    if (!existing) return reply(`✅ *No Active Loan*\n\nYou have no outstanding loans!\n\n_Use *.loan <amount>* to take a loan._ 🖤`)
    const inputAmt = args[0]?.toLowerCase() === 'all' ? (u.wallet || 0) : parseInt(args[0])
    if (!inputAmt || inputAmt <= 0) {
      return reply(
        `🏦 *YOUR LOAN*\n\n` +
        `*Tier:* ${existing.tier}\n` +
        `*Remaining:* £${(existing.total_due || 0).toLocaleString()}\n` +
        `*Due:* ${new Date(existing.due_date).toLocaleDateString('en-GB')}\n\n` +
        `Usage: *.repay <amount>* or *.repay all*`
      )
    }
    if (inputAmt > (u.wallet || 0)) return reply(`❌ You do not have enough coins. You have £${(u.wallet || 0).toLocaleString()}.`)
    const result = await db.repayLoan(sender, inputAmt)
    if (!result) return reply(`❌ Loan not found.`)
    await db.updateUser(sender, { wallet: (u.wallet || 0) - inputAmt })
    await db.trackCurrencyRemoved(inputAmt)
    if (result.paid) {
      const refund = result.overpay || 0
      if (refund > 0) await db.updateUser(sender, { wallet: (u.wallet || 0) - inputAmt + refund })
      await reply(
        `🎉 *LOAN FULLY REPAID!*\n\n` +
        `✅ You've cleared your debt!\n` +
        `💵 Paid: £${inputAmt.toLocaleString()}\n` +
        (refund > 0 ? `💰 Overpayment refunded: £${refund.toLocaleString()}\n` : '') +
        `\n_Your credit record is clean._ 🖤`
      )
    } else {
      await reply(
        `💳 *PARTIAL REPAYMENT*\n\n` +
        `✅ Paid: £${inputAmt.toLocaleString()}\n` +
        `💳 Remaining: £${(result.remaining || 0).toLocaleString()}\n\n` +
        `_Keep paying to clear your debt!_ 🖤`
      )
    }
  },

  // expose xpForLevel so other modules (pokemon.js, profile.js) can import
  xpForLevel,
}
