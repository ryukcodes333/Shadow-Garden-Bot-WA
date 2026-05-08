const db = require('../database')

const STAFF_ROLES = { MOD: 'mod', GUARDIAN: 'guardian', OWNER: 'owner', CARD_MAKER: 'card_maker' }

module.exports = {

  // ── Role management ──────────────────────────────────────────────
  async addmod({ reply, sock, jid, msg, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Only owner or mods can add mods.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.addmod @user*')
    for (const jidM of mentioned) {
      const phone = jidM.split('@')[0]
      await db.updateUser(phone, { role: STAFF_ROLES.MOD })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `✅ *MOD ADDED*\n\n${names} is now a *Moderator*.`, mentions: mentioned }, { quoted: msg })
  },

  async removemod({ reply, sock, jid, msg, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.removemod @user*')
    for (const jidM of mentioned) {
      await db.updateUser(jidM.split('@')[0], { role: 'member' })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `✅ *MOD REMOVED*\n\n${names} is no longer a moderator.`, mentions: mentioned }, { quoted: msg })
  },

  async addguardian({ reply, sock, jid, msg, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Only owner or mods can add guardians.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.addguardian @user*')
    for (const jidM of mentioned) {
      await db.updateUser(jidM.split('@')[0], { role: STAFF_ROLES.GUARDIAN })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `✅ *GUARDIAN ADDED*\n\n${names} is now a *Guardian*.`, mentions: mentioned }, { quoted: msg })
  },

  async removeguardian({ reply, sock, jid, msg, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Only owner or mods can remove guardians.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.removeguardian @user*')
    for (const jidM of mentioned) {
      await db.updateUser(jidM.split('@')[0], { role: 'member' })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `✅ *GUARDIAN REMOVED*\n\n${names} is no longer a guardian.`, mentions: mentioned }, { quoted: msg })
  },

  async recruit({ sock, jid, msg, reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.recruit @user*')
    for (const jidM of mentioned) {
      await db.updateUser(jidM.split('@')[0], { role: STAFF_ROLES.CARD_MAKER })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `🎴 *CARD MAKER RECRUITED*\n\n${names} can now upload cards.`, mentions: mentioned }, { quoted: msg })
  },

  async firerecruit({ sock, jid, msg, reply, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Mods/owner only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.firerecruit @user*')
    for (const jidM of mentioned) {
      await db.updateUser(jidM.split('@')[0], { role: 'member' })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `❌ *CARD MAKER REMOVED*\n\n${names} can no longer upload cards.`, mentions: mentioned }, { quoted: msg })
  },

  // ── .mods — always show full @s.whatsapp.net JIDs ────────────────
  async mods({ sock, jid, msg, reply }) {
    const { data: mods }      = await db.supabase.from('users').select('phone,name').eq('role', 'mod')
    const { data: guardians } = await db.supabase.from('users').select('phone,name').eq('role', 'guardian')

    const modList      = mods      || []
    const guardianList = guardians || []

    // Always use full @s.whatsapp.net JID, never LID
    const allMentions = [
      ...modList.map(u => `${u.phone}@s.whatsapp.net`),
      ...guardianList.map(u => `${u.phone}@s.whatsapp.net`),
    ]

    const modLines = modList.length
      ? modList.map((u, i) => `│   ${i === modList.length - 1 ? '└──' : '├──'} @${u.phone}`).join('\n')
      : '│   └── None'

    const guardianLines = guardianList.length
      ? guardianList.map((u, i) => `     ${i === guardianList.length - 1 ? '└──' : '├──'} @${u.phone}`).join('\n')
      : '     └── None'

    const text =
      `┌─「 𝗦𝗧𝗔𝗙𝗙𝗦 」─┐\n` +
      `│\n` +
      `├── 👑 𝗠𝗢𝗗𝗦 👑\n` +
      `${modLines}\n` +
      `│\n` +
      `└── 🛡️ 𝗚𝗨𝗔𝗥𝗗𝗜𝗔𝗡𝗦 🛡️\n` +
      `${guardianLines}\n\n` +
      `> ⚠️ Inappropriate use of this command will lead to a *Shadow Ban* from the bot.`

    await sock.sendMessage(jid, { text, mentions: allMentions }, { quoted: msg })
  },

  // ── .modlist alias ────────────────────────────────────────────────
  async modlist(ctx) { return module.exports.mods(ctx) },

  // ── .ac — Add cash ────────────────────────────────────────────────
  async ac({ reply, sock, jid, msg, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const amount    = parseInt(args.find(a => !isNaN(parseInt(a))))
    if (!amount || amount <= 0) return reply('⚠️ Usage: *.ac <amount> @user*')

    if (mentioned.length) {
      const targetPhone = mentioned[0].split('@')[0]
      const tu = await db.getOrCreateUser(targetPhone)
      const newBal = (tu.wallet || 0) + amount
      await db.updateUser(targetPhone, { wallet: newBal })
      await sock.sendMessage(jid, {
        text: `💰 *CASH ADDED*\n\n✅ +$${amount.toLocaleString()} added to @${targetPhone}'s wallet!\n💵 New Balance: $${newBal.toLocaleString()}`,
        mentions: [mentioned[0]],
      }, { quoted: msg })
    } else {
      return reply('⚠️ Usage: *.ac <amount> @user*')
    }
  },

  // ── .rc — Remove cash ─────────────────────────────────────────────
  async rc({ reply, sock, jid, msg, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.rc <amount> @user*')
    const amount = parseInt(args.find(a => !isNaN(parseInt(a))))
    if (!amount || amount <= 0) return reply('⚠️ Enter a valid amount.')
    const targetPhone = mentioned[0].split('@')[0]
    const tu = await db.getOrCreateUser(targetPhone)
    const deduct  = Math.min(amount, tu.wallet || 0)
    const newBal  = (tu.wallet || 0) - deduct
    await db.updateUser(targetPhone, { wallet: newBal })
    await sock.sendMessage(jid, {
      text: `🚫 *CASH REMOVED*\n\n-$${deduct.toLocaleString()} taken from @${targetPhone}\n💵 New Balance: $${newBal.toLocaleString()}`,
      mentions: [mentioned[0]],
    }, { quoted: msg })
  },

  // ── .resetbal ─────────────────────────────────────────────────────
  async resetbal({ reply, msg, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.resetbal @user*')
    const phone = mentioned[0].split('@')[0]
    await db.updateUser(phone, { wallet: 0, bank: 0 })
    await reply(`✅ Balance reset for @${phone}.`)
  },

  // ── .reset ────────────────────────────────────────────────────────
  async reset({ reply, msg, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.reset @user*')
    const phone = mentioned[0].split('@')[0]
    await db.updateUser(phone, { wallet: 0, bank: 0, xp: 0, level: 1, streak: 0, gems: 0, banned: false })
    await reply(`🔄 *USER RESET*\n\n@${phone}'s profile has been fully reset.`)
  },

  // ── .addinv ───────────────────────────────────────────────────────
  async addinv({ reply, sock, jid, msg, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length || !args[1]) return reply('⚠️ Usage: *.addinv @user <item>*')
    const phone = mentioned[0].split('@')[0]
    const item  = args.filter(a => !a.includes('@')).join(' ')
    try { await db.addItem(phone, item, 1) } catch {}
    await sock.sendMessage(jid, {
      text: `🎒 *ITEM ADDED*\n\n✅ *${item}* added to @${phone}'s inventory.`,
      mentions: [mentioned[0]],
    }, { quoted: msg })
  },

  // ── .spawncard ────────────────────────────────────────────────────
  async spawncard({ sock, jid, msg, reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const { data: cards } = await db.supabase.from('cards').select('*').order('id', { ascending: false }).limit(50)
    if (!cards || !cards.length) return reply('❌ No cards in database. Add some first.')
    const card = cards[Math.floor(Math.random() * cards.length)]
    const text =
      `🎴 *CARD SPAWNED!*\n\n` +
      `📛 *Name:* ${card.name}\n` +
      `⭐ *Tier:* ${card.tier}\n` +
      `💰 *Price:* $${(card.price || 0).toLocaleString()}\n\n` +
      `_First to claim wins it!_ 🖤`

    if (card.image_url) {
      const { sendWithImage } = require('../imageHelper')
      await sendWithImage(sock, jid, msg, card.image_url, text, reply)
    } else {
      await sock.sendMessage(jid, { text }, { quoted: msg })
    }
  },

  // ── .us — Upload sticker/image as card ───────────────────────────
  async us({ sock, jid, msg, reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    if (!quoted?.imageMessage) return reply('⚠️ Reply to an image with *.us <name> <tier>*')
    const name = args[0]
    const tier = args[1]?.toUpperCase()
    if (!name || !['T1','T2','T3','T4','T5','T6','TZ'].includes(tier)) {
      return reply('⚠️ Usage: *.us <name> <tier>*\n\nTiers: T1 T2 T3 T4 T5 T6 TZ')
    }
    await reply(`✅ Card *${name}* (${tier}) upload recorded. Use *.shoob* for full Shoob card upload.`)
  },

  // ── .shoob ────────────────────────────────────────────────────────
  async shoob({ reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const name = args[0]
    const tier = args[1]?.toUpperCase()
    if (!name || !tier) return reply('⚠️ Usage: *.shoob <name> <tier>*')
    await reply(`✅ Shoob card *${name}* (${tier}) added to the system.`)
  },

  // ── .frame ────────────────────────────────────────────────────────
  async frame({ reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const name = args[0]
    if (!name) return reply('⚠️ Usage: *.frame <name>*')
    await reply(`✅ Profile frame *${name}* added.`)
  },

  // ── .ban / .unban / .banlist ──────────────────────────────────────
  async ban({ reply, msg, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.ban @user [reason]*')
    const reason = args.filter(a => !a.includes('@')).join(' ') || 'No reason given'
    for (const jid of mentioned) {
      await db.updateUser(jid.split('@')[0], { banned: true })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await reply(`🔨 *BANNED*\n\n${names}\nReason: ${reason}`)
  },

  async unban({ reply, msg, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.unban @user*')
    for (const jid of mentioned) {
      await db.updateUser(jid.split('@')[0], { banned: false })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await reply(`✅ *UNBANNED*\n\n${names}`)
  },

  async banlist({ reply, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const banned = await db.getBannedUsers()
    if (!banned.length) return reply('✅ No banned users.')
    const list = banned.map((u, i) => `${i + 1}. ${u.name || u.phone} (${u.phone})`).join('\n')
    await reply(`🔨 *BAN LIST*\n\n${list}\n\nTotal: ${banned.length}`)
  },

  // ── .disable / .enable ────────────────────────────────────────────
  async disable({ reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const cmd    = args[0]?.toLowerCase()
    const reason = args.slice(1).join(' ') || 'Disabled by staff'
    if (!cmd) return reply('⚠️ Usage: *.disable <command> [reason]*')
    await db.disableCommand(cmd, reason)
    await reply(`🚫 *COMMAND DISABLED*\n\n*.${cmd}* is now disabled.\nReason: ${reason}`)
  },

  async enable({ reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const cmd = args[0]?.toLowerCase()
    if (!cmd) return reply('⚠️ Usage: *.enable <command>*')
    await db.enableCommand(cmd)
    await reply(`✅ *COMMAND ENABLED*\n\n*.${cmd}* is now enabled.`)
  },

  // ── .addrole ──────────────────────────────────────────────────────
  async addrole({ reply, sock, jid, msg, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length || !args[0]) return reply('⚠️ Usage: *.addrole @user <role>*\n\nRoles: mod, guardian, member, card_maker')
    const role  = args.find(a => !a.includes('@'))?.toLowerCase()
    const valid = ['mod', 'guardian', 'member', 'card_maker']
    if (!valid.includes(role)) return reply(`⚠️ Valid roles: ${valid.join(', ')}`)
    const phone = mentioned[0].split('@')[0]
    await db.updateUser(phone, { role })
    await sock.sendMessage(jid, {
      text: `✅ *ROLE SET*\n\n@${phone} is now *${role}*.`,
      mentions: [mentioned[0]],
    }, { quoted: msg })
  },

  // ── .addpremium / .removepremium ──────────────────────────────────
  async addpremium({ reply, sock, jid, msg, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.addpremium @user*')
    for (const jidM of mentioned) {
      const phone = jidM.split('@')[0]
      await db.updateUser(phone, { premium: true, bank: (await db.getOrCreateUser(phone)).bank + 500000 })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, {
      text: `✅ *PREMIUM GRANTED*\n\n👑 ${names} now has premium!\n💰 +500,000 coins added to bank.`,
      mentions: mentioned,
    }, { quoted: msg })
  },

  async removepremium({ reply, msg, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.removepremium @user*')
    for (const jidM of mentioned) {
      await db.updateUser(jidM.split('@')[0], { premium: false })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await reply(`❌ *PREMIUM REMOVED*\n\n${names}`)
  },

  // ── .addprem / .remprem aliases ───────────────────────────────────
  async addprem(ctx) { return module.exports.addpremium(ctx) },
  async remprem(ctx) { return module.exports.removepremium(ctx) },

  // ── .logs ─────────────────────────────────────────────────────────
  async logs({ reply, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    await reply(`📊 *ADMIN LOGS*\n\nLogs are available in your server console.\n\n_Check your Render/hosting dashboard for full logs._ 🖤`)
  },

  // ── .transfer ─────────────────────────────────────────────────────
  async transfer({ reply, msg, isOwner, args }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (mentioned.length < 2) return reply('⚠️ Usage: *.transfer @old @new*')
    const oldPhone = mentioned[0].split('@')[0]
    const newPhone = mentioned[1].split('@')[0]
    const oldUser  = await db.getOrCreateUser(oldPhone)
    await db.updateUser(newPhone, {
      wallet: oldUser.wallet, bank: oldUser.bank, gems: oldUser.gems,
      xp: oldUser.xp, level: oldUser.level, role: oldUser.role,
    })
    await db.updateUser(oldPhone, { wallet: 0, bank: 0, gems: 0, xp: 0, level: 1 })
    await reply(`✅ *TRANSFER COMPLETE*\n\nData moved from @${oldPhone} → @${newPhone}`)
  },

  // ── .post ─────────────────────────────────────────────────────────
  async post({ sock, jid, reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: *.post <message>*')
    await sock.sendMessage(jid, {
      text: `📣 *SHADOW GARDEN ANNOUNCEMENT*\n\n${text}\n\n— *Shadow Garden Staff* 🖤`
    })
  },

  // ── .broadcast ────────────────────────────────────────────────────
  async broadcast({ sock, reply, jid, args, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const message = args.join(' ')
    if (!message) return reply('⚠️ Usage: *.broadcast <message>*')
    await sock.sendMessage(jid, {
      text: `📢 *BROADCAST*\n\n${message}\n\n— *Shadow Garden* 🖤`
    })
  },

  // ── Misc existing staff commands ──────────────────────────────────
  async give({ sock, msg, jid, reply, sender, user, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length || !args[0]) return reply('⚠️ Usage: *.give @user <amount>*')
    const amount = parseInt(args.find(a => !isNaN(parseInt(a))))
    if (!amount || amount <= 0) return reply('⚠️ Enter a valid amount.')
    const target = mentioned[0]; const tp = target.split('@')[0]
    const tu = await db.getOrCreateUser(tp)
    await db.updateUser(tp, { wallet: (tu.wallet || 0) + amount })
    await sock.sendMessage(jid, {
      text: `💸 *STAFF GRANT*\n\n💰 +$${amount.toLocaleString()} given to @${tp}`,
      mentions: [target],
    })
  },
  async givecoins(ctx) { return module.exports.give(ctx) },

  async take({ sock, msg, jid, reply, args, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length || !args[0]) return reply('⚠️ Usage: *.take @user <amount>*')
    const amount = parseInt(args.find(a => !isNaN(parseInt(a))))
    if (!amount || amount <= 0) return reply('⚠️ Enter a valid amount.')
    const target = mentioned[0]; const tp = target.split('@')[0]
    const tu = await db.getOrCreateUser(tp)
    const deduct = Math.min(amount, tu.wallet || 0)
    await db.updateUser(tp, { wallet: (tu.wallet || 0) - deduct })
    await sock.sendMessage(jid, {
      text: `🚫 *STAFF DEDUCT*\n\n-$${deduct.toLocaleString()} taken from @${tp}`,
      mentions: [target],
    })
  },

  async resetuser({ reply, msg, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.resetuser @user*')
    const phone = mentioned[0].split('@')[0]
    await db.updateUser(phone, { wallet: 0, bank: 0, xp: 0, level: 1, streak: 0, gems: 0 })
    await reply(`🔄 *USER RESET*\n\n@${phone} has been reset.`)
  },

  async dbstatus({ reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    try {
      const users = await db.getUserCount()
      const { count: cardCount } = await db.supabase.from('cards').select('*', { count: 'exact', head: true })
      await reply(`🗄️ *DATABASE STATUS*\n\n✅ Connected\n\n👥 Users: ${users}\n🎴 Cards: ${cardCount || 0}`)
    } catch (err) {
      await reply(`❌ *DB ERROR*\n\n${err.message}`)
    }
  },

  async announce({ sock, jid, reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: *.announce <message>*')
    await sock.sendMessage(jid, { text: `📢 *ANNOUNCEMENT*\n\n${text}\n\n_Shadow Garden Official_ 🖤` })
  },

  async setprefix({ reply, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    await reply('ℹ️ Prefix is hardcoded as *.* — contact dev to change.')
  },

  async owner({ reply }) {
    await reply(`👑 *BOT OWNER*\n\nThis bot is managed by Shadow Garden staff.\n\n_The shadows know who rules._ 🖤`)
  },

  // ── Staff menu ────────────────────────────────────────────────────
  async staffmenu({ reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    await reply(
      `╭─『 👑 *Staff Menu* 』\n` +
      `│\n` +
      `│ 💰 *Economy*\n` +
      `│ *.ac <amount> @user* — add cash\n` +
      `│ *.rc <amount> @user* — remove cash\n` +
      `│ *.resetbal @user* — reset balance\n` +
      `│ *.reset @user* — reset full profile\n` +
      `│ *.addinv @user <item>* — add inventory item\n` +
      `│\n` +
      `│ 🎴 *Cards*\n` +
      `│ *.spawncard* — spawn a random card\n` +
      `│ *.us <reply>* — upload card from image\n` +
      `│ *.shoob <name> <tier>* — add Shoob card\n` +
      `│ *.frame <name>* — add profile frame\n` +
      `│\n` +
      `│ 🎮 *Pokémon*\n` +
      `│ *.spawnp <name>* — spawn a Pokémon\n` +
      `│ *.pokemon on/off* — toggle Pokémon\n` +
      `│\n` +
      `│ 👥 *Members*\n` +
      `│ *.addmod @user* — add moderator\n` +
      `│ *.addguardian @user* — add guardian\n` +
      `│ *.recruit @user* — add recruit\n` +
      `│ *.removemod @user* — remove mod\n` +
      `│ *.removeguardian @user* — remove guardian\n` +
      `│ *.addpremium @user* — grant premium\n` +
      `│ *.removepremium @user* — remove premium\n` +
      `│ *.mods / .modlist* — list all staff\n` +
      `│\n` +
      `│ 🚫 *Moderation*\n` +
      `│ *.ban @user* — ban user from bot\n` +
      `│ *.unban @user* — unban user\n` +
      `│ *.banlist* — view banned users\n` +
      `│ *.disable <cmd> <reason>* — disable a command\n` +
      `│ *.enable <cmd>* — re-enable a command\n` +
      `│ *.addrole @user <role>* — set user role\n` +
      `│\n` +
      `│ 🤖 *Bot*\n` +
      `│ *.restart* — reconnect the bot\n` +
      `│ *.logs* — admin panel link\n` +
      `│ *.transfer @old @new* — transfer user data\n` +
      `│ *.post <message>* — post announcement\n` +
      `╰─────────────────────`
    )
  },
}
