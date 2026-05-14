const db = require('../database')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')

const gtaCmds         = require('./gta')
const mainCmds        = require('./main')
const adminCmds       = require('./admin')
const economyCmds     = require('./economy')
const cardCmds        = require('./cards')
const gameCmds        = require('./games')
const pokemonCmds     = require('./pokemon')
const interactionCmds = require('./interactions')
const funCmds         = require('./fun')
const rpgCmds         = require('./rpg')
const unoCmds         = require('./uno')
const gambleCmds      = require('./gamble')
const summerCmds      = require('./summer')
const guildCmds       = require('./guilds')
const converterCmds   = require('./converter')
const staffCmds       = require('./staff')
const pollCmds        = require('./poll')
const lotteryCmds     = require('./lottery')
const profileCmds     = require('./profile')
const aiCmds          = require('./ai')
const utilityCmds     = require('./utility')
const imagesCmds      = require('./images')
const { alphaChatReply, getSuspension } = require('./chat')

const PREFIX      = global.prefix   || '.'
const POKE_PREFIX = '#'
const OWNER_LID   = global.ownerLid || '259683117985842@lid'

const spamTracker = {}

async function handleMessage(sock, msg) {
  const jid       = msg.key.remoteJid
  const isGroup   = jid?.endsWith('@g.us')
  const senderJid = isGroup ? msg.key.participant : msg.key.remoteJid
  const sender    = senderJid?.split('@')[0]?.split(':')[0] || ''

  const isOwner = senderJid === OWNER_LID ||
    senderJid?.replace('@s.whatsapp.net', '') === OWNER_LID.replace('@lid', '') ||
    sender === OWNER_LID.replace('@lid', '')

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

  // ── Group-level protections ─────────────────────────────────
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
        const admins    = (groupMeta?.participants || []).filter(p => p.admin).map(p => p.id)
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

    if (groupSettings?.antibot) {
      const isBot = senderJid?.includes(':') || sender.length > 18
      if (isBot && !isOwner && !isMod) {
        await sock.groupParticipantsUpdate(jid, [senderJid], 'remove').catch(() => {})
        await sock.sendMessage(jid, { text: `🤖 @${sender} (bot) removed by anti-bot.`, mentions: [senderJid] })
        return
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

  // ── AFK return ──────────────────────────────────────────────
  if (!isSticker && !isReaction && !isBold && textRaw) {
    const afkRecord = await db.getAFK(sender).catch(() => null)
    if (afkRecord) {
      const duration    = Date.now() - new Date(afkRecord.since).getTime()
      const mins        = Math.floor(duration / 60000)
      const hrs         = Math.floor(mins / 60)
      const durationStr = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`
      await db.removeAFK(sender)
      await sock.sendMessage(jid, {
        text: `🌑 *Welcome back!*\n\n👤 @${sender}\n⏳ AFK for: ${durationStr}\n💤 ${afkRecord.reason}`,
        mentions: [senderJid],
      })
    }
  }

  // ── AFK notifications ────────────────────────────────────────
  if (isGroup && textRaw && senderJid) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    for (const mentionedJid of mentions) {
      const mentionedPhone = mentionedJid.split('@')[0].split(':')[0]
      const afkRecord = await db.getAFK(mentionedPhone).catch(() => null)
      if (afkRecord) {
        await db.incrementAFKMentions(mentionedPhone)
        const since = new Date(afkRecord.since).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        await sock.sendMessage(jid, {
          text: `💤 @${mentionedPhone} is AFK\n📌 ${afkRecord.reason}\n⏰ Since: ${since}`,
          mentions: [mentionedJid],
        })
      }

      const quotedParticipant = (msg.message?.extendedTextMessage?.contextInfo?.participant || '').split('@')[0]
      if (quotedParticipant !== mentionedPhone) {
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

  // ── Image + sticker shortcut ─────────────────────────────────
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

  // ── Alpha chat detection (before prefix check) ───────────────
  if (!isSticker && !isReaction && !isBold) {
    const botPhone = (sock.user?.id || '').split(':')[0].split('@')[0]
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const quotedParticipant = (msg.message?.extendedTextMessage?.contextInfo?.participant || '').split('@')[0].split(':')[0]
    const isReplyToBot = quotedParticipant && botPhone && quotedParticipant === botPhone
    const isBotMentioned = botPhone && mentionedJids.some(m => m.split('@')[0].split(':')[0] === botPhone)
    const mentionsAlpha = /\balpha\b/i.test(textRaw)

    if ((isReplyToBot || isBotMentioned || mentionsAlpha) && !textRaw.startsWith(PREFIX) && !textRaw.startsWith(POKE_PREFIX)) {
      await alphaChatReply(sock, jid, msg, sender, msg.pushName || sender, textRaw, isOwner)
      return
    }
  }

  // ── Determine prefix ─────────────────────────────────────────
  const isPokemon = textRaw.startsWith(POKE_PREFIX)
  const isDot     = textRaw.startsWith(PREFIX)
  if (!isPokemon && !isDot) return

  const usedPrefix = isPokemon ? POKE_PREFIX : PREFIX
  const body  = textRaw.slice(usedPrefix.length).trim()
  const args  = body.split(/\s+/)
  const cmd   = args.shift().toLowerCase()

  const user = await db.getOrCreateUser(sender, msg.pushName || sender).catch(() => null)

  // ── Banned: silently ignore ───────────────────────────────────
  if (user?.banned && !isOwner) return

  // ── Suspension check (sender) ─────────────────────────────────
  if (!isOwner && cmd !== 'p' && cmd !== 'profile') {
    const suspension = await getSuspension(db.supabase, sender).catch(() => null)
    if (suspension) {
      const until = new Date(suspension.suspended_until).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
      })
      await sock.sendMessage(jid, {
        text:
          `*You are currently suspended from using this bot.*\n\n` +
          `*⏳ Suspension Ends:* ${until}\n` +
          `*📋 Reason:* ${suspension.reason || 'No reason given'}\n\n` +
          `> Contact a staff if you think this was a mistake.`,
      }, { quoted: msg })
      return
    }
  }

  // ── Suspension check (mentioned/target user) ──────────────────
  if (!isOwner && cmd !== 'p' && cmd !== 'profile') {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    for (const mJid of mentions) {
      const mPhone = mJid.split('@')[0].split(':')[0]
      const mSusp = await getSuspension(db.supabase, mPhone).catch(() => null)
      if (mSusp) {
        const until = new Date(mSusp.suspended_until).toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
        })
        await sock.sendMessage(jid, {
          text:
            `*That user is currently suspended from using the bot.*\n\n` +
            `*⏳ Suspension Ends:* ${until}\n` +
            `*📋 Reason:* ${mSusp.reason || 'No reason given'}\n\n` +
            `> You cannot interact with suspended users.`,
        }, { quoted: msg })
        return
      }
    }
  }

  const disabledCmds = await db.getDisabledCommands().catch(() => [])
  if (disabledCmds.some(d => d.command === cmd) && !isOwner) {
    await sock.sendMessage(jid, { text: `⚠️ *.${cmd}* is currently disabled.` })
    return
  }

  const NO_DB_CMDS = new Set([
    'menu','help','ping','uptime','botstatus','info','status','website',
    'community','support','addbot','memory','alive','version','speed','runtime','repo','script',
    'sticker','s','toimg','take','steal','vv','vv2','enc','qr','qrcode',
    'translate','tr','tts','say','weather','wiki','google','myip','news','ssweb',
    'lyrics','movie','ytsearch','tourl','tinyurl','shorturl',
    'ytmp4','ytmp3','tiktok','instagram','facebook','twitter','threads','capcut','mediafire','apk','pinterest','wallpaper',
    'ai','chatgpt','gpt','gemini','llama','deepseek','mistral','groq',
    'flux','pixart','sdxl','pollinations','playground','aidetect',
    'waifu','neko','animesearch','animekill','animebite','animewave','animewink','animebonk',
    'megumin','mikasa','naruto','sasuke','itachi','madara','gojo','nezuko','kurumi','onepiece','yumeko',
    'lotterystart','lotteryjoin','lotterystatus','lotterydraw','lotteryend','lottery',
    'poll','pollresult','dbstatus',
    'addmod','removemod','addguardian','removeguardian','mods','modlist','modslist',
    'phelp','law','pbenefits','report','trivia','math','fact','joke','flip','8ball','roll','choose',
    'roulette','horse','casino','dice',
    'removebg','nobg','enhance','remini','upscale','night','sunset','rain','city','gun','jail','toanime','cartoon','carbon',
    'suspend','unsuspend','suspendlist',
  ])

  const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg })

  if (!user && !NO_DB_CMDS.has(cmd)) {
    return reply(
      `⚠️ *Database Not Set Up*\n\nSupabase tables haven't been created yet.\nRun *setup.sql* in your Supabase SQL Editor to fix this.`
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
    // ── # prefix → Pokémon commands ─────────────────────────────
    if (isPokemon) {
      const pk = pokemonCmds
      if (cmd === 'phelp')                       return await pk.phelp(ctx)
      if (cmd === 'start')                       return await pk.start(ctx)
      if (cmd === 'trainer')                     return await pk.trainer(ctx)
      if (cmd === 'pdaily')                      return await pk.pdaily(ctx)
      if (cmd === 'quests')                      return await pk.quests(ctx)
      if (cmd === 'rank')                        return await pk.rank(ctx)
      if (cmd === 'hunt' || cmd === 'wb')        return await pk.hunt(ctx)
      if (cmd === 'catch' || cmd === 'c')        return await pk.catch(ctx)
      if (cmd === 'spawnp' || cmd === 'spawn')   return await pk.spawnp(ctx)
      if (cmd === 'team')                        return await pk.team(ctx)
      if (cmd === 'party')                       return await pk.party(ctx)
      if (cmd === 'pc')                          return await pk.pc(ctx)
      if (cmd === 'swap' || cmd === 'pswap')     return await pk.swap(ctx)
      if (cmd === 'battle' || cmd === 'pbattle') return await pk.battle(ctx)
      if (cmd === 'gym')                         return await pk.gym(ctx)
      if (cmd === 'raid')                        return await pk.raid(ctx)
      if (cmd === 'heal' || cmd === 'pheal')     return await pk.heal(ctx)
      if (cmd === 'boost')                       return await pk.boost(ctx)
      if (cmd === 'evolve')                      return await pk.evolve(ctx)
      if (cmd === 'train')                       return await pk.train(ctx)
      if (cmd === 'moves')                       return await pk.moves(ctx)
      if (cmd === 'learn')                       return await pk.learn(ctx)
      if (cmd === 'stats' || cmd === 'pstats')   return await pk.stats(ctx)
      if (cmd === 'mart')                        return await pk.mart(ctx)
      if (cmd === 'mbuy')                        return await pk.mbuy(ctx)
      if (cmd === 'use' || cmd === 'puse')       return await pk.use(ctx)
      if (cmd === 'trade' || cmd === 'ptrade')   return await pk.trade(ctx)
      if (cmd === 'gift' || cmd === 'pgive')     return await pk.gift(ctx)
      if (cmd === 'dex')                         return await pk.dex(ctx)
      if (cmd === 'event')                       return await pk.event(ctx)
      if (cmd === 'legend')                      return await pk.legend(ctx)
      if (cmd === 'achieve')                     return await pk.achieve(ctx)
      if (cmd === 'cooldown')                    return await pk.cooldown(ctx)
      if (cmd === 'pokemon')                     return await pk.pokemon(ctx)
      if (cmd === 'setms')                       return await pk.setms(ctx)
      if (cmd === 'delms')                       return await pk.delms(ctx)
      return
    }

    // ── . prefix → all other commands ───────────────────────────

    // GTA V RP commands
    if (gtaCmds[cmd])           return await gtaCmds[cmd](ctx)

    // Image filter commands
    if (imagesCmds[cmd])        return await imagesCmds[cmd](ctx)

    // Main commands (menu, ping, sticker, etc.)
    if (mainCmds[cmd])          return await mainCmds[cmd](ctx)

    // Admin / group management
    if (adminCmds[cmd])         return await adminCmds[cmd](ctx)

    // Profile commands
    if (profileCmds[cmd])       return await profileCmds[cmd](ctx)

    // Economy commands
    if (economyCmds[cmd])       return await economyCmds[cmd](ctx)

    // Card commands
    if (cardCmds[cmd])          return await cardCmds[cmd](ctx)

    // Game commands
    if (gameCmds[cmd])          return await gameCmds[cmd](ctx)

    // Legacy . prefix Pokémon commands
    if (cmd === 'wb')           return await pokemonCmds.hunt(ctx)
    if (cmd === 'phelp')        return await pokemonCmds.phelp(ctx)
    if (cmd === 'pokemon')      return await pokemonCmds.pokemon(ctx)
    if (cmd === 'setms')        return await pokemonCmds.setms(ctx)
    if (cmd === 'delms')        return await pokemonCmds.delms(ctx)
    if (pokemonCmds[cmd])       return await pokemonCmds[cmd](ctx)

    // Interactions (hug, kiss, slap, etc.)
    if (interactionCmds[cmd])   return await interactionCmds[cmd](ctx)

    // Fun commands
    if (funCmds[cmd])           return await funCmds[cmd](ctx)

    // RPG commands
    if (rpgCmds[cmd])           return await rpgCmds[cmd](ctx)

    // UNO commands
    if (unoCmds[cmd])           return await unoCmds[cmd](ctx)

    // Gamble commands (bet, slots, roulette, horse, casino, etc.)
    if (gambleCmds[cmd])        return await gambleCmds[cmd](ctx)

    // Summer event commands
    if (summerCmds[cmd])        return await summerCmds[cmd](ctx)

    // Guild commands
    if (guildCmds[cmd])         return await guildCmds[cmd](ctx)

    // Converter / calc / currency commands
    if (converterCmds[cmd])     return await converterCmds[cmd](ctx)

    // Staff commands
    if (staffCmds[cmd])         return await staffCmds[cmd](ctx)

    // Poll commands
    if (pollCmds[cmd])          return await pollCmds[cmd](ctx)

    // Lottery commands
    if (lotteryCmds[cmd])       return await lotteryCmds[cmd](ctx)

    // AI commands (Groq, image gen, anime)
    if (aiCmds[cmd])            return await aiCmds[cmd](ctx)

    // Utility commands (weather, wiki, translate, download, etc.)
    if (utilityCmds[cmd])       return await utilityCmds[cmd](ctx)

  } catch (err) {
    console.error(`Command error [${usedPrefix}${cmd}]:`, err.message)
    await ctx.reply(`⚠️ Error running *.${cmd}*\n\n_${err.message}_`)
  }
}

module.exports = handleMessage
