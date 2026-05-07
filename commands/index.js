const db = require('../database')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')

const mainCmds     = require('./main')
const adminCmds    = require('./admin')
const economyCmds  = require('./economy')
const cardCmds     = require('./cards')
const gameCmds     = require('./games')
const pokemonCmds  = require('./pokemon')
const interactionCmds = require('./interactions')
const funCmds      = require('./fun')
const rpgCmds      = require('./rpg')
const unoCmds      = require('./uno')
const gambleCmds   = require('./gamble')
const summerCmds   = require('./summer')
const guildCmds    = require('./guilds')
const converterCmds = require('./converter')
const staffCmds    = require('./staff')
const pollCmds     = require('./poll')
const lotteryCmds  = require('./lottery')
const profileCmds  = require('./profile')

const PREFIX   = global.prefix   || '.'
const OWNER_LID = global.ownerLid || '259683117985842@lid'

const spamTracker = {}

async function handleMessage(sock, msg) {
  const jid       = msg.key.remoteJid
  const isGroup   = jid?.endsWith('@g.us')
  const senderJid = isGroup ? msg.key.participant : msg.key.remoteJid
  const sender    = senderJid?.split('@')[0] || ''

  const isOwner = senderJid === OWNER_LID ||
    senderJid?.replace('@s.whatsapp.net','') === OWNER_LID.replace('@lid','')

  let isMod = false
  let isGuardian = false
  if (!isOwner && sender) {
    try {
      const staffUser = await db.getOrCreateUser(sender).catch(() => null)
      isMod      = staffUser?.role === 'mod'
      isGuardian = staffUser?.role === 'guardian'
    } catch(e) {}
  }

  const msgType  = Object.keys(msg.message || {})[0]
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

  if (isGroup && textRaw) {
    await db.logMessage(sender, jid).catch(() => {})

    const groupSettings = await db.getOrCreateGroup(jid,'').catch(() => null)

    if (groupSettings?.muted) {
      const groupMeta = await sock.groupMetadata(jid).catch(() => null)
      const admins = (groupMeta?.participants||[]).filter(p=>p.admin).map(p=>p.id)
      if (!admins.includes(senderJid)) return
    }

    if (groupSettings?.antispam) {
      const now = Date.now()
      if (!spamTracker[senderJid]) spamTracker[senderJid] = []
      spamTracker[senderJid] = spamTracker[senderJid].filter(t => now-t < 5000)
      spamTracker[senderJid].push(now)
      if (spamTracker[senderJid].length > 6) {
        await sock.sendMessage(jid, { text:`⚠️ *ANTI-SPAM*\n\n👤 @${sender} slow down!\n\n_The system doesn't tolerate spam… 🖤_`, mentions:[senderJid] })
        return
      }
    }

    if (groupSettings?.antilink) {
      const urlRegex = /https?:\/\/[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+/gi
      if (urlRegex.test(textRaw)) {
        const groupMeta = await sock.groupMetadata(jid).catch(() => null)
        const admins = (groupMeta?.participants||[]).filter(p=>p.admin).map(p=>p.id)
        if (!admins.includes(senderJid) && !isOwner && !isMod) {
          const action = groupSettings.antilink_action || 'warn'
          if (action === 'kick') {
            await sock.groupParticipantsUpdate(jid,[senderJid],'remove')
            await sock.sendMessage(jid,{text:`❌ *ANTI-LINK*\n\n@${sender} was removed for posting a link. 🚫\n\n_The shadows don't welcome spammers…_ 🖤`,mentions:[senderJid]})
          } else if (action === 'delete') {
            await sock.sendMessage(jid,{delete:msg.key})
            await sock.sendMessage(jid,{text:`⚠️ *ANTI-LINK*\n\n@${sender} link deleted! 🔗🚫`,mentions:[senderJid]})
          } else {
            await db.addWarning(sender,jid,'Anti-link violation','bot')
            const total = await db.getWarnings(sender,jid)
            await sock.sendMessage(jid,{delete:msg.key}).catch(()=>{})
            await sock.sendMessage(jid,{text:`⚠️ *ANTI-LINK WARNING*\n\n👤 @${sender}\n🚫 Warning #${total.length}`,mentions:[senderJid]})
          }
          return
        }
      }
    }

    const blacklist = await db.getBlacklist(jid).catch(() => [])
    if (blacklist.length > 0) {
      const lower = textRaw.toLowerCase()
      if (blacklist.some(w => lower.includes(w.toLowerCase()))) {
        await sock.sendMessage(jid,{delete:msg.key}).catch(()=>{})
        await sock.sendMessage(jid,{text:`🚫 *BLACKLISTED WORD*\n\n@${sender} that word is not allowed here.`,mentions:[senderJid]})
        return
      }
    }
  }

  if (!isSticker && !isReaction && !isBold && textRaw) {
    const afkRecord = await db.getAFK(sender).catch(() => null)
    if (afkRecord) {
      const duration = Date.now() - new Date(afkRecord.since).getTime()
      const mins = Math.floor(duration/60000)
      const hrs  = Math.floor(mins/60)
      const durationStr = hrs > 0 ? `${hrs}h ${mins%60}m` : `${mins}m`
      await db.removeAFK(sender)
      await sock.sendMessage(jid,{
        text:`🌑 *WELCOME BACK*\n\n👤 *User:* @${sender}\n\n⏳ AFK for: ${durationStr}\n💤 Reason: ${afkRecord.reason}\n\n_The shadows have released you._ 🖤`,
        mentions:[senderJid]
      })
    }
  }

  if (isGroup && textRaw && senderJid) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    for (const mentionedJid of mentions) {
      const mentionedPhone = mentionedJid.split('@')[0]
      const afkRecord = await db.getAFK(mentionedPhone).catch(() => null)
      if (afkRecord) {
        await db.incrementAFKMentions(mentionedPhone)
        const since = new Date(afkRecord.since).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})
        await sock.sendMessage(jid,{
          text:`💤 *USER IS AFK*\n\n👤 @${mentionedPhone} is away.\n\n📌 Reason: ${afkRecord.reason}\n⏰ Since: ${since}`,
          mentions:[mentionedJid]
        })
      }
    }
  }

  if (isImageWithStickerCmd) {
    const ctx = {
      sock, msg, jid, senderJid, sender, args:[], cmd:'s', user:null,
      isGroup, isOwner, isMod, isGuardian, PREFIX,
      pushName: msg.pushName||sender, msgType, textRaw,
      reply: (text) => sock.sendMessage(jid,{text},{quoted:msg}),
      react:  (emoji) => sock.sendMessage(jid,{react:{text:emoji,key:msg.key}}),
    }
    try { if (mainCmds['s']) await mainCmds['s'](ctx) } catch(e) {}
    return
  }

  if (!textRaw.startsWith(PREFIX)) return

  const body = textRaw.slice(PREFIX.length).trim()
  const args = body.split(/\s+/)
  const cmd  = args.shift().toLowerCase()

  const user = await db.getOrCreateUser(sender, msg.pushName||sender).catch(() => null)
  if (user?.banned && !isOwner) {
    await sock.sendMessage(jid,{text:`🚫 You are banned from using Shadow Garden Bot.`})
    return
  }

  const disabledCmds = await db.getDisabledCommands().catch(() => [])
  if (disabledCmds.some(d=>d.command===cmd) && !isOwner) {
    await sock.sendMessage(jid,{text:`⚠️ The command *.${cmd}* is currently disabled.`})
    return
  }

  const NO_DB_CMDS = new Set([
    'menu','help','ping','uptime','botstatus','info','status','website',
    'community','support','addbot','memory','alive','version','runtime',
    'sticker','s','toimg','qr','translate','play',
    'lotterystart','lotteryjoin','lotterystatus','lotterydraw','lotteryend',
    'poll','pollresult','dbstatus','ll','lottery',
    'addmod','removemod','addguardian','removeguardian','mods',
  ])

  const reply = (text) => sock.sendMessage(jid,{text},{quoted:msg})

  if (!user && !NO_DB_CMDS.has(cmd)) {
    return reply(
      `⚠️ *Database Not Set Up*\n\n` +
      `The Supabase tables haven't been created yet.\n\n` +
      `📋 *To fix this:*\n` +
      `1. Go to *supabase.com* → your project\n` +
      `2. Click *SQL Editor*\n` +
      `3. Paste contents of *setup.sql* and click Run\n\n` +
      `_Once setup is done, all commands will work._ 🖤`
    )
  }

  const ctx = {
    sock, msg, jid, senderJid, sender, args, cmd, user, isGroup, isOwner, isMod, isGuardian, PREFIX,
    pushName: msg.pushName||sender, msgType, textRaw,
    reply,
    replyImage: (image,caption) => sock.sendMessage(jid,{image,caption},{quoted:msg}),
    react: (emoji) => sock.sendMessage(jid,{react:{text:emoji,key:msg.key}}),
  }

  try {
    if (mainCmds[cmd])        return await mainCmds[cmd](ctx)
    if (adminCmds[cmd])       return await adminCmds[cmd](ctx)
    if (profileCmds[cmd])     return await profileCmds[cmd](ctx)
    if (economyCmds[cmd])     return await economyCmds[cmd](ctx)
    if (cardCmds[cmd])        return await cardCmds[cmd](ctx)
    if (gameCmds[cmd])        return await gameCmds[cmd](ctx)
    if (cmd === 'pokecatch')  return await pokemonCmds.pokecatchInGroup({ jid, reply, react: ctx.react, sender, user })
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
  } catch(err) {
    console.error(`Command error [${cmd}]:`, err.message)
    await ctx.reply(`⚠️ An error occurred running *.${cmd}*\n\n_${err.message}_`)
  }
}

module.exports = handleMessage
