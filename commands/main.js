const db = require('../database')
const fs = require('fs')
const path = require('path')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')
const { makeSticker } = require('../stickerHelper')

const MENU_IMAGE = path.join(__dirname, '../assets/menu.jpg')
const BOT_VERSION = '1.0.0'

function uptime() {
  const ms = Date.now() - global.botStartTime
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`
  return `${m}m ${s % 60}s`
}

module.exports = {
  async menu({ sock, msg, jid, sender }) {
    const menuText = `╔『 🌑 𝐒𝐇𝚫𝐃𝐎𝐖 𝐆𝚫𝐑𝐃𝚵𝐍 🌑 』╗
┃ 𖤐 Prefix : .
┃ 𖤐 Name : Alpha
┃ 𖤐 Core : Alpha
┃ 𖤐 Dev : Ryuk
╚═══════════════════╝

✦ *.support* → Join the Shadow Garden Community.
✦ *.addbot* → Request to add a Shadow Garden Bot to your group.

━━━━━━━━━━━━━━━━━

📋 『 𝗠𝗔𝗜𝗡 』
✦ .menu
✦ .ping
✦ .website
✦ .community
✦ .afk
✦ .help
✦ .info
✦ .uptime

━━━━━━━━━━━━━━━━━

⚙️ 『 𝗔𝗗𝗠𝗜𝗡 』
✦ .kick
✦ .delete
✦ .antilink
✦ .antilink set [action]
✦ .warn @user [reason]
✦ .resetwarn
✦ .groupinfo / .gi
✦ .groupstats / .gs
✦ .welcome on/off
✦ .setwelcome
✦ .leave on/off
✦ .setleave
✦ .promote
✦ .demote
✦ .mute
✦ .unmute
✦ .hidetag
✦ .tagall
✦ .activity
✦ .active
✦ .inactive
✦ .open
✦ .close
✦ .antism on/off
✦ .blacklist add/remove/list

━━━━━━━━━━━━━━━━━

💰 『 𝗘𝗖𝗢𝗡𝗢𝗠𝗬 』
✦ .bal / .balance
✦ .gems
✦ .premium / .prem  ✦ .membership / .memb
✦ .premiumbal / .pbal
✦ .daily
✦ .withdraw / .wid
✦ .deposit / .dep
✦ .donate
✦ .lottery
✦ .lp
✦ .richlg
✦ .richlist

⧉ 𝗣𝗿𝗼𝗳𝗶𝗹𝗲
✦ .register / .reg
✦ .setname
✦ .profile / .p
✦ .bio
✦ .setage

⧉ 𝗜𝗻𝘃𝗲𝗻𝘁𝗼𝗿𝘆
✦ .inv
✦ .use
✦ .sell
✦ .buy

⧉ 𝗚𝗿𝗶𝗻𝗱𝗶𝗻𝗴
✦ .work
✦ .dig
✦ .fish
✦ .beg
✦ .roast

⧉ 𝗦𝘁𝗮𝘁𝘀
✦ .leaderboard / .lb
✦ .stats
✦ .cds
✦ .bc
✦ .lc

━━━━━━━━━━━━━━━━━

🎴 『 𝗖𝗔𝗥𝗗 𝗦𝗬𝗦𝗧𝗘𝗠 』
✦ .collection / .coll
✦ .deck
✦ .sdi
✦ .card
✦ .ci <name> [tier]
✦ .mycolls
✦ .cardlb
✦ .get
✦ .stardust

⧉ 𝗖𝗼𝗺𝗯𝗮𝘁
✦ .vs

⧉ 𝗧𝗿𝗮𝗱𝗶𝗻𝗴
✦ .cg
✦ .sellc
✦ .tc
✦ .accept / .decline

⧉ 𝗗𝗲𝗰𝗸 𝗖𝗼𝗻𝘁𝗿𝗼𝗹
✦ .ctd
✦ .ctd remove / clear

⧉ 𝗟𝗲𝗻𝗱𝗶𝗻𝗴
✦ .lc
✦ .lcd
✦ .retrieve

⧉ 𝗔𝘂𝗰𝘁𝗶𝗼𝗻
✦ .auction
✦ .myauc
✦ .listauc

━━━━━━━━━━━━━━━━━

🎮 『 𝗚𝗔𝗠𝗘𝗦 』
✦ .ttt
✦ .c4
✦ .wcg
✦ .wordchain
✦ .startbattle
✦ .stopgame

━━━━━━━━━━━━━━━━━

🃏 『 𝗨𝗡𝗢 』
✦ .uno
✦ .startuno
✦ .unoplay
✦ .unodraw
✦ .unohand

━━━━━━━━━━━━━━━━━

🎲 『 𝗚𝗔𝗠𝗕𝗟𝗘 』
✦ .slots
✦ .dice
✦ .casino
✦ .cf
✦ .db
✦ .dp
✦ .roulette
✦ .horse
✦ .spin

━━━━━━━━━━━━━━━━━

👤 『 𝗜𝗡𝗧𝗘𝗥𝗔𝗖𝗧𝗜𝗢𝗡𝗦 』
✦ .hug
✦ .kiss
✦ .slap
✦ .wave
✦ .pat
✦ .dance
✦ .sad
✦ .smile
✦ .laugh

⧉ 𝗖𝗼𝗺𝗯𝗮𝘁
✦ .punch
✦ .hit
✦ .kill
✦ .kidnap

⧉ 𝗘𝘅𝘁𝗿𝗮𝘀
✦ .lick
✦ .bonk
✦ .tickle
✦ .shrug

━━━━━━━━━━━━━━━━━

🎉 『 𝗙𝗨𝗡 』
✦ .gay
✦ .lesbian
✦ .simp
✦ .match
✦ .ship
✦ .character
✦ .pp
✦ .skill
✦ .duality
✦ .gen
✦ .pov
✦ .social
✦ .relation
✦ .compliment
✦ .roast

⧉ 𝗚𝗮𝗺𝗲𝘀
✦ .wyr
✦ .truth
✦ .dare
✦ .td
✦ .joke
✦ .8ball <question>
✦ .roll [sides] [count]
✦ .choose a | b | c
✦ .flip
✦ .reverse <text>

⧉ 𝗨𝘁𝗶𝗹𝗶𝘁𝘆
✦ .fancy → 40 numbered styles
✦ .fancy <n> <text>
✦ .password / .pass [length]
✦ .qr <text>
✦ .fact

⧉ 𝗦𝘁𝗮𝘁𝘂𝘀
✦ .status
✦ .memory
✦ .ll

━━━━━━━━━━━━━━━━━

👤 『 𝗣𝗥𝗢𝗙𝗜𝗟𝗘 』
✦ .profile / .p
✦ .setpp
✦ .setbg
✦ .frames
✦ .setframe <1–30>

━━━━━━━━━━━━━━━━━

⚔️ 『 𝗥𝗣𝗚 』
✦ .rpg
✦ .selectclass — Choose your class
✦ .skillinfo — View skill evolution
✦ .dungeon — Enter dungeon
✦ .attack / .heavy / .defend / .special / .heal / .flee
⧉ 𝗖𝗹𝗮𝘀𝘀 𝗔𝗯𝗶𝗹𝗶𝘁𝗶𝗲𝘀
✦ .slash / .darkslash / .voidrend (Warrior)
✦ .darknova / .voidcascade (Mage)
✦ .shadowshot / .voidpiercer (Archer)
✦ .backstab / .smokebomb (Assassin)
✦ .shieldwall / .deathblow (Knight)
✦ .berserk (Warrior)
✦ .adventure / .quest / .raid

━━━━━━━━━━━━━━━━━

📜 『 𝗣𝗢𝗞𝗘́𝗠𝗢𝗡 𝗦𝗬𝗦𝗧𝗘𝗠 』
✦ #phelp — Full Pokémon command menu
✦ #start — Begin your journey
✦ #hunt / #wb — Find wild Pokémon
✦ #catch / #c <slot> --<ball> — Catch Pokémon
✦ #party / #team / #pc — Manage Pokémon
✦ #dex <name/id> — Pokédex info
✦ #trainer — Your trainer profile
✦ #mart / #mbuy / #use — PokéMart

━━━━━━━━━━━━━━━━━

🤖 『 𝗔𝗜 』
✦ .ai / .gpt
✦ .translate / .tt
✦ .chat on/off

━━━━━━━━━━━━━━━━━

🔄 『 𝗖𝗢𝗡𝗩𝗘𝗥𝗧𝗘𝗥 』
✦ .sticker / .s
✦ .take
✦ .toimg
✦ .play
✦ .speech
✦ .mood
✦ .pintimg

━━━━━━━━━━━━━━━━━

☀️ 『 𝗦𝗨𝗠𝗠𝗘𝗥 𝗘𝗩𝗘𝗡𝗧 』
✦ .summer
✦ .token check
✦ .token shop
✦ .token buy
✦ .token top

━━━━━━━━━━━━━━━━━

🏰 『 𝗚𝗨𝗜𝗟𝗗𝗦 』
✦ .guild create / join / leave / info / list
✦ .guild disband
✦ .guildbattle <name>
✦ .guildleaderboard / .glb
✦ .guilddonation <amount>
✦ .guildinvite @user

⧉ 𝗚𝘂𝗶𝗹𝗱 𝗥𝗮𝗶𝗱
✦ .guildraid — Leader starts 5-floor raid
✦ .raidjoin — Members join (60s window)
✦ .raidattack — Attack during raid


╚═════════════════╝
  「 Rule from the Shadows. 🖤 」`

    if (fs.existsSync(MENU_IMAGE)) {
      await sock.sendMessage(jid, {
        image: { url: MENU_IMAGE },
        caption: menuText
      }, { quoted: msg })
    } else {
      await sock.sendMessage(jid, { text: menuText }, { quoted: msg })
    }
  },

  async ping({ sock, msg, jid }) {
    const start = Date.now()
    await sock.sendMessage(jid, { text: '🏓' }, { quoted: msg })
    const ping = Date.now() - start
    await sock.sendMessage(jid, { text: `Alpha's here!\n> ${ping}Ms` }, { quoted: msg })
  },

  async uptime({ reply }) {
    await reply(`⏱️ *Uptime:* ${uptime()}`)
  },

  async info({ sock, msg, jid, user }) {
    const start = Date.now()
    const userCount = await db.getUserCount()
    const groupCount = await db.getGroupCount()
    const ping = Date.now() - start
    const mem = process.memoryUsage()
    const ramUsed = (mem.heapUsed / 1024 / 1024).toFixed(1)

    await sock.sendMessage(jid, {
      text:
        `📌 *BOT INFORMATION*\n\n` +
        `🤖 *Name:* ${global.botName}\n` +
        `⚙️ *Version:* ${BOT_VERSION}\n` +
        `📡 *Status:* Online\n` +
        `⚡ *Speed:* ${ping} ms\n\n` +
        `👥 *Users:* ${userCount}\n` +
        `🏠 *Groups:* ${groupCount}\n` +
        `🧠 *RAM:* ${ramUsed} MB\n\n` +
        `📊 *Uptime:* ${uptime()}\n` +
        `👤 *Dev:* Ryuk`
    }, { quoted: msg })
  },

  async status({ sock, msg, jid }) {
    const start = Date.now()
    const userCount = await db.getUserCount()
    const groupCount = await db.getGroupCount()
    const ping = Date.now() - start
    const mem = process.memoryUsage()
    const ramUsed = (mem.heapUsed / 1024 / 1024).toFixed(1)

    await sock.sendMessage(jid, {
      text:
        `🤖 *BOT STATUS*\n\n` +
        `📡 *Status:* Online\n` +
        `⚡ *Ping:* ${ping} ms\n` +
        `⏱️ *Uptime:* ${uptime()}\n` +
        `🧠 *RAM:* ${ramUsed} MB\n\n` +
        `👥 *Users:* ${userCount}\n` +
        `🏠 *Groups:* ${groupCount}`
    }, { quoted: msg })
  },

  async afk({ reply, args, sender, senderJid }) {
    const reason = args.join(' ') || 'No reason given'
    await db.setAFK(sender, reason)
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    await reply(
      `💤 *AFK MODE ACTIVATED*\n\n` +
      `👤 @${sender}\n` +
      `📌 *Reason:* ${reason}\n` +
      `⏰ *Time:* ${now}\n\n` +
      `_Anyone who tags you will be notified._ 🖤`
    )
  },

  async website({ reply }) {
    await reply(`🌐 *SHADOW GARDEN WEBSITE*\n\n🔗 Coming Soon…`)
  },

  async community({ reply }) {
    await reply(`🌑 *SHADOW GARDEN COMMUNITY*\n\nType *.support* for the group link.`)
  },

  async support({ reply }) {
    await reply(`💬 *SHADOW GARDEN SUPPORT*\n\nhttps://chat.whatsapp.com/invite`)
  },

  async addbot({ reply }) {
    await reply(`🤖 *ADD BOT REQUEST*\n\nContact staff with your group link.\n\nUse *.mods* to see available staff.`)
  },

  async help({ reply, args }) {
    const cmd = args[0]
    if (cmd) {
      await reply(`📖 *HELP: .${cmd}*\n\nSee *.menu* for full command list.`)
    } else {
      await reply(`📖 *HELP MENU*\n\n• Type *.menu* for all commands\n• *#phelp* for Pokémon commands\n• *.law* for rules\n• *.pbenefits* for premium info`)
    }
  },

  async memory({ reply }) {
    const mem = process.memoryUsage()
    const toMB = (b) => (b / 1024 / 1024).toFixed(2)
    await reply(`💾 *MEMORY*\n\nHeap Used: ${toMB(mem.heapUsed)} MB\nRSS: ${toMB(mem.rss)} MB`)
  },

  async lastlogs({ reply }) {
    await reply(`📋 *LAST LOGS*\n\nNo recent errors.`)
  },

  // ── .law ──────────────────────────────────────────────────────
  async law({ reply }) {
    await reply(
      `📜 *SHADOW GARDEN LAWS AND REGULATIONS* 📜\n\n` +
      `*(All members must comply with the rules below at all times)*\n\n` +

      `⚖️ *BASIC RULES*\n\n` +
      `1. Respect all Moderators, Guardians, and Staff members at all times. Disrespect, insults, or toxic behavior toward staff will not be tolerated.\n\n` +
      `2. Maintain proper and decent behavior in all community spaces. Avoid being disruptive, annoying, or engaging in actions that may lead to punishment or bans.\n\n` +
      `3. Impersonating staff members in any form (names, roles, profiles, or actions) is strictly prohibited and will result in immediate punishment.\n\n` +
      `4. Follow instructions from staff members when given. Failure to comply may lead to disciplinary action.\n\n\n` +

      `💰🎴 *ECONOMY, CARDS AND PLAY RULES*\n\n` +
      `1. Multiple accounts (alts) are strictly prohibited. Any user caught using more than one account for advantage will be permanently banned.\n\n` +
      `2. The use of scripts, cheats, macros, or any form of bot-assisted automation to gain unfair advantage is strictly forbidden.\n\n` +
      `3. Fake card spawns are not allowed under any circumstance. Sending or spreading fake spawns in community groups or external servers will result in punishment.\n\n` +
      `4. Exploiting bugs, glitches, or unintended mechanics for personal gain is strictly prohibited and must be reported immediately to staff.\n\n` +
      `5. Any form of fraud, scam trading, or manipulation of card systems will lead to severe penalties, including bans.\n\n\n` +

      `🤖 *BOT RULES AND CONDUCT*\n\n` +
      `1. If the bot is offline or experiencing issues, do NOT spam commands repeatedly. Doing so will result in punishment.\n\n` +
      `2. Attempting to overload, crash, or disrupt the bot through spam or abuse is strictly forbidden.\n\n` +
      `3. Do not DM staff members asking why the bot is offline or malfunctioning. Updates will be provided when necessary.\n\n` +
      `4. Do not DM moderators requesting bot replacements in groups. If a bot is banned or replaced, announcements will be made officially.\n\n` +
      `5. Misusing bot commands intentionally or repeatedly will lead to restriction or blacklist from bot features.\n\n\n` +

      `🏠 *REQUIREMENTS FOR BOT ACCESS IN GROUPS*\n\n` +
      `1. Groups must maintain a minimum of 80 active members to qualify for bot access.\n\n` +
      `2. At least one Moderator or Guardian must be present in the group to supervise activity.\n\n` +
      `3. The bot and assigned staff must be granted full administrative permissions in the group for proper operation.\n\n` +
      `4. Removing or tampering with assigned staff or bot permissions may result in immediate bot removal from the group.\n\n` +
      `5. If a group becomes inactive or dies (low or no engagement), the bot will be removed without notice.\n\n\n` +

      `📩 *STAFF CONTACT RULES*\n\n` +
      `1. To view available staff members, use the command: *.modslist*\n\n` +
      `2. When contacting staff, clearly state your issue or request. Do NOT send empty messages like "hi", "hey", or "wsp".\n\n` +
      `3. Spamming staff DMs is strictly forbidden. You may be blocked or penalized for doing so.\n\n` +
      `4. Do not contact multiple staff members for the same issue. Choose one and wait for a response.\n\n` +
      `5. Do not DM staff begging for unbans. If your appeal is valid, it will be reviewed—repeated requests will only worsen your case.\n\n\n` +

      `🚫 *FINAL NOTICE*\n\n` +
      `No one is exempt from these rules, regardless of rank, status, or experience.\n\n` +
      `Everyone is expected to follow and respect the regulations equally.\n\n` +
      `Violating any of these rules may result in warnings, restrictions, or permanent bans depending on severity.\n\n` +

      `🔄 *UPDATES*\n\n` +
      `These rules may be updated, changed, or expanded at any time without prior notice. All members are expected to stay informed and up to date with the latest version.`
    )
  },

  // ── .pbenefits ────────────────────────────────────────────────
  async pbenefits({ reply }) {
    await reply(
      `『 𝗦𝗛𝗔𝗗𝗢𝗪 𝗚𝗔𝗥𝗗𝗘𝗡 𝗣𝗥𝗘𝗠𝗜𝗨𝗠 』 ◈════════════════════◈\n\n` +

      `✨ *PREMIUM BENEFITS*\n\n` +
      `💰 *Instant Reward*\n\n` +
      `Receive an immediate 500,000 coins deposited into your bank upon activation.\n\n` +
      `⚡ *Boosted Efficiency*\n\n` +
      `75% cooldown reduction on all bot commands.\n\nExcludes daily reward commands.\n\n` +
      `💎 *Exclusive Currency*\n\n` +
      `Access to premium currency: Obsidian Shards.\n\n` +
      `🏷️ *Personalization Perks*\n\n` +
      `Custom mention sticker for your profile.\n\nAnimated profile & background effects.\n\nAnimated card deck backgrounds for enhanced visuals.\n\n` +

      `◈════════════════════◈\n\n` +

      `🛒 *HOW TO PURCHASE PREMIUM MEMBERSHIP*\n\n` +
      `1. Be aware that Premium requires payment to activate.\n\n` +
      `2. Use the command: *.mods* to contact staff.\n\n` +
      `3. A moderator will respond with full purchase instructions.\n\n` +
      `4. Follow the official steps carefully to complete your purchase.\n\n` +

      `◈════════════════════◈\n\n` +

      `📌 *IMPORTANT NOTICE*\n\n` +
      `Premium is optional and provides convenience + cosmetic benefits.\n\n` +
      `All transactions must be handled only by official staff members.\n\n` +
      `Do not trust unofficial sellers or third parties.\n\n` +

      `◈════════════════════◈`
    )
  },

  // ── .restart ──────────────────────────────────────────────────
  async restart({ sock, jid, msg, reply, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    await sock.sendMessage(jid, {
      text:
        `🤖 *SYSTEM NOTICE*\n\n` +
        `⚠️ *Shadow Garden Bot is restarting...*\n\n` +
        `The bot is currently undergoing a quick reboot to apply updates and improve performance.\n\n` +
        `🔄 *Status:* Restart in progress\n` +
        `⏳ *Estimated time:* A few moments\n\n` +
        `✨ Please wait patiently while we bring everything back online.`
    }, { quoted: msg })
    setTimeout(() => {
      process.exit(0)
    }, 2000)
  },

  // ── .setms ────────────────────────────────────────────────────
  async setms(ctx) {
    const pokemonCmds = require('./pokemon')
    return pokemonCmds.setms(ctx)
  },

  // ── .delms ────────────────────────────────────────────────────
  async delms(ctx) {
    const pokemonCmds = require('./pokemon')
    return pokemonCmds.delms(ctx)
  },

  // ── .tagall ───────────────────────────────────────────────────
  async tagall({ sock, msg, jid, senderJid, sender, isGroup, isOwner, args, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const admin = await _isAdmin(sock, jid, senderJid)
    if (!admin && !isOwner) return reply('⚠️ Admin only.')
    const meta    = await sock.groupMetadata(jid)
    const message = args.join(' ') || 'Attention everyone!'

    // Always use full JID (not LID)
    const members = meta.participants.map(p => {
      const num = p.id.split('@')[0].split(':')[0]
      return `${num}@s.whatsapp.net`
    })

    const owner   = meta.owner || meta.participants.find(p => p.admin === 'superadmin')?.id || ''
    const ownerNum = owner.split('@')[0].split(':')[0]

    // Fetch activity (last 7 days)
    const activePhones = await db.getActiveUsers(jid, 24 * 7).catch(() => [])
    const activeSet    = new Set(activePhones)

    const memberLines = members.map(m => {
      const phone    = m.split('@')[0]
      const isActive = activeSet.has(phone)
      const status   = isActive ? '🟢' : '🔴'
      return `${status} 💠 @${phone}`
    }).join('\n')

    const text =
      `📣 *Tagging All...*\n\n` +
      `🏷️ *Message:* ${message}\n` +
      `🎃 *Group:* ${meta.subject}\n` +
      `🆔 *Group JID:* ${jid}\n` +
      `👑 *Group Owner:* @${ownerNum}\n` +
      `👥 *Group Members Count:* ${members.length}\n\n` +
      `${memberLines}`

    await sock.sendMessage(jid, { text, mentions: members })
  },

  // ── .modlist / .modslist ──────────────────────────────────────
  async modlist({ sock, jid, msg, reply, isGroup }) {
    const { data: mods }      = await db.supabase.from('users').select('phone,name').eq('role', 'mod')
    const { data: guardians } = await db.supabase.from('users').select('phone,name').eq('role', 'guardian')

    const modList      = mods      || []
    const guardianList = guardians || []

    const allMentions = [
      ...modList.map(u => `${u.phone}@s.whatsapp.net`),
      ...guardianList.map(u => `${u.phone}@s.whatsapp.net`),
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
      `> ⚠️ Inappropriate use of this command will lead to a *Shadow Ban*.`

    await sock.sendMessage(jid, { text, mentions: allMentions }, { quoted: msg })
  },
  async modslist(ctx) { return module.exports.modlist(ctx) },

  // ── dbstatus ──────────────────────────────────────────────────
  async dbstatus({ reply, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const tables = [
      'users', 'groups', 'warnings', 'afk', 'messages', 'cooldowns',
      'inventory', 'cards', 'user_cards', 'user_pokemon', 'games',
      'summer_tokens', 'guilds', 'guild_members', 'blacklist', 'disabled_commands',
    ]
    const results = await Promise.all(tables.map(async (table) => {
      try {
        const { count, error } = await db.supabase.from(table).select('*', { count: 'exact', head: true })
        if (error) return { table, ok: false }
        return { table, ok: true, count: count || 0 }
      } catch {
        return { table, ok: false }
      }
    }))
    const lines = results.map(r => `${r.ok ? '✅' : '❌'} ${r.table}${r.ok ? ` (${r.count})` : ' — MISSING'}`).join('\n')
    const ready   = results.filter(r => r.ok).length
    await reply(`🗄️ *DATABASE STATUS*\n\n${lines}\n\n📊 *Tables:* ${ready}/${tables.length} ready`)
  },

  async botstatus({ sock, msg, jid }) {
    const start = Date.now()
    const userCount  = await db.getUserCount().catch(() => '?')
    const groupCount = await db.getGroupCount().catch(() => '?')
    const ping    = Date.now() - start
    const mem     = process.memoryUsage()
    const ramUsed = (mem.heapUsed / 1024 / 1024).toFixed(1)
    const ramTotal = (mem.heapTotal / 1024 / 1024).toFixed(1)

    await sock.sendMessage(jid, {
      text:
        `🌑 *SHADOW GARDEN — BOT STATUS*\n\n` +
        `🤖 *Name:* ${global.botName}\n` +
        `📡 *Status:* ${global.botConnected ? '🟢 Online' : '🔴 Offline'}\n\n` +
        `⚡ *Ping:* ${ping} ms\n` +
        `⏱️ *Uptime:* ${uptime()}\n` +
        `🧠 *RAM:* ${ramUsed} / ${ramTotal} MB\n\n` +
        `👥 *Users:* ${userCount}\n` +
        `🏠 *Groups:* ${groupCount}\n\n` +
        `👤 *Dev:* Ryuk`
    }, { quoted: msg })
  },

  async sticker({ sock, msg, jid, reply }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const targetMsg = quoted
      ? {
          message: quoted,
          key: {
            remoteJid: jid,
            id: msg.message.extendedTextMessage.contextInfo.stanzaId,
            participant: msg.message.extendedTextMessage.contextInfo.participant,
          },
        }
      : msg

    const targetContent = quoted || msg.message
    const imgMsg =
      targetContent?.imageMessage ||
      targetContent?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage

    if (!imgMsg) {
      return reply(`🖼️ *STICKER MAKER*\n\nSend or quote a *JPG / PNG* image with *.s* to convert it.`)
    }

    const mime = imgMsg.mimetype || ''
    if (mime.includes('gif') || mime.includes('video')) {
      return reply(`❌ GIFs and videos are not supported. Send a *JPG or PNG* image only.`)
    }

    try {
      const buffer = await downloadMediaMessage(
        targetMsg, 'buffer', {},
        { logger: console, reuploadRequest: sock.updateMediaMessage }
      )
      const stickerBuffer = await makeSticker(buffer)
      await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: msg })
    } catch (err) {
      await reply(`❌ Failed to create sticker: ${err.message}`)
    }
  },

  async s(ctx) { return module.exports.sticker(ctx) },
}

async function _isAdmin(sock, jid, senderJid) {
  const meta = await sock.groupMetadata(jid).catch(() => null)
  if (!meta) return false
  return meta.participants.filter(p => p.admin).map(p => p.id).includes(senderJid)
}
