const db = require('../database')
const { parseDuration } = require('./chat')

async function isAdmin(sock, jid, senderJid) {
  const meta = await sock.groupMetadata(jid).catch(() => null)
  if (!meta) return false
  const normalize = id => id.split('@')[0].split(':')[0]
  const senderNorm = normalize(senderJid)
  return meta.participants
    .filter(p => p.admin)
    .some(p => normalize(p.id) === senderNorm)
}

async function isBotAdmin(sock, jid) {
  const meta = await sock.groupMetadata(jid).catch(() => null)
  if (!meta) return false
  const botId = sock.user?.id
  return meta.participants.filter(p => p.admin).map(p => p.id).some(id =>
    id === botId || id.split('@')[0] === botId?.split('@')[0] || id.split(':')[0] === botId?.split('@')[0]
  )
}

module.exports = {
  async kick({ sock, msg, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const botAdmin = await isBotAdmin(sock, jid)
    if (!botAdmin) return reply('❌ I need to be an admin to kick users.')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.kick @user`')
    for (const target of mentioned) {
      const targetPhone = target.split('@')[0]
      await sock.groupParticipantsUpdate(jid, [target], 'remove')
      await sock.sendMessage(jid, { text: `🚫 Successfully removed @${targetPhone} from the group.`, mentions: [target] }, { quoted: msg })
    }
  },

  async delete({ sock, msg, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const ctx = msg.message?.extendedTextMessage?.contextInfo
    const quoted = ctx?.stanzaId
    if (!quoted) return reply('❌ Reply to a message to delete it.')
    const participant = ctx?.participant || ctx?.remoteJid || jid
    await sock.sendMessage(jid, { delete: { remoteJid: jid, id: quoted, fromMe: false, participant } })
  },

  async antilink({ sock, msg, jid, args, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin  = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const group  = await db.getOrCreateGroup(jid, '')
    const action = args[0]?.toLowerCase()
    if (action === 'on') {
      await db.updateGroup(jid, { antilink: true })
      await reply('🔗 *Anti-Link ON* ✅\n\nLinks will now be removed automatically.')
    } else if (action === 'off') {
      await db.updateGroup(jid, { antilink: false })
      await reply('🔓 *Anti-Link OFF*\n\nLinks are now allowed.')
    } else if (action === 'set' && args[1]) {
      const newAction = args[1].toLowerCase()
      if (!['warn', 'kick', 'delete'].includes(newAction)) return reply('❌ Options: warn, kick, delete')
      await db.updateGroup(jid, { antilink_action: newAction })
      await reply(`✅ Anti-link action set to *${newAction}*`)
    } else {
      const status = group?.antilink ? '✅ ON' : '❌ OFF'
      const act    = group?.antilink_action || 'warn'
      await reply(`🔗 *Anti-Link Status*\n\nStatus: ${status}\nAction: *${act}*\n\nUsage:\n• \`.antilink on/off\`\n• \`.antilink set [warn/kick/delete]\``)
    }
  },

  async antispam({ sock, jid, args, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin  = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const toggle = args[0]?.toLowerCase()
    if (toggle === 'on') {
      await db.updateGroup(jid, { antispam: true })
      await reply('🛡️ *Anti-Spam ON* ✅')
    } else if (toggle === 'off') {
      await db.updateGroup(jid, { antispam: false })
      await reply('✅ *Anti-Spam OFF*')
    } else {
      await reply('❌ Usage: `.antispam on/off`')
    }
  },

  async antibot({ sock, jid, args, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin  = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const toggle = args[0]?.toLowerCase()
    if (toggle === 'on') {
      await db.updateGroup(jid, { antibot: true })
      await reply('🤖 *Anti-Bot ON* ✅\n\nBots will be kicked automatically.')
    } else if (toggle === 'off') {
      await db.updateGroup(jid, { antibot: false })
      await reply('✅ *Anti-Bot OFF*')
    } else {
      const group = await db.getOrCreateGroup(jid, '')
      await reply(`🤖 *Anti-Bot:* ${group?.antibot ? '✅ ON' : '❌ OFF'}\n\nUsage: \`.antibot on/off\``)
    }
  },

  async checkadmin({ sock, jid, isGroup, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const meta     = await sock.groupMetadata(jid)
    const admins   = meta.participants.filter(p => p.admin)
    const botId    = sock.user?.id
    const botIsAdm = admins.some(p =>
      p.id === botId || p.id.split('@')[0] === botId?.split('@')[0]
    )
    const adminLines = admins.map(p => {
      const num  = p.id.split('@')[0].split(':')[0]
      const role = p.admin === 'superadmin' ? '👑' : '⚙️'
      return `${role} @${num}`
    }).join('\n')
    await sock.sendMessage(jid, {
      text:
        `⚙️ *Admins - ${meta.subject}*\n\n${adminLines || 'None'}\n\n` +
        `🤖 Bot admin: ${botIsAdm ? '✅ Yes' : '❌ No'}`,
      mentions: admins.map(p => p.id),
    })
  },

  async warn({ sock, msg, jid, args, senderJid, sender, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.warn @user [reason]`')
    const target      = mentioned[0]
    const targetPhone = target.split('@')[0]
    const reason      = args.filter(a => !a.includes('@')).join(' ') || 'No reason given'
    await db.addWarning(targetPhone, jid, reason, sender)
    const warns = await db.getWarnings(targetPhone, jid)
    await sock.sendMessage(jid, {
      text: `⚠️ *WARNED* - @${targetPhone} (${warns.length}/3)\n\n📌 Reason: ${reason}`,
      mentions: [target]
    }, { quoted: msg })
    if (warns.length >= 3) {
      await sock.groupParticipantsUpdate(jid, [target], 'remove')
      await sock.sendMessage(jid, { text: `*🚫 KICKED* - @${targetPhone} reached 3 warnings.`, mentions: [target] })
    }
  },

  async resetwarn({ sock, msg, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.resetwarn @user`')
    const targetPhone = mentioned[0].split('@')[0]
    await db.resetWarnings(targetPhone, jid)
    await sock.sendMessage(jid, { text: `✅ Warnings cleared for @${targetPhone}.`, mentions: [mentioned[0]] }, { quoted: msg })
  },

  async groupinfo({ sock, jid, isGroup, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const meta   = await sock.groupMetadata(jid)
    const group  = await db.getOrCreateGroup(jid, meta.subject)
    const admins = meta.participants.filter(p => p.admin)
    const link   = await sock.groupInviteCode(jid).catch(() => null).then(c => c ? `https://chat.whatsapp.com/${c}` : 'N/A')
    const created  = new Date(meta.creation * 1000).toLocaleDateString()
    const owner    = meta.owner ? meta.owner.split('@')[0] : 'Unknown'
    const activeNow = await db.getActiveUsers(jid, 24)
    const totalMsgs = await db.getMessageCount(jid, 24 * 7)
    await reply(
      `📌 *Group Info*\n\n` +
      `👥 *Name:* ${meta.subject}\n` +
      `🆔 *JID:* ${jid}\n` +
      `🔗 *Link:* ${link}\n\n` +
      `👤 *Members:* ${meta.participants.length}\n` +
      `⚙️ *Admins:* ${admins.length}\n` +
      `📅 *Created:* ${created}\n` +
      `👑 *Owner:* ${owner}\n\n` +
      `🟢 *Active (24h):* ${activeNow.length}\n` +
      `📊 *Messages (7d):* ${totalMsgs}\n\n` +
      `🛡️ Anti-Link: ${group?.antilink ? '✅ ON' : '❌ OFF'}\n` +
      `🚫 Anti-Spam: ${group?.antispam ? '✅ ON' : '❌ OFF'}`
    )
  },
  async gi(ctx) { return module.exports.groupinfo(ctx) },

  async groupstats({ sock, jid, isGroup, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const meta        = await sock.groupMetadata(jid)
    const group       = await db.getOrCreateGroup(jid, meta.subject)
    const admins      = meta.participants.filter(p => p.admin)
    const activeUsers = await db.getActiveUsers(jid, 24)
    const inactiveCount = meta.participants.length - activeUsers.length
    const todayMsgs   = await db.getMessageCount(jid, 24)
    const weekMsgs    = await db.getMessageCount(jid, 24 * 7)
    await reply(
      `📊 *Group Stats - ${meta.subject}*\n\n` +
      `👤 Members: ${meta.participants.length}\n` +
      `🟢 Active: ${activeUsers.length} | 🔴 Inactive: ${inactiveCount}\n` +
      `⚙️ Admins: ${admins.length}\n\n` +
      `📈 Today: ${todayMsgs} msgs\n` +
      `📉 This Week: ${weekMsgs} msgs\n\n` +
      `🔗 Anti-Link: ${group?.antilink ? '✅ ON' : '❌ OFF'}\n` +
      `🛡️ Anti-Spam: ${group?.antispam ? '✅ ON' : '❌ OFF'}`
    )
  },
  async gs(ctx) { return module.exports.groupstats(ctx) },

  async welcome({ sock, jid, args, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin  = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const toggle = args[0]?.toLowerCase()
    if (toggle === 'on') {
      await db.updateGroup(jid, { welcome: true })
      await reply('✅ *Welcome messages ON*')
    } else if (toggle === 'off') {
      await db.updateGroup(jid, { welcome: false })
      await reply('✅ *Welcome messages OFF*')
    } else {
      await reply('❌ Usage: `.welcome on/off`')
    }
  },

  async setwelcome({ sock, jid, args, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin    = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const msg_text = args.join(' ')
    if (!msg_text) return reply('❌ Usage: `.setwelcome <message>`\n\nUse `<user>` and `<group>` as placeholders.')
    await db.updateGroup(jid, { welcome_msg: msg_text, welcome: true })
    await reply('✅ *Welcome message updated!*\n\nUse <user> for mention, <group> for group name.')
  },

  async leave({ sock, jid, args, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin  = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const toggle = args[0]?.toLowerCase()
    if (toggle === 'on') {
      await db.updateGroup(jid, { leave: true })
      await reply('✅ *Leave messages ON*')
    } else if (toggle === 'off') {
      await db.updateGroup(jid, { leave: false })
      await reply('✅ *Leave messages OFF*')
    } else {
      await reply('❌ Usage: `.leave on/off`')
    }
  },

  async setleave({ sock, jid, args, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin    = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const msg_text = args.join(' ')
    if (!msg_text) return reply('❌ Usage: `.setleave <message>`')
    await db.updateGroup(jid, { leave_msg: msg_text, leave: true })
    await reply('✅ *Leave message updated!*')
  },

  async promote({ sock, msg, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const ctx = msg.message?.extendedTextMessage?.contextInfo
    const mentioned = ctx?.mentionedJid || []
    const quotedParticipant = ctx?.participant ? [ctx.participant] : []
    const targets = mentioned.length ? mentioned : quotedParticipant
    if (!targets.length) return reply('Please specify a user to promote.')
    for (const target of targets) {
      const targetPhone = target.split('@')[0]
      await sock.groupParticipantsUpdate(jid, [target], 'promote')
      await sock.sendMessage(jid, { text: `@${targetPhone} has been promoted to admin.`, mentions: [target] }, { quoted: msg })
    }
  },

  async demote({ sock, msg, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const ctx = msg.message?.extendedTextMessage?.contextInfo
    const mentioned = ctx?.mentionedJid || []
    const quotedParticipant = ctx?.participant ? [ctx.participant] : []
    const targets = mentioned.length ? mentioned : quotedParticipant
    if (!targets.length) return reply('Please specify a user to demote.')
    for (const target of targets) {
      const targetPhone = target.split('@')[0]
      await sock.groupParticipantsUpdate(jid, [target], 'demote')
      await sock.sendMessage(jid, { text: `@${targetPhone} is no longer an admin.`, mentions: [target] }, { quoted: msg })
    }
  },

  async mute({ sock, msg, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (mentioned.length) {
      // Mute specific user (add to group muted list in DB)
      const target = mentioned[0]
      const phone = target.split('@')[0]
      await db.addMutedUser(jid, phone).catch(() => {})
      await sock.sendMessage(jid, { text: `@${phone} has been muted successful`, mentions: [target] }, { quoted: msg })
    } else {
      // Mute entire group
      await sock.groupSettingUpdate(jid, 'announcement')
      await db.updateGroup(jid, { muted: true })
      await reply('🔇 *Group Muted* - only admins can send messages.')
    }
  },

  async unmute({ sock, msg, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (mentioned.length) {
      // Unmute specific user
      const target = mentioned[0]
      const phone = target.split('@')[0]
      await db.removeMutedUser(jid, phone).catch(() => {})
      await sock.sendMessage(jid, { text: `@${phone} is now unmuted.`, mentions: [target] }, { quoted: msg })
    } else {
      // Unmute entire group
      await sock.groupSettingUpdate(jid, 'not_announcement')
      await db.updateGroup(jid, { muted: false })
      await reply('🔊 *Group Unmuted* - everyone can send messages.')
    }
  },

  async open({ sock, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    await sock.groupSettingUpdate(jid, 'not_announcement')
    await db.updateGroup(jid, { muted: false })
    await reply('🔓 *Group OPEN*')
  },

  async close({ sock, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    await sock.groupSettingUpdate(jid, 'announcement')
    await db.updateGroup(jid, { muted: true })
    await reply('🔒 *Group CLOSED*')
  },

  async hidetag({ sock, jid, senderJid, isGroup, isOwner, args, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin   = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const meta    = await sock.groupMetadata(jid)
    const members = meta.participants.map(p => p.id)
    const text    = args.join(' ') || '👋'
    await sock.sendMessage(jid, { text, mentions: members })
  },

  async tagall({ sock, jid, senderJid, isGroup, isOwner, args, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const meta      = await sock.groupMetadata(jid)
    const members   = meta.participants.map(p => p.id)
    const message   = args.join(' ') || 'Attention everyone!'
    const taggerNum = senderJid.split('@')[0].split(':')[0]
    const groupName = meta.subject || 'Group'
    const memberLines = members.map(m => `💠 @${m.split('@')[0].split(':')[0]}`).join('\n')
    const text =
      `*🔖 Message:* ${message}\n` +
      `*🎃 Group:* ${groupName}\n` +
      `*👥 Members:* ${members.length}\n` +
      `*🗣️ Tagger:* @${taggerNum}\n\n` +
      memberLines
    await sock.sendMessage(jid, { text, mentions: [...members, senderJid] })
  },

  async lockgroup({ sock, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    await sock.groupSettingUpdate(jid, 'announcement')
    await db.updateGroup(jid, { muted: true })
    await reply('🔒 *Group Locked* - only admins can send messages.')
  },

  async unlockgroup({ sock, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    await sock.groupSettingUpdate(jid, 'not_announcement')
    await db.updateGroup(jid, { muted: false })
    await reply('🔓 *Group Unlocked* - everyone can send messages.')
  },

  async invitelink({ sock, jid, isGroup, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    try {
      const code = await sock.groupInviteCode(jid)
      await reply(`🔗 *Group Invite Link*\n\nhttps://chat.whatsapp.com/${code}`)
    } catch {
      await reply('❌ Could not get invite link. Make sure I am an admin.')
    }
  },

  async revoke({ sock, jid, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    try {
      await sock.groupRevokeInvite(jid)
      const code = await sock.groupInviteCode(jid)
      await reply(`✅ *Invite link revoked!*\n\nNew link: https://chat.whatsapp.com/${code}`)
    } catch {
      await reply('❌ Could not revoke invite link.')
    }
  },

  async activity({ sock, jid, isGroup, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const meta        = await sock.groupMetadata(jid)
    const activeUsers = await db.getActiveUsers(jid, 24)
    const todayMsgs   = await db.getMessageCount(jid, 24)
    const weekMsgs    = await db.getMessageCount(jid, 24 * 7)
    const actLevel    = Math.min(100, Math.floor((todayMsgs / Math.max(meta.participants.length, 1)) * 10))
    const actStatus   = actLevel > 60 ? '🔥 Very Active' : actLevel > 30 ? '⚡ Moderate' : '😴 Low'
    await reply(
      `📊 *Activity - ${meta.subject}*\n\n` +
      `Status: ${actStatus} (${actLevel}%)\n\n` +
      `💬 Today: ${todayMsgs} | Week: ${weekMsgs}\n` +
      `🟢 Active: ${activeUsers.length}/${meta.participants.length}`
    )
  },

  async active({ sock, jid, isGroup, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const meta        = await sock.groupMetadata(jid)
    const activeUsers = await db.getActiveUsers(jid, 24)
    const list        = activeUsers.map((p, i) => `${i + 1}. ${p}`).join('\n') || 'No active users today.'
    await reply(`🟢 *Active (24h) - ${meta.subject}*\n\n${list}\n\n${activeUsers.length}/${meta.participants.length}`)
  },

  async inactive({ sock, jid, isGroup, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const meta        = await sock.groupMetadata(jid)
    const activeUsers = await db.getActiveUsers(jid, 24 * 7)
    const activeSet   = new Set(activeUsers)
    const inactive    = meta.participants
      .map(p => p.id.includes('@s.whatsapp.net') ? p.id.split('@')[0] : null)
      .filter(p => p && !activeSet.has(p))
      .slice(0, 20)
    const list = inactive.length
      ? inactive.map((p, i) => `${i + 1}. ${p}`).join('\n')
      : 'Everyone has been active!'
    await reply(`🔴 *Inactive (7 days) - ${meta.subject}*\n\n${list}\n\n${inactive.length}/${meta.participants.length}`)
  },

  async antism(ctx) { return module.exports.antispam(ctx) },

  async blacklist({ sock, jid, args, senderJid, isGroup, isOwner, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin  = await isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('*🚫 Access Denied*')
    const action = args[0]?.toLowerCase()
    const word   = args.slice(1).join(' ')
    if (action === 'add') {
      if (!word) return reply('❌ Usage: `.blacklist add <word>`')
      await db.addBlacklist(jid, word)
      await reply(`✅ *${word}* added to blacklist.`)
    } else if (action === 'remove') {
      if (!word) return reply('❌ Usage: `.blacklist remove <word>`')
      await db.removeBlacklist(jid, word)
      await reply(`✅ *${word}* removed from blacklist.`)
    } else if (action === 'list') {
      const list = await db.getBlacklist(jid)
      await reply(list.length ? `📋 *Blacklist*\n\n${list.map((w, i) => `${i + 1}. ${w}`).join('\n')}` : 'No blacklisted words.')
    } else {
      await reply('❌ Usage: `.blacklist add/remove/list [word]`')
    }
  },

  async ban({ sock, msg, jid, args, senderJid, isOwner, isMod, reply }) {
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.ban @user [reason]`')
    const target  = mentioned[0]
    const phone   = target.split('@')[0].split(':')[0]
    const reason  = args.filter(a => !a.startsWith('@') && !a.includes('@')).join(' ') || 'No reason given'
    await db.updateUser(phone, { banned: true })
    await sock.sendMessage(jid, {
      text: `*🔨 BANNED*\n\n@${phone} has been banned from using the bot.\n📋 Reason: ${reason}`,
      mentions: [target]
    }, { quoted: msg })
  },

  async unban({ sock, msg, jid, args, senderJid, isOwner, isMod, reply }) {
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const phone = mentioned.length
      ? mentioned[0].split('@')[0].split(':')[0]
      : (args[0] || '').replace(/[^0-9]/g, '')
    if (!phone) return reply('❌ Usage: `.unban @user`')
    await db.updateUser(phone, { banned: false })
    await reply(`✅ *UNBANNED*\n\n${phone} can now use the bot again.`)
  },

  async banlist({ reply, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('*🚫 Access Denied*')
    try {
      const banned = await db.getBannedUsers()
      if (!banned.length) return reply('✅ No banned users.')
      const list = banned.map((u, i) => `${i + 1}. *${u.name || u.phone}* - \`${u.phone}\``).join('\n')
      await reply(`*🔨 Banned Users (${banned.length})*\n\n${list}`)
    } catch (e) { await reply(`❌ Error: ${e.message}`) }
  },

  async suspend({ sock, msg, jid, args, senderJid, sender, isOwner, isMod, isGuardian, reply }) {
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('❌ Usage: `.suspend @user <duration> [reason]`\n\nDuration: 30m / 1h / 1d / 1w')
    const target = mentioned[0]
    const phone  = target.split('@')[0].split(':')[0]
    const durationArg = args.find(a => /^\d+(m|h|d|w)$/i.test(a))
    if (!durationArg) return reply('❌ Duration required. Examples: 30m, 1h, 6h, 1d, 1w')
    const ms = parseDuration(durationArg)
    if (!ms) return reply('❌ Invalid duration. Use: 30m, 1h, 1d, 1w')
    const reason = args.filter(a => !a.startsWith('@') && !a.includes('@') && !/^\d+(m|h|d|w)$/i.test(a)).join(' ') || 'No reason given'
    await db.addSuspension(phone, reason, new Date(Date.now() + ms), sender)
    const until = new Date(Date.now() + ms).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
    })
    await sock.sendMessage(jid, {
      text: `⏸️ *SUSPENDED*\n\n@${phone} has been suspended.\n\n⏳ *Until:* ${until}\n📋 *Reason:* ${reason}`,
      mentions: [target],
    }, { quoted: msg })
  },

  async unsuspend({ sock, msg, jid, args, senderJid, isOwner, isMod, isGuardian, reply }) {
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const phone = mentioned.length
      ? mentioned[0].split('@')[0].split(':')[0]
      : (args[0] || '').replace(/[^0-9]/g, '')
    if (!phone) return reply('❌ Usage: `.unsuspend @user`')
    await db.removeSuspension(phone)
    await sock.sendMessage(jid, {
      text: `✅ *SUSPENSION LIFTED*\n\n@${phone}'s suspension has been removed.`,
      mentions: mentioned.length ? [mentioned[0]] : [],
    }, { quoted: msg })
  },

  async suspendlist({ reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('*🚫 Access Denied*')
    try {
      const suspensions = await db.getSuspensions()
      if (!suspensions.length) return reply('✅ No active suspensions.')
      const now    = new Date()
      const active = suspensions.filter(s => new Date(s.suspended_until) > now)
      if (!active.length) return reply('✅ No active suspensions.')
      const list = active.map((s, i) => {
        const until = new Date(s.suspended_until).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
        })
        return `${i + 1}. *${s.phone}*\n   ⏳ Until: ${until}\n   📋 ${s.reason}`
      }).join('\n\n')
      await reply(`⏸️ *Suspended Users (${active.length})*\n\n${list}`)
    } catch (e) { await reply(`❌ Error: ${e.message}`) }
  },
}
