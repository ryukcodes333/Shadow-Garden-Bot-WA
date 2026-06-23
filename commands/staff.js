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

// ── Per-group command disable (in-memory + DB backed) ────────────
const groupDisabled = {}

async function loadGroupDisabled(groupJid) {
  if (!groupDisabled[groupJid]) {
    try {
      const disabled = await db.getGroupDisabledCmds(groupJid)
      groupDisabled[groupJid] = new Set(disabled || [])
    } catch {
      groupDisabled[groupJid] = new Set()
    }
  }
  return groupDisabled[groupJid]
}

async function saveGroupDisabled(groupJid) {
  try {
    await db.setGroupDisabledCmds(groupJid, [...(groupDisabled[groupJid] || [])])
  } catch (e) {
    console.error('[saveGroupDisabled]', e.message)
  }
}


module.exports = {

  // Exported helper — used by index.js for gamble/pokemon group checks
  loadGroupDisabled,

  // ── .mods - always use actual participant JIDs ─────────────────
  async mods({ sock, jid, msg, reply, isGroup, sender, pushName }) {
    const allStaff     = await db.getMods()
    const modList      = allStaff.filter(u => u.role === 'mod')
    const guardianList = allStaff.filter(u => u.role === 'guardian')

    // Build phoneToJid map from current group to get real JIDs (avoids LID display)
    const phoneToJid = isGroup ? await buildPhoneMap(sock, jid) : {}

    // Mentions use real JIDs (could be @lid or @s.whatsapp.net)
    const allMentions = [
      ...modList.map(u => resolveJid(u.phone, phoneToJid)),
      ...guardianList.map(u => resolveJid(u.phone, phoneToJid)),
    ]

    // Display text always uses just the phone number (not the @lid number)
    const callerName = pushName || sender || 'there'
    const modLines = modList.length
      ? modList.map(u => `⌬ @${u.phone}`).join('\n')
      : '(none)'

    const guardianLines = guardianList.length
      ? guardianList.map(u => `◈ @${u.phone}`).join('\n')
      : '(none)'

    const text =
      `╔═════ ⋆⋅☆⋅⋆ ═════╗\n` +
      `          👑 𝗠𝗢𝗗𝗦 👑\n` +
      `╚═════ ⋆⋅☆⋅⋆ ═════╝\n\n` +
      `${modLines}\n\n` +
      `╔════ ⋆⋅🛡️⋅⋆ ════╗\n` +
      `         𝗚𝗨𝗔𝗥𝗗𝗜𝗔𝗡𝗦\n` +
      `╚════ ⋆⋅⚔️⋅⋆ ════╝\n\n` +
      `${guardianLines}\n\n` +
      `> *DO NOT* spam their DMs to *avoid getting blocked* 🚫`
    await sock.sendMessage(jid, { text, mentions: allMentions }, { quoted: msg })
  },

  async modlist(ctx) { return module.exports.mods(ctx) },

  // ── Role management ───────────────────────────────────────────
  async addmod({ reply, sock, jid, msg, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.addmod @user`')
    for (const jidM of mentioned) await db.updateUser(jidM.split('@')[0].split(':')[0], { role: STAFF_ROLES.MOD })
    const names = mentioned.map(j => `@${j.split('@')[0].split(':')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `✅ *MOD ADDED*\n\n${names} is now a *Moderator*.`, mentions: mentioned }, { quoted: msg })
  },

  async removemod({ reply, sock, jid, msg, isOwner }) {
    if (!isOwner) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.removemod @user`')
    for (const jidM of mentioned) await db.updateUser(jidM.split('@')[0].split(':')[0], { role: 'member' })
    const names = mentioned.map(j => `@${j.split('@')[0].split(':')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `✅ *MOD REMOVED*\n\n${names} is no longer a moderator.`, mentions: mentioned }, { quoted: msg })
  },

  async addguardian({ reply, sock, jid, msg, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.addguardian @user`')
    for (const jidM of mentioned) await db.updateUser(jidM.split('@')[0].split(':')[0], { role: STAFF_ROLES.GUARDIAN })
    const names = mentioned.map(j => `@${j.split('@')[0].split(':')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `✅ *GUARDIAN ADDED*\n\n${names} is now a *Guardian*.`, mentions: mentioned }, { quoted: msg })
  },

  async removeguardian({ reply, sock, jid, msg, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.removeguardian @user`')
    for (const jidM of mentioned) await db.updateUser(jidM.split('@')[0].split(':')[0], { role: 'member' })
    const names = mentioned.map(j => `@${j.split('@')[0].split(':')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `✅ *GUARDIAN REMOVED*\n\n${names} is no longer a guardian.`, mentions: mentioned }, { quoted: msg })
  },

  async recruit({ sock, jid, msg, reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.recruit @user`')
    for (const jidM of mentioned) await db.updateUser(jidM.split('@')[0].split(':')[0], { role: STAFF_ROLES.CARD_MAKER })
    const names = mentioned.map(j => `@${j.split('@')[0].split(':')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `🎴 *CARD MAKER RECRUITED*\n\n${names} can now upload cards.`, mentions: mentioned }, { quoted: msg })
  },

  async firerecruit({ sock, jid, msg, reply, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.firerecruit @user`')
    for (const jidM of mentioned) await db.updateUser(jidM.split('@')[0].split(':')[0], { role: 'member' })
    const names = mentioned.map(j => `@${j.split('@')[0].split(':')[0]}`).join(', ')
    await sock.sendMessage(jid, { text: `❌ *CARD MAKER REMOVED*\n\n${names} can no longer upload cards.`, mentions: mentioned }, { quoted: msg })
  },

  // ── Economy ───────────────────────────────────────────────────
  async ac({ reply, sock, jid, msg, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.ac <amount> @user`')
    const amount = parseInt(args.find(a => !isNaN(parseInt(a))))
    if (!amount || amount <= 0) return reply('❌ Enter a valid amount.')
    const phone  = mentioned[0].split('@')[0]
    const tu     = await db.getOrCreateUser(phone)
    const newBal = (tu.wallet || 0) + amount
    await db.updateUser(phone, { wallet: newBal })
    await sock.sendMessage(jid, { text: `💰 *CASH ADDED*\n\n✅ +£${amount.toLocaleString()} → @${phone}\n💵 Balance: £${newBal.toLocaleString()}`, mentions: [mentioned[0]] }, { quoted: msg })
  },

  async rc({ reply, sock, jid, msg, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.rc <amount> @user`')
    const amount = parseInt(args.find(a => !isNaN(parseInt(a))))
    if (!amount || amount <= 0) return reply('❌ Enter a valid amount.')
    const phone  = mentioned[0].split('@')[0]
    const tu     = await db.getOrCreateUser(phone)
    // Remove from wallet first, then bank for the remainder
    let remaining   = amount
    const fromWallet = Math.min(remaining, tu.wallet || 0)
    remaining -= fromWallet
    const fromBank   = Math.min(remaining, tu.bank || 0)
    const totalRemoved = fromWallet + fromBank
    await db.updateUser(phone, {
      wallet: (tu.wallet || 0) - fromWallet,
      bank:   (tu.bank   || 0) - fromBank,
    })
    const newWallet = (tu.wallet || 0) - fromWallet
    const newBank   = (tu.bank   || 0) - fromBank
    await sock.sendMessage(jid, {
      text: `🚫 *CASH REMOVED*\n\n-£${totalRemoved.toLocaleString()} from @${phone}\n💵 Wallet: £${newWallet.toLocaleString()}\n🏦 Bank: £${newBank.toLocaleString()}`,
      mentions: [mentioned[0]],
    }, { quoted: msg })
  },

  async resetbal({ reply, msg, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.resetbal @user`')
    await db.updateUser(mentioned[0].split('@')[0], { wallet: 0, bank: 0 })
    await reply(`✅ Balance reset for @${mentioned[0].split('@')[0]}.`)
  },

  async reset({ reply, msg, isOwner }) {
    if (!isOwner) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.reset @user`')
    const phone = mentioned[0].split('@')[0]
    await db.updateUser(phone, { wallet: 0, bank: 0, xp: 0, level: 1, streak: 0, gems: 0, banned: false })
    await reply(`🔄 *USER RESET*\n\n@${phone} fully reset.`)
  },

  async addinv({ reply, sock, jid, msg, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.addinv @user <item>`')
    const item  = args.filter(a => !a.includes('@')).join(' ')
    const phone = mentioned[0].split('@')[0]
    try { await db.addItem(phone, item, 1) } catch {}
    await sock.sendMessage(jid, { text: `🎒 *ITEM ADDED*\n\n✅ *${item}* → @${phone}`, mentions: [mentioned[0]] }, { quoted: msg })
  },

  // ── Cards ─────────────────────────────────────────────────────
  async spawncard({ sock, jid, msg, reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    const cards = await db.getCards()
    if (!cards || !cards.length) return reply('❌ No cards in database.')
    const card = cards[Math.floor(Math.random() * cards.length)]
    const text = `🎴 *CARD SPAWNED!*\n\n📛 *Name:* ${card.name}\n⭐ *Tier:* ${card.tier}\n💰 *Price:* £${(card.price || 0).toLocaleString()}\n\n_First to claim wins it!_ 🖤`
    if (card.image_url) {
      const { sendWithImage } = require('../imageHelper')
      await sendWithImage(sock, jid, msg, card.image_url, text, reply)
    } else {
      await sock.sendMessage(jid, { text }, { quoted: msg })
    }
  },

  async us({ reply, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
    await reply('ℹ️ Use *.upload* command to add card images via the full upload flow.')
  },

  async shoob({ reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
    const name = args[0]; const tier = args[1]?.toUpperCase()
    if (!name || !tier) return reply('⚠️ Usage: *.shoob <name> <tier>*')
    await reply(`✅ Shoob card *${name}* (${tier}) recorded.`)
  },

  async frame({ reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
    await reply(`✅ Frame *${args[0] || '?'}* noted. Use the full admin panel to manage frames.`)
  },

  // ── Moderation ────────────────────────────────────────────────
  async ban({ reply, msg, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.ban @user [reason]`')
    const reason = args.filter(a => !a.includes('@')).join(' ') || 'No reason given'
    for (const j of mentioned) await db.updateUser(j.split('@')[0].split(':')[0], { banned: true })
    await reply(`🔨 *BANNED*\n\n${mentioned.map(j => `@${j.split('@')[0].split(':')[0]}`).join(', ')}\nReason: ${reason}`)
  },

  async unban({ reply, msg, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.unban @user`')
    for (const j of mentioned) await db.updateUser(j.split('@')[0].split(':')[0], { banned: false })
    await reply(`✅ *UNBANNED*\n\n${mentioned.map(j => `@${j.split('@')[0].split(':')[0]}`).join(', ')}`)
  },

  async banlist({ reply, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
    const banned = await db.getBannedUsers()
    if (!banned.length) return reply('✅ No banned users.')
    const list = banned.map((u, i) => `${i + 1}. ${u.name || u.phone} (${u.phone})`).join('\n')
    await reply(`🔨 *BAN LIST* (${banned.length})\n\n${list}`)
  },

  async disable({ reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
    const cmd    = args[0]?.toLowerCase()
    const reason = args.slice(1).join(' ') || 'Disabled by staff'
    if (!cmd) return reply('⚠️ Usage: *.disable <command> [reason]*')
    await db.disableCommand(cmd, reason)
    await reply(`🚫 *COMMAND DISABLED*\n\n*.${cmd}* is now off.\nReason: ${reason}`)
  },

  async enable({ reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
    const cmd = args[0]?.toLowerCase()
    if (!cmd) return reply('⚠️ Usage: *.enable <command>*')
    await db.enableCommand(cmd)
    await reply(`✅ *COMMAND ENABLED*\n\n*.${cmd}* is back on.`)
  },

  async addrole({ reply, sock, jid, msg, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
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
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
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
    if (!isOwner) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.removepremium @user*')
    for (const jidM of mentioned) await db.updateUser(jidM.split('@')[0], { premium: false })
    await reply(`❌ *PREMIUM REMOVED*\n\n${mentioned.map(j => `@${j.split('@')[0]}`).join(', ')}`)
  },
  async remprem(ctx) { return module.exports.removepremium(ctx) },

  // ── Bot management ────────────────────────────────────────────
  async logs({ reply, isOwner }) {
    if (!isOwner) return reply('*🚫 Access Denied*')
    await reply(`📊 *ADMIN LOGS*\n\nCheck your server console / hosting dashboard for full logs.`)
  },

  async transfer({ reply, msg, isOwner }) {
    if (!isOwner) return reply('*🚫 Access Denied*')
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
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: *.post <message>*')
    await sock.sendMessage(jid, { text: `📣 *KONOSUBA ANNOUNCEMENT*\n\n${text}\n\n- *Konosuba Staff* 🖤` })
  },

  async broadcast({ sock, reply, jid, args, isOwner }) {
    if (!isOwner) return reply('*🚫 Access Denied*')
    const message = args.join(' ')
    if (!message) return reply('⚠️ Usage: *.broadcast <message>*')
    await sock.sendMessage(jid, { text: `📢 *BROADCAST*\n\n${message}\n\n- *Konosuba* 🖤` })
  },

  async announce({ sock, jid, reply, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
    const text = args.join(' ')
    if (!text) return reply('⚠️ Usage: *.announce <message>*')
    await sock.sendMessage(jid, { text: `📢 *ANNOUNCEMENT*\n\n${text}\n\n_Konosuba Official_ 🖤` })
  },

  async dbstatus({ reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    try {
      const users = await db.getUserCount()
      const cards = await db.getCards()
      await reply(`🗄️ *DATABASE STATUS*\n\n✅ Connected (MongoDB)\n\n👥 Users: ${users}\n🎴 Cards: ${cards.length || 0}`)
    } catch (err) {
      await reply(`❌ *DB ERROR*\n\n${err.message}`)
    }
  },

  async give({ sock, msg, jid, reply, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.give @user <amount>*')
    const amount = parseInt(args.find(a => !isNaN(parseInt(a))))
    if (!amount || amount <= 0) return reply('❌ Valid amount required.')
    const phone = mentioned[0].split('@')[0]
    const tu    = await db.getOrCreateUser(phone)
    await db.updateUser(phone, { wallet: (tu.wallet || 0) + amount })
    await sock.sendMessage(jid, { text: `💸 *STAFF GRANT*\n\n+£${amount.toLocaleString()} → @${phone}`, mentions: [mentioned[0]] })
  },
  async givecoins(ctx) { return module.exports.give(ctx) },

  async take({ sock, msg, jid, reply, args, isOwner }) {
    if (!isOwner) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.take @user <amount>*')
    const amount = parseInt(args.find(a => !isNaN(parseInt(a))))
    if (!amount || amount <= 0) return reply('❌ Valid amount required.')
    const phone  = mentioned[0].split('@')[0]
    const tu     = await db.getOrCreateUser(phone)
    const deduct = Math.min(amount, tu.wallet || 0)
    await db.updateUser(phone, { wallet: (tu.wallet || 0) - deduct })
    await sock.sendMessage(jid, { text: `🚫 *STAFF DEDUCT*\n\n-£${deduct.toLocaleString()} from @${phone}`, mentions: [mentioned[0]] })
  },

  async resetuser({ reply, msg, isOwner }) {
    if (!isOwner) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.resetuser @user*')
    const phone = mentioned[0].split('@')[0]
    await db.updateUser(phone, { wallet: 0, bank: 0, xp: 0, level: 1, streak: 0, gems: 0 })
    await reply(`🔄 *USER RESET*\n\n@${phone} reset.`)
  },

  async owner({ reply }) {
    await reply(`👑 *BOT OWNER*\n\nThis bot is managed by Konosuba staff.`)
  },

  async setprefix({ reply, isOwner }) {
    if (!isOwner) return reply('*🚫 Access Denied*')
    await reply('ℹ️ Prefix is hardcoded as *.* - contact dev to change.')
  },

  // ── Staff menu ────────────────────────────────────────────────
  async staffmenu({ reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    await reply(
      `╭─『 👑 *Staff Menu* 』\n│\n` +
      `│ 💰 *Economy*\n│ *.ac <amount> @user* - add cash\n│ *.rc <amount> @user* - remove cash\n│ *.resetbal @user* - reset balance\n│ *.reset @user* - full reset\n│ *.addinv @user <item>* - add inventory item\n│\n` +
      `│ 🎴 *Cards*\n│ *.spawncard* - spawn random card\n│ *.shoob <name> <tier>* - add Shoob card\n│\n` +
      `│ 🎮 *Pokémon*\n│ *#spawnp <name>* - spawn specific Pokémon\n│ *.pokemon on/off* - toggle Pokémon system\n│\n` +
      `│ 👥 *Members*\n│ *.addmod @user* - add moderator\n│ *.addguardian @user* - add guardian\n│ *.recruit @user* - add card maker\n│ *.removemod / .removeguardian*\n│ *.addpremium / .removepremium*\n│ *.mods / .modlist* - view staff\n│\n` +
      `│ 🚫 *Moderation*\n│ *.ban / .unban / .banlist*\n│ *.disable / .enable <cmd>*\n│ *.addrole @user <role>*\n│\n` +
      `│ 🤖 *Bot*\n│ *.restart* - reboot bot\n│ *.logs* - check logs\n│ *.transfer @old @new*\n│ *.post <message>*\n` +
      `╰─────────────────────`
    )
  },

  // ── Group management for owner/mod/guardian ─────────────────
  async join({ sock, jid, args, isOwner, isMod, isGuardian, reply }) {
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    const link = args[0]
    if (!link || !link.includes('chat.whatsapp.com/')) return reply('❌ Usage: *.join <invite link>*\n\nExample: *.join https://chat.whatsapp.com/XXXX*')
    const code = link.split('chat.whatsapp.com/').pop().split(/[?&]/)[0].trim()
    if (!code) return reply('❌ Invalid invite link.')
    try {
      await sock.groupAcceptInvite(code)
      await reply('✅ *Joined group successfully!*')
    } catch (err) {
      await reply(`❌ Failed to join: ${err.message || 'Invalid or expired invite link.'}`)
    }
  },

  async exit({ sock, jid, isOwner, isMod, isGuardian, isGroup, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    await reply('👋 *Leaving this group...*')
    try {
      await sock.groupLeave(jid)
    } catch (err) {
      await reply(`❌ Failed to leave: ${err.message}`)
    }
  },

  async listgc({ sock, jid, isOwner, isMod, isGuardian, reply }) {
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    try {
      const groups = await sock.groupFetchAllParticipating()
      const list   = Object.values(groups)
      if (!list.length) return reply('📋 Bot is not in any groups.')
      const lines  = list.map((g, i) => `${i + 1}. *${g.subject}* - ${g.participants.length} members`).join('\n')
      await reply(`📋 *Groups Bot is In (${list.length})*\n\n${lines}`)
    } catch (err) {
      await reply(`❌ Error fetching groups: ${err.message}`)
    }
  },

  async myrole({ reply, sender, user, isOwner, isMod, isGuardian }) {
    const role = isOwner ? '👑 Owner' : isMod ? '⚙️ Moderator' : isGuardian ? '🛡️ Guardian' : (user?.role || 'Member')
    await reply(`🎭 *Your Role*\n\n${role}`)
  },

  // ── .resetallusers — owner only, deletes every user document ────────────
  async resetallusers({ reply, isOwner, args }) {
    if (!isOwner) return reply('*🚫 Access Denied* — Owner only command.')

    const confirm = (args[0] || '').toUpperCase()
    if (confirm !== 'CONFIRM') {
      return reply(
        `⚠️ *RESET ALL USERS*\n\n` +
        `This will *permanently delete ALL user profiles* from the database.\n` +
        `Cards, warnings, Pokémon, and other data are NOT affected — only user accounts.\n\n` +
        `Everyone will need to re-register using *.reg <name> | <password>*\n\n` +
        `*To confirm, type:*\n` +
        `_.resetallusers CONFIRM_`
      )
    }

    const db = require('../database')
    const count = await db.deleteAllUsers()

    await reply(
      `🗑️ *ALL USERS DELETED*\n\n` +
      `*${count}* user profiles have been removed from the database.\n\n` +
      `Users must now re-register using:\n` +
      `*.reg <name> | <password>*\n\n` +
      `_The slate is clean._ 🌑`
    )
  },

  // ── Per-group disable/enable ────────────────────────────────────
  async gdisable({ reply, isOwner, isMod, isGuardian, isGroup, jid, args }) {
    if (!isGroup) return reply('❌ Groups only.')
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    const cmd = (args[0] || '').toLowerCase().replace(/^\./, '')
    if (!cmd) return reply('⚠️ Usage: *.gdisable <command>*')
    const safe = ['gdisable','genable','disable','enable','addmod','removemod','staffmenu']
    if (safe.includes(cmd)) return reply(`❌ Cannot disable *${cmd}* — protected.`)
    const disabled = await loadGroupDisabled(jid)
    disabled.add(cmd)
    await saveGroupDisabled(jid)
    await reply(`🔒 *.${cmd}* disabled in this group.\n\nUse *.genable ${cmd}* to re-enable.`)
  },

  async genable({ reply, isOwner, isMod, isGuardian, isGroup, jid, args }) {
    if (!isGroup) return reply('❌ Groups only.')
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    const cmd = (args[0] || '').toLowerCase().replace(/^\./, '')
    if (!cmd) return reply('⚠️ Usage: *.genable <command>*')
    const disabled = await loadGroupDisabled(jid)
    disabled.delete(cmd)
    await saveGroupDisabled(jid)
    await reply(`✅ *.${cmd}* re-enabled in this group.`)
  },

  async gdisabledlist({ reply, isGroup, jid }) {
    if (!isGroup) return reply('❌ Groups only.')
    const disabled = await loadGroupDisabled(jid)
    if (disabled.size === 0) return reply('✅ No commands are disabled in this group.')
    const list = [...disabled].map(c => `• *.${c}*`).join('\n')
    return reply(`🔒 *Disabled commands in this group:*\n\n${list}\n\nUse *.genable <cmd>* to re-enable any.`)
  },

  // ── .gamble on/off — toggle gambling in this group ──────────────
  async gamble({ reply, isOwner, isMod, isGuardian, isGroup, jid, args }) {
    if (!isGroup) return reply('❌ Groups only.')
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    const sub = (args[0] || '').toLowerCase()
    if (sub !== 'on' && sub !== 'off') return reply('Usage: *.gamble on* or *.gamble off*')
    const disabled = await loadGroupDisabled(jid)
    if (sub === 'off') {
      disabled.add('__GAMBLE_OFF__')
      await saveGroupDisabled(jid)
      return reply('🎰 Gambling has been *disabled* in this group.')
    } else {
      disabled.delete('__GAMBLE_OFF__')
      await saveGroupDisabled(jid)
      return reply('🎰 Gambling has been *enabled* in this group.')
    }
  },

  // ── .pokemon on/off — toggle Pokémon in this group ──────────────
  async pokemon({ reply, isOwner, isMod, isGuardian, isGroup, jid, args }) {
    if (!isGroup) return reply('❌ Groups only.')
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    const sub = (args[0] || '').toLowerCase()
    if (sub !== 'on' && sub !== 'off') return reply('Usage: *.pokemon on* or *.pokemon off*')
    const disabled = await loadGroupDisabled(jid)
    if (sub === 'off') {
      disabled.add('__POKEMON_OFF__')
      await saveGroupDisabled(jid)
      return reply('🎮 Pokémon has been *disabled* in this group.')
    } else {
      disabled.delete('__POKEMON_OFF__')
      await saveGroupDisabled(jid)
      return reply('🎮 Pokémon has been *enabled* in this group.')
    }
  },

  async gambleoff({ reply, isOwner, isMod, isGuardian, isGroup, jid }) {
    return module.exports.gdisable({ reply, isOwner, isMod, isGuardian, isGroup, jid, args: ['gamble'] })
  },

  async gambleon({ reply, isOwner, isMod, isGuardian, isGroup, jid }) {
    return module.exports.genable({ reply, isOwner, isMod, isGuardian, isGroup, jid, args: ['gamble'] })
  },

  // ── .staffmenu — full staff command reference ──────────────────────────────
  async staffmenu({ reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied* — Staff only.')

    const ownerBlock = isOwner ? (
      `\n*👑 OWNER COMMANDS*\n` +
      `┃ .addmod .removemod .addguardian .removeguardian\n` +
      `┃ .ban .unban .banlist .kick\n` +
      `┃ .suspend .unsuspend .suspendlist\n` +
      `┃ .setprefix .resetprefix .setbotname\n` +
      `┃ .addcoins .removecoins .setcoins .resetcoins\n` +
      `┃ .addgems .removegems .resetgems\n` +
      `┃ .resetuser .resetallusers .wipedb\n` +
      `┃ .setlevel .resetlevel .resetxp\n` +
      `┃ .forceregister .unregister .deleteuser\n` +
      `┃ .addcard .removecard .givecard .deletecard\n` +
      `┃ .cardspawn .seedcards .wipecards\n` +
      `┃ .setdaily .setweekly .resetdailies\n` +
      `┃ .broadcast .bcast .announce\n` +
      `┃ .setmaxbet .setminbet .setlimit\n` +
      `┃ .disablecmd .enablecmd .disabledlist\n` +
      `┃ .gdisable .genable .gdisabledlist\n` +
      `┃ .gamble on/off .pokemon on/off\n` +
      `┃ .join .exit .listgc .leaveall\n` +
      `┃ .dbstatus .checkdb .dbstats .health\n` +
      `┃ .ecostats .econreset .moneywipe\n` +
      `┃ .lotterystart .lotteryend .lotterydraw\n` +
      `┃ .lockall .unlockall .shutdown .restart\n` +
      `╰━━━━━━━━━━━━━━━━\n`
    ) : ''

    const modBlock = (isOwner || isMod) ? (
      `\n*🛡️ MOD COMMANDS*\n` +
      `┃ .kick .mute .unmute .warn .resetwarns\n` +
      `┃ .suspend @user [time] [reason]\n` +
      `┃ .unsuspend @user\n` +
      `┃ .ban @user [reason] .unban @user\n` +
      `┃ .close (lockgroup) .open (unlockgroup)\n` +
      `┃ .delete .del .d — delete replied message\n` +
      `┃ .antispam on/off .antilink on/off\n` +
      `┃ .antibot on/off .antiword on/off\n` +
      `┃ .blacklist <word> .unblacklist <word>\n` +
      `┃ .blacklistlist .clearblacklist\n` +
      `┃ .welcome on/off .goodbye on/off\n` +
      `┃ .setdesc .setname .setpic .settopic\n` +
      `┃ .invitelink .revokelink .promote .demote\n` +
      `┃ .warnlist .warnings @user\n` +
      `┃ .mods .modlist .stafflist .modslist\n` +
      `┃ .myrole .unafk @user\n` +
      `┃ .addcoins .removecoins (mod-limited)\n` +
      `┃ .setxp .setlevel (mod-limited)\n` +
      `╰━━━━━━━━━━━━━━━━\n`
    ) : ''

    const guardianBlock = (isOwner || isMod || isGuardian) ? (
      `\n*⚔️ GUARDIAN COMMANDS*\n` +
      `┃ .warn @user [reason]\n` +
      `┃ .warnlist .warnings @user\n` +
      `┃ .delete .del .d — delete replied message\n` +
      `┃ .report (forward to staff)\n` +
      `┃ .antispam on/off (view only)\n` +
      `┃ .myrole .mods .modlist .stafflist\n` +
      `╰━━━━━━━━━━━━━━━━\n`
    ) : ''

    const allStaffBlock = (
      `\n*📋 ALL STAFF — GENERAL*\n` +
      `┃ .p @user .profile @user .bal @user\n` +
      `┃ .myid .id .info .status .botstatus\n` +
      `┃ .ping .uptime .memory .alive .speed\n` +
      `┃ .dbstatus .checkdb .ecostats\n` +
      `┃ .lotterystart .lotteryjoin .lotterystatus\n` +
      `┃ .lotteryend .lotterydraw\n` +
      `┃ .poll <question> | <a> | <b> ...\n` +
      `┃ .pollresult .endpoll\n` +
      `┃ .trivia .math .fact .joke .8ball .flip\n` +
      `┃ .sticker .s .toimg .take .steal\n` +
      `┃ .ai .chatgpt .gpt .gemini .llama\n` +
      `┃ .translate .tr .tts .say .wiki .weather\n` +
      `┃ .menu .help .repo .signup .script\n` +
      `┃ .removebg .enhance .remini .upscale\n` +
      `┃ .waifu .neko .animekill .animebite\n` +
      `┃ .hug .pat .kiss .slap .cry .wave\n` +
      `┃ .gay .howgay .ratio .npc .vibe .aura\n` +
      `┃ .chess @user .chess start bot .endchess\n` +
      `┃ .bj .blackjack .uno .joinuno .unostart\n` +
      `┃ .cf heads/tails [amount]\n` +
      `┃ .slots .slot .rps .dice\n` +
      `┃ .fish .dig .beg .work .daily .weekly\n` +
      `┃ .shop .buy .sell .market\n` +
      `┃ .bal .wallet .bank .deposit .withdraw\n` +
      `┃ .pay @user [amount] .richlist .topbank\n` +
      `┃ .rob .crime .heist\n` +
      `┃ .collection .deck .ci .ss .fs .cardlb\n` +
      `┃ .get .cg .cgconfirm .cgcancel .dc .tc\n` +
      `┃ .stardust\n` +
      `┃ .phelp #start #trainer #party #pc\n` +
      `┃ #hunt #catch #heal #battle #gym\n` +
      `┃ #evolve #train #moves #dex #mart\n` +
      `┃ .guild .gcreate .gjoin .gleave\n` +
      `┃ .guildinfo .guildtop .gcontribute\n` +
      `╰━━━━━━━━━━━━━━━━\n`
    )

    const header = `🌑 *SHADOW GARDEN — STAFF MENU*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `Role: *${isOwner ? '👑 Owner' : isMod ? '🛡️ Mod' : '⚔️ Guardian'}*\n` +
      `━━━━━━━━━━━━━━━━━━`

    await reply(header + ownerBlock + modBlock + guardianBlock + allStaffBlock +
      `\n_Use *.help <cmd>* for details on any command._`)
  },

  // ── .seedcards — bulk import all 85k cards from JSON into MongoDB ─────────
  async seedcards({ reply, isOwner }) {
    if (!isOwner) return reply('*🚫 Owner only.*')
    await reply('⏳ Seeding cards from all three sources into MongoDB... this may take a minute.')
    try {
      const cardIndex     = require('./card.json')
      let cardIndex2      = []
      let cardIndexMazoku = []
      try { cardIndex2      = require('./cards_shoob2.json') } catch {}
      try { cardIndexMazoku = require('./cards_mazoku.json') } catch {}

      const totalInput = cardIndex.length + cardIndex2.length + cardIndexMazoku.length
      const { inserted, total } = await db.seedAllCards(cardIndex, cardIndex2, cardIndexMazoku)
      return reply(
        `✅ *Card Seed Complete*\n\n` +
        `📦 Input cards:   ${totalInput.toLocaleString()}\n` +
        `✨ New inserts:   ${inserted.toLocaleString()}\n` +
        `🗄️ Total in DB:   ${total.toLocaleString()}\n\n` +
        `_All cards are now visible on the web._`
      )
    } catch (err) {
      console.error('[.seedcards] ERROR:', err)
      return reply(`❌ Seed failed: ${err.message}`)
    }
  },

}

// Export for index.js per-group check
module.exports.loadGroupDisabled = loadGroupDisabled
