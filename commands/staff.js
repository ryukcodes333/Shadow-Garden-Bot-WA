const db = require('../database')

// ── Resolve actual JID from group participants map ────────────────
// phone: stored number (e.g. "2347012345678")
// phoneToJid: built from groupMetadata participants
// Returns actual JID (may be @lid or @s.whatsapp.net), always falls back to @s.whatsapp.net
function resolveJid(phone, phoneToJid) {
  return phoneToJid[phone] || `${phone}@s.whatsapp.net`
}

// Build phone→actualJid map from group metadata (handles @lid users)
async function buildPhoneMap(sock, jid) {
  try {
    const meta = await sock.groupMetadata(jid)
    const map  = {}
    for (const p of meta.participants) {
      // Actual JID may be "number@s.whatsapp.net" or "lid@lid"
      // Extract canonical phone: digits before @, strip ":device" suffix
      const num = p.id.split('@')[0].split(':')[0]
      map[num] = p.id
    }
    return map
  } catch { return {} }
}

const STAFF_ROLES = { MOD: 'mod', GUARDIAN: 'guardian', CARD_MAKER: 'card_maker' }

module.exports = {

  // ── .mods — always use actual participant JIDs ─────────────────
  async mods({ sock, jid, msg, reply, isGroup }) {
    const { data: mods }      = await db.supabase.from('users').select('phone,name').eq('role', 'mod')
    const { data: guardians } = await db.supabase.from('users').select('phone,name').eq('role', 'guardian')

    const modList      = mods      || []
    const guardianList = guardians || []

    // Build phoneToJid map from current group to get real JIDs (avoids LID display)
    const phoneToJid = isGroup ? await buildPhoneMap(sock, jid) : {}

    // Mentions use real JIDs (could be @lid or @s.whatsapp.net)
    const allMentions = [
      ...modList.map(u => resolveJid(u.phone, phoneToJid)),
      ...guardianList.map(u => resolveJid(u.phone, phoneToJid)),
    ]

    // Display text always uses just the phone number (not the @lid number)
    const modLines = modList.length
      ? modList.map((u, i) => `│   ${i === modList.length - 1 ? '└──' : '├──'} @${u.phone}`).join('\n')
      : '│   └── None'

    const guardianLines = guardianList.length
      ? guardianList.map((u, i) => `     ${i === guardianList.length - 1 ? '└──' : '├──'} @${u.phone}`).join('\n')
      : '     └── None'

    const text =
      `┌─「 𝗦𝗧𝗔𝗙𝗙𝗦 」─┐\n` +
      `│\n` +
      `├── 👑 𝗠𝗢𝗗𝗦 👑\n${modLines}\n` +
      `│\n` +
      `└── 🛡️ 𝗚𝗨𝗔𝗥𝗗𝗜𝗔𝗡𝗦 🛡️\n${guardianLines}\n\n` +
      `> ⚠️ Inappropriate use of this command will lead to a *Shadow Ban* from the bot.`

    await sock.sendMessage(jid, { text, mentions: allMentions }, { quoted: msg })
  },

  async modlist(ctx) { return module.exports.mods(ctx) },

  // ── Role management ───────────────────────────────────────────
  async addmod({ reply, sock, jid, msg, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Only owner or mods can add mods.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.addmod @user*')
    for (const jidM of mentioned) await db.updateUser(jidM.split('@')[0], { role: STAFF_ROLES.MOD })
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `✅ *MOD ADDED*\n\n${names} is now a *Moderator*.`, mentions: mentioned }, { quoted: msg })
  },

  async removemod({ reply, sock, jid, msg, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.removemod @user*')
    for (const jidM of mentioned) await db.updateUser(jidM.split('@')[0], { role: 'member' })
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `✅ *MOD REMOVED*\n\n${names} is no longer a moderator.`, mentions: mentioned }, { quoted: msg })
  },

  async addguardian({ reply, sock, jid, msg, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Only owner or mods can add guardians.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.addguardian @user*')
    for (const jidM of mentioned) await db.updateUser(jidM.split('@')[0], { role: STAFF_ROLES.GUARDIAN })
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `✅ *GUARDIAN ADDED*\n\n${names} is now a *Guardian*.`, mentions: mentioned }, { quoted: msg })
  },

  async removeguardian({ reply, sock, jid, msg, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Only owner or mods can remove guardians.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.removeguardian @user*')
    for (const jidM of mentioned) await db.updateUser(jidM.split('@')[0], { role: 'member' })
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `✅ *GUARDIAN REMOVED*\n\n${names} is no longer a guardian.`, mentions: mentioned }, { quoted: msg })
  },

  async recruit({ sock, jid, msg, reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.recruit @user*')
    for (const jidM of mentioned) await db.updateUser(jidM.split('@')[0], { role: STAFF_ROLES.CARD_MAKER })
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `🎴 *CARD MAKER RECRUITED*\n\n${names} can now upload cards.`, mentions: mentioned }, { quoted: msg })
  },

  async firerecruit({ sock, jid, msg, reply, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.firerecruit @user*')
    for (const jidM of mentioned) await db.updateUser(jidM.split('@')[0], { role: 'member' })
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `❌ *CARD MAKER REMOVED*\n\n${names} can no longer upload cards.`, mentions: mentioned }, { quoted: msg })
  },

  // ── Economy ───────────────────────────────────────────────────
  async ac({ reply, sock, jid, msg, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.ac <amount> @user*')
    const amount = parseInt(args.find(a => !isNaN(parseInt(a))))
    if (!amount || amount <= 0) return reply('⚠️ Enter a valid amount.')
    const phone  = mentioned[0].split('@')[0]
    const tu     = await db.getOrCreateUser(phone)
    const newBal = (tu.wallet || 0) + amount
    await db.updateUser(phone, { wallet: newBal })
    await sock.sendMessage(jid, { text: `💰 *CASH ADDED*\n\n✅ +$${amount.toLocaleString()} → @${phone}\n💵 Balance: $${newBal.toLocaleString()}`, mentions: [mentioned[0]] }, { quoted: msg })
  },

  async rc({ reply, sock, jid, msg, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.rc <amount> @user*')
    const amount = parseInt(args.find(a => !isNaN(parseInt(a))))
    if (!amount || amount <= 0) return reply('⚠️ Enter a valid amount.')
    const phone  = mentioned[0].split('@')[0]
    const tu     = await db.getOrCreateUser(phone)
    const deduct = Math.min(amount, tu.wallet || 0)
    await db.updateUser(phone, { wallet: (tu.wallet || 0) - deduct })
    await sock.sendMessage(jid, { text: `🚫 *CASH REMOVED*\n\n-$${deduct.toLocaleString()} from @${phone}\n💵 Balance: $${((tu.wallet || 0) - deduct).toLocaleString()}`, mentions: [mentioned[0]] }, { quoted: msg })
  },

  async resetbal({ reply, msg, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.resetbal @user*')
    await db.updateUser(mentioned[0].split('@')[0], { wallet: 0, bank: 0 })
    await reply(`✅ Balance reset for @${mentioned[0].split('@')[0]}.`)
  },

  async reset({ reply, msg, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.reset @user*')
    const phone = mentioned[0].split('@')[0]
    await db.updateUser(phone, { wallet: 0, bank: 0, xp: 0, level: 1, streak: 0, gems: 0, banned: false })
    await reply(`🔄 *USER RESET*\n\n@${phone} fully reset.`)
  },

  async addinv({ reply, sock, jid, msg, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.addinv @user <item>*')
    const item  = args.filter(a => !a.includes('@')).join(' ')
    const phone = mentioned[0].split('@')[0]
    try { await db.addItem(phone, item, 1) } catch {}
    await sock.sendMessage(jid, { text: `🎒 *ITEM ADDED*\n\n✅ *${item}* → @${phone}`, mentions: [mentioned[0]] }, { quoted: msg })
  },

  // ── Cards ─────────────────────────────────────────────────────
  async spawncard({ sock, jid, msg, reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const { data: cards } = await db.supabase.from('cards').select('*').order('id', { ascending: false }).limit(50)
    if (!cards || !cards.length) return reply('❌ No cards in database.')
    const card = cards[Math.floor(Math.random() * cards.length)]
    const text = `🎴 *CARD SPAWNED!*\n\n📛 *Name:* ${card.name}\n⭐ *Tier:* ${card.tier}\n💰 *Price:* $${(card.price || 0).toLocaleString()}\n\n_First to claim wins it!_ 🖤`
    if (card.image_url) {
      const { sendWithImage } = require('../imageHelper')
      await sendWithImage(sock, jid, msg, card.image_url, text, reply)
    } else {
      await sock.sendMessage(jid, { text }, { quoted: msg })
    }
  },

  async us({ reply, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    await reply('ℹ️ Use *.upload* command to add card images via the full upload flow.')
  },

  async shoob({ reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const name = args[0]; const tier = args[1]?.toUpperCase()
    if (!name || !tier) return reply('⚠️ Usage: *.shoob <name> <tier>*')
    await reply(`✅ Shoob card *${name}* (${tier}) recorded.`)
  },

  async frame({ reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    await reply(`✅ Frame *${args[0] || '?'}* noted. Use the full admin panel to manage frames.`)
  },

  // ── Moderation ────────────────────────────────────────────────
  async ban({ reply, msg, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.ban @user [reason]*')
    const reason = args.filter(a => !a.includes('@')).join(' ') || 'No reason given'
    for (const j of mentioned) await db.updateUser(j.split('@')[0], { banned: true })
    await reply(`🔨 *BANNED*\n\n${mentioned.map(j => `@${j.split('@')[0]}`).join(', ')}\nReason: ${reason}`)
  },

  async unban({ reply, msg, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.unban @user*')
    for (const j of mentioned) await db.updateUser(j.split('@')[0], { banned: false })
    await reply(`✅ *UNBANNED*\n\n${mentioned.map(j => `@${j.split('@')[0]}`).join(', ')}`)
  },

  async banlist({ reply, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const banned = await db.getBannedUsers()
    if (!banned.length) return reply('✅ No banned users.')
    const list = banned.map((u, i) => `${i + 1}. ${u.name || u.phone} (${u.phone})`).join('\n')
    await reply(`🔨 *BAN LIST* (${banned.length})\n\n${list}`)
  },

  async disable({ reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const cmd    = args[0]?.toLowerCase()
    const reason = args.slice(1).join(' ') || 'Disabled by staff'
    if (!cmd) return reply('⚠️ Usage: *.disable <command> [reason]*')
    await db.disableCommand(cmd, reason)
    await reply(`🚫 *COMMAND DISABLED*\n\n*.${cmd}* is now off.\nReason: ${reason}`)
  },

  async enable({ reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const cmd = args[0]?.toLowerCase()
    if (!cmd) return reply('⚠️ Usage: *.enable <command>*')
    await db.enableCommand(cmd)
    await reply(`✅ *COMMAND ENABLED*\n\n*.${cmd}* is back on.`)
  },

  async addrole({ reply, sock, jid, msg, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length || !args[0]) return reply('⚠️ Usage: *.addrole @user <role>*\n\nRoles: mod, guardian, member, card_maker')
    const role  = args.find(a => !a.includes('@'))?.toLowerCase()
    const valid = ['mod', 'guardian', 'member', 'card_maker']
    if (!valid.includes(role)) return reply(`⚠️ Valid roles: ${valid.join(', ')}`)
    const phone = mentioned[0].split('@')[0]
    await db.updateUser(phone, { role })
    await sock.sendMessage(jid, { text: `✅ *ROLE SET*\n\n@${phone} is now *${role}*.`, mentions: [mentioned[0]] }, { quoted: msg })
  },

  async addpremium({ reply, sock, jid, msg, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.addpremium @user*')
    for (const jidM of mentioned) {
      const phone = jidM.split('@')[0]
      const u = await db.getOrCreateUser(phone)
      await db.updateUser(phone, { premium: true, bank: (u.bank || 0) + 500000 })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `✅ *PREMIUM GRANTED*\n\n👑 ${names} now has premium!\n💰 +500,000 coins to bank.`, mentions: mentioned }, { quoted: msg })
  },
  async addprem(ctx) { return module.exports.addpremium(ctx) },

  async removepremium({ reply, msg, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.removepremium @user*')
    for (const jidM of mentioned) await db.updateUser(jidM.split('@')[0], { premium: false })
    await reply(`❌ *PREMIUM REMOVED*\n\n${mentioned.map(j => `@${j.split('@')[0]}`).join(', ')}`)
  },
  async remprem(ctx) { return module.exports.removepremium(ctx) },

  // ── Bot management ────────────────────────────────────────────
  async logs({ reply, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    await reply(`📊 *ADMIN LOGS*\n\nCheck your server console / hosting dashboard for full logs.`)
  },

  async transfer({ reply, msg, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (mentioned.length < 2) return reply('⚠️ Usage: *.transfer @old @new*')
    const oldPhone = mentioned[0].split('@')[0]
    const newPhone = mentioned[1].split('@')[0]
    const oldUser  = await db.getOrCreateUser(oldPhone)
    await db.updateUser(newPhone, { wallet: oldUser.wallet, bank: oldUser.bank, gems: oldUser.gems, xp: oldUser.xp, level: oldUser.level, role: oldUser.role })
    await db.updateUser(oldPhone, { wallet: 0, bank: 0, gems: 0, xp: 0, level: 1 })
    await reply(`✅ *TRANSFER COMPLETE*\n\n@${oldPhone} → @${newPhone}`)
  },

  async post({ sock, jid, reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: *.post <message>*')
    await sock.sendMessage(jid, { text: `📣 *SHADOW GARDEN ANNOUNCEMENT*\n\n${text}\n\n— *Shadow Garden Staff* 🖤` })
  },

  async broadcast({ sock, reply, jid, args, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const message = args.join(' ')
    if (!message) return reply('⚠️ Usage: *.broadcast <message>*')
    await sock.sendMessage(jid, { text: `📢 *BROADCAST*\n\n${message}\n\n— *Shadow Garden* 🖤` })
  },

  async announce({ sock, jid, reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: *.announce <message>*')
    await sock.sendMessage(jid, { text: `📢 *ANNOUNCEMENT*\n\n${text}\n\n_Shadow Garden Official_ 🖤` })
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

  async give({ sock, msg, jid, reply, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.give @user <amount>*')
    const amount = parseInt(args.find(a => !isNaN(parseInt(a))))
    if (!amount || amount <= 0) return reply('⚠️ Valid amount required.')
    const phone = mentioned[0].split('@')[0]
    const tu    = await db.getOrCreateUser(phone)
    await db.updateUser(phone, { wallet: (tu.wallet || 0) + amount })
    await sock.sendMessage(jid, { text: `💸 *STAFF GRANT*\n\n+$${amount.toLocaleString()} → @${phone}`, mentions: [mentioned[0]] })
  },
  async givecoins(ctx) { return module.exports.give(ctx) },

  async take({ sock, msg, jid, reply, args, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.take @user <amount>*')
    const amount = parseInt(args.find(a => !isNaN(parseInt(a))))
    if (!amount || amount <= 0) return reply('⚠️ Valid amount required.')
    const phone  = mentioned[0].split('@')[0]
    const tu     = await db.getOrCreateUser(phone)
    const deduct = Math.min(amount, tu.wallet || 0)
    await db.updateUser(phone, { wallet: (tu.wallet || 0) - deduct })
    await sock.sendMessage(jid, { text: `🚫 *STAFF DEDUCT*\n\n-$${deduct.toLocaleString()} from @${phone}`, mentions: [mentioned[0]] })
  },

  async resetuser({ reply, msg, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.resetuser @user*')
    const phone = mentioned[0].split('@')[0]
    await db.updateUser(phone, { wallet: 0, bank: 0, xp: 0, level: 1, streak: 0, gems: 0 })
    await reply(`🔄 *USER RESET*\n\n@${phone} reset.`)
  },

  async owner({ reply }) {
    await reply(`👑 *BOT OWNER*\n\nThis bot is managed by Shadow Garden staff.\n\n_The shadows know who rules._ 🖤`)
  },

  async setprefix({ reply, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    await reply('ℹ️ Prefix is hardcoded as *.* — contact dev to change.')
  },

  // ── Staff menu ────────────────────────────────────────────────
  async staffmenu({ reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    await reply(
      `╭─『 👑 *Staff Menu* 』\n│\n` +
      `│ 💰 *Economy*\n│ *.ac <amount> @user* — add cash\n│ *.rc <amount> @user* — remove cash\n│ *.resetbal @user* — reset balance\n│ *.reset @user* — full reset\n│ *.addinv @user <item>* — add inventory item\n│\n` +
      `│ 🎴 *Cards*\n│ *.spawncard* — spawn random card\n│ *.shoob <name> <tier>* — add Shoob card\n│\n` +
      `│ 🎮 *Pokémon*\n│ *#spawnp <name>* — spawn specific Pokémon\n│ *.pokemon on/off* — toggle Pokémon system\n│\n` +
      `│ 👥 *Members*\n│ *.addmod @user* — add moderator\n│ *.addguardian @user* — add guardian\n│ *.recruit @user* — add card maker\n│ *.removemod / .removeguardian*\n│ *.addpremium / .removepremium*\n│ *.mods / .modlist* — view staff\n│\n` +
      `│ 🚫 *Moderation*\n│ *.ban / .unban / .banlist*\n│ *.disable / .enable <cmd>*\n│ *.addrole @user <role>*\n│\n` +
      `│ 🤖 *Bot*\n│ *.restart* — reboot bot\n│ *.logs* — check logs\n│ *.transfer @old @new*\n│ *.post <message>*\n` +
      `╰─────────────────────`
    )
  },
}
