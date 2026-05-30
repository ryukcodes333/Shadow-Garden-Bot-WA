const db = require('../database')

// Per-group disabled commands storage (in-memory, backed by DB)
// groupDisabled[groupJid] = Set of disabled command names
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

// ── Resolve actual JID from group participants map ────────────────
function phoneToJid(phone, participants) {
  if (!participants || !phone) return null
  const clean = phone.replace(/\D/g, '')
  for (const p of participants) {
    const pNum = p.id.split('@')[0].replace(/\D/g, '')
    if (pNum === clean || pNum.endsWith(clean) || clean.endsWith(pNum)) return p.id
  }
  return null
}

function isOwner(user) { return (user?.role || '').toLowerCase() === 'owner' }
function isMod(user)   { return ['mod', 'guardian', 'owner'].includes((user?.role || '').toLowerCase()) }

module.exports = {
  // ── Export for use in index.js ────────────────────────────────────
  loadGroupDisabled,
  groupDisabled,

  // ── .addmod ───────────────────────────────────────────────────────
  async addmod({ sock, jid, reply, sender, user, pushName, mentionedJid, args, groupMetadata }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    if (!isMod(u)) return reply(`❌ Only mods/guardians/owner can use this.`)

    const participants = groupMetadata?.participants || []
    let targetJid = mentionedJid?.[0]
    if (!targetJid && args[0]) targetJid = phoneToJid(args[0], participants)
    if (!targetJid) return reply(`❌ Mention a user or provide their number.\n\nUsage: *.addmod @user*`)

    const targetSender = targetJid.includes('@') ? targetJid : targetJid + '@s.whatsapp.net'
    const target = await db.getOrCreateUser(targetSender)

    if (isOwner(target)) return reply(`❌ Cannot modify the owner's role.`)
    await db.updateUser(targetSender, { role: 'mod' })

    await reply(`✅ *${target.name || targetSender}* is now a *Mod*!\n\n_Their mod status applies in ALL groups._ 🖤`)
  },

  // ── .addguardian ──────────────────────────────────────────────────
  async addguardian({ reply, sender, user, pushName, mentionedJid, args, groupMetadata }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    if (!isMod(u)) return reply(`❌ Only mods/guardians/owner can use this.`)

    const participants = groupMetadata?.participants || []
    let targetJid = mentionedJid?.[0]
    if (!targetJid && args[0]) targetJid = phoneToJid(args[0], participants)
    if (!targetJid) return reply(`❌ Mention a user or provide their number.`)

    const targetSender = targetJid.includes('@') ? targetJid : targetJid + '@s.whatsapp.net'
    const target = await db.getOrCreateUser(targetSender)

    if (isOwner(target)) return reply(`❌ Cannot modify the owner's role.`)
    await db.updateUser(targetSender, { role: 'guardian' })
    await reply(`🛡️ *${target.name || targetSender}* is now a *Guardian*!\n\n_Guardian status applies in ALL groups._ 🖤`)
  },

  // ── .removemod ────────────────────────────────────────────────────
  async removemod({ reply, sender, user, pushName, mentionedJid, args, groupMetadata }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    if (!isOwner(u)) return reply(`❌ Only the *owner* can remove mods.`)

    const participants = groupMetadata?.participants || []
    let targetJid = mentionedJid?.[0]
    if (!targetJid && args[0]) targetJid = phoneToJid(args[0], participants)
    if (!targetJid) return reply(`❌ Mention a user or provide their number.`)

    const targetSender = targetJid.includes('@') ? targetJid : targetJid + '@s.whatsapp.net'
    const target = await db.getOrCreateUser(targetSender)

    await db.updateUser(targetSender, { role: 'member' })
    await reply(`✅ *${target.name || targetSender}* mod/guardian status has been removed.`)
  },

  // ── .stafflist ────────────────────────────────────────────────────
  async stafflist({ reply }) {
    try {
      const staff = await db.getAllStaff()
      if (!staff || staff.length === 0)
        return reply(`👥 *STAFF LIST*\n\nNo staff members found.\n\n_Use *.addmod @user* to promote someone._ 🖤`)
      const lines = staff.map(s => `• *${s.name || s.phone}* — ${s.role}`).join('\n')
      return reply(`👥 *STAFF LIST*\n\n${lines}\n\n_Staff roles are universal across ALL groups._ 🖤`)
    } catch {
      return reply('❌ Could not load staff list.')
    }
  },

  // ── .setrole ──────────────────────────────────────────────────────
  async setrole({ reply, sender, user, pushName, mentionedJid, args, groupMetadata }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    if (!isOwner(u)) return reply(`❌ Only the *owner* can set roles.`)

    const participants = groupMetadata?.participants || []
    let targetJid = mentionedJid?.[0]
    if (!targetJid && args[0]) { targetJid = phoneToJid(args[0], participants); args = args.slice(1) }
    if (!targetJid) return reply(`❌ Mention a user.\n\nUsage: *.setrole @user <role>*`)

    const role = (args[args.length - 1] || '').toLowerCase()
    const validRoles = ['member', 'mod', 'guardian', 'owner']
    if (!validRoles.includes(role)) return reply(`❌ Valid roles: ${validRoles.join(', ')}`)

    const targetSender = targetJid.includes('@') ? targetJid : targetJid + '@s.whatsapp.net'
    await db.updateUser(targetSender, { role })
    await reply(`✅ Role updated to *${role}* — applies in ALL groups. 🖤`)
  },

  // ── .ban ──────────────────────────────────────────────────────────
  async ban({ reply, sender, user, pushName, mentionedJid, args, groupMetadata }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    if (!isMod(u)) return reply(`❌ Only mods/guardians/owner can ban users.`)

    const participants = groupMetadata?.participants || []
    let targetJid = mentionedJid?.[0]
    if (!targetJid && args[0]) targetJid = phoneToJid(args[0], participants)
    if (!targetJid) return reply(`❌ Mention a user to ban.`)

    const targetSender = targetJid.includes('@') ? targetJid : targetJid + '@s.whatsapp.net'
    const target = await db.getOrCreateUser(targetSender)
    if (isOwner(target)) return reply(`❌ Cannot ban the owner.`)

    await db.updateUser(targetSender, { banned: true })
    await reply(`🔨 *${target.name || targetSender}* has been banned. 🖤`)
  },

  // ── .unban ────────────────────────────────────────────────────────
  async unban({ reply, sender, user, pushName, mentionedJid, args, groupMetadata }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    if (!isMod(u)) return reply(`❌ Only mods/guardians/owner can unban users.`)

    const participants = groupMetadata?.participants || []
    let targetJid = mentionedJid?.[0]
    if (!targetJid && args[0]) targetJid = phoneToJid(args[0], participants)
    if (!targetJid) return reply(`❌ Mention a user to unban.`)

    const targetSender = targetJid.includes('@') ? targetJid : targetJid + '@s.whatsapp.net'
    await db.updateUser(targetSender, { banned: false })
    await reply(`✅ User has been unbanned.`)
  },

  // ── .warn ─────────────────────────────────────────────────────────
  async warn({ reply, sender, user, pushName, mentionedJid, args, groupMetadata }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    if (!isMod(u)) return reply(`❌ Only mods/guardians/owner can warn users.`)

    const participants = groupMetadata?.participants || []
    let targetJid = mentionedJid?.[0]
    if (!targetJid && args[0]) targetJid = phoneToJid(args[0], participants)
    if (!targetJid) return reply(`❌ Mention a user to warn.`)

    const targetSender = targetJid.includes('@') ? targetJid : targetJid + '@s.whatsapp.net'
    const target = await db.getOrCreateUser(targetSender)
    const warns = (target.warns || 0) + 1
    await db.updateUser(targetSender, { warns })

    let extra = ''
    if (warns >= 3) { await db.updateUser(targetSender, { banned: true }); extra = '\n\n🔨 *3 warnings reached — user auto-banned!*' }

    await reply(`⚠️ *${target.name || targetSender}* has been warned! (${warns}/3)${extra}`)
  },

  // ── PER-GROUP COMMAND DISABLE/ENABLE ─────────────────────────────

  // .disable <command> — disable a command in THIS group only
  async disable({ reply, sender, user, pushName, jid, args }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    if (!isMod(u)) return reply(`❌ Only mods/guardians/owner can disable commands.`)

    const cmdName = (args[0] || '').toLowerCase().replace(/^\./, '')
    if (!cmdName) return reply(`❌ Usage: *.disable <command>*\nExample: *.disable gamble*`)

    // Safety: don't allow disabling staff/admin commands
    const protected_cmds = ['disable','enable','addmod','addguardian','removemod','ban','unban','setrole','stafflist']
    if (protected_cmds.includes(cmdName)) return reply(`❌ Cannot disable *${cmdName}* — it's a protected command.`)

    const disabled = await loadGroupDisabled(jid)
    disabled.add(cmdName)
    await saveGroupDisabled(jid)

    await reply(`🔒 *${cmdName}* has been disabled in this group.\n\nUse *.enable ${cmdName}* to re-enable it. 🖤`)
  },

  // .enable <command> — re-enable a command in THIS group
  async enable({ reply, sender, user, pushName, jid, args }) {
    const u = user || await db.getOrCreateUser(sender, pushName)
    if (!isMod(u)) return reply(`❌ Only mods/guardians/owner can enable commands.`)

    const cmdName = (args[0] || '').toLowerCase().replace(/^\./, '')
    if (!cmdName) return reply(`❌ Usage: *.enable <command>*\nExample: *.enable gamble*`)

    const disabled = await loadGroupDisabled(jid)
    disabled.delete(cmdName)
    await saveGroupDisabled(jid)

    await reply(`✅ *${cmdName}* has been re-enabled in this group. 🖤`)
  },

  // .disabledlist — show disabled commands for this group
  async disabledlist({ reply, jid }) {
    const disabled = await loadGroupDisabled(jid)
    if (disabled.size === 0) return reply(`✅ No commands are disabled in this group.`)
    const list = [...disabled].map(c => `• *.${c}*`).join('\n')
    return reply(`🔒 *Disabled Commands (this group):*\n\n${list}\n\nUse *.enable <cmd>* to re-enable any.`)
  },

  // ── .gamble off/on (alias for enable/disable) ─────────────────────
  async gambleoff({ reply, sender, user, pushName, jid }) {
    return module.exports.disable({ reply, sender, user, pushName, jid, args: ['gamble'] })
  },
  async gambleon({ reply, sender, user, pushName, jid }) {
    return module.exports.enable({ reply, sender, user, pushName, jid, args: ['gamble'] })
  },
}
