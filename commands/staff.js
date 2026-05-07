const db = require('../database')

const STAFF_ROLES = { MOD: 'mod', GUARDIAN: 'guardian', OWNER: 'owner', CARD_MAKER: 'card_maker' }

module.exports = {

  // ── Role management ──────────────────────────────────────────────
  async addmod({ reply, sock, jid, msg, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Only the owner or mods can add mods.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.addmod @user*')
    for (const jidM of mentioned) {
      const phone = jidM.split('@')[0]
      await db.updateUser(phone, { role: STAFF_ROLES.MOD })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, {
      text: `✅ *MOD ADDED*\n\n👮 ${names} is now a *Moderator*.\n\n_With power comes responsibility._ 🖤`,
      mentions: mentioned,
    }, { quoted: msg })
  },

  async removemod({ reply, sock, jid, msg, args, isOwner }) {
    if (!isOwner) return reply('⚠️ Only the owner can remove mods.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.removemod @user*')
    for (const jidM of mentioned) {
      const phone = jidM.split('@')[0]
      await db.updateUser(phone, { role: 'member' })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, {
      text: `✅ *MOD REMOVED*\n\n👤 ${names} is no longer a moderator.\n\n_Rank revoked._ 🖤`,
      mentions: mentioned,
    }, { quoted: msg })
  },

  async addguardian({ reply, sock, jid, msg, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Only the owner or mods can add guardians.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.addguardian @user*')
    for (const jidM of mentioned) {
      const phone = jidM.split('@')[0]
      await db.updateUser(phone, { role: STAFF_ROLES.GUARDIAN })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, {
      text: `✅ *GUARDIAN ADDED*\n\n🛡️ ${names} is now a *Guardian*.\n\n_The garden gains a protector._ 🖤`,
      mentions: mentioned,
    }, { quoted: msg })
  },

  async removeguardian({ reply, sock, jid, msg, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Only the owner or mods can remove guardians.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.removeguardian @user*')
    for (const jidM of mentioned) {
      const phone = jidM.split('@')[0]
      await db.updateUser(phone, { role: 'member' })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, {
      text: `✅ *GUARDIAN REMOVED*\n\n👤 ${names} is no longer a guardian.\n\n_Rank revoked._ 🖤`,
      mentions: mentioned,
    }, { quoted: msg })
  },

  // ── .recruit — Grant card_maker role ─────────────────────────────
  async recruit({ sock, jid, msg, reply, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) {
      return reply('⚠️ Only staff can recruit card makers.')
    }
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) {
      return reply(
        `⚠️ *RECRUIT — USAGE*\n\n` +
        `*.recruit @user*\n\n` +
        `This grants the user *Card Maker* status.\n` +
        `Card Makers can use the *.upload* command to add cards.\n\n` +
        `_Use *.firerecruit @user* to remove the role._ 🖤`
      )
    }

    const recruitedJids = []
    for (const jidM of mentioned) {
      const phone = jidM.split('@')[0]
      await db.updateUser(phone, { role: STAFF_ROLES.CARD_MAKER })
      recruitedJids.push(jidM)
    }

    const names = recruitedJids.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, {
      text:
        `🎴 *CARD MAKER RECRUITED*\n\n` +
        `${names} has been granted *Card Maker* status!\n\n` +
        `✅ They can now use *.upload* to add cards to the database.\n\n` +
        `_The card collection grows._ 🖤`,
      mentions: recruitedJids,
    }, { quoted: msg })
  },

  // ── .firerecruit — Remove card_maker role ─────────────────────────
  async firerecruit({ sock, jid, msg, reply, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Only mods/owner can remove card maker status.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.firerecruit @user*')
    for (const jidM of mentioned) {
      const phone = jidM.split('@')[0]
      await db.updateUser(phone, { role: 'member' })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await sock.sendMessage(jid, {
      text: `❌ *CARD MAKER REMOVED*\n\n${names} can no longer upload cards.\n\n_Role revoked._ 🖤`,
      mentions: mentioned,
    }, { quoted: msg })
  },

  // ── .mods — Tree layout with @mentions ───────────────────────────
  async mods({ sock, jid, msg, reply, isGroup }) {
    const { data: mods }      = await db.supabase.from('users').select('phone,name').eq('role', 'mod')
    const { data: guardians } = await db.supabase.from('users').select('phone,name').eq('role', 'guardian')

    const modList      = mods      || []
    const guardianList = guardians || []

    // Build a phone→realJid map from actual group participants to avoid LID issues
    let phoneToJid = {}
    if (isGroup) {
      try {
        const meta = await sock.groupMetadata(jid)
        for (const p of meta.participants) {
          // participant id can be phone@s.whatsapp.net or lid format
          // extract the numeric portion and map it
          const num = p.id.split('@')[0].split(':')[0]
          phoneToJid[num] = p.id
        }
      } catch { /* ignore, fall back to constructed JIDs */ }
    }

    function resolveJid(phone) {
      return phoneToJid[phone] || `${phone}@s.whatsapp.net`
    }

    const allMentions = [
      ...modList.map(u => resolveJid(u.phone)),
      ...guardianList.map(u => resolveJid(u.phone)),
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
      `> *⚠️ Note:* Inappropriate use of this command will lead to a *Shadow Ban* from the bot, this means that the bot will *never* be able to join this group *again*`

    await sock.sendMessage(jid, { text, mentions: allMentions }, { quoted: msg })
  },

  // ── Add Cash (staff only) ─────────────────────────────────────────
  async ac({ reply, sender, user, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Only staff can use this command.')
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: *.ac <amount>*\n\nExample: *.ac 5000*')
    const u = user || await db.getOrCreateUser(sender)
    const newBal = (u.wallet || 0) + amount
    await db.updateUser(sender, { wallet: newBal })
    await reply(
      `💰 *CASH ADDED*\n\n` +
      `✅ +$${amount.toLocaleString()} added to your wallet!\n\n` +
      `💵 *New Balance:* $${newBal.toLocaleString()}\n\n` +
      `_Staff privilege exercised._ 🖤`
    )
  },

  // ── Broadcast ─────────────────────────────────────────────────────
  async broadcast({ sock, reply, jid, args, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const message = args.join(' ')
    if (!message) return reply('⚠️ Usage: *.broadcast <message>*')
    await reply(`📢 *BROADCAST SENT*\n\n${message}`)
  },

  // ── Give coins ────────────────────────────────────────────────────
  async give({ sock, msg, jid, reply, sender, user, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Only staff can give coins.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length || !args[0]) return reply('⚠️ Usage: *.give @user <amount>*')
    const amount = parseInt(args.find(a => !a.includes('@')))
    if (!amount || amount <= 0) return reply('⚠️ Enter a valid amount.')
    const target = mentioned[0]
    const targetPhone = target.split('@')[0]
    const targetUser = await db.getOrCreateUser(targetPhone)
    await db.updateUser(targetPhone, { wallet: (targetUser.wallet || 0) + amount })
    await sock.sendMessage(jid, {
      text: `💸 *STAFF GRANT*\n\n💰 +$${amount.toLocaleString()} given to @${targetPhone}\n\n_By staff order._ 🖤`,
      mentions: [target],
    })
  },

  async givecoins(ctx) { return module.exports.give(ctx) },

  // ── Take coins ────────────────────────────────────────────────────
  async take({ sock, msg, jid, reply, args, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length || !args[0]) return reply('⚠️ Usage: *.take @user <amount>*')
    const amount = parseInt(args.find(a => !a.includes('@')))
    if (!amount || amount <= 0) return reply('⚠️ Enter a valid amount.')
    const target = mentioned[0]
    const targetPhone = target.split('@')[0]
    const targetUser = await db.getOrCreateUser(targetPhone)
    const deduct = Math.min(amount, targetUser.wallet || 0)
    await db.updateUser(targetPhone, { wallet: (targetUser.wallet || 0) - deduct })
    await sock.sendMessage(jid, {
      text: `🚫 *STAFF DEDUCT*\n\n💸 -$${deduct.toLocaleString()} taken from @${targetPhone}\n\n_By staff order._ 🖤`,
      mentions: [target],
    })
  },

  // ── Reset user ────────────────────────────────────────────────────
  async resetuser({ reply, msg, args, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.resetuser @user*')
    const target = mentioned[0]
    const phone = target.split('@')[0]
    await db.updateUser(phone, { wallet: 0, bank: 0, xp: 0, level: 1, streak: 0, gems: 0 })
    await reply(`🔄 *USER RESET*\n\n👤 @${phone} has been reset.\n\n_Their journey starts again._ 🖤`)
  },

  // ── Ban / unban ───────────────────────────────────────────────────
  async ban({ reply, msg, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.ban @user [reason]*')
    const reason = args.filter(a => !a.includes('@')).join(' ') || 'No reason given'
    for (const jid of mentioned) {
      const phone = jid.split('@')[0]
      await db.updateUser(phone, { banned: true })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await reply(`🔨 *BANNED*\n\n${names} has been banned.\nReason: ${reason}\n\n_The shadows reject them._ 🖤`)
  },

  async unban({ reply, msg, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.unban @user*')
    for (const jid of mentioned) {
      const phone = jid.split('@')[0]
      await db.updateUser(phone, { banned: false })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await reply(`✅ *UNBANNED*\n\n${names} has been unbanned.\n\n_The shadows welcome them back._ 🖤`)
  },

  // ── Premium management ────────────────────────────────────────────
  async addprem({ reply, msg, args, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.addprem @user*')
    for (const jid of mentioned) {
      const phone = jid.split('@')[0]
      await db.updateUser(phone, { premium: true })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await reply(`✅ *PREMIUM ADDED*\n\n👑 ${names} now has premium!\n\n_Luxury unlocked._ 🖤`)
  },

  async remprem({ reply, msg, args, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.remprem @user*')
    for (const jid of mentioned) {
      const phone = jid.split('@')[0]
      await db.updateUser(phone, { premium: false })
    }
    const names = mentioned.map(j => `@${j.split('@')[0]}`).join(', ')
    await reply(`❌ *PREMIUM REMOVED*\n\n${names}\n\n_Premium revoked._ 🖤`)
  },

  // ── Database management ───────────────────────────────────────────
  async dbstatus({ reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    try {
      const users = await db.getUserCount()
      const { count: cardCount } = await db.supabase.from('cards').select('*', { count: 'exact', head: true })
      await reply(
        `🗄️ *DATABASE STATUS*\n\n` +
        `✅ Connected: Supabase\n\n` +
        `📊 *Stats:*\n👥 Users: ${users}\n🎴 Cards: ${cardCount || 0}\n\n` +
        `_System is operational._ 🖤`
      )
    } catch (err) {
      await reply(`❌ *DB ERROR*\n\n${err.message}\n\n_Check Supabase connection._ 🖤`)
    }
  },

  // ── Group management helpers ──────────────────────────────────────
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
}
