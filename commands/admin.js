const db = require('../database')

async function isAdmin(sock, jid, senderJid) {
  const meta = await sock.groupMetadata(jid).catch(() => null)
  if (!meta) return false
  return meta.participants.filter(p => p.admin).map(p => p.id).includes(senderJid)
}

async function isBotAdmin(sock, jid) {
  const meta = await sock.groupMetadata(jid).catch(() => null)
  if (!meta) return false
  const botId = sock.user?.id
  return meta.participants.filter(p => p.admin).map(p => p.id).some(id => id === botId || id.split('@')[0] === botId?.split('@')[0] || id.split(':')[0] === botId?.split('@')[0])
}

module.exports = {
  async kick({ sock, msg, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    const botAdmin = await isBotAdmin(sock, jid)
    if (!botAdmin) return reply('⚠️ I need to be an admin to kick users.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: .kick @user')
    for (const target of mentioned) {
      const targetPhone = target.split('@')[0]
      await sock.groupParticipantsUpdate(jid, [target], 'remove')
      await sock.sendMessage(jid, { text: `@${targetPhone} has been removed.`, mentions: [target] }, { quoted: msg })
    }
  },

  async delete({ sock, msg, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.stanzaId
    if (!quoted) return reply('⚠️ Reply to a message to delete it.')
    await sock.sendMessage(jid, { delete: { remoteJid: jid, id: quoted, fromMe: false } })
    await reply('🗑️ Message deleted.')
  },

  async antilink({ sock, msg, jid, args, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    const group = await db.getOrCreateGroup(jid, '')
    const action = args[0]?.toLowerCase()
    if (action === 'on') {
      await db.updateGroup(jid, { antilink: true })
      await reply('🔗 Anti-link *ON* — action: warn\nUse .antilink set [warn/kick/delete] to change.')
    } else if (action === 'off') {
      await db.updateGroup(jid, { antilink: false })
      await reply('🔓 Anti-link *OFF*')
    } else if (action === 'set' && args[1]) {
      const newAction = args[1].toLowerCase()
      if (!['warn', 'kick', 'delete'].includes(newAction)) return reply('⚠️ Action must be: warn, kick, or delete')
      await db.updateGroup(jid, { antilink_action: newAction })
      await reply(`✅ Anti-link action set to: *${newAction}*`)
    } else {
      const status = group?.antilink ? 'ON' : 'OFF'
      const act = group?.antilink_action || 'warn'
      await reply(`🔗 Anti-link: *${status}* | Action: *${act}*\n\n.antilink on/off\n.antilink set [warn/kick/delete]`)
    }
  },

  async warn({ sock, msg, jid, args, senderJid, sender, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: .warn @user [reason]')
    const target = mentioned[0]
    const targetPhone = target.split('@')[0]
    const reason = args.filter(a => !a.includes('@')).join(' ') || 'No reason given'
    await db.addWarning(targetPhone, jid, reason, sender)
    const warns = await db.getWarnings(targetPhone, jid)
    await sock.sendMessage(jid, {
      text: `⚠️ @${targetPhone} warned — ${reason} (${warns.length}/3)`,
      mentions: [target]
    }, { quoted: msg })
    if (warns.length >= 3) {
      await sock.groupParticipantsUpdate(jid, [target], 'remove')
      await sock.sendMessage(jid, { text: `🚫 @${targetPhone} kicked after 3 warnings.`, mentions: [target] })
    }
  },

  async resetwarn({ sock, msg, jid, args, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: .resetwarn @user')
    const target = mentioned[0]
    const targetPhone = target.split('@')[0]
    await db.resetWarnings(targetPhone, jid)
    await sock.sendMessage(jid, { text: `✅ Warnings cleared for @${targetPhone}.`, mentions: [target] }, { quoted: msg })
  },

  async groupinfo({ sock, msg, jid, isGroup, reply }, alias) {
    if (!isGroup) return reply('❌ Groups only.')
    const meta = await sock.groupMetadata(jid)
    const group = await db.getOrCreateGroup(jid, meta.subject)
    const admins = meta.participants.filter(p => p.admin)
    const bots = meta.participants.filter(p => p.id.includes(':'))
    const link = await sock.groupInviteCode(jid).catch(() => 'N/A').then(c => c !== 'N/A' ? `https://chat.whatsapp.com/${c}` : 'N/A')
    const created = new Date(meta.creation * 1000).toLocaleDateString()
    const owner = meta.owner?.split('@')[0] || 'Unknown'
    const activeNow = await db.getActiveUsers(jid, 24)
    const totalMsgs = await db.getMessageCount(jid, 24 * 7)
    await reply(`📌 *GROUP INFORMATION*\n\n👥 *Group Name:* ${meta.subject}\n🆔 *Group ID:* ${jid}\n🔗 *Invite Link:* ${link}\n\n👤 *Members:* ${meta.participants.length}\n⚙️ *Admins:* ${admins.length}\n🤖 *Bots:* ${bots.length}\n\n📅 *Created On:* ${created}\n👑 *Owner:* ${owner}\n\n🟢 *Active Now:* ${activeNow.length}\n📊 *Message Count:* ${totalMsgs}\n\n🛡️ *Anti-Link:* ${group?.antilink ? 'ON' : 'OFF'}\n🚫 *Anti-Spam:* ${group?.antispam ? 'ON' : 'OFF'}\n🔒 *Group Status:* ${group?.muted ? 'Closed' : 'Open'}\n\n_This group is under constant system monitoring…_ 🖤`)
  },

  async gi(ctx) { return module.exports.groupinfo(ctx) },

  async groupstats({ sock, msg, jid, isGroup, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const meta = await sock.groupMetadata(jid)
    const group = await db.getOrCreateGroup(jid, meta.subject)
    const admins = meta.participants.filter(p => p.admin)
    const activeUsers = await db.getActiveUsers(jid, 24)
    const inactiveCount = meta.participants.length - activeUsers.length
    const todayMsgs = await db.getMessageCount(jid, 24)
    const weekMsgs = await db.getMessageCount(jid, 24 * 7)
    const warnings = await db.getWarnings('', jid)
    const lastAct = new Date().toLocaleTimeString()
    await reply(`📊 *GROUP STATS*\n\n👥 *Group:* ${meta.subject}\n🆔 *ID:* ${jid}\n\n👤 *Members:* ${meta.participants.length}\n🟢 Active Users: ${activeUsers.length}\n🔴 Inactive Users: ${inactiveCount}\n\n⚙️ *Admins:* ${admins.length}\n🤖 Bot Status: Online\n\n📈 *Messages Today:* ${todayMsgs}\n📉 *Messages This Week:* ${weekMsgs}\n\n🚫 *Warnings Issued:* ${warnings.length}\n🔗 Anti-Link: ${group?.antilink ? 'ON' : 'OFF'}\n🛡️ Anti-Spam: ${group?.antispam ? 'ON' : 'OFF'}\n\n⏰ *Last Activity:* ${lastAct}\n\n_The system is always watching the flow of this group…_ 🖤`)
  },

  async gs(ctx) { return module.exports.groupstats(ctx) },

  async welcome({ sock, msg, jid, args, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    const toggle = args[0]?.toLowerCase()
    if (toggle === 'on') {
      await db.updateGroup(jid, { welcome: true })
      await reply('✅ Welcome messages ON\nCustomize with .setwelcome <message> (use <user> and <group>)')
    } else if (toggle === 'off') {
      await db.updateGroup(jid, { welcome: false })
      await reply('✅ Welcome messages OFF')
    } else {
      await reply('⚠️ Usage: .welcome on/off')
    }
  },

  async setwelcome({ jid, args, senderJid, isGroup, isOwner, reply, sock }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    const msg_text = args.join(' ')
    if (!msg_text) return reply('⚠️ Usage: .setwelcome <message>\nUse <user> and <group> as placeholders.')
    await db.updateGroup(jid, { welcome_msg: msg_text, welcome: true })
    await reply('✅ Welcome message set.')
  },

  async leave({ sock, msg, jid, args, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    const toggle = args[0]?.toLowerCase()
    if (toggle === 'on') {
      await db.updateGroup(jid, { leave: true })
      await reply('✅ Leave messages ON')
    } else if (toggle === 'off') {
      await db.updateGroup(jid, { leave: false })
      await reply('✅ Leave messages OFF')
    } else {
      await reply('⚠️ Usage: .leave on/off')
    }
  },

  async setleave({ sock, jid, args, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    const msg_text = args.join(' ')
    if (!msg_text) return reply('⚠️ Usage: .setleave <message>')
    await db.updateGroup(jid, { leave_msg: msg_text, leave: true })
    await reply('✅ Leave message set.')
  },

  async promote({ sock, msg, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Mention a user to promote.')
    for (const target of mentioned) {
      const targetPhone = target.split('@')[0]
      await sock.groupParticipantsUpdate(jid, [target], 'promote')
      await sock.sendMessage(jid, { text: `@${targetPhone} has been promoted to admin 👑`, mentions: [target] }, { quoted: msg })
    }
  },

  async demote({ sock, msg, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Mention a user to demote.')
    for (const target of mentioned) {
      const targetPhone = target.split('@')[0]
      await sock.groupParticipantsUpdate(jid, [target], 'demote')
      await sock.sendMessage(jid, { text: `@${targetPhone} is no longer an admin`, mentions: [target] }, { quoted: msg })
    }
  },

  async mute({ sock, msg, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    await sock.groupSettingUpdate(jid, 'announcement')
    await db.updateGroup(jid, { muted: true })
    await reply('🔇 Group muted — only admins can send messages.')
  },

  async unmute({ sock, msg, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    await sock.groupSettingUpdate(jid, 'not_announcement')
    await db.updateGroup(jid, { muted: false })
    await reply('🔊 Group unmuted — everyone can now send messages.')
  },

  async open({ sock, msg, jid, senderJid, sender, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    await sock.groupSettingUpdate(jid, 'not_announcement')
    await db.updateGroup(jid, { muted: false })
    await reply('🔓 Group is now *OPEN* — anyone can send messages.')
  },

  async close({ sock, msg, jid, senderJid, sender, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    await sock.groupSettingUpdate(jid, 'announcement')
    await db.updateGroup(jid, { muted: true })
    await reply('🔒 Group is now *CLOSED* — only admins can send messages.')
  },

  async hidetag({ sock, msg, jid, senderJid, isGroup, isOwner, args, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    const meta = await sock.groupMetadata(jid)
    const members = meta.participants.map(p => p.id)
    const text = args.join(' ') || '👋'
    await sock.sendMessage(jid, { text, mentions: members })
  },

  async tagall({ sock, msg, jid, senderJid, sender, isGroup, isOwner, args, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    const meta = await sock.groupMetadata(jid)
    const members = meta.participants.map(p => p.id)
    const message = args.join(' ') || 'Attention everyone!'
    const activePhones = await db.getActiveUsers(jid, 24 * 7)
    const activeSet = new Set(activePhones)
    const memberLines = members.map(m => {
      const phone = m.split('@')[0]
      return `${activeSet.has(phone) ? '🟢' : '🔴'} @${phone}`
    }).join('\n')
    const text = `📣 ${message}\n\n${memberLines}`
    await sock.sendMessage(jid, { text, mentions: members })
  },

  async activity({ sock, jid, isGroup, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const meta = await sock.groupMetadata(jid)
    const activeUsers = await db.getActiveUsers(jid, 24)
    const todayMsgs = await db.getMessageCount(jid, 24)
    const yestMsgs = (await db.getMessageCount(jid, 48)) - todayMsgs
    const weekMsgs = await db.getMessageCount(jid, 24 * 7)
    const topUser = await db.getTopUser(jid, 24)
    const actLevel = Math.min(100, Math.floor((todayMsgs / Math.max(meta.participants.length, 1)) * 10))
    const actStatus = actLevel > 60 ? 'Very Active 🔥' : actLevel > 30 ? 'Moderate ⚡' : 'Low 😴'
    await reply(
      `📊 *Activity — ${meta.subject}*\n\n` +
      `Status: ${actStatus} (${actLevel}%)\n\n` +
      `💬 Today: ${todayMsgs} | Yesterday: ${yestMsgs} | Week: ${weekMsgs}\n` +
      `🟢 Active members: ${activeUsers.length}/${meta.participants.length}\n` +
      `🔥 Top user: ${topUser || 'N/A'}`
    )
  },

  async active({ sock, jid, isGroup, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const meta = await sock.groupMetadata(jid)
    const activeUsers = await db.getActiveUsers(jid, 24)
    const list = activeUsers.map((p, i) => `${i + 1}. ${p}`).join('\n') || 'No active users today.'
    await reply(`🟢 *Active Users (24h)* — ${meta.subject}\n\n${list}\n\nTotal: ${activeUsers.length}/${meta.participants.length}`)
  },

  async inactive({ sock, jid, isGroup, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const meta = await sock.groupMetadata(jid)
    const activeUsers = await db.getActiveUsers(jid, 24 * 7)
    const all = meta.participants.map(p => p.id.split('@')[0])
    const inactive = all.filter(p => !activeUsers.includes(p))
    const list = inactive.slice(0, 20).map((p, i) => `${i + 1}. ${p}`).join('\n') || 'Everyone has been active!'
    await reply(`🔴 *Inactive (7 days)* — ${meta.subject}\n\n${list}\n\nTotal: ${inactive.length}/${meta.participants.length}`)
  },

  async antism({ sock, jid, args, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    const toggle = args[0]?.toLowerCase()
    if (toggle === 'on') {
      await db.updateGroup(jid, { antispam: true })
      await reply('🛡️ Anti-spam *ON* — 7+ messages in 5s will trigger a warning.')
    } else if (toggle === 'off') {
      await db.updateGroup(jid, { antispam: false })
      await reply('✅ Anti-spam *OFF*')
    } else {
      await reply('⚠️ Usage: .antism on/off')
    }
  },

  async blacklist({ sock, jid, args, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    const action = args[0]?.toLowerCase()
    const word = args.slice(1).join(' ')
    if (action === 'add') {
      if (!word) return reply('⚠️ Usage: .blacklist add <word>')
      await db.addBlacklist(jid, word)
      await reply(`✅ "*${word}*" added to blacklist.`)
    } else if (action === 'remove') {
      if (!word) return reply('⚠️ Usage: .blacklist remove <word>')
      await db.removeBlacklist(jid, word)
      await reply(`✅ "*${word}*" removed from blacklist.`)
    } else if (action === 'list') {
      const list = await db.getBlacklist(jid)
      await reply(list.length ? `📋 *Blacklisted Words*\n\n${list.map((w, i) => `${i + 1}. ${w}`).join('\n')}` : 'No blacklisted words.')
    } else {
      await reply('⚠️ Usage: .blacklist add/remove/list [word]')
    }
  },
}
