const db = require('../database')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')

const mainCmds      = require('./main')
const adminCmds     = require('./admin')
const economyCmds   = require('./economy')
const cardCmds      = require('./cards')
const gameCmds      = require('./games')
const pokemonCmds   = require('./pokemon')
const interactionCmds = require('./interactions')
const funCmds       = require('./fun')
const rpgCmds       = require('./rpg')
const unoCmds       = require('./uno')
const gambleCmds    = require('./gamble')
const summerCmds    = require('./summer')
const guildCmds     = require('./guilds')
const converterCmds = require('./converter')
const staffCmds     = require('./staff')
const pollCmds      = require('./poll')
const lotteryCmds   = require('./lottery')
const profileCmds   = require('./profile')

const PREFIX      = global.prefix    || '.'
const POKE_PREFIX = '#'
const OWNER_LID   = global.ownerLid  || '259683117985842@lid'

const spamTracker = {}

// ── Pokemon commands that use # prefix ───────────────────────────
const POKE_CMDS = new Set([
  'phelp', 'start', 'trainer', 'pdaily', 'quests', 'rank',
  'hunt', 'wb', 'catch', 'c', 'spawn', 'spawnp',
  'team', 'party', 'pc', 'swap', 't2pc', 't2party', 'pswap',
  'battle', 'pbattle', 'gym', 'raid', 'heal', 'pheal', 'boost',
  'evolve', 'train', 'moves', 'learn', 'stats', 'pstats',
  'mart', 'mbuy', 'use', 'puse', 'trade', 'ptrade', 'gift', 'pgive',
  'dex', 'event', 'legend', 'achieve', 'cooldown',
  'pokemon', 'setms', 'delms',
  'atk', 'moveinfo',
])

async function handleMessage(sock, msg) {
  const jid       = msg.key.remoteJid
  const isGroup   = jid?.endsWith('@g.us')
  const senderJid = isGroup ? msg.key.participant : msg.key.remoteJid
  const sender    = senderJid?.split('@')[0] || ''

  const isOwner = senderJid === OWNER_LID ||
    senderJid?.replace('@s.whatsapp.net', '') === OWNER_LID.replace('@lid', '')

  let isMod = false
  let isGuardian = false
  if (!isOwner && sender) {
    try {
      const staffUser = await db.getOrCreateUser(sender).catch(() => null)
      isMod      = staffUser?.role === 'mod'
      isGuardian = staffUser?.role === 'guardian'
    } catch {}
  }

  const msgType    = Object.keys(msg.message || {})[0]
  const isSticker  = msgType === 'stickerMessage'
  const isReaction = msgType === 'reactionMessage'

  const textRaw = msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption || ''

  const isBold = textRaw.startsWith('*') && textRaw.endsWith('*') && textRaw.length > 2

  const isImageWithStickerCmd = (msgType === 'imageMessage' || msgType === 'videoMessage') &&
    (textRaw.trim().toLowerCase() === `${PREFIX}s` || textRaw.trim().toLowerCase() === `${PREFIX}sticker`)

  if (!textRaw && !isSticker && !isReaction && !isImageWithStickerCmd) return

  // ── Group-level handling ────────────────────────────────────────
  if (isGroup && textRaw) {
    await db.logMessage(sender, jid).catch(() => {})

    const groupSettings = await db.getOrCreateGroup(jid, '').catch(() => null)

    if (groupSettings?.muted) {
      const groupMeta = await sock.groupMetadata(jid).catch(() => null)
      const admins = (groupMeta?.participants || []).filter(p => p.admin).map(p => p.id)
      if (!admins.includes(senderJid)) return
    }

    if (groupSettings?.antispam) {
      const now = Date.now()
      if (!spamTracker[senderJid]) spamTracker[senderJid] = []
      spamTracker[senderJid] = spamTracker[senderJid].filter(t => now - t < 5000)
      spamTracker[senderJid].push(now)
      if (spamTracker[senderJid].length > 6) {
        await sock.sendMessage(jid, { text: `⚠️ @${sender} slow down!`, mentions: [senderJid] })
        return
      }
    }

    if (groupSettings?.antilink) {
      const urlRegex = /https?:\/\/[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+/gi
      if (urlRegex.test(textRaw)) {
        const groupMeta = await sock.groupMetadata(jid).catch(() => null)
        const admins = (groupMeta?.participants || []).filter(p => p.admin).map(p => p.id)
        if (!admins.includes(senderJid) && !isOwner && !isMod) {
          const action = groupSettings.antilink_action || 'warn'
          if (action === 'kick') {
            await sock.groupParticipantsUpdate(jid, [senderJid], 'remove')
            await sock.sendMessage(jid, { text: `❌ @${sender} removed for posting a link.`, mentions: [senderJid] })
          } else if (action === 'delete') {
            await sock.sendMessage(jid, { delete: msg.key })
            await sock.sendMessage(jid, { text: `⚠️ @${sender} link deleted!`, mentions: [senderJid] })
          } else {
            await db.addWarning(sender, jid, 'Anti-link violation', 'bot')
            const total = await db.getWarnings(sender, jid)
            await sock.sendMessage(jid, { delete: msg.key }).catch(() => {})
            await sock.sendMessage(jid, { text: `⚠️ @${sender} warning #${total.length}`, mentions: [senderJid] })
          }
          return
        }
      }
    }

    const blacklist = await db.getBlacklist(jid).catch(() => [])
    if (blacklist.length > 0) {
      const lower = textRaw.toLowerCase()
      if (blacklist.some(w => lower.includes(w.toLowerCase()))) {
        await sock.sendMessage(jid, { delete: msg.key }).catch(() => {})
        await sock.sendMessage(jid, { text: `🚫 @${sender} that word is not allowed.`, mentions: [senderJid] })
        return
      }
    }
  }

  // ── AFK return detection ────────────────────────────────────────
  if (!isSticker && !isReaction && !isBold && textRaw) {
    const afkRecord = await db.getAFK(sender).catch(() => null)
    if (afkRecord) {
      const duration = Date.now() - new Date(afkRecord.since).getTime()
      const mins = Math.floor(duration / 60000)
      const hrs  = Math.floor(mins / 60)
      const durationStr = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`
      await db.removeAFK(sender)
      await sock.sendMessage(jid, {
        text: `🌑 *WELCOME BACK*\n\n👤 @${sender}\n\n⏳ AFK for: ${durationStr}\n💤 Reason: ${afkRecord.reason}`,
        mentions: [senderJid],
      })
    }
  }

  // ── Notify when an AFK user is mentioned ───────────────────────
  if (isGroup && textRaw && senderJid) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    for (const mentionedJid of mentions) {
      const mentionedPhone = mentionedJid.split('@')[0]
      const afkRecord = await db.getAFK(mentionedPhone).catch(() => null)
      if (afkRecord) {
        await db.incrementAFKMentions(mentionedPhone)
        const since = new Date(afkRecord.since).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        await sock.sendMessage(jid, {
          text: `💤 @${mentionedPhone} is AFK\n📌 Reason: ${afkRecord.reason}\n⏰ Since: ${since}`,
          mentions: [mentionedJid],
        })
      }

      // ── Mention sticker ─────────────────────────────────────────
      // Send when someone mentions a user who has a sticker set
      // Don't send if: the bot is the sender, or if it's a reply to the mentioned user's own message
      const isReplyToMentioned = (() => {
        const ctx = msg.message?.extendedTextMessage?.contextInfo
        if (!ctx) return false
        const quotedParticipant = ctx.participant || ''
        return quotedParticipant.split('@')[0] === mentionedPhone
      })()

      if (!isReplyToMentioned) {
        try {
          const ms = pokemonCmds.getMentionStickers()
          if (ms[mentionedPhone]) {
            const stickerBuf = Buffer.from(ms[mentionedPhone].data, 'base64')
            await sock.sendMessage(jid, { sticker: stickerBuf }, { quoted: msg })
          }
        } catch {}
      }
    }
  }

  // ── Image + sticker command ─────────────────────────────────────
  if (isImageWithStickerCmd) {
    const ctx = {
      sock, msg, jid, senderJid, sender, args: [], cmd: 's', user: null,
      isGroup, isOwner, isMod, isGuardian, PREFIX,
      pushName: msg.pushName || sender, msgType, textRaw,
      reply: (text) => sock.sendMessage(jid, { text }, { quoted: msg }),
      react:  (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }),
    }
    try { if (mainCmds['s']) await mainCmds['s'](ctx) } catch {}
    return
  }

  if (!textRaw) return

  // ── Determine which prefix was used ────────────────────────────
  const isPokemon = textRaw.startsWith(POKE_PREFIX)
  const isDot     = textRaw.startsWith(PREFIX)

  if (!isPokemon && !isDot) return

  const usedPrefix = isPokemon ? POKE_PREFIX : PREFIX
  const body  = textRaw.slice(usedPrefix.length).trim()
  const args  = body.split(/\s+/)
  const cmd   = args.shift().toLowerCase()

  const user = await db.getOrCreateUser(sender, msg.pushName || sender).catch(() => null)
  if (user?.banned && !isOwner) {
    await sock.sendMessage(jid, { text: `🚫 You are banned from using Shadow Garden Bot.` })
    return
  }

  const disabledCmds = await db.getDisabledCommands().catch(() => [])
  if (disabledCmds.some(d => d.command === cmd) && !isOwner) {
    await sock.sendMessage(jid, { text: `⚠️ The command *${usedPrefix}${cmd}* is currently disabled.` })
    return
  }

  const NO_DB_CMDS = new Set([
    'menu', 'help', 'ping', 'uptime', 'botstatus', 'info', 'status', 'website',
    'community', 'support', 'addbot', 'memory', 'alive', 'version', 'runtime',
    'sticker', 's', 'toimg', 'qr', 'translate', 'play',
    'lotterystart', 'lotteryjoin', 'lotterystatus', 'lotterydraw', 'lotteryend',
    'poll', 'pollresult', 'dbstatus', 'll', 'lottery',
    'addmod', 'removemod', 'addguardian', 'removeguardian', 'mods',
    'phelp', 'law', 'pbenefits',
  ])

  const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg })

  if (!user && !NO_DB_CMDS.has(cmd)) {
    return reply(
      `⚠️ *Database Not Set Up*\n\n` +
      `The Supabase tables haven't been created yet.\n\n` +
      `Run *setup.sql* in your Supabase SQL Editor to fix this.`
    )
  }

  const ctx = {
    sock, msg, jid, senderJid, sender, args, cmd, user, isGroup, isOwner, isMod, isGuardian, PREFIX,
    pushName: msg.pushName || sender, msgType, textRaw,
    reply,
    replyImage: (image, caption) => sock.sendMessage(jid, { image, caption }, { quoted: msg }),
    react: (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }),
  }

  try {
    // ── # prefix → Pokemon commands ──────────────────────────────
    if (isPokemon) {
      // .setms / .delms also work with # prefix
      if (cmd === 'setms')        return await pokemonCmds.setms(ctx)
      if (cmd === 'delms')        return await pokemonCmds.delms(ctx)
      if (cmd === 'phelp')        return await pokemonCmds.phelp(ctx)
      if (cmd === 'start')        return await pokemonCmds.start(ctx)
      if (cmd === 'trainer')      return await pokemonCmds.trainer(ctx)
      if (cmd === 'pdaily')       return await pokemonCmds.pdaily(ctx)
      if (cmd === 'quests')       return await pokemonCmds.quests(ctx)
      if (cmd === 'rank')         return await pokemonCmds.rank(ctx)
      if (cmd === 'hunt' || cmd === 'wb') return await pokemonCmds.hunt(ctx)
      if (cmd === 'catch' || cmd === 'c') return await pokemonCmds.catch(ctx)
      if (cmd === 'spawnp')       return await pokemonCmds.spawnp(ctx)
      if (cmd === 'spawn')        return await pokemonCmds.spawnp(ctx)
      if (cmd === 'team')         return await pokemonCmds.team(ctx)
      if (cmd === 'party')        return await pokemonCmds.party(ctx)
      if (cmd === 'pc')           return await pokemonCmds.pc(ctx)
      if (cmd === 'swap' || cmd === 'pswap') return await pokemonCmds.swap(ctx)
      if (cmd === 'battle' || cmd === 'pbattle') return await pokemonCmds.battle(ctx)
      if (cmd === 'gym')          return await pokemonCmds.gym(ctx)
      if (cmd === 'raid')         return await pokemonCmds.raid(ctx)
      if (cmd === 'heal' || cmd === 'pheal') return await pokemonCmds.heal(ctx)
      if (cmd === 'boost')        return await pokemonCmds.boost(ctx)
      if (cmd === 'evolve')       return await pokemonCmds.evolve(ctx)
      if (cmd === 'train')        return await pokemonCmds.train(ctx)
      if (cmd === 'moves')        return await pokemonCmds.moves(ctx)
      if (cmd === 'learn')        return await pokemonCmds.learn(ctx)
      if (cmd === 'stats' || cmd === 'pstats') return await pokemonCmds.stats(ctx)
      if (cmd === 'mart')         return await pokemonCmds.mart(ctx)
      if (cmd === 'mbuy')         return await pokemonCmds.mbuy(ctx)
      if (cmd === 'use' || cmd === 'puse')    return await pokemonCmds.use(ctx)
      if (cmd === 'trade' || cmd === 'ptrade') return await pokemonCmds.trade(ctx)
      if (cmd === 'gift' || cmd === 'pgive')  return await pokemonCmds.gift(ctx)
      if (cmd === 'dex')          return await pokemonCmds.dex(ctx)
      if (cmd === 'event')        return await pokemonCmds.event(ctx)
      if (cmd === 'legend')       return await pokemonCmds.legend(ctx)
      if (cmd === 'achieve')      return await pokemonCmds.achieve(ctx)
      if (cmd === 'cooldown')     return await pokemonCmds.cooldown(ctx)
      if (cmd === 'pokemon')      return await pokemonCmds.pokemon(ctx)
      // Fallback: unknown # command
      return
    }

    // ── . prefix → all other commands ────────────────────────────
    if (mainCmds[cmd])        return await mainCmds[cmd](ctx)
    if (adminCmds[cmd])       return await adminCmds[cmd](ctx)
    if (profileCmds[cmd])     return await profileCmds[cmd](ctx)
    if (economyCmds[cmd])     return await economyCmds[cmd](ctx)
    if (cardCmds[cmd])        return await cardCmds[cmd](ctx)
    if (gameCmds[cmd])        return await gameCmds[cmd](ctx)

    // Legacy . prefix pokemon commands still work
    if (cmd === 'pokecatch')  return await pokemonCmds.catch(ctx)
    if (cmd === 'wb')         return await pokemonCmds.hunt(ctx)
    if (cmd === 'phelp')      return await pokemonCmds.phelp(ctx)
    if (pokemonCmds[cmd])     return await pokemonCmds[cmd](ctx)

    if (interactionCmds[cmd]) return await interactionCmds[cmd](ctx)
    if (funCmds[cmd])         return await funCmds[cmd](ctx)
    if (rpgCmds[cmd])         return await rpgCmds[cmd](ctx)
    if (unoCmds[cmd])         return await unoCmds[cmd](ctx)
    if (gambleCmds[cmd])      return await gambleCmds[cmd](ctx)
    if (summerCmds[cmd])      return await summerCmds[cmd](ctx)
    if (guildCmds[cmd])       return await guildCmds[cmd](ctx)
    if (converterCmds[cmd])   return await converterCmds[cmd](ctx)
    if (staffCmds[cmd])       return await staffCmds[cmd](ctx)
    if (pollCmds[cmd])        return await pollCmds[cmd](ctx)
    if (lotteryCmds[cmd])     return await lotteryCmds[cmd](ctx)
  } catch (err) {
    console.error(`Command error [${usedPrefix}${cmd}]:`, err.message)
    await ctx.reply(`⚠️ Error running *${usedPrefix}${cmd}*\n\n_${err.message}_`)
  }
}

module.exports = handleMessage
