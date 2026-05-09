const db = require('../database')

const DAILY_COINS = [200, 350, 500, 750, 1000]
const DAILY_GEMS = [5, 10, 15, 20, 30]
const SHOP_ITEMS = {
  sword:    { name: 'Sword',        price: 500, type: 'weapon',  emoji: '⚔️' },
  shield:   { name: 'Shield',       price: 400, type: 'weapon',  emoji: '🛡️' },
  bow:      { name: 'Bow',          price: 350, type: 'weapon',  emoji: '🏹' },
  potion:   { name: 'Health Potion',price: 100, type: 'item',    emoji: '🍎' },
  energy:   { name: 'Energy Drink', price: 80,  type: 'item',    emoji: '⚡' },
  ticket:   { name: 'Luck Ticket',  price: 150, type: 'item',    emoji: '🎟️' },
  vip:      { name: 'VIP Pass',     price: 50,  type: 'premium', emoji: '👑', gems: true },
  mythicbox:{ name: 'Mythic Box',   price: 100, type: 'premium', emoji: '🌌', gems: true },
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
    await reply(`⏳ *.${cmd}* cooldown — ${timeStr} remaining.`)
    return true
  }
  return false
}

module.exports = {
  async bal({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const total = (u.wallet || 0) + (u.bank || 0)
    await reply(
      `💰 *Balance — ${u.name || sender}*\n\n` +
      `💵 Wallet: $${(u.wallet||0).toLocaleString()}\n` +
      `🏦 Bank: $${(u.bank||0).toLocaleString()}\n` +
      `📊 Total: $${total.toLocaleString()}`
    )
  },
  async balance(ctx) { return module.exports.bal(ctx) },

  async gems({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    await reply(`💎 *${u.name || sender}* — ${u.gems||0} gems`)
  },

  async daily({ reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    const cooldown = await db.getCooldown(sender, 'daily')
    if (cooldown > 0) {
      const hrs  = Math.floor(cooldown / 3600000)
      const mins = Math.floor((cooldown % 3600000) / 60000)
      return reply(`⏳ Daily already claimed — come back in *${hrs}h ${mins}m*`)
    }
    const tier  = Math.min(Math.floor((u.streak||0)/7), DAILY_COINS.length-1)
    const coins = DAILY_COINS[tier] + Math.floor(Math.random()*100)
    const gems  = DAILY_GEMS[tier]
    const isFirst = !u.last_daily
    const newStreak = (u.streak||0) + 1
    const luckyBonus = Math.random() < 0.3 ? Math.floor(Math.random()*200)+50 : 0
    await db.updateUser(sender, { wallet:(u.wallet||0)+coins+luckyBonus, gems:(u.gems||0)+gems, streak:newStreak, last_daily:new Date().toISOString() })
    await db.setCooldown(sender, 'daily', CD_DAILY)
    if (isFirst) {
      await reply(`🌑 *First Daily!*\n\n💰 +$${coins} | 💎 +${gems} gems\n🔥 Streak: 1 day\n\nWelcome to Shadow Garden!`)
    } else {
      await reply(
        `🌑 *Daily Claimed!*\n\n` +
        `💰 +$${coins}${luckyBonus > 0 ? ` + $${luckyBonus} lucky bonus 🍀` : ''}\n` +
        `💎 +${gems} gems\n` +
        `🔥 Streak: ${newStreak} days\n\n` +
        `💵 Wallet: $${(u.wallet||0)+coins+luckyBonus}`
      )
    }
  },

  async withdraw({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const withdraw = args[0]?.toLowerCase()==='all' ? u.bank : parseInt(args[0])
    if (!withdraw || withdraw<=0) return reply('⚠️ Usage: .withdraw <amount> or .withdraw all')
    if (withdraw > (u.bank||0)) return reply('❌ Not enough in bank.')
    await db.updateUser(sender, { wallet:(u.wallet||0)+withdraw, bank:(u.bank||0)-withdraw })
    await reply(`💵 Withdrew $${withdraw.toLocaleString()}\nWallet: $${((u.wallet||0)+withdraw).toLocaleString()} | Bank: $${((u.bank||0)-withdraw).toLocaleString()}`)
  },
  async wid(ctx) { return module.exports.withdraw(ctx) },

  async deposit({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = args[0]?.toLowerCase()==='all' ? u.wallet : parseInt(args[0])
    if (!amount||amount<=0) return reply('⚠️ Usage: .deposit <amount> or .deposit all')
    if (amount>(u.wallet||0)) return reply('❌ Not enough in wallet.')
    await db.updateUser(sender, { wallet:(u.wallet||0)-amount, bank:(u.bank||0)+amount })
    await reply(`🏦 Deposited $${amount.toLocaleString()}\nWallet: $${((u.wallet||0)-amount).toLocaleString()} | Bank: $${((u.bank||0)+amount).toLocaleString()}`)
  },
  async dep(ctx) { return module.exports.deposit(ctx) },

  async donate({ sock, msg, jid, reply, sender, user, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length||!args[1]) return reply('⚠️ Usage: .donate @user <amount>')
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[1])||parseInt(args[0])
    if (!amount||amount<=0) return reply('❌ Enter a valid amount.')
    if (amount>(u.wallet||0)) return reply('❌ Not enough in wallet.')
    const target = mentioned[0]; const tp = target.split('@')[0]
    const tu = await db.getOrCreateUser(tp)
    await db.updateUser(sender, { wallet:(u.wallet||0)-amount })
    await db.updateUser(tp, { wallet:(tu.wallet||0)+amount })
    await sock.sendMessage(jid, { text:`💸 @${sender} donated $${amount.toLocaleString()} to @${tp}`, mentions:[msg.key.participant||msg.key.remoteJid,target] })
  },

  async work({ reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender,pushName)
    if (await checkCooldown(sender,'work',CD_WORK,reply)) return
    const jobs = ['hacked a server','sold rare items','completed a bounty','trained disciples','patrolled the shadows','decoded encrypted files','delivered a package']
    const job = jobs[Math.floor(Math.random()*jobs.length)]
    const earned = Math.floor(Math.random()*200)+100
    await db.updateUser(sender, { wallet:(u.wallet||0)+earned })
    await db.setCooldown(sender,'work',CD_WORK)
    await reply(`💼 You ${job} and earned *$${earned}*\n⏰ Work again in 20 minutes.`)
  },

  async dig({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    if (await checkCooldown(sender,'dig',CD_DIG,reply)) return
    const found = Math.random()
    let result, earned=0
    if      (found<0.05){ result='a rare gem! 💎'; earned=500; await db.updateUser(sender,{gems:(u.gems||0)+2}) }
    else if (found<0.3) { earned=Math.floor(Math.random()*150)+50; result=`$${earned}` }
    else if (found<0.6) { result='nothing useful' }
    else                { earned=Math.floor(Math.random()*30)+5; result=`a rusty coin worth $${earned}` }
    if (earned>0) await db.updateUser(sender,{wallet:(u.wallet||0)+earned})
    await db.setCooldown(sender,'dig',CD_DIG)
    await reply(`⛏️ Found: ${result}${earned>0?` (+$${earned})`:''}`)
  },

  async fish({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    if (await checkCooldown(sender,'fish',CD_FISH,reply)) return
    const catches = ['🐟 Common Fish','🐠 Tropical Fish','🦈 Shark!','🐡 Puffer Fish','💎 Shadow Pearl','👢 Old Boot','🎣 Nothing...']
    const weights = [30,25,5,15,3,10,12]
    let rand=Math.random()*100, cumulative=0, caught=catches[6]
    for (let i=0;i<catches.length;i++){cumulative+=weights[i];if(rand<cumulative){caught=catches[i];break}}
    const coins = caught.includes('Shadow Pearl')?500:caught.includes('Shark')?250:caught.includes('Nothing')||caught.includes('Boot')?0:Math.floor(Math.random()*80)+20
    if (coins>0) await db.updateUser(sender,{wallet:(u.wallet||0)+coins})
    await db.setCooldown(sender,'fish',CD_FISH)
    await reply(`🎣 Caught: ${caught}${coins>0?` — +$${coins}`:''}`)
  },

  async beg({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    if (await checkCooldown(sender,'beg',CD_BEG,reply)) return
    const success = Math.random()<0.6
    const coins = success ? Math.floor(Math.random()*50)+10 : 0
    if (success) await db.updateUser(sender,{wallet:(u.wallet||0)+coins})
    await db.setCooldown(sender,'beg',CD_BEG)
    await reply(success ? `🙏 Someone gave you *$${coins}*` : `🙏 Nobody gave you anything. Get a job.`)
  },

  async roast({ reply }) {
    const roasts = ['Your wallet is so empty even the moths left.','You\'re the human equivalent of a participation trophy.','Your grinding skills are as slow as your internet.','Even the dungeon boss pities you.','Your balance is a negative number of brain cells.']
    await reply(`🔥 ${roasts[Math.floor(Math.random()*roasts.length)]}`)
  },

  async richlist({ reply }) {
    const rich = await db.getRichList(10)
    if (!rich.length) return reply('No users found.')
    const medals = ['🥇','🥈','🥉']
    const top3 = rich.slice(0,3).map((u,i)=>`${medals[i]} *${u.name||u.phone}* — $${((u.wallet||0)+(u.bank||0)).toLocaleString()}`).join('\n')
    const rest = rich.slice(3).map((u,i)=>`${i+4}. ${u.name||u.phone} — $${((u.wallet||0)+(u.bank||0)).toLocaleString()}`).join('\n')
    await reply(`💎 *Rich List*\n\n${top3}${rest?'\n\n'+rest:''}`)
  },
  async richLg(ctx) { return module.exports.richlist(ctx) },

  async leaderboard({ reply }) {
    const board = await db.getLeaderboard(10)
    if (!board.length) return reply('No users on leaderboard yet.')
    const medals = ['🥇','🥈','🥉']
    const lines = board.map((u,i)=>`${medals[i]||`${i+1}.`} *${u.name||u.phone}* — $${(u.wallet||0).toLocaleString()}`)
    await reply(`🏆 *Leaderboard*\n\n${lines.join('\n')}`)
  },
  async lb(ctx) { return module.exports.leaderboard(ctx) },

  async shop({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const weapons  = Object.entries(SHOP_ITEMS).filter(([,v])=>v.type==='weapon' ).map(([k,v])=>`${v.emoji} ${v.name} — $${v.price}`).join('\n')
    const items    = Object.entries(SHOP_ITEMS).filter(([,v])=>v.type==='item'   ).map(([k,v])=>`${v.emoji} ${v.name} — $${v.price}`).join('\n')
    const premium  = Object.entries(SHOP_ITEMS).filter(([,v])=>v.type==='premium').map(([k,v])=>`${v.emoji} ${v.name} — ${v.price} gems`).join('\n')
    await reply(
      `🛍️ *Shop* | 💰 $${(u.wallet||0).toLocaleString()} | 💎 ${u.gems||0} gems\n\n` +
      `⚔️ *Weapons*\n${weapons}\n\n` +
      `🎒 *Items*\n${items}\n\n` +
      `💎 *Premium*\n${premium}\n\n` +
      `Use .buy <item> to purchase`
    )
  },

  async buy({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const itemKey = args[0]?.toLowerCase()
    if (!itemKey) return reply('⚠️ Usage: .buy <item> — see .shop')
    const item = Object.entries(SHOP_ITEMS).find(([k,v])=>k===itemKey||v.name.toLowerCase()===itemKey)
    if (!item) return reply('❌ Item not found. Check .shop')
    const [,data] = item
    if (data.gems) {
      if ((u.gems||0)<data.price) return reply(`❌ Need ${data.price} gems. You have ${u.gems||0}.`)
      await db.updateUser(sender,{gems:(u.gems||0)-data.price})
    } else {
      if ((u.wallet||0)<data.price) return reply(`❌ Need $${data.price}. You have $${u.wallet||0}.`)
      await db.updateUser(sender,{wallet:(u.wallet||0)-data.price})
    }
    await db.addItem(sender, data.name)
    await reply(`✅ Bought ${data.emoji} *${data.name}*`)
  },

  async inv({ sock, jid, msg, reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    const items = await db.getInventory(sender)
    const text = !items.length
      ? `🎒 *${u.name||sender}'s Inventory*\n\nEmpty — visit .shop to stock up.`
      : `🎒 *${u.name||sender}'s Inventory*\n\n${items.map(i=>`• ${i.item} x${i.quantity}`).join('\n')}`
    try {
      await sock.sendMessage(jid, {
        text,
        contextInfo: {
          externalAdReply: {
            title: '🌑 Shadow Garden',
            body: 'shadowgarden.com',
            mediaType: 1,
            previewType: 0,
            renderLargerThumbnail: false,
            sourceUrl: 'https://shadowgarden.com',
          }
        }
      }, { quoted: msg })
    } catch {
      await reply(text)
    }
  },
  async bag(ctx) { return module.exports.inv(ctx) },

  async sell({ reply, sender, user, args }) {
    const itemName = args.join(' ')
    if (!itemName) return reply('⚠️ Usage: .sell <item>')
    const items = await db.getInventory(sender)
    const found = items.find(i=>i.item.toLowerCase()===itemName.toLowerCase())
    if (!found) return reply('❌ Item not found in inventory.')
    const shopItem = Object.values(SHOP_ITEMS).find(s=>s.name.toLowerCase()===itemName.toLowerCase())
    const sellPrice = shopItem ? Math.floor(shopItem.price*0.6) : 50
    await db.removeItem(sender, found.item)
    const u = user || await db.getOrCreateUser(sender)
    await db.updateUser(sender,{wallet:(u.wallet||0)+sellPrice})
    await reply(`💸 Sold *${found.item}* for $${sellPrice}`)
  },

  async use({ reply, sender, args }) {
    const itemName = args.join(' ')
    if (!itemName) return reply('⚠️ Usage: .use <item>')
    const items = await db.getInventory(sender)
    const found = items.find(i=>i.item.toLowerCase()===itemName.toLowerCase())
    if (!found) return reply('❌ Item not found in inventory.')
    await db.removeItem(sender, found.item)
    await reply(`✨ Used *${found.item}* — effect applied!`)
  },

  async register({ reply, sender, user, pushName, args }) {
    const u = user || await db.getOrCreateUser(sender,pushName)
    if (u.bio&&u.bio!=='') return reply('⚠️ Already registered.')
    const name = args.join(' ')||pushName||sender
    await db.updateUser(sender,{name,bio:'Shadow Garden Member'})
    await reply(`✅ Registered as *${name}*\n\nType .profile to see your profile.`)
  },
  async reg(ctx) { return module.exports.register(ctx) },

  async setname({ reply, sender, args }) {
    const name = args.join(' ')
    if (!name) return reply('⚠️ Usage: .setname <name>')
    await db.updateUser(sender,{name})
    await reply(`✅ Name set to: *${name}*`)
  },

  async bio({ reply, sender, args }) {
    const bio = args.join(' ')
    if (!bio) return reply('⚠️ Usage: .bio <your bio>')
    await db.updateUser(sender,{bio})
    await reply(`✅ Bio updated.`)
  },

  async setage({ reply, sender, args }) {
    const age = parseInt(args[0])
    if (!age||age<1||age>120) return reply('⚠️ Usage: .setage <number>')
    await db.updateUser(sender,{age})
    await reply(`✅ Age set to: ${age}`)
  },

  async stats({ reply, sender, args, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const targetPhone = mentioned.length ? mentioned[0].split('@')[0] : sender
    const u = await db.getOrCreateUser(targetPhone)
    const xpNeeded = (u.level||1)*1000
    await reply(
      `👤 *${u.name||targetPhone}*\n\n` +
      `📊 Lv.${u.level||1} | ⭐ ${u.xp||0}/${xpNeeded} XP | 🎖️ ${u.role||'Member'}\n` +
      `💰 $${(u.wallet||0).toLocaleString()} wallet | 🏦 $${(u.bank||0).toLocaleString()} bank | 💎 ${u.gems||0} gems\n` +
      `🔥 Streak: ${u.streak||0} days\n` +
      `📅 Joined: ${u.created_at?new Date(u.created_at).toLocaleDateString():'Unknown'}`
    )
  },
  async pstats(ctx) { return module.exports.stats(ctx) },

  async cds({ reply, sender }) {
    const commands = ['daily','work','fish','dig','beg']
    const lines = []
    for (const cmd of commands) {
      const remaining = await db.getCooldown(sender,cmd)
      if (remaining>0) {
        const mins = Math.floor(remaining/60000)
        const secs = Math.floor((remaining%60000)/1000)
        lines.push(`⏳ .${cmd} — ${mins>0?`${mins}m `:''}${secs}s`)
      } else {
        lines.push(`✅ .${cmd} — ready`)
      }
    }
    await reply(`⏱️ *Cooldowns*\n\n${lines.join('\n')}`)
  },
  async bc(ctx) { return module.exports.cds(ctx) },
  async lc(ctx) { return module.exports.cds(ctx) },

  async membership({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    await reply(`👑 *${u.name||sender}* — ${u.premium?'✅ Premium':'❌ Regular'} member`)
  },
  async memb(ctx) { return module.exports.membership(ctx) },
  async premium(ctx) { return module.exports.membership(ctx) },
  async prem(ctx) { return module.exports.membership(ctx) },

  async premiumbal({ reply, sender, user }) {
    const u = user || await db.getOrCreateUser(sender)
    await reply(`💎 *${u.name||sender}* — ${u.gems||0} gems | Premium: ${u.premium?'Active':'Inactive'}`)
  },
  async pbal(ctx) { return module.exports.premiumbal(ctx) },
}
