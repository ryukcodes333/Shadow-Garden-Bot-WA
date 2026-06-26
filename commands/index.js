const db = require('../database')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')

const econStatsCmds   = require('./economyStats')
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
const chessCmds       = require('./chess')
const blackjackCmds   = require('./blackjack')
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
const { alphaChatReply, aquaChatReply } = require('./chat')
const vibeCmds = require('./vibe')
const amongusCmds = require('./amongus')

const { buildLinkPreview } = require('../linkPreviewHelper')

const PREFIX      = global.prefix   || '.'
const POKE_PREFIX = '#'
const OWNER_LID   = '75454690107579@lid'

const spamTracker = {}

// ── Button / List response router ────────────────────────────────────────────
// Handles interactiveResponseMessage (quick_reply buttons from @dark-yasiya/baileys),
// buttonsResponseMessage (classic buttons), and listResponseMessage.

async function handleInteraction(sock, msg) {
  const msgType = Object.keys(msg.message || {})[0]

  let buttonId  = null
  let rowId     = null
  let isButton  = false
  let isList    = false

  if (msgType === 'templateButtonReplyMessage') {
    buttonId = msg.message.templateButtonReplyMessage?.selectedId || ''
    isButton = true
  } else if (msgType === 'buttonsResponseMessage') {
    buttonId = msg.message.buttonsResponseMessage?.selectedButtonId || ''
    isButton = true
  } else if (msgType === 'listResponseMessage') {
    rowId  = msg.message.listResponseMessage?.singleSelectReply?.selectedRowId || ''
    isList = true
  } else if (msgType === 'interactiveResponseMessage') {
    // @dark-yasiya/baileys quick_reply & interactive button responses
    try {
      const body = msg.message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
      if (body) {
        const parsed = JSON.parse(body)
        if (parsed.id) {
          buttonId = parsed.id
          isButton = true
        }
      }
    } catch {}
    // Also handle single-select list responses wrapped in interactiveResponseMessage
    if (!buttonId) {
      const sel = msg.message.interactiveResponseMessage?.singleSelectReply?.selectedRowId
      if (sel) { rowId = sel; isList = true }
    }
    // Fallback: some clients send the id directly in the body field
    if (!buttonId && !rowId) {
      try {
        const body = msg.message.interactiveResponseMessage?.body?.text
        if (body) { buttonId = body; isButton = true }
      } catch {}
    }
  } else {
    return false
  }

  if (isButton && buttonId) {
    // ── Chess buttons (legacy — now handled via text moves) ───────────────
    if (buttonId.startsWith('chess_')) {
      // Chess is now reply-based; ignore button interactions
      return true
    }
    // ── Blackjack buttons ─────────────────────────────────────────────────
    if (buttonId.startsWith('bj_')) {
      await blackjackCmds.handleButton(sock, msg, buttonId)
      return true
    }
    // ── UNO buttons ───────────────────────────────────────────────────────
    if (buttonId.startsWith('uno_') || buttonId.startsWith('play_') || buttonId.startsWith('color_') || buttonId.startsWith('uno_more_')) {
      await unoCmds.handleButton(sock, msg, buttonId)
      return true
    }
  }

  if (isList && rowId) {
    // ── Game action rows ──────────────────────────────────────────────────
    if (rowId.startsWith('chess_')) {
      // Chess is now reply-based; ignore legacy list interactions
      return true
    }
    if (rowId.startsWith('bj_')) {
      await blackjackCmds.handleButton(sock, msg, rowId)
      return true
    }
    if (rowId.startsWith('uno_')) {
      await unoCmds.handleButton(sock, msg, rowId)
      return true
    }
    // ── Chess piece/move selections (legacy — now text-based) ────────────
    if (rowId.startsWith('select_') || rowId.startsWith('move_')) {
      return true
    }
    // ── UNO card/color selections ─────────────────────────────────────────
    if (rowId.startsWith('play_') || rowId.startsWith('color_')) {
      await unoCmds.handleList(sock, msg, rowId)
      return true
    }
  }

  return false
}

// ── Main message handler ─────────────────────────────────────────────────────

async function handleMessage(sock, msg) {
  // ── One-time link preview wrapper ────────────────────────────────────────
  if (!sock.__lpWrapped) {
    const _origSend = sock.sendMessage.bind(sock)
    sock.sendMessage = async (jid, content, opts) => {
      if (content?.text && !content.linkPreview && typeof content.text === 'string') {
        const url = (content.text.match(/https?:\/\/[^\s\]>)'"]+/i) || [])[0]
        if (url) {
          const preview = await buildLinkPreview(url).catch(() => null)
          if (preview) content = { ...content, linkPreview: preview }
        }
      }
      return _origSend(jid, content, opts)
    }
    sock.__lpWrapped = true
  }

  const jid       = msg.key.remoteJid
  const isGroup   = jid?.endsWith('@g.us')
  let senderJid   = isGroup ? msg.key.participant : msg.key.remoteJid

  // ── LID → @s.whatsapp.net normalization ─────────────────────────────────
  if (senderJid?.endsWith('@lid') && isGroup) {
    try {
      const meta = await sock.groupMetadata(jid).catch(() => null)
      const matched = (meta?.participants || []).find(p =>
        p.lid === senderJid || p.id === senderJid
      )
      if (matched?.id && matched.id.endsWith('@s.whatsapp.net')) {
        senderJid = matched.id
      }
    } catch {}
  }

  const sender = senderJid?.split('@')[0]?.split(':')[0] || ''

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

  const msgType = Object.keys(msg.message || {})[0]

  // ── Route button / list interactions FIRST (before any text checks) ──────
  const interactionHandled = await handleInteraction(sock, msg).catch(err => {
    console.error('[interaction error]', err?.message || err)
    return false
  })
  if (interactionHandled) return

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

  // ── Group-level protections ─────────────────────────────────────────────
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

    if (groupSettings?.cardspawn_enabled) {
      setImmediate(() => cardCmds.checkAutoSpawn(sock, jid))
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

  // ── AFK return ──────────────────────────────────────────────────────────
  if (!isSticker && !isReaction && !isBold && textRaw) {
    const afkRecord = await db.getAFK(sender).catch(() => null)
    if (afkRecord) {
      const duration    = Date.now() - new Date(afkRecord.since).getTime()
      const mins        = Math.floor(duration / 60000)
      const hrs         = Math.floor(mins / 60)
      const durationStr = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`
      const displayName = msg.pushName || sender
      await db.removeAFK(sender)
      await sock.sendMessage(jid, {
        text: `Welcome back ${displayName}-senpai! You were AFK for ${durationStr}\n> ${afkRecord.reason}`,
        mentions: [senderJid],
      })
    }
  }

  // ── AFK notifications ────────────────────────────────────────────────────
  if (isGroup && textRaw && senderJid) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    for (const mentionedJid of mentions) {
      const mentionedPhone = mentionedJid.split('@')[0].split(':')[0]
      const afkRecord = await db.getAFK(mentionedPhone).catch(() => null)
      if (afkRecord) {
        await db.incrementAFKMentions(mentionedPhone)
        await sock.sendMessage(jid, {
          text: `🔔 Please don't tag ${mentionedPhone}-senpai! They are currently AFK.\n> Reason: ${afkRecord.reason}`,
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

  // ── Image + sticker shortcut ─────────────────────────────────────────────
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

  // ── Yes/No pay confirmation handler ─────────────────────────────────────
  const textLower = textRaw.trim().toLowerCase()
  if (textLower === 'yes' || textLower === 'no') {
    try {
      const handled = await economyCmds.handlePayConfirm(
        sender, textLower === 'yes',
        { sock, msg, jid }
      )
      if (handled) return
    } catch {}
  }

  // ── Chess accept handler ─────────────────────────────────────────────────
  if (textLower === 'accept') {
    const game = chessCmds.chessGames.get(jid)
    if (game?.status === 'pending') {
      await chessCmds.accept({ sock, msg, jid, senderJid, sender, reply: (t) => sock.sendMessage(jid, { text: t }, { quoted: msg }) })
      return
    }
  }

  // ── Chess text-move handler (e.g. "e2 e4" or "resign") ──────────────────
  if (isGroup && chessCmds.chessGames.has(jid)) {
    const chessMove = textRaw.trim().match(/^([a-h][1-8])[\s-]?([a-h][1-8])$/i)
    const isResign  = textLower === 'resign'
    if (chessMove || isResign) {
      const handled = await chessCmds.handleMove(sock, jid, senderJid, textRaw.trim()).catch(() => false)
      if (handled) return
    }
  }

  // ── AI chat detection ────────────────────────────────────────────────────
  if (!isSticker && !isReaction && !isBold) {
    const botPhone       = (sock.user?.id  || '').split(':')[0].split('@')[0]
    const botLid         = (sock.user?.lid || '').split(':')[0].split('@')[0]
    const mentionedJids  = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const quotedParticipant = (msg.message?.extendedTextMessage?.contextInfo?.participant || '').split('@')[0].split(':')[0]
    const isReplyToBot   = quotedParticipant && (
      (botPhone && quotedParticipant === botPhone) ||
      (botLid   && quotedParticipant === botLid)
    )
    const isBotMentioned = mentionedJids.some(m => {
      const p = m.split('@')[0].split(':')[0]
      return (botPhone && p === botPhone) || (botLid && p === botLid)
    })

    const persona    = await db.getAiPersona().catch(() => null)
    const aiName     = (persona?.name || '').trim().toLowerCase()
    const nameRegex  = aiName ? new RegExp(`\\b${aiName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i') : null
    const mentionsAiName  = nameRegex ? nameRegex.test(textRaw) : false
    const mentionsAlpha   = /\balpha\b/i.test(textRaw)
    const mentionsAqua    = /\baqua\b/i.test(textRaw)

    // In DMs, always trigger Aqua (she responds to everything that isn't a command)
    const isDM = !isGroup
    const triggered = isDM || isBotMentioned || isReplyToBot || mentionsAiName || mentionsAlpha || mentionsAqua

    if (triggered && !textRaw.startsWith(PREFIX) && !textRaw.startsWith(POKE_PREFIX)) {
      // Aqua always wins: any reply to the bot, any @mention of bot, or "aqua" in message
      // She has group-level memory so she remembers the whole conversation
      if (isReplyToBot || isBotMentioned || (mentionsAqua && !mentionsAlpha)) {
        await aquaChatReply(sock, jid, msg, sender, msg.pushName || sender, textRaw)
      } else if (persona?.name && mentionsAiName) {
        try {
          await aiCmds.handleAiPersonaReply(sock, jid, msg, textRaw, persona)
        } catch (e) {
          console.error('[AI Persona] reply error:', e.message)
        }
      } else {
        await alphaChatReply(sock, jid, msg, sender, msg.pushName || sender, textRaw, isOwner)
      }
      return
    }
  }

  // ── Determine prefix ─────────────────────────────────────────────────────
  const isPokemon = textRaw.startsWith(POKE_PREFIX)
  const isDot     = textRaw.startsWith(PREFIX)

  // ── Natural language battle — "Pikachu use thunderbolt!" ─────────────────
  if (!isPokemon && !isDot) {
    const handled = await pokemonCmds.handleNaturalLanguageBattle(sock, jid, msg, sender, textRaw, senderJid).catch(() => false)
    if (!handled) return
    return
  }

  const usedPrefix = isPokemon ? POKE_PREFIX : PREFIX
  const body  = textRaw.slice(usedPrefix.length).trim()
  const args  = body.split(/\s+/)
  const cmd   = args.shift().toLowerCase()

  // ── Look up user ─────────────────────────────────────────────────────────
  const user = await db.getOrCreateUser(sender, msg.pushName || sender, senderJid).catch(() => null)
  const canonicalSender = user?.phone || sender

  if (user?.banned && !isOwner) return

  // ── Suspension check (sender) ─────────────────────────────────────────────
  if (!isOwner && cmd !== 'p' && cmd !== 'profile') {
    const suspension = await db.getSuspension(sender).catch(() => null)
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

  // ── Suspension check (mentioned/target user) ──────────────────────────────
  if (!isOwner && cmd !== 'p' && cmd !== 'profile') {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    for (const mJid of mentions) {
      const mPhone = mJid.split('@')[0].split(':')[0]
      const mSusp = await db.getSuspension(mPhone).catch(() => null)
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
    'poll','pollresult','dbstatus','checkdb',
    'addmod','removemod','addguardian','removeguardian','mods','modlist','modslist',
    'phelp','law','pbenefits','report','trivia','math','fact','joke','flip','8ball','roll','choose',
    'removebg','nobg','enhance','remini','upscale','night','sunset','rain','city','gun','jail','toanime','cartoon','carbon',
    'suspend','unsuspend','suspendlist',
    'market','wallet','bank','weekly','monthly','crime','rob','heist','topmoney','topbank','howgay','lockgroup','unlockgroup','join','exit','listgc',
    'register','reg','start','p','profile','bal','balance','help','menu',
    'myid','id','signup',
  ])

  const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg })

  const isDbReady = db.mongoose.connection.readyState === 1

  if (!isDbReady && !NO_DB_CMDS.has(cmd)) {
    return reply(
      `⏳ *Database Connecting...*\n\nThe bot is still connecting to the database.\nPlease wait a moment and try again!`
    )
  }

  if (isDbReady && !user) {
    try { user = await db.getOrCreateUser(sender, msg.pushName || sender, senderJid) } catch {}
  }

  // ── Registration gate — all commands require a linked account (jid) ──────
  const PUBLIC_CMDS = new Set([
    'menu','help','ping','uptime','botstatus','info','status','alive',
    'repo','script','signup','reg','register','link',
    'myid','id',
  ])
  if (isDbReady && !isOwner && !isMod && !isGuardian && !PUBLIC_CMDS.has(cmd)) {
    if (!user?.jid) {
      const replyFn = (text) => sock.sendMessage(jid, { text }, { quoted: msg })
      return replyFn(
        `You are not registered, so you cannot use this command. Type \`.signup\` to register.\n\n` +
        `*Please note:* if you are caught using multiple accounts *(dual accounts)*, you may be banned.`
      )
    }
  }

  const ctx = {
    sock, msg, jid, senderJid,
    sender: canonicalSender,
    rawSender: sender,
    args, cmd, user, isGroup, isOwner, isMod, isGuardian, PREFIX,
    pushName: msg.pushName || sender, msgType, textRaw,
    reply,
    replyImage: (image, caption) => sock.sendMessage(jid, { image, caption }, { quoted: msg }),
    react: (emoji) => sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }),
  }

  try {
    // ── # prefix → Pokémon commands ──────────────────────────────────────
    if (isPokemon) {
      const pk = pokemonCmds
      if (cmd === 'phelp')                       return await pk.phelp(ctx)
      if (cmd === 'start')                       return await pk.start(ctx)
      if (cmd === 'trainer')                     return await pk.trainer(ctx)
      if (cmd === 'pdaily')                      return await pk.pdaily(ctx)
      if (cmd === 'quests')                      return await pk.quests(ctx)
      if (cmd === 'rank')                        return await pk.rank(ctx)
      if (cmd === 'hunt' || cmd === 'wb' || cmd === 'scout') return await pk.scout(ctx)
      if (cmd === 'catch' || cmd === 'c')        return await pk.catch(ctx)
      if (cmd === 'spawnp' || cmd === 'spawn')   return await pk.spawnp(ctx)
      if (cmd === 'team')                        return await pk.team(ctx)
      if (cmd === 'party')                       return await pk.party(ctx)
      if (cmd === 'pc')                          return await pk.pc(ctx)
      if (cmd === 'swap' || cmd === 'pswap')     return await pk.swap(ctx)
      if (cmd === 'battle' || cmd === 'pbattle') return await pk.battle(ctx)
      if (cmd === 'gym')                         return await pk.gym(ctx)
      if (cmd === 'challenge')                   return await pk.challenge(ctx)
      if (cmd === 'badges')                      return await pk.badges(ctx)
      if (cmd === 'raid')                        return await pk.raid(ctx)
      if (cmd === 'heal' || cmd === 'pheal')     return await pk.heal(ctx)
      if (cmd === 'boost')                       return await pk.boost(ctx)
      if (cmd === 'evolve')                      return await pk.evolve(ctx)
      if (cmd === 'train')                       return await pk.train(ctx)
      if (cmd === 'moves' || cmd === 'moveset')   return await pk.moves(ctx)
      if (cmd === 'learn')                       return await pk.learn(ctx)
      if (cmd === 'bag')                         return await pk.bag(ctx)
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
      if (cmd === 'move' || cmd === 'mb')        return await pk.move(ctx)
      return
    }

    // ── . prefix → all other commands ───────────────────────────────────

    if (gtaCmds[cmd])           return await gtaCmds[cmd](ctx)
    if (imagesCmds[cmd])        return await imagesCmds[cmd](ctx)
    if (mainCmds[cmd])          return await mainCmds[cmd](ctx)
    if (adminCmds[cmd])         return await adminCmds[cmd](ctx)

    if (cmd === 'reg' || cmd === 'register') return await profileCmds['reg'](ctx)
    if (cmd === 'link')                      return await profileCmds['link'](ctx)

    if (profileCmds[cmd])       return await profileCmds[cmd](ctx)
    if (economyCmds[cmd])       return await economyCmds[cmd](ctx)

    if (cmd === 'cardspawn')    return await cardCmds.cardspawn(ctx)
    if (cmd === 'cg')           return await cardCmds.cg(ctx)
    if (cmd === 'cgconfirm')    return await cardCmds.cgconfirm(ctx)
    if (cmd === 'cgcancel')     return await cardCmds.cgcancel(ctx)
    if (cardCmds[cmd])          return await cardCmds[cmd](ctx)

    if (gameCmds[cmd])          return await gameCmds[cmd](ctx)

    // ── Chess ─────────────────────────────────────────────────────────────

      // ── Among Us ──────────────────────────────────────────────────────────────
      if (cmd === 'amongus') return await amongusCmds['amongus'](ctx)

      // Unique AU commands (no conflicts with other systems)
      const AU_ONLY = new Set([
        'go','move','walk','room','tasks','task','duties','complete',
        'vent','ventto','sabotage','sabo','fix','repair',
        'report','body','meeting','emergency','vote','skip','observe',
        'vitals','protect','guard','shift','track',
        'map','ausmap','crewcard','locker','cosmetics','buyau','colours','colors',
        'colour','color','titles','austats','aulb','crate','spin','pet'
      ])
      if (AU_ONLY.has(cmd) && amongusCmds[cmd]) return await amongusCmds[cmd](ctx)

      // .eliminate — AU kill alias (always AU, DM-only enforced inside)
      if (cmd === 'eliminate') return await amongusCmds['eliminate'](ctx)

      // .kill — route to Among Us when in active game; otherwise falls through
      if (cmd === 'kill' && amongusCmds.activeGames[jid]) return await amongusCmds['kill'](ctx)

      // .joinau / .leaveau / .playersau / .startau — explicit Among Us aliases (always route to AU)
      if (cmd === 'joinau')    return await amongusCmds['joinau'](ctx)
      if (cmd === 'leaveau')   return await amongusCmds['leaveau'](ctx)
      if (cmd === 'playersau') return await amongusCmds['playersau'](ctx)
      if (cmd === 'startau')   return await amongusCmds['startau'](ctx)

      // .join / .leave / .players — route to Among Us when game exists in group
      const AU_LOBBY = new Set(['join','leave','players'])
      if (AU_LOBBY.has(cmd) && amongusCmds.activeGames[jid]) return await amongusCmds[cmd](ctx)

      // .equip — try AU cosmetic first; if no cosmetic matched (returns null), fall through to rpg
      if (cmd === 'equip') {
        const auResult = await amongusCmds['equip'](ctx).catch(() => null)
        if (auResult !== null && auResult !== undefined) return
      }

          if (cmd === 'chess')        return await chessCmds.chess(ctx)
    if (cmd === 'endchess')     return await chessCmds.endchess(ctx)

    // ── Blackjack ─────────────────────────────────────────────────────────
    if (cmd === 'bj' || cmd === 'blackjack') return await blackjackCmds.bj(ctx)

    // ── UNO ───────────────────────────────────────────────────────────────
    if (cmd === 'uno')          return await unoCmds.uno(ctx)
    if (cmd === 'joinuno')      return await unoCmds.joinuno(ctx)
    if (cmd === 'unostart')     return await unoCmds.unostart(ctx)
    if (cmd === 'stopgame' || cmd === 'unostop') return await unoCmds.stopgame(ctx)
    if (cmd === 'caught')       return await unoCmds.caught(ctx)

    if (cmd === 'wb')              return await pokemonCmds.hunt(ctx)
    if (cmd === 'phelp')           return await pokemonCmds.phelp(ctx)
    if (cmd === 'pokemon')         return await pokemonCmds.pokemon(ctx)
    if (cmd === 'mypokemon')       return await pokemonCmds.party(ctx)
    if (cmd === 'setms')        return await pokemonCmds.setms(ctx)
    if (cmd === 'delms')        return await pokemonCmds.delms(ctx)
    if (pokemonCmds[cmd])       return await pokemonCmds[cmd](ctx)

    if (interactionCmds[cmd])   return await interactionCmds[cmd](ctx)
    if (funCmds[cmd])           return await funCmds[cmd](ctx)
    if (rpgCmds[cmd])           return await rpgCmds[cmd](ctx)
    if (gambleCmds[cmd])        return await gambleCmds[cmd](ctx)
    if (summerCmds[cmd])        return await summerCmds[cmd](ctx)
    if (guildCmds[cmd])         return await guildCmds[cmd](ctx)
    if (converterCmds[cmd])     return await converterCmds[cmd](ctx)

    if (cmd === 'ecostats')     return await econStatsCmds.ecostats(ctx)

    if (cmd === 'clearstaff') {
      if (!isOwner) return reply('❌ Owner only.')
      try {
        const User = db.mongoose.model('User')
        const result = await User.updateMany(
          { role: { $in: ['mod', 'guardian'] } },
          { $unset: { role: 1 } }
        )
        const count = result.modifiedCount ?? result.nModified ?? 0
        return reply(`✅ Cleared *${count}* staff member${count !== 1 ? 's' : ''} from the database.`)
      } catch (e) {
        return reply(`❌ clearstaff failed: ${e.message}`)
      }
    }

    if (cmd === 'resetallusers') return await staffCmds['resetallusers'](ctx)
    if (staffCmds[cmd])         return await staffCmds[cmd](ctx)
    if (cmd === 'join')          return staffCmds['join'] ? staffCmds['join'](ctx) : ctx.reply('❌ .join <invite link>')
    if (cmd === 'exit')          return staffCmds['exit'] ? staffCmds['exit'](ctx) : ctx.reply('❌ Groups only.')
    if (cmd === 'listgc')        return staffCmds['listgc'] ? staffCmds['listgc'](ctx) : ctx.reply('❌ Access Denied')

    if (cmd === 'lockgroup')     return adminCmds['close']    ? adminCmds['close'](ctx)   : ctx.reply('❌ Groups only.')
    if (cmd === 'unlockgroup')   return adminCmds['open']     ? adminCmds['open'](ctx)    : ctx.reply('❌ Groups only.')
    if (cmd === 'howgay')        return funCmds['gay']        ? funCmds['gay'](ctx)       : ctx.reply('❌ Fun cmd missing.')
    if (cmd === 'market')        return economyCmds['market'] ? economyCmds['market'](ctx): ctx.reply('❌ Economy cmd missing.')
    if (cmd === 'wallet')        return economyCmds['wallet'] ? economyCmds['wallet'](ctx): economyCmds['bal'](ctx)
    if (cmd === 'bank')          return economyCmds['bankbal']? economyCmds['bankbal'](ctx): economyCmds['bal'](ctx)
    if (cmd === 'weekly')        return economyCmds['weekly'] ? economyCmds['weekly'](ctx): ctx.reply('⏳ Coming soon.')
    if (cmd === 'monthly')       return economyCmds['monthly']? economyCmds['monthly'](ctx):ctx.reply('⏳ Coming soon.')
    if (cmd === 'crime')         return economyCmds['crime']  ? economyCmds['crime'](ctx) : ctx.reply('⏳ Coming soon.')
    if (cmd === 'rob')           return economyCmds['rob']    ? economyCmds['rob'](ctx)   : ctx.reply('⏳ Coming soon.')
    if (cmd === 'heist')         return economyCmds['heist']  ? economyCmds['heist'](ctx) : ctx.reply('⏳ Coming soon.')
    if (cmd === 'topmoney')      return economyCmds['topmoney']?economyCmds['topmoney'](ctx):economyCmds['richlist'](ctx)
    if (cmd === 'topbank')       return economyCmds['topbank']?economyCmds['topbank'](ctx):economyCmds['richlist'](ctx)
    if (cmd === 'achievements')  return economyCmds['achievements']?economyCmds['achievements'](ctx):ctx.reply('🏆 Achievements coming soon!')
    if (cmd === 'claim')         return economyCmds['claim']  ? economyCmds['claim'](ctx) : economyCmds['daily'](ctx)
    if (cmd === 'bonus')         return economyCmds['bonus']  ? economyCmds['bonus'](ctx) : ctx.reply('⏳ Coming soon.')
    if (cmd === 'upgrade')       return economyCmds['upgrade']? economyCmds['upgrade'](ctx):ctx.reply('⏳ Coming soon.')
    if (cmd === 'prestige')      return economyCmds['prestige']?economyCmds['prestige'](ctx):ctx.reply('⏳ Coming soon.')
    if (cmd === 'bankupgrade')   return economyCmds['bankupgrade']?economyCmds['bankupgrade'](ctx):ctx.reply('⏳ Coming soon.')
    if (cmd === 'withdrawall')   return economyCmds['withdrawall']?economyCmds['withdrawall'](ctx):(()=>{ctx.args=['all'];return economyCmds['withdraw'](ctx)})()
    if (cmd === 'goodbye')       return adminCmds['leave']    ? adminCmds['leave'](ctx)   : ctx.reply('❌ Usage: .goodbye on/off')
    if (cmd === 'invitelink')    return adminCmds['invitelink']?adminCmds['invitelink'](ctx):ctx.reply('⏳ Coming soon.')
    if (cmd === 'stafflist')     return staffCmds['mods']     ? staffCmds['mods'](ctx)    : ctx.reply('No staff found.')
    if (cmd === 'myrole')        return staffCmds['myrole']   ? staffCmds['myrole'](ctx)  : ctx.reply('⏳ Coming soon.')

    if (pollCmds[cmd])          return await pollCmds[cmd](ctx)
    if (lotteryCmds[cmd])       return await lotteryCmds[cmd](ctx)

    if (cmd === 'aitrain')      return await aiCmds.aitrain(ctx)
    if (aiCmds[cmd])            return await aiCmds[cmd](ctx)

    if (utilityCmds[cmd])       return await utilityCmds[cmd](ctx)
    if (vibeCmds[cmd])          return await vibeCmds[cmd](ctx)

  } catch (err) {
    console.error(`Command error [${usedPrefix}${cmd}]:`, err.message)
    await ctx.reply(`⚠️ Error running *.${cmd}*\n\n_${err.message}_`)
  }
}

module.exports = handleMessage
