const db   = require('../database')
const fs   = require('fs')
const path = require('path')

const BANK_CARD_IMG  = path.join(__dirname, '../assets/bankcard.png')
const TXN_APPROVED_IMG = path.join(__dirname, '../assets/txnapproved.jpg')

const DAILY_COINS = [200, 350, 500, 750, 1000]
const DAILY_GEMS  = [5, 10, 15, 20, 30]
const SHOP_ITEMS  = {
  sword:        { name: 'Sword',              price: 500,   type: 'weapon',    emoji: '⚔️' },
  shield:       { name: 'Shield',             price: 400,   type: 'weapon',    emoji: '🛡️' },
  bow:          { name: 'Bow',                price: 350,   type: 'weapon',    emoji: '🏹' },
  dagger:       { name: 'Dagger',             price: 300,   type: 'weapon',    emoji: '🗡️' },
  axe:          { name: 'Battle Axe',         price: 650,   type: 'weapon',    emoji: '🪓' },
  staff_wep:    { name: 'Magic Staff',        price: 700,   type: 'weapon',    emoji: '🪄' },
  spear:        { name: 'Spear',              price: 550,   type: 'weapon',    emoji: '🔱' },
  armor:        { name: 'Iron Armor',         price: 800,   type: 'armor',     emoji: '🥋' },
  helmet:       { name: 'Steel Helmet',       price: 450,   type: 'armor',     emoji: '⛑️' },
  boots:        { name: 'Shadow Boots',       price: 380,   type: 'armor',     emoji: '👟' },
  potion:       { name: 'Health Potion',      price: 100,   type: 'consumable',emoji: '🧪' },
  elixir:       { name: 'Mana Elixir',        price: 120,   type: 'consumable',emoji: '💙' },
  energy:       { name: 'Energy Drink',       price: 80,    type: 'consumable',emoji: '⚡' },
  antidote:     { name: 'Antidote',           price: 90,    type: 'consumable',emoji: '💊' },
  bomb:         { name: 'Shadow Bomb',        price: 200,   type: 'consumable',emoji: '💣' },
  ticket:       { name: 'Luck Ticket',        price: 150,   type: 'tool',      emoji: '🎟️' },
  pickaxe:      { name: 'Pickaxe',            price: 280,   type: 'tool',      emoji: '⛏️' },
  fishingrod:   { name: 'Fishing Rod',        price: 220,   type: 'tool',      emoji: '🎣' },
  map:          { name: 'Treasure Map',       price: 500,   type: 'tool',      emoji: '🗺️' },
  lantern:      { name: 'Shadow Lantern',     price: 180,   type: 'tool',      emoji: '🏮' },
  ring:         { name: 'Power Ring',         price: 950,   type: 'accessory', emoji: '💍' },
  amulet:       { name: 'Mana Amulet',        price: 850,   type: 'accessory', emoji: '📿' },
  cloak:        { name: 'Shadow Cloak',       price: 1200,  type: 'accessory', emoji: '🧣' },
  bank_note_10k:  { name: 'Bank Note (10K)',  price: 5000,  type: 'bank',      emoji: '💵', bankBonus: 50000 },
  bank_note_100k: { name: 'Bank Note (100K)', price: 40000, type: 'bank',      emoji: '💴', bankBonus: 500000 },
}

const CD_DAILY = 24 * 3600
const CD_WORK  = 20 * 60
const CD_FISH  =  2 * 60
const CD_DIG   =  2 * 60
const CD_BEG   = 300

async function checkCooldown(sender, cmd, seconds, reply) {
  const remaining = await db.getCooldown(sender, cmd)
  if (remaining > 0) {
    const mins = Math.floor(remaining / 60000)
    const secs = Math.floor((remaining % 60000) / 1000)
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
    await reply(`⏳ Command cooldown! Try again in *${timeStr}*`)
    return true
  }
  return false
}

module.exports = {
  async bal({ sock, msg, jid, reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const total = (u.wallet || 0) + (u.bank || 0)
    const caption =
      `*💰 ACCOUNT BALANCE 💰*\n\n` +
      `*🏦 Bank:* \`\`\`${(u.bank || 0).toLocaleString()}\`\`\`\n` +
      `*🏦 Bank Limit:* \`\`\`${(u.bank_limit || 50000).toLocaleString()}\`\`\`\n` +
      `*👛 Wallet:* \`\`\`${(u.wallet || 0).toLocaleString()}\`\`\`\n\n` +
      `*💫 Total:* \`\`\`${total.toLocaleString()}\`\`\``
    if (fs.existsSync(BANK_CARD_IMG)) {
      const buf = fs.readFileSync(BANK_CARD_IMG)
      await sock.sendMessage(jid, { image: buf, caption, mentions: [`${sender}@s.whatsapp.net`] }, { quoted: msg })
    } else {
      await sock.sendMessage(jid, { text: caption, mentions: [`${sender}@s.whatsapp.net`] }, { quoted: msg })
    }
  },
  async balance(ctx) { return module.exports.bal(ctx) },
  async wallet(ctx)  { return module.exports.bal(ctx) },
  async bankbal({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    await reply(`🏦 *Bank Balance*\n\n\`\`\`\n🏦 Bank  : $${(u.bank||0).toLocaleString()}\n💵 Wallet: $${(u.wallet||0).toLocaleString()}\n\`\`\``)
  },

  async gems({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    await reply(`💎 *${u.name || sender}'s Gems*\n\n${u.gems || 0} 💎`)
  },

  async daily({ reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    const cooldown = await db.getCooldown(sender, 'daily')
    if (cooldown > 0) {
      const hrs  = Math.floor(cooldown / 3600000)
      const mins = Math.floor((cooldown % 3600000) / 60000)
      return reply(`⏳ Already claimed! Try again in *${hrs}h ${mins}m*`)
    }
    const tier   = Math.min(Math.floor((u.streak || 0) / 7), DAILY_COINS.length - 1)
    const coins  = DAILY_COINS[tier] + Math.floor(Math.random() * 100)
    const gems   = DAILY_GEMS[tier]
    const newStreak = (u.streak || 0) + 1
    const lucky  = Math.random() < 0.3 ? Math.floor(Math.random() * 200) + 50 : 0
    await db.updateUser(sender, {
      wallet: (u.wallet || 0) + coins + lucky,
      gems:   (u.gems   || 0) + gems,
      streak: newStreak,
      last_daily: new Date().toISOString(),
    })
    await db.setCooldown(sender, 'daily', CD_DAILY)
    await reply(
      `🌟 *Daily Reward Claimed!*\n\n` +
      `💰 +$${coins}${lucky > 0 ? ` + $${lucky} 🍀 Lucky Bonus` : ''}\n` +
      `💎 +${gems} gems\n` +
      `🔥 Streak: ${newStreak} days\n\n` +
      `_Come back in 24 hours!_`
    )
  },

  async withdraw({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = args[0]?.toLowerCase() === 'all' ? u.bank : parseInt(args[0])
    if (!amount || amount <= 0) return reply('❌ Usage: `.withdraw <amount>` or `.withdraw all`')
    if (amount > (u.bank || 0)) return reply(`❌ Not enough in bank! Bank: $${(u.bank || 0).toLocaleString()}`)
    await db.updateUser(sender, { wallet: (u.wallet || 0) + amount, bank: (u.bank || 0) - amount })
    await reply(`🏧 You have successfully withdrawn ${amount.toLocaleString()} from your bank.`)
  },
  async wid(ctx) { return module.exports.withdraw(ctx) },

  async deposit({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = args[0]?.toLowerCase() === 'all' ? u.wallet : parseInt(args[0])
    if (!amount || amount <= 0) return reply('❌ Usage: `.deposit <amount>` or `.deposit all`')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough in wallet! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    const bankLimit = u.bank_limit || 50000
    const currentBank = u.bank || 0
    const remaining = bankLimit - currentBank
    if (remaining <= 0) return reply(`❌ Bank full! Limit: $${bankLimit.toLocaleString()}\n\n💵 Buy a *Bank Note* at *.shop* to increase your limit.`)
    const actualDeposit = Math.min(amount, remaining)
    await db.updateUser(sender, { wallet: (u.wallet || 0) - actualDeposit, bank: currentBank + actualDeposit })
    if (actualDeposit < amount) {
      await reply(`🎉 Deposited $${actualDeposit.toLocaleString()} (bank limit reached!)\n\n🏦 Bank: $${(currentBank + actualDeposit).toLocaleString()} / $${bankLimit.toLocaleString()}\n💵 Buy a *Bank Note* at *.shop* to increase your limit.`)
    } else {
      await reply(`🎉 Deposited $${actualDeposit.toLocaleString()} to your bank.\n\n🏦 Bank: $${(currentBank + actualDeposit).toLocaleString()} / $${bankLimit.toLocaleString()}`)
    }
  },
  async dep(ctx) { return module.exports.deposit(ctx) },

  async pay({ sock, msg, jid, reply, sender, user, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.pay @user <amount>`')
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args.find(a => !isNaN(parseInt(a))))
    if (!amount || amount <= 0) return reply('❌ Enter a valid amount.')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough in wallet! You have $${(u.wallet || 0).toLocaleString()}`)
    const target = mentioned[0]
    const tp     = target.split('@')[0].split(':')[0]
    const tu     = await db.getOrCreateUser(tp)
    await db.updateUser(sender, { wallet: (u.wallet || 0) - amount })
    await db.updateUser(tp, { wallet: (tu.wallet || 0) + amount })
    const caption =
      `*💸 TRANSACTION APPROVED ✅*\n\n` +
      `*From:* @${sender}\n` +
      `*To:* @${tp}\n` +
      `*Amount:* $${amount.toLocaleString()}\n\n` +
      `_Processed by Konosuba Bank_ 🖤`
    if (fs.existsSync(TXN_APPROVED_IMG)) {
      const buf = fs.readFileSync(TXN_APPROVED_IMG)
      await sock.sendMessage(jid, { image: buf, caption, mentions: [msg.key.participant || msg.key.remoteJid, target] }, { quoted: msg })
    } else {
      await sock.sendMessage(jid, { text: caption, mentions: [msg.key.participant || msg.key.remoteJid, target] }, { quoted: msg })
    }
  },
  async donate(ctx) { return module.exports.pay(ctx) },

  async work({ reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    if (await checkCooldown(sender, 'work', CD_WORK, reply)) return
    const jobs   = ['hacked a server', 'sold rare items', 'completed a bounty', 'trained disciples', 'patrolled the shadows', 'decoded encrypted files', 'delivered a package']
    const job    = jobs[Math.floor(Math.random() * jobs.length)]
    const earned = Math.floor(Math.random() * 200) + 100
    await db.updateUser(sender, { wallet: (u.wallet || 0) + earned })
    await db.setCooldown(sender, 'work', CD_WORK)
    await reply(
      `💼 *Work Complete!*\n\n` +
      `You ${job}\n` +
      `💰 +$${earned}\n\n` +
      `⏳ Next work in *20 minutes*`
    )
  },

  async dig({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    if (await checkCooldown(sender, 'dig', CD_DIG, reply)) return
    const found = Math.random()
    let result, earned = 0
    if      (found < 0.05) { result = 'a rare gem! 💎'; earned = 500; await db.updateUser(sender, { gems: (u.gems || 0) + 2 }) }
    else if (found < 0.3)  { earned = Math.floor(Math.random() * 150) + 50; result = `$${earned} in coins` }
    else if (found < 0.6)  { result = 'nothing useful 😐' }
    else                   { earned = Math.floor(Math.random() * 30) + 5; result = `a rusty coin worth $${earned}` }
    if (earned > 0) await db.updateUser(sender, { wallet: (u.wallet || 0) + earned })
    await db.setCooldown(sender, 'dig', CD_DIG)
    await reply(`⛏️ *Digging Result*\n\nYou found: ${result}`)
  },

  async fish({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    if (await checkCooldown(sender, 'fish', CD_FISH, reply)) return
    const catches = ['🐟 Common Fish', '🐠 Tropical Fish', '🦈 Shark!', '🐡 Puffer Fish', '💎 Shadow Pearl', '👢 Old Boot', '🎣 Nothing...']
    const weights = [30, 25, 5, 15, 3, 10, 12]
    let rand = Math.random() * 100, cumulative = 0, caught = catches[6]
    for (let i = 0; i < catches.length; i++) { cumulative += weights[i]; if (rand < cumulative) { caught = catches[i]; break } }
    const coins = caught.includes('Shadow Pearl') ? 500 : caught.includes('Shark') ? 250 : caught.includes('Nothing') || caught.includes('Boot') ? 0 : Math.floor(Math.random() * 80) + 20
    if (coins > 0) await db.updateUser(sender, { wallet: (u.wallet || 0) + coins })
    await db.setCooldown(sender, 'fish', CD_FISH)
    await reply(`🎣 *Caught:* ${caught}${coins > 0 ? `\n💰 +$${coins}` : ''}`)
  },

  async beg({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    if (await checkCooldown(sender, 'beg', CD_BEG, reply)) return
    const success = Math.random() < 0.6
    const coins   = success ? Math.floor(Math.random() * 50) + 10 : 0
    if (success) await db.updateUser(sender, { wallet: (u.wallet || 0) + coins })
    await db.setCooldown(sender, 'beg', CD_BEG)
    await reply(success ? `🙏 Someone felt generous - *+$${coins}*` : `🙏 Nobody gave you anything. Get a job! 😭`)
  },

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

  async richlist({ reply }) {
    const rich = await db.getRichList(10)
    if (!rich.length) return reply('No users found yet.')
    const cards = rich.map((u, i) => {
      const hasRealName = u.name && u.name !== u.phone && !/^\d{10,}$/.test(u.name)
      const display = hasRealName ? u.name : `@${u.phone}`
      return (
        `═══════════════\n` +
        `║ *🔖 Name:* ${display}\n` +
        `║ *✨ Level:* ${u.level || 1}\n` +
        `║ *🏦 Bank:* $${(u.bank || 0).toLocaleString()}\n` +
        `║  *#️⃣ Position:* ${i + 1}\n` +
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
      const display = hasRealName ? u.name : `@${u.phone}`
      return (
        `═══════════════\n` +
        `║ *🔖 Name:* ${display}\n` +
        `║ *✨ Level:* ${u.level || 1}\n` +
        `║ *🏦 Bank:* $${(u.bank || 0).toLocaleString()}\n` +
        `║  *#️⃣ Position:* ${i + 1}\n` +
        `═══════════════`
      )
    })
    await reply(`╔═════════╗\n    🏆 Tᴏᴘ 10 Pʟᴀʏᴇʀs\n╚═════════╝\n\n${cards.join('\n\n')}`)
  },
  async lb(ctx) { return module.exports.leaderboard(ctx) },

  async market({ reply, sender, user }) {
    const u         = user || await db.getOrCreateUser(sender)
    const byType    = {}
    for (const [k, v] of Object.entries(SHOP_ITEMS)) {
      if (!byType[v.type]) byType[v.type] = []
      byType[v.type].push([k, v])
    }
    const typeEmojis = { weapon:'⚔️', armor:'🥋', consumable:'🧪', tool:'🔧', accessory:'💍' }
    const typeLabels = { weapon:'Weapons', armor:'Armor', consumable:'Consumables', tool:'Tools', accessory:'Accessories' }
    let sections = ''
    for (const [type, entries] of Object.entries(byType)) {
      const lines = entries.map(([k, v]) => `  ${v.emoji} *${v.name}* - $${v.price.toLocaleString()}  \`.buy ${k}\``).join('\n')
      sections += `\n${typeEmojis[type]||'🛒'} *${typeLabels[type]||type}*\n${lines}\n`
    }
    await reply(
      `🏪 *Konosuba Market*\n\n` +
      `💰 Wallet: $${(u.wallet||0).toLocaleString()} | 💎 Gems: ${u.gems||0}\n` +
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
    if (!itemKey) return reply('❌ Usage: `.buy <item>` - see `.shop`')
    const item    = Object.entries(SHOP_ITEMS).find(([k, v]) => k === itemKey || v.name.toLowerCase() === itemKey)
    if (!item) return reply('❌ Item not found. Check `.shop`')
    const [, data] = item
    if (data.gems) {
      if ((u.gems || 0) < data.price) return reply(`❌ Need ${data.price} 💎. You have ${u.gems || 0}.`)
      await db.updateUser(sender, { gems: (u.gems || 0) - data.price })
    } else {
      if ((u.wallet || 0) < data.price) return reply(`❌ Need $${data.price}. You have $${(u.wallet || 0).toLocaleString()}`)
      await db.updateUser(sender, { wallet: (u.wallet || 0) - data.price })
    }
    // Bank note: instantly applies bank limit bonus instead of going to inventory
    if (data.bankBonus) {
      const newLimit = (u.bank_limit || 50000) + data.bankBonus
      await db.updateUser(sender, { bank_limit: newLimit })
      return reply(
        `✅ *Bank Note Applied!*\n\n${data.emoji} *${data.name}*\n\n` +
        `🏦 Bank limit increased by $${data.bankBonus.toLocaleString()}!\n` +
        `📈 New limit: $${newLimit.toLocaleString()}`
      )
    }
    await db.addItem(sender, data.name)
    await reply(`✅ *Purchased!*\n\n${data.emoji} *${data.name}* added to your inventory.`)
  },

  async inv({ sock, jid, msg, reply, sender, user }) {
    const u     = user || await db.getOrCreateUser(sender)
    const items = await db.getInventory(sender)
    const text  = !items.length
      ? `🎒 *${u.name || sender}'s Inventory*\n\nEmpty - visit \`.shop\` to stock up.`
      : `🎒 *${u.name || sender}'s Inventory*\n\n${items.map(i => `• ${i.item} ×${i.quantity}`).join('\n')}`
    await reply(text)
  },
  async bag(ctx) { return module.exports.inv(ctx) },

  async sell({ reply, sender, user, args }) {
    const itemName = args.join(' ')
    if (!itemName) return reply('❌ Usage: `.sell <item>`')
    const items    = await db.getInventory(sender)
    const found    = items.find(i => i.item.toLowerCase() === itemName.toLowerCase())
    if (!found) return reply('❌ Item not found in inventory.')
    const shopItem  = Object.values(SHOP_ITEMS).find(s => s.name.toLowerCase() === itemName.toLowerCase())
    const sellPrice = shopItem ? Math.floor(shopItem.price * 0.6) : 50
    await db.removeItem(sender, found.item)
    const u = user || await db.getOrCreateUser(sender)
    await db.updateUser(sender, { wallet: (u.wallet || 0) + sellPrice })
    await reply(`💸 Sold *${found.item}* for $${sellPrice}`)
  },

  async use({ reply, sender, args }) {
    const itemName = args.join(' ')
    if (!itemName) return reply('❌ Usage: `.use <item>`')
    const items    = await db.getInventory(sender)
    const found    = items.find(i => i.item.toLowerCase() === itemName.toLowerCase())
    if (!found) return reply('❌ Item not in inventory.')
    await db.removeItem(sender, found.item)
    await reply(`✨ Used *${found.item}* - effect applied!`)
  },

  async register({ sock, jid, reply, sender, senderJid, pushName, args, isGroup }) {
    // Registration must be done in DM for security
    if (isGroup) {
      try {
        await sock.sendMessage(`${sender}@s.whatsapp.net`, {
          text:
            `🔐 *REGISTRATION*\n\n` +
            `For security, registration must be done here in DM.\n\n` +
            `📝 *Usage:* \`.reg <name> | <password>\`\n` +
            `Example: \`.reg Shadow Reaper | mypassword123\`\n\n` +
            `_Your password is private — never share it in groups._ 🖤`,
        })
      } catch {}
      return reply(`🔐 Registration is private! Please check your *DMs* for instructions.`)
    }

    const existing = await db.getUser(sender).catch(() => null)
    if (existing && existing.bio && existing.bio !== '') return reply('⚠️ Already registered.')

    const raw = args.join(' ')
    const pipeIdx = raw.indexOf('|')
    if (pipeIdx === -1) {
      return reply('❌ Usage: `.reg <name> | <password>`\nExample: `.reg Shadow Reaper | mypassword123`')
    }
    const name     = raw.slice(0, pipeIdx).trim() || pushName || sender
    const password = raw.slice(pipeIdx + 1).trim()
    if (!password) {
      return reply('❌ Password cannot be empty.\nUsage: `.reg <name> | <password>`')
    }

    const userDoc = await db.getOrCreateUser(sender, name).catch(() => null)
    if (!userDoc) {
      return reply('❌ Registration failed — the database may be offline. Please try again in a moment.')
    }

    await db.updateUser(sender, { name, password, bio: 'Konosuba Member' }).catch(() => {})

    await reply(
      `✅ *REGISTERED!*\n\n` +
      `Welcome to the Konosuba family, *${name}*!\n\n` +
      `📱 *Phone:* ${sender.split('@')[0]}\n` +
      `🔑 *Password:* ${password}\n\n` +
      `Use these to login at the Konosuba website!\n` +
      `Type *.p* to view your profile card.\n\n` +
      `_Your adventure begins now._ ✦`
    )
  },
  async reg(ctx) { return module.exports.register(ctx) },

  async setname({ reply, sender, args }) {
    const name = args.join(' ')
    if (!name) return reply('❌ Usage: `.setname <name>`')
    await db.updateUser(sender, { name })
    await reply(`✅ Name set to *${name}*`)
  },

  async bio({ reply, sender, args }) {
    const bio = args.join(' ')
    if (!bio) return reply('❌ Usage: `.bio <your bio>`')
    await db.updateUser(sender, { bio })
    await reply(`✅ *Bio updated!*`)
  },

  async setage({ reply, sender, args }) {
    const age = parseInt(args[0])
    if (!age || age < 1 || age > 120) return reply('❌ Usage: `.setage <number>`')
    await db.updateUser(sender, { age })
    await reply(`✅ Age set to ${age}`)
  },

  async stats({ reply, sender, args, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const targetPhone = mentioned.length ? mentioned[0].split('@')[0] : sender
    const u = await db.getOrCreateUser(targetPhone)
    const xpNeeded = (u.level || 1) * 1000
    await reply(
      `👤 *${u.name || targetPhone}*\n\n` +
      `📊 Lv.${u.level || 1} | ⭐ ${u.xp || 0}/${xpNeeded} XP | 🎖️ ${u.role || 'Member'}\n` +
      `💰 $${(u.wallet || 0).toLocaleString()} | 🏦 $${(u.bank || 0).toLocaleString()} | 💎 ${u.gems || 0}\n` +
      `🔥 Streak: ${u.streak || 0} days`
    )
  },
  async pstats(ctx) { return module.exports.stats(ctx) },

  async cds({ reply, sender }) {
    const commands = [
      { key: 'work',      label: '.work'      },
      { key: 'fish',      label: '.fish'      },
      { key: 'dig',       label: '.dig'       },
      { key: 'beg',       label: '.beg'       },
      { key: 'crime',     label: '.crime'     },
      { key: 'rob',       label: '.rob'       },
      { key: 'heist',     label: '.heist'     },
      { key: 'bonus',     label: '.bonus'     },
      { key: 'dungeon',   label: '.dungeon'   },
      { key: 'adventure', label: '.adventure' },
    ]
    const lines = []
    for (const { key, label } of commands) {
      const remaining = await db.getCooldown(sender, key)
      if (remaining > 0) {
        const hrs     = Math.floor(remaining / 3600000)
        const mins    = Math.floor((remaining % 3600000) / 60000)
        const secs    = Math.floor((remaining % 60000) / 1000)
        const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
        lines.push(`* \`${label}\` | *${timeStr}*`)
      } else {
        lines.push(`* \`${label}\` | *Ready!*`)
      }
    }
    await reply(`⏳ Your Active Cooldowns ⏳\n\n${lines.join('\n')}`)
  },
  async bc(ctx) { return module.exports.cds(ctx) },

  async membership({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    await reply(`👑 *Membership Status*\n\n${u.name || sender}: ${u.premium ? '✅ Premium Member' : '❌ Regular Member'}`)
  },
  async memb(ctx)    { return module.exports.membership(ctx) },
  async premium(ctx) { return module.exports.membership(ctx) },
  async prem(ctx)    { return module.exports.membership(ctx) },

  async premiumbal({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    await reply(`💎 *Premium Balance*\n\n${u.name || sender}\n${u.gems || 0} gems | Premium: ${u.premium ? '✅ Active' : '❌ Inactive'}`)
  },
  async pbal(ctx) { return module.exports.premiumbal(ctx) },

  async weekly({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const remaining = await db.getCooldown(sender, 'weekly')
    if (remaining > 0) {
      const hrs = Math.floor(remaining / 3600000)
      const mins = Math.floor((remaining % 3600000) / 60000)
      return reply(`⏳ Weekly already claimed! Try again in *${hrs}h ${mins}m*`)
    }
    const coins = Math.floor(Math.random() * 1000) + 1500
    await db.updateUser(sender, { wallet: (u.wallet || 0) + coins })
    await db.setCooldown(sender, 'weekly', 7 * 24 * 3600)
    await reply(`📅 *Weekly Reward!*\n\n💰 +$${coins.toLocaleString()}\n\n_Come back in 7 days!_`)
  },

  async monthly({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const remaining = await db.getCooldown(sender, 'monthly')
    if (remaining > 0) {
      const days = Math.floor(remaining / 86400000)
      const hrs  = Math.floor((remaining % 86400000) / 3600000)
      return reply(`⏳ Monthly already claimed! Try again in *${days}d ${hrs}h*`)
    }
    const coins = Math.floor(Math.random() * 3000) + 5000
    await db.updateUser(sender, { wallet: (u.wallet || 0) + coins })
    await db.setCooldown(sender, 'monthly', 30 * 24 * 3600)
    await reply(`🗓️ *Monthly Reward!*\n\n💰 +$${coins.toLocaleString()}\n\n_Come back in 30 days!_`)
  },

  async crime({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const remaining = await db.getCooldown(sender, 'crime')
    if (remaining > 0) {
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      return reply(`⏳ You're laying low. Try again in *${mins}m ${secs}s*`)
    }
    const success = Math.random() < 0.5
    const amount  = Math.floor(Math.random() * 400) + 100
    await db.setCooldown(sender, 'crime', 15 * 60)
    if (success) {
      await db.updateUser(sender, { wallet: (u.wallet || 0) + amount })
      const acts = ['robbed a merchant', 'pickpocketed a noble', 'hacked a guild vault', 'stole a shipment', 'conned a trader']
      await reply(`🦹 *Crime Successful!*\n\nYou ${acts[Math.floor(Math.random()*acts.length)]}.\n💰 +$${amount}`)
    } else {
      const fine = Math.min(amount, u.wallet || 0)
      await db.updateUser(sender, { wallet: Math.max(0, (u.wallet || 0) - fine) })
      await reply(`👮 *Caught!*\n\nYou were caught and fined *$${fine}*. Better luck next time.`)
    }
  },

  async rob({ sock, msg, jid, reply, sender, user, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: *.rob @user*')
    const u = user || await db.getOrCreateUser(sender)
    const remaining = await db.getCooldown(sender, 'rob')
    if (remaining > 0) {
      const mins = Math.floor(remaining / 60000)
      return reply(`⏳ You need to wait *${mins}m* before robbing again.`)
    }
    const target = mentioned[0]
    const tp     = target.split('@')[0]
    if (tp === sender) return reply('❌ You cannot rob yourself!')
    const tu = await db.getOrCreateUser(tp)
    if ((tu.wallet || 0) < 50) return reply(`❌ @${tp} doesn't have enough to rob.`)
    const success = Math.random() < 0.45
    await db.setCooldown(sender, 'rob', 20 * 60)
    if (success) {
      const stolen = Math.floor((tu.wallet || 0) * (0.1 + Math.random() * 0.2))
      await db.updateUser(tp, { wallet: (tu.wallet || 0) - stolen })
      await db.updateUser(sender, { wallet: (u.wallet || 0) + stolen })
      await sock.sendMessage(jid, { text: `🦹 *Rob Successful!*\n\nYou stole *$${stolen.toLocaleString()}* from @${tp}!`, mentions: [target] }, { quoted: msg })
    } else {
      const fine = Math.min(100, u.wallet || 0)
      await db.updateUser(sender, { wallet: (u.wallet || 0) - fine })
      await sock.sendMessage(jid, { text: `👮 *Caught!*\n\nYou failed to rob @${tp} and paid a *$${fine}* fine.`, mentions: [target] }, { quoted: msg })
    }
  },

  async heist({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const remaining = await db.getCooldown(sender, 'heist')
    if (remaining > 0) {
      const mins = Math.floor(remaining / 60000)
      return reply(`⏳ Cooling down from last heist. *${mins}m* left.`)
    }
    const success = Math.random() < 0.4
    const amount  = Math.floor(Math.random() * 1500) + 500
    await db.setCooldown(sender, 'heist', 60 * 60)
    if (success) {
      await db.updateUser(sender, { wallet: (u.wallet || 0) + amount })
      await reply(`💰 *Heist Successful!*\n\nYour crew cracked the vault and got away with *$${amount.toLocaleString()}*!`)
    } else {
      const loss = Math.min(Math.floor(amount * 0.3), u.wallet || 0)
      await db.updateUser(sender, { wallet: (u.wallet || 0) - loss })
      await reply(`🚨 *Heist Failed!*\n\nThe guards caught you. You lost *$${loss.toLocaleString()}* in the chaos.`)
    }
  },

  async topmoney({ reply }) {
    const rich = await db.getRichList(10)
    if (!rich.length) return reply('No users found yet.')
    const cards = rich.map((u, i) => {
      const hasRealName = u.name && u.name !== u.phone && !/^\d{10,}$/.test(u.name)
      const display = hasRealName ? u.name : `@${u.phone}`
      return (
        `═══════════════\n` +
        `║ *🔖 Name:* ${display}\n` +
        `║ *✨ Level:* ${u.level || 1}\n` +
        `║ *🏦 Bank:* $${(u.bank || 0).toLocaleString()}\n` +
        `║  *#️⃣ Position:* ${i + 1}\n` +
        `═══════════════`
      )
    })
    await reply(`╔═════════╗\n    🏆 Tᴏᴘ 10 Rɪᴄʜᴇsᴛ\n╚═════════╝\n\n${cards.join('\n\n')}`)
  },
  async topbank({ reply }) {
    const rich = await db.getRichList(10)
    if (!rich.length) return reply('No users found yet.')
    const cards = rich.map((u, i) => {
      const hasRealName = u.name && u.name !== u.phone && !/^\d{10,}$/.test(u.name)
      const display = hasRealName ? u.name : `@${u.phone}`
      return (
        `═══════════════\n` +
        `║ *🔖 Name:* ${display}\n` +
        `║ *✨ Level:* ${u.level || 1}\n` +
        `║ *🏦 Bank:* $${(u.bank || 0).toLocaleString()}\n` +
        `║  *#️⃣ Position:* ${i + 1}\n` +
        `═══════════════`
      )
    })
    await reply(`╔═════════╗\n    🏆 Tᴏᴘ 10 Bᴀɴᴋ Bᴀʟᴀɴᴄᴇ\n╚═════════╝\n\n${cards.join('\n\n')}`)
  },

  async achievements({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const ach = []
    if ((u.wallet || 0) + (u.bank || 0) >= 10000) ach.push('💰 *Coin Hoarder* - Net worth over $10,000')
    if ((u.streak || 0) >= 7)  ach.push('🔥 *Week Warrior* - 7-day daily streak')
    if ((u.streak || 0) >= 30) ach.push('🏆 *Monthly Master* - 30-day daily streak')
    if ((u.level  || 1) >= 10) ach.push('📈 *Veteran* - Reached level 10')
    await reply(
      `🏆 *Achievements*\n\n` +
      (ach.length ? ach.join('\n') : '_No achievements yet. Keep playing!_')
    )
  },

  async bonus({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const remaining = await db.getCooldown(sender, 'bonus')
    if (remaining > 0) {
      const hrs  = Math.floor(remaining / 3600000)
      const mins = Math.floor((remaining % 3600000) / 60000)
      return reply(`⏳ Bonus claimed! Next in *${hrs}h ${mins}m*`)
    }
    const coins = Math.floor(Math.random() * 300) + 100
    await db.updateUser(sender, { wallet: (u.wallet || 0) + coins })
    await db.setCooldown(sender, 'bonus', 4 * 3600)
    await reply(`🎁 *Bonus Collected!*\n\n💰 +$${coins}\n\n_Next bonus in 4 hours._`)
  },

  async upgrade({ reply }) {
    await reply('⚙️ *Upgrade System*\n\n_Upgrades coming soon! Stay tuned._')
  },

  async prestige({ reply }) {
    await reply('✨ *Prestige*\n\n_Prestige system coming soon! Keep grinding._')
  },

  async bankupgrade({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    await reply(
      `🏦 *BANK UPGRADE*\n\n` +
      `📊 *Current Limit:* $${(u.bank_limit || 50000).toLocaleString()}\n` +
      `💰 *Current Bank:* $${(u.bank || 0).toLocaleString()}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `📋 *Available Bank Notes:*\n\n` +
      `💵 *Bank Note (10K)* — $5,000\n   Increases limit by +$50,000\n   \`.buy bank_note_10k\`\n\n` +
      `💴 *Bank Note (100K)* — $40,000\n   Increases limit by +$500,000\n   \`.buy bank_note_100k\`\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `_Bank notes are applied instantly!_ 🖤`
    )
  },

  async withdrawall({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = u.bank || 0
    if (amount <= 0) return reply('❌ Your bank is empty.')
    await db.updateUser(sender, { wallet: (u.wallet || 0) + amount, bank: 0 })
    await reply(`🏧 You have successfully withdrawn *$${amount.toLocaleString()}* from your bank.\n\n💵 Wallet: $${((u.wallet||0)+amount).toLocaleString()} | 🏦 Bank: $0`)
  },

  async claim(ctx) { return module.exports.daily(ctx) },

  async loan({ sock, msg, jid, reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const existing = await db.getLoan(sender).catch(() => null)
    if (existing) {
      const due = new Date(existing.due_date).toLocaleDateString('en-GB')
      return reply(
        `🏦 *ACTIVE LOAN*\n\n` +
        `You already have an outstanding loan!\n\n` +
        `*Tier:* ${existing.tier}\n` +
        `*Original:* $${(existing.amount || 0).toLocaleString()}\n` +
        `*Remaining:* $${(existing.total_due || 0).toLocaleString()}\n` +
        `*Due:* ${due}\n\n` +
        `Use *.repay <amount>* to pay it back.`
      )
    }
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) {
      const tier = db.getLoanTierForLevel(u.level || 1)
      const { max, interest } = db.LOAN_TIERS[tier]
      return reply(
        `🏦 *SHADOW GARDEN BANK — LOAN*\n\n` +
        `*Your Tier:* ${tier}\n` +
        `*Max Loan:* $${max.toLocaleString()}\n` +
        `*Interest Rate:* ${(interest * 100).toFixed(0)}%\n\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `🥉 *Bronze* (Lv 1-9) - Max $5,000 | 10%\n` +
        `🔵 *Silver* (Lv 10-24) - Max $15,000 | 8%\n` +
        `🟢 *Gold* (Lv 25-49) - Max $50,000 | 6%\n` +
        `✨ *Shadow* (Lv 50+) - Max $150,000 | 4%\n\n` +
        `Usage: *.loan <amount>*`
      )
    }
    const tier = db.getLoanTierForLevel(u.level || 1)
    const { max, interest } = db.LOAN_TIERS[tier]
    if (amount > max) return reply(`❌ Your *${tier}* tier max loan is $${max.toLocaleString()}.`)
    const total_due = Math.ceil(amount * (1 + interest))
    const loan = await db.createLoan(sender, amount, tier)
    await db.updateUser(sender, { wallet: (u.wallet || 0) + amount })
    await reply(
      `✅ *LOAN APPROVED!*\n\n` +
      `🏦 *Konosuba Bank*\n\n` +
      `*Tier:* ${tier}\n` +
      `*Amount:* $${amount.toLocaleString()}\n` +
      `*Interest:* ${(interest * 100).toFixed(0)}%\n` +
      `*Total Due:* $${total_due.toLocaleString()}\n` +
      `*Due Date:* ${new Date(loan.due_date).toLocaleDateString('en-GB')}\n\n` +
      `💵 $${amount.toLocaleString()} added to your wallet.\n\n` +
      `Use *.repay <amount>* to pay back your loan. 🖤`
    )
  },

  async repay({ sock, msg, jid, reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const existing = await db.getLoan(sender).catch(() => null)
    if (!existing) return reply(`✅ *No Active Loan*\n\nYou have no outstanding loans!\n\n_Use *.loan <amount>* to take a loan._ 🖤`)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) {
      return reply(
        `🏦 *YOUR LOAN*\n\n` +
        `*Tier:* ${existing.tier}\n` +
        `*Remaining:* $${(existing.total_due || 0).toLocaleString()}\n` +
        `*Due:* ${new Date(existing.due_date).toLocaleDateString('en-GB')}\n\n` +
        `Usage: *.repay <amount>* or *.repay all*`
      )
    }
    const repayAmount = args[0]?.toLowerCase() === 'all' ? (u.wallet || 0) : amount
    if (repayAmount > (u.wallet || 0)) return reply(`❌ Not enough in wallet! You have $${(u.wallet || 0).toLocaleString()}.`)
    const result = await db.repayLoan(sender, repayAmount)
    if (!result) return reply(`❌ Loan not found.`)
    await db.updateUser(sender, { wallet: (u.wallet || 0) - repayAmount })
    if (result.paid) {
      const refund = result.overpay || 0
      if (refund > 0) await db.updateUser(sender, { wallet: (u.wallet || 0) - repayAmount + refund })
      await reply(
        `🎉 *LOAN FULLY REPAID!*\n\n` +
        `✅ You've cleared your debt!\n` +
        `💵 Paid: $${repayAmount.toLocaleString()}\n` +
        (refund > 0 ? `💰 Overpayment refunded: $${refund.toLocaleString()}\n` : '') +
        `\n_Your credit record is clean._ 🖤`
      )
    } else {
      await reply(
        `💳 *PARTIAL REPAYMENT*\n\n` +
        `✅ Paid: $${repayAmount.toLocaleString()}\n` +
        `💳 Remaining: $${(result.remaining || 0).toLocaleString()}\n\n` +
        `_Keep paying to clear your debt!_ 🖤`
      )
    }
  },

  async usepp({ sock, msg, jid, reply, sender }) {
    const ctx    = msg.message?.extendedTextMessage?.contextInfo
    const quoted = ctx?.quotedMessage
    if (!quoted?.imageMessage && !msg.message?.imageMessage) {
      return reply(`🖼️ *PROFILE PICTURE*\n\nSend or reply to an image with *.usepp* to set it as your profile picture.`)
    }
    try {
      const { downloadMediaMessage } = require('@whiskeysockets/baileys')
      const targetMsg = quoted?.imageMessage
        ? { message: quoted, key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant } }
        : msg
      const buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, {
        logger: { level: () => {}, info: () => {}, warn: () => {}, error: () => {} },
        reuploadRequest: sock.updateMediaMessage,
      })
      const sharp = require('sharp')
      const jpegBuf = await sharp(buffer).resize(400, 400, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer()
      const b64 = jpegBuf.toString('base64')
      await db.updateUser(sender, { profile_pp: b64 })
      await reply(`✅ *Profile picture updated!*\n\n_Use *.profile* to view your card._ 🖤`)
    } catch (err) {
      await reply(`❌ Failed: ${err.message}`)
    }
  },

  async usebg({ sock, msg, jid, reply, sender }) {
    const ctx    = msg.message?.extendedTextMessage?.contextInfo
    const quoted = ctx?.quotedMessage
    if (!quoted?.imageMessage && !msg.message?.imageMessage) {
      return reply(`🎨 *PROFILE BACKGROUND*\n\nSend or reply to an image with *.usebg* to set it as your profile background.`)
    }
    try {
      const { downloadMediaMessage } = require('@whiskeysockets/baileys')
      const targetMsg = quoted?.imageMessage
        ? { message: quoted, key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant } }
        : msg
      const buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, {
        logger: { level: () => {}, info: () => {}, warn: () => {}, error: () => {} },
        reuploadRequest: sock.updateMediaMessage,
      })
      const sharp = require('sharp')
      const jpegBuf = await sharp(buffer).resize(800, 400, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer()
      const b64 = jpegBuf.toString('base64')
      await db.updateUser(sender, { profile_bg: b64 })
      await reply(`✅ *Profile background updated!*\n\n_Use *.profile* to view your card._ 🖤`)
    } catch (err) {
      await reply(`❌ Failed: ${err.message}`)
    }
  },
      }
