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
✦ .wb
✦ .spawnp (staff only)
✦ .pokemon

⧉ 𝗧𝗲𝗮𝗺 𝗖𝗼𝗻𝘁𝗿𝗼𝗹
✦ .party
✦ .pc
✦ .pswap
✦ .t2pc
✦ .t2party

⧉ 𝗕𝗮𝘁𝘁𝗹𝗲
✦ .pbattle
✦ .atk
✦ .moves
✦ .moveinfo
✦ .pheal

⧉ 𝗧𝗿𝗮𝗱𝗲 / 𝗜𝗻𝘁𝗲𝗿𝗮𝗰𝘁
✦ .pgive
✦ .ptrade
✦ .ptrade accept / reject

⧉ 𝗚𝗿𝗼𝘄𝘁𝗵
✦ .evolve
✦ .learn
✦ .puse

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
    await reply(`⏱️ *UPTIME*\n\n🤖 Bot has been running for:\n*${uptime()}*\n\n_The system never sleeps…_ 🖤`)
  },

  async info({ sock, msg, jid, user }) {
    const start = Date.now()
    const userCount = await db.getUserCount()
    const groupCount = await db.getGroupCount()
    const ping = Date.now() - start
    const mem = process.memoryUsage()
    const ramUsed = (mem.heapUsed / 1024 / 1024).toFixed(1)
    const ramTotal = (mem.heapTotal / 1024 / 1024).toFixed(1)

    await sock.sendMessage(jid, {
      text: `📌 *BOT INFORMATION*\n\n🤖 *Name:* ${global.botName}\n🌑 *Theme:* Shadow Garden\n⚙️ *Prefix:* ${global.prefix}\n🧠 *Mode:* Public\n📡 *Status:* Online\n\n👤 *Developer:* Ryuk\n🧩 *Version:* ${BOT_VERSION}\n\n📊 *Uptime:* ${uptime()}\n⚡ *Speed:* ${ping} ms\n\n💾 *Database:* Supabase (Connected)\n🛡️ *Security:* Active\n\n📱 *Platform:* WhatsApp MD (Baileys)\n\n⏰ *Runtime:* ${Math.floor((Date.now() - global.botStartTime) / 3600000)} hours\n\n👥 *Users:* ${userCount}\n🏠 *Groups:* ${groupCount}\n\n_The system runs silently in the shadows… always active, always watching._ 🖤`
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
      text: `🤖 *BOT STATUS*\n\n🌑 *Name:* ${global.botName}\n⚙️ *Mode:* Public\n📡 *Status:* Online\n\n⚡ *Ping:* ${ping} ms\n⏱️ *Uptime:* ${uptime()}\n🧠 *RAM Usage:* ${ramUsed} MB\n💾 *Database:* Supabase Connected\n\n👥 *Active Chats:* ${groupCount}\n👤 *Users:* ${userCount}\n🏠 *Groups:* ${groupCount}\n\n🔐 *Security:* Active\n🚫 *Errors Today:* 0\n\n📅 *Last Restart:* ${new Date(global.botStartTime).toLocaleString()}\n\n_The system runs silently… but it never sleeps._ 🖤`
    }, { quoted: msg })
  },

  async afk({ reply, args, sender, senderJid }) {
    const reason = args.join(' ') || 'No reason given'
    await db.setAFK(sender, reason)
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    await reply(`💤 *AFK MODE ACTIVATED*\n\n👤 *User:* @${sender}\n\n📌 *Reason:* ${reason}\n⏰ *Time:* ${now}\n\n⚡ You are now marked as AFK.\n\n💬 Anyone who mentions you will be notified.\n\n_The shadows will hold your presence until you return…_ 🖤`)
  },

  async website({ reply }) {
    await reply(`🌐 *SHADOW GARDEN WEBSITE*\n\n🔗 Coming Soon…\n\n_The shadows are building something great._ 🖤`)
  },

  async community({ reply }) {
    await reply(`🌑 *SHADOW GARDEN COMMUNITY*\n\n👥 Join our group for support, updates, and more.\n\n_Type .support for the link._ 🖤`)
  },

  async support({ reply }) {
    await reply(`💬 *SHADOW GARDEN SUPPORT*\n\nhttps://chat.whatsapp.com/invite\n\n_The shadows welcome you._ 🖤`)
  },

  async addbot({ reply }) {
    await reply(`🤖 *ADD BOT REQUEST*\n\nTo add Shadow Garden Bot to your group, contact @developer with your group link.\n\n_The shadows expand their reach._ 🖤`)
  },

  async help({ reply, args }) {
    const cmd = args[0]
    if (cmd) {
      await reply(`📖 *HELP: .${cmd}*\n\nFor detailed help on *.${cmd}*, check the menu or ask in support.\n\n_The system provides guidance to those who seek it._ 🖤`)
    } else {
      await reply(`📖 *HELP MENU*\n\nType *.menu* to see all commands.\n\nFor specific command help: *.help <command>*\n\n_The system guides those willing to learn._ 🖤`)
    }
  },

  async memory({ reply }) {
    const mem = process.memoryUsage()
    const toMB = (b) => (b / 1024 / 1024).toFixed(2)
    await reply(`💾 *MEMORY USAGE*\n\nHeap Used: ${toMB(mem.heapUsed)} MB\nHeap Total: ${toMB(mem.heapTotal)} MB\nRSS: ${toMB(mem.rss)} MB\nExternal: ${toMB(mem.external)} MB\n\n_Monitoring system resources…_ 🖤`)
  },

  async lastlogs({ reply }) {
    await reply(`📋 *LAST LOGS*\n\nNo recent errors.\n\n_The system runs cleanly._ 🖤`)
  },

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
        if (error) return { table, ok: false, count: 0 }
        return { table, ok: true, count: count || 0 }
      } catch {
        return { table, ok: false, count: 0 }
      }
    }))

    let storageBucket = false
    try {
      const { data: buckets } = await db.supabase.storage.listBuckets()
      storageBucket = (buckets || []).some(b => b.name === 'card-images')
    } catch {}

    const ready = results.filter(r => r.ok)
    const missing = results.filter(r => !r.ok)

    const lines = results.map(r =>
      `${r.ok ? '✅' : '❌'} ${r.table}${r.ok ? ` (${r.count})` : ' — MISSING'}`
    ).join('\n')

    await reply(
      `🗄️ *DATABASE STATUS*\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `${lines}\n\n` +
      `🗂️ ${storageBucket ? '✅' : '❌'} Storage: card-images bucket\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `📊 Tables: ${ready.length}/16 ready\n` +
      (missing.length === 0
        ? `🟢 All tables online! Bot fully operational.`
        : `🔴 ${missing.length} table(s) missing — run setup.sql in Supabase.`
      ) +
      (storageBucket ? `` : `\n⚠️ Storage bucket missing — card images need it.`) +
      `\n\n_Checked at ${new Date().toLocaleTimeString()} 🖤_`
    )
  },

  async botstatus({ sock, msg, jid }) {
    const start = Date.now()
    const userCount = await db.getUserCount().catch(() => '?')
    const groupCount = await db.getGroupCount().catch(() => '?')
    const ping = Date.now() - start
    const mem = process.memoryUsage()
    const ramUsed = (mem.heapUsed / 1024 / 1024).toFixed(1)
    const ramTotal = (mem.heapTotal / 1024 / 1024).toFixed(1)
    const waVer = global.latestBaileysVersion ? global.latestBaileysVersion.join('.') : 'unknown'
    const isLatest = global.latestBaileysIsLatest ? '✅ Latest' : '⚠️ Outdated'

    await sock.sendMessage(jid, {
      text:
        `🌑 *SHADOW GARDEN — BOT STATUS*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🤖 *Name:* ${global.botName} (Alpha)\n` +
        `⚙️ *Prefix:* ${global.prefix}\n` +
        `📡 *Status:* ${global.botConnected ? '🟢 Online' : '🔴 Offline'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `⚡ *Ping:* ${ping} ms\n` +
        `⏱️ *Uptime:* ${uptime()}\n` +
        `🧠 *RAM:* ${ramUsed} / ${ramTotal} MB\n\n` +
        `📱 *WA Version:* ${waVer}\n` +
        `🔄 *Version Status:* ${isLatest}\n` +
        `🖥️ *Platform:* Chrome on Ubuntu (Baileys)\n\n` +
        `👥 *Users:* ${userCount}\n` +
        `🏠 *Groups:* ${groupCount}\n\n` +
        `📅 *Started:* ${new Date(global.botStartTime).toLocaleString()}\n` +
        `👤 *Dev:* Ryuk\n\n` +
        `_The system runs silently… always watching._ 🖤`,
    }, { quoted: msg })
  },

  async sticker({ sock, msg, jid, reply }) {
    // Determine the target message: quoted or the message itself
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

    // Detect media type in the target message
    const targetContent = quoted || msg.message
    const imgMsg =
      targetContent?.imageMessage ||
      targetContent?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage

    if (!imgMsg) {
      return reply(
        `🖼️ *STICKER MAKER*\n\n` +
        `Send or quote a *JPG / PNG* image with *.s* to convert it.\n\n` +
        `📦 *Pack:* Atomic\n✍️ *Author:* Shadow Garden\n📐 *Size:* 512 × 512\n\n` +
        `_Only static images are accepted (no GIFs or videos)._ 🖤`
      )
    }

    // Reject GIFs and videos
    const mime = imgMsg.mimetype || ''
    if (mime.includes('gif') || mime.includes('video')) {
      return reply(`❌ GIFs and videos are not supported for stickers.\n\nSend a *JPG or PNG* image only.`)
    }

    try {
      const buffer = await downloadMediaMessage(
        targetMsg,
        'buffer',
        {},
        { logger: console, reuploadRequest: sock.updateMediaMessage }
      )

      const stickerBuffer = await makeSticker(buffer)

      await sock.sendMessage(
        jid,
        { sticker: stickerBuffer },
        { quoted: msg }
      )
    } catch (err) {
      console.error('[sticker] Error:', err)
      await reply(`❌ Failed to create sticker: ${err.message}\n\n_Make sure the image is a valid JPG or PNG._ 🖤`)
    }
  },

  async s(ctx) { return module.exports.sticker(ctx) },
}
