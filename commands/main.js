const db = require('../database')
const fs = require('fs')
const path = require('path')
const { makeSticker } = require('../stickerHelper')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')

const MENU_IMAGE = path.join(__dirname, '../assets/menu.jpg')
const BOT_VERSION = '3.0'

function uptime() {
  const ms = Date.now() - (global.botStartTime || Date.now())
  const s  = Math.floor(ms / 1000)
  const m  = Math.floor(s / 60)
  const h  = Math.floor(m / 60)
  const d  = Math.floor(h / 24)
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`
  return `${m}m ${s % 60}s`
}

function uptimeWAT() {
  const ms = Date.now() - (global.botStartTime || Date.now())
  const s  = Math.floor(ms / 1000)
  const m  = Math.floor(s / 60)
  const h  = Math.floor(m / 60)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m % 60)}:${pad(s % 60)} WAT`
}

function dateStr() {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

async function buildPhoneMap(sock, jid) {
  try {
    const meta = await sock.groupMetadata(jid)
    const map  = {}
    for (const p of meta.participants) {
      const num = p.id.split('@')[0].split(':')[0]
      map[num] = p.id
    }
    return map
  } catch { return {} }
}

module.exports = {

  async menu({ sock, msg, jid, sender }) {
    const menuText =
      `┏❐✦ *sʜᴀᴅᴏᴡ ɢᴀʀᴅᴇɴ* ✦❐\n` +
      `┃» *ʙᴏᴛ ɴᴀᴍᴇ* : Alpha\n` +
      `┃» *ᴜsᴇʀɴᴀᴍᴇ* : Ryuk\n` +
      `┃» *ᴄᴏʀᴇ* : Alpha\n` +
      `┃» *ᴅᴇᴠᴇʟᴏᴘᴇʀ* : Ryuk\n` +
      `┃» *ᴠᴇʀsɪᴏɴ* : ${BOT_VERSION}\n` +
      `┃» *ᴍᴏᴅᴇ* : Public\n` +
      `┃» *ᴘʀᴇғɪx* : [ . ]\n` +
      `┃» *ᴜᴘᴛɪᴍᴇ* : ${uptimeWAT()}\n` +
      `┃» *ᴅᴀᴛᴇ* : ${dateStr()}\n` +
      `┗❐\n\n` +

      `┏❐ 🌑 sʜᴀᴅᴏᴡ ɢᴀʀᴅᴇɴ\n` +
      `┃ 🌑 ᴏғғɪᴄɪᴀʟ\n` +
      `┃ ├ .support\n┃ ├ .addbot\n┃ ├ .website\n` +
      `┃ ├ .community\n┃ ├ .help\n┃ ├ .info\n┃ └ .uptime\n` +
      `┗❐\n\n` +

      `┏❐ 📋 ᴍᴀɪɴ\n` +
      `┃ 📋 ᴍᴀɪɴ ᴄᴏᴍᴍᴀɴᴅs\n` +
      `┃ ├ .menu\n┃ ├ .ping\n┃ ├ .afk\n┃ ├ .runtime\n` +
      `┃ ├ .speed\n┃ ├ .repo\n┃ ├ .script\n┃ ├ .vv\n` +
      `┃ ├ .vv2\n┃ └ .enc\n` +
      `┗❐\n\n` +

      `┏❐ ⚙️ ᴀᴅᴍɪɴ\n` +
      `┃ ⚙️ ɢʀᴏᴜᴘ ᴍᴀɴᴀɢᴇᴍᴇɴᴛ\n` +
      `┃ ├ .kick\n┃ ├ .delete\n┃ ├ .promote\n┃ ├ .demote\n` +
      `┃ ├ .mute\n┃ ├ .unmute\n┃ ├ .hidetag\n┃ ├ .tagall\n` +
      `┃ ├ .groupinfo\n┃ ├ .groupstats\n┃ ├ .activity\n` +
      `┃ ├ .active\n┃ ├ .inactive\n┃ ├ .open\n┃ ├ .close\n` +
      `┃ ├ .welcome\n┃ ├ .setwelcome\n┃ ├ .leave\n┃ ├ .setleave\n` +
      `┃ ├ .antilink\n┃ ├ .antispam\n┃ ├ .antibot\n` +
      `┃ ├ .warn\n┃ ├ .resetwarn\n┃ ├ .blacklist\n┃ └ .checkadmin\n` +
      `┗❐\n\n` +

      `┏❐ 💰 ᴇᴄᴏɴᴏᴍʏ\n` +
      `┃ 💰 ᴇᴄᴏɴᴏᴍʏ ᴄᴏᴍᴍᴀɴᴅs\n` +
      `┃ ├ .bal\n┃ ├ .balance\n┃ ├ .gems\n┃ ├ .daily\n` +
      `┃ ├ .withdraw\n┃ ├ .deposit\n┃ ├ .donate\n┃ ├ .work\n` +
      `┃ ├ .dig\n┃ ├ .fish\n┃ ├ .beg\n┃ ├ .richlist\n` +
      `┃ ├ .leaderboard\n┃ ├ .shop\n┃ ├ .buy\n┃ ├ .inv\n┃ └ .sell\n` +
      `┗❐\n\n` +

      `┏❐ 🎴 ᴄᴀʀᴅ sʏsᴛᴇᴍ\n` +
      `┃ 🎴 ᴄᴀʀᴅ ᴄᴏᴍᴍᴀɴᴅs\n` +
      `┃ ├ .collection\n┃ ├ .coll\n┃ ├ .deck\n┃ ├ .card\n┃ ├ .ci\n` +
      `┃ ├ .mycolls\n┃ ├ .cardlb\n┃ ├ .get\n┃ ├ .stardust\n┃ ├ .vs\n` +
      `┃ ├ .cg\n┃ ├ .sellc\n┃ ├ .tc\n┃ ├ .accept\n┃ ├ .decline\n` +
      `┃ ├ .ctd\n┃ ├ .lc\n┃ ├ .lcd\n┃ ├ .retrieve\n` +
      `┃ ├ .auction\n┃ ├ .myauc\n┃ └ .listauc\n` +
      `┗❐\n\n` +

      `┏❐ 🎮 ɢᴀᴍᴇs\n` +
      `┃ 🎮 ɢᴀᴍᴇ ᴄᴏᴍᴍᴀɴᴅs\n` +
      `┃ ├ .ttt\n┃ ├ .c4\n┃ ├ .wcg\n┃ ├ .wordchain\n` +
      `┃ ├ .truth\n┃ ├ .dare\n┃ ├ .8ball\n┃ ├ .flip\n` +
      `┃ ├ .dice\n┃ ├ .math\n┃ ├ .trivia\n┃ ├ .rps\n` +
      `┃ ├ .slots\n┃ ├ .casino\n┃ ├ .roulette\n┃ ├ .horse\n` +
      `┃ ├ .spin\n┃ ├ .startbattle\n┃ └ .stopgame\n` +
      `┗❐\n\n` +

      `┏❐ 📜 ᴘᴏᴋᴇ́ᴍᴏɴ sʏsᴛᴇᴍ\n` +
      `┃ 📜 ᴘᴏᴋᴇ́ᴍᴏɴ ᴄᴏᴍᴍᴀɴᴅs\n` +
      `┃ ├ #phelp\n┃ ├ #start\n┃ ├ #hunt\n┃ ├ #catch\n` +
      `┃ ├ #party\n┃ ├ #team\n┃ ├ #pc\n┃ ├ #dex\n` +
      `┃ ├ #trainer\n┃ ├ #mart\n┃ ├ #mbuy\n┃ └ #use\n` +
      `┗❐\n\n` +

      `┏❐ ⚔️ ʀᴘɢ\n` +
      `┃ ⚔️ ʀᴘɢ ᴄᴏᴍᴍᴀɴᴅs\n` +
      `┃ ├ .rpg\n┃ ├ .selectclass\n┃ ├ .skillinfo\n┃ ├ .dungeon\n` +
      `┃ ├ .attack\n┃ ├ .heavy\n┃ ├ .defend\n┃ ├ .special\n` +
      `┃ ├ .heal\n┃ ├ .flee\n┃ ├ .adventure\n┃ ├ .quest\n┃ └ .raid\n` +
      `┗❐\n\n` +

      `┏❐ 🏰 ɢᴜɪʟᴅs\n` +
      `┃ 🏰 ɢᴜɪʟᴅ ᴄᴏᴍᴍᴀɴᴅs\n` +
      `┃ ├ .guild create\n┃ ├ .guild join\n┃ ├ .guild leave\n` +
      `┃ ├ .guild info\n┃ ├ .guild list\n┃ ├ .guildbattle\n` +
      `┃ ├ .guildleaderboard\n┃ ├ .guildraid\n┃ ├ .raidjoin\n┃ └ .raidattack\n` +
      `┗❐\n\n` +

      `┏❐ 🤖 ᴀɪ\n` +
      `┃ 🤖 ᴀɪ ᴄᴏᴍᴍᴀɴᴅs\n` +
      `┃ ├ .ai\n┃ ├ .chatgpt\n┃ ├ .gpt\n┃ ├ .gemini\n` +
      `┃ ├ .llama\n┃ ├ .deepseek\n┃ ├ .mistral\n┃ ├ .groq\n` +
      `┃ ├ .flux\n┃ ├ .pixart\n┃ ├ .sdxl\n┃ ├ .pollinations\n` +
      `┃ ├ .playground\n┃ └ .aidetect\n` +
      `┗❐\n\n` +

      `┏❐ 🖼️ sᴛɪᴄᴋᴇʀs\n` +
      `┃ 🖼️ sᴛɪᴄᴋᴇʀ ᴄᴏᴍᴍᴀɴᴅs\n` +
      `┃ ├ .s\n┃ ├ .sticker\n┃ ├ .take\n┃ ├ .steal\n┃ ├ .toimg\n` +
      `┃ ├ .qc\n┃ ├ .emojimix\n┃ ├ .smeme\n┃ ├ .pat\n┃ ├ .slap\n` +
      `┃ ├ .hug\n┃ ├ .kiss\n┃ ├ .bite\n┃ ├ .bonk\n┃ └ .dance\n` +
      `┗❐\n\n` +

      `┏❐ 🎭 ᴀɴɪᴍᴇ\n` +
      `┃ 🎭 ᴀɴɪᴍᴇ ᴄᴏᴍᴍᴀɴᴅs\n` +
      `┃ ├ .waifu\n┃ ├ .neko\n┃ ├ .animesearch\n┃ ├ .animekill\n` +
      `┃ ├ .animebite\n┃ ├ .animewave\n┃ ├ .animewink\n┃ ├ .animebonk\n` +
      `┃ ├ .megumin\n┃ ├ .mikasa\n┃ ├ .naruto\n┃ ├ .sasuke\n` +
      `┃ ├ .itachi\n┃ ├ .madara\n┃ ├ .gojo\n┃ ├ .nezuko\n` +
      `┃ ├ .kurumi\n┃ ├ .onepiece\n┃ └ .yumeko\n` +
      `┗❐\n\n` +

      `┏❐ 🔧 ᴜᴛɪʟɪᴛʏ\n` +
      `┃ 🔧 ᴜᴛɪʟɪᴛʏ ᴄᴏᴍᴍᴀɴᴅs\n` +
      `┃ ├ .currency\n┃ ├ .convert\n┃ ├ .translate\n┃ ├ .tr\n` +
      `┃ ├ .calc\n┃ ├ .calculate\n┃ ├ .tts\n┃ ├ .say\n` +
      `┃ ├ .tourl\n┃ ├ .tinyurl\n┃ ├ .shorturl\n┃ ├ .tovn\n` +
      `┃ ├ .readmore\n┃ ├ .qr\n┃ ├ .qrcode\n┃ ├ .readqr\n` +
      `┃ ├ .lyrics\n┃ ├ .movie\n┃ ├ .ytsearch\n┃ ├ .google\n` +
      `┃ ├ .weather\n┃ ├ .wiki\n┃ ├ .news\n┃ ├ .ssweb\n┃ └ .myip\n` +
      `┗❐\n\n` +

      `┏❐ 🖼️ ɪᴍᴀɢᴇ\n` +
      `┃ 🖼️ ɪᴍᴀɢᴇ ᴛᴏᴏʟs\n` +
      `┃ ├ .removebg\n┃ ├ .nobg\n┃ ├ .enhance\n┃ ├ .remini\n` +
      `┃ ├ .upscale\n┃ ├ .toanime\n┃ ├ .cartoon\n┃ ├ .carbon\n` +
      `┃ ├ .jail\n┃ ├ .gun\n┃ ├ .city\n┃ ├ .night\n┃ ├ .sunset\n┃ └ .rain\n` +
      `┗❐\n\n` +

      `┏❐ 📥 ᴅᴏᴡɴʟᴏᴀᴅ\n` +
      `┃ 📥 ᴅᴏᴡɴʟᴏᴀᴅ ᴄᴏᴍᴍᴀɴᴅs\n` +
      `┃ ├ .ytmp4\n┃ ├ .ytmp3\n┃ ├ .tiktok\n┃ ├ .instagram\n` +
      `┃ ├ .facebook\n┃ ├ .twitter\n┃ ├ .threads\n┃ ├ .capcut\n` +
      `┃ ├ .mediafire\n┃ ├ .apk\n┃ ├ .pinterest\n┃ └ .wallpaper\n` +
      `┗❐\n\n` +

      `┏❐ 📜 ɪɴꜰᴏ\n` +
      `┃ 📜 ɪɴꜰᴏ ᴄᴏᴍᴍᴀɴᴅs\n` +
      `┃ ├ .law\n┃ ├ .pbenefits\n┃ ├ .mods\n┃ ├ .report\n┃ └ .leaderboard\n` +
      `┗❐`

    if (fs.existsSync(MENU_IMAGE)) {
      await sock.sendMessage(jid, { image: { url: MENU_IMAGE }, caption: menuText }, { quoted: msg })
    } else {
      await sock.sendMessage(jid, { text: menuText }, { quoted: msg })
    }
  },

  async ping({ sock, msg, jid }) {
    const start = Date.now()
    const ping = Date.now() - start
    await sock.sendMessage(jid, { text: `🏓 Pong! ${ping}ms` }, { quoted: msg })
  },

  async speed({ sock, msg, jid }) {
    const start = Date.now()
    const s1 = await sock.sendMessage(jid, { text: '⚡ Testing...' }, { quoted: msg })
    await sock.sendMessage(jid, { text: `⚡ Done in ${Date.now() - start}ms` }, { quoted: msg })
  },

  async runtime({ reply }) {
    await reply(`⏱️ Runtime: ${uptime()}`)
  },

  async uptime({ reply }) {
    await reply(`⏱️ Uptime: ${uptime()}`)
  },

  async repo({ reply }) {
    await reply(`📦 *Repo*\n\nGitHub: Coming soon`)
  },

  async script({ reply }) {
    await reply(`📜 Shadow Garden Bot v${BOT_VERSION}\nDev: Ryuk`)
  },

  async vv({ sock, msg, jid, reply }) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo
    const quoted = ctx?.quotedMessage
    if (!quoted) return reply('↩️ Reply to a view-once message with .vv')
    const inner = quoted?.viewOnceMessageV2?.message || quoted?.viewOnceMessage?.message || quoted
    const imgMsg = inner?.imageMessage || quoted?.imageMessage
    const vidMsg = inner?.videoMessage || quoted?.videoMessage
    if (!imgMsg && !vidMsg) return reply('❌ No view-once media found.')
    try {
      const targetMsg = {
        message: inner || quoted,
        key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant },
      }
      const buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, {
        logger: { level: () => {}, info: () => {}, warn: () => {}, error: () => {} },
        reuploadRequest: sock.updateMediaMessage,
      })
      if (imgMsg) {
        await sock.sendMessage(jid, { image: buffer, caption: '🔓 Unlocked' }, { quoted: msg })
      } else {
        await sock.sendMessage(jid, { video: buffer, caption: '🔓 Unlocked' }, { quoted: msg })
      }
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`)
    }
  },
  async vv2(ctx) { return module.exports.vv(ctx) },

  async enc({ sock, msg, jid, reply }) {
    const ctx    = msg.message?.extendedTextMessage?.contextInfo
    const quoted = ctx?.quotedMessage
    if (!quoted?.imageMessage) return reply('↩️ Reply to an image with .enc')
    try {
      const targetMsg = {
        message: quoted,
        key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant },
      }
      const buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, {
        logger: { level: () => {}, info: () => {}, warn: () => {}, error: () => {} },
        reuploadRequest: sock.updateMediaMessage,
      })
      await sock.sendMessage(jid, { image: buffer, viewOnce: true, caption: '🔒' }, { quoted: msg })
    } catch (e) {
      await reply(`❌ Failed: ${e.message}`)
    }
  },

  async info({ sock, msg, jid }) {
    const start      = Date.now()
    const userCount  = await db.getUserCount().catch(() => '?')
    const groupCount = await db.getGroupCount().catch(() => '?')
    const ping       = Date.now() - start
    const mem        = process.memoryUsage()
    await sock.sendMessage(jid, {
      text:
        `📌 *BOT INFORMATION*\n\n🤖 *Name:* ${global.botName || 'Shadow Garden Bot'}\n⚙️ *Version:* ${BOT_VERSION}\n` +
        `📡 *Status:* Online\n⚡ *Speed:* ${ping} ms\n\n` +
        `👥 *Users:* ${userCount}\n🏠 *Groups:* ${groupCount}\n` +
        `🧠 *RAM:* ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB\n\n` +
        `📊 *Uptime:* ${uptime()}\n👤 *Dev:* Ryuk`
    }, { quoted: msg })
  },

  async status({ sock, msg, jid }) {
    const start = Date.now()
    const ping  = Date.now() - start
    const mem   = process.memoryUsage()
    await sock.sendMessage(jid, {
      text:
        `🤖 *BOT STATUS*\n\n📡 *Status:* Online\n⚡ *Ping:* ${ping} ms\n⏱️ *Uptime:* ${uptime()}\n` +
        `🧠 *RAM:* ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`
    }, { quoted: msg })
  },

  async botstatus({ sock, msg, jid }) { return module.exports.status({ sock, msg, jid }) },

  async afk({ reply, args, sender }) {
    const reason = args.join(' ') || 'No reason'
    await db.setAFK(sender, reason)
    await reply(`💤 AFK set\n📌 ${reason}\n\nAnyone who tags you will be notified.`)
  },

  async website({ reply }) {
    await reply(`🌐 Website coming soon`)
  },

  async community({ reply }) {
    await reply(`🌑 Use *.support* to get the group link.`)
  },

  async support({ reply }) {
    await reply(`💬 DM a mod via *.mods* to get the invite link.`)
  },

  async addbot({ reply }) {
    await reply(`🤖 Contact staff with your group link.\nUse *.mods* to find staff.`)
  },

  async help({ reply, args }) {
    if (args[0]) return reply(`📖 .${args[0]} — check *.menu* for details`)
    await reply(`📖 *Help*\n\n• *.menu* — all commands\n• *#phelp* — pokémon help\n• *.law* — rules\n• *.pbenefits* — premium info`)
  },

  async memory({ reply }) {
    const mem = process.memoryUsage()
    const toMB = b => (b / 1024 / 1024).toFixed(2)
    await reply(`💾 Heap: ${toMB(mem.heapUsed)} MB | RSS: ${toMB(mem.rss)} MB`)
  },

  async report({ reply, args }) {
    const reason = args.join(' ')
    if (!reason) return reply('⚠️ Usage: .report <reason>')
    await reply(`✅ Report received! Staff will review it.`)
  },

  async law({ reply }) {
    await reply(
      `📜 *SHADOW GARDEN LAWS AND REGULATIONS* 📜\n\n*(All members must comply with these rules at all times)*\n\n` +
      `⚖️ *BASIC RULES*\n\n` +
      `1. Respect all Moderators, Guardians, and Staff at all times.\n\n` +
      `2. Maintain proper behavior in all community spaces.\n\n` +
      `3. Impersonating staff is strictly prohibited.\n\n` +
      `4. Follow instructions from staff when given.\n\n\n` +
      `💰🎴 *ECONOMY, CARDS AND PLAY RULES*\n\n` +
      `1. Multiple accounts (alts) are strictly prohibited.\n\n` +
      `2. No scripts, cheats, macros, or bot automation.\n\n` +
      `3. Fake card spawns are not allowed.\n\n` +
      `4. Report bugs — don't exploit them.\n\n` +
      `5. No fraud, scam trading, or card manipulation.\n\n\n` +
      `🤖 *BOT RULES*\n\n` +
      `1. Don't spam commands when the bot is offline.\n\n` +
      `2. Don't attempt to crash or overload the bot.\n\n` +
      `3. Don't DM staff asking why the bot is offline.\n\n` +
      `4. Repeated command misuse = blacklist.\n\n\n` +
      `🏠 *BOT ACCESS REQUIREMENTS*\n\n` +
      `1. Min. 80 active members in group.\n\n` +
      `2. At least one Mod or Guardian must be present.\n\n` +
      `3. Bot and staff must have full admin permissions.\n\n` +
      `4. Tampering with bot permissions = immediate removal.\n\n\n` +
      `📩 *STAFF CONTACT RULES*\n\n` +
      `1. Use *.modslist* to view staff.\n\n` +
      `2. State your issue clearly — no empty "hi" messages.\n\n` +
      `3. No spamming staff DMs.\n\n` +
      `4. Contact only one staff member at a time.\n\n` +
      `5. Don't beg for unbans.\n\n\n` +
      `🚫 No one is exempt from these rules.\nViolations = warnings, restrictions, or bans.\n\n` +
      `🔄 Rules may be updated at any time.`
    )
  },

  async pbenefits({ reply }) {
    await reply(
      `『 𝗦𝗛𝗔𝗗𝗢𝗪 𝗚𝗔𝗥𝗗𝗘𝗡 𝗣𝗥𝗘𝗠𝗜𝗨𝗠 』 ◈════════════════════◈\n\n` +
      `✨ *PREMIUM BENEFITS*\n\n` +
      `💰 *Instant Reward*\n\nReceive 500,000 coins deposited into your bank upon activation.\n\n` +
      `⚡ *Boosted Efficiency*\n\n75% cooldown reduction on all bot commands.\n(Excludes daily reward commands.)\n\n` +
      `💎 *Exclusive Currency*\n\nAccess to premium currency: Obsidian Shards.\n\n` +
      `🏷️ *Personalization Perks*\n\nCustom mention sticker for your profile.\n\nAnimated profile & background effects.\n\nAnimated card deck backgrounds.\n\n` +
      `◈════════════════════◈\n\n` +
      `🛒 *HOW TO PURCHASE PREMIUM*\n\n` +
      `1. Be aware that Premium requires payment to activate.\n\n` +
      `2. Use: *.mods* to contact staff.\n\n` +
      `3. A moderator will respond with full purchase instructions.\n\n` +
      `4. Follow the official steps to complete your purchase.\n\n` +
      `◈════════════════════◈\n\n` +
      `📌 All transactions must be handled only by official staff members.\nDo not trust unofficial sellers or third parties.\n\n` +
      `◈════════════════════◈`
    )
  },

  async restart({ sock, jid, msg, reply, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    await sock.sendMessage(jid, { text: `🔄 Restarting...` }, { quoted: msg })
    setTimeout(() => process.exit(0), 2000)
  },

  async setms(ctx) { return require('./pokemon').setms(ctx) },
  async delms(ctx) { return require('./pokemon').delms(ctx) },

  async tagall({ sock, msg, jid, senderJid, sender, isGroup, isOwner, args, reply }) {
    if (!isGroup) return reply('❌ Groups only.')
    const meta = await sock.groupMetadata(jid)
    const admins = meta.participants.filter(p => p.admin).map(p => p.id)
    if (!admins.includes(senderJid) && !isOwner) return reply('⚠️ Admin only.')

    const message    = args.join(' ') || 'Attention everyone!'
    const actualJids = meta.participants.map(p => p.id)
    const activePhones = await db.getActiveUsers(jid, 24 * 7).catch(() => [])
    const activeSet  = new Set(activePhones)

    const memberLines = meta.participants.map(p => {
      const num = p.id.split('@')[0].split(':')[0]
      return `${activeSet.has(num) ? '🟢' : '🔴'} @${num}`
    }).join('\n')

    await sock.sendMessage(jid, {
      text: `📣 *${message}*\n\n👥 ${meta.participants.length} members\n\n${memberLines}`,
      mentions: actualJids
    })
  },

  async modlist({ sock, jid, msg, reply, isGroup }) {
    const { data: mods }      = await db.supabase.from('users').select('phone,name').eq('role', 'mod')
    const { data: guardians } = await db.supabase.from('users').select('phone,name').eq('role', 'guardian')

    const modList      = mods      || []
    const guardianList = guardians || []
    const phoneToJid   = isGroup ? await buildPhoneMap(sock, jid) : {}

    const allMentions = [
      ...modList.map(u => phoneToJid[u.phone] || `${u.phone}@s.whatsapp.net`),
      ...guardianList.map(u => phoneToJid[u.phone] || `${u.phone}@s.whatsapp.net`),
    ]

    const modLines = modList.length
      ? modList.map((u, i) => {
          const resolved   = phoneToJid[u.phone] || `${u.phone}@s.whatsapp.net`
          const displayNum = resolved.split('@')[0].split(':')[0]
          return `│   ${i === modList.length - 1 ? '└──' : '├──'} @${displayNum}`
        }).join('\n')
      : '│   └── None'

    const guardianLines = guardianList.length
      ? guardianList.map((u, i) => {
          const resolved   = phoneToJid[u.phone] || `${u.phone}@s.whatsapp.net`
          const displayNum = resolved.split('@')[0].split(':')[0]
          return `     ${i === guardianList.length - 1 ? '└──' : '├──'} @${displayNum}`
        }).join('\n')
      : '     └── None'

    const text =
      `┌─「 𝗦𝗧𝗔𝗙𝗙𝗦 」─┐\n│\n` +
      `├── 👑 𝗠𝗢𝗗𝗦 👑\n${modLines}\n│\n` +
      `└── 🛡️ 𝗚𝗨𝗔𝗥𝗗𝗜𝗔𝗡𝗦 🛡️\n${guardianLines}\n\n` +
      `> ⚠️ Inappropriate use of this command will lead to a *Shadow Ban*.`

    await sock.sendMessage(jid, { text, mentions: allMentions }, { quoted: msg })
  },
  async modslist(ctx) { return module.exports.modlist(ctx) },

  async sticker({ sock, msg, jid, reply }) {
    const isImageMsg = !!msg.message?.imageMessage
    const isVideoMsg = !!msg.message?.videoMessage
    const ctx        = msg.message?.extendedTextMessage?.contextInfo
    const quoted     = ctx?.quotedMessage
    const quotedImg  = quoted?.imageMessage
    const quotedVid  = quoted?.videoMessage

    if (!isImageMsg && !isVideoMsg && !quotedImg && !quotedVid) {
      return reply(`🖼️ Send or reply to an *image* with *.s* to make a sticker`)
    }

    const targetMsg = (quotedImg || quotedVid)
      ? { message: quoted, key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant } }
      : msg

    try {
      const buffer  = await downloadMediaMessage(targetMsg, 'buffer', {}, {
        logger: { level: () => {}, info: () => {}, warn: () => {}, error: () => {} },
        reuploadRequest: sock.updateMediaMessage,
      })
      const sticker = await makeSticker(buffer)
      await sock.sendMessage(jid, { sticker }, { quoted: msg })
    } catch (err) {
      await reply(`❌ Sticker failed: ${err.message}`)
    }
  },
  async s(ctx) { return module.exports.sticker(ctx) },

  async take({ sock, msg, jid, reply }) {
    const ctx    = msg.message?.extendedTextMessage?.contextInfo
    const quoted = ctx?.quotedMessage
    if (!quoted?.stickerMessage) return reply('↩️ Reply to a *sticker* with .take')
    try {
      const targetMsg = {
        message: quoted,
        key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant },
      }
      const buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, {
        logger: { level: () => {}, info: () => {}, warn: () => {}, error: () => {} },
        reuploadRequest: sock.updateMediaMessage,
      })
      const sharp  = require('sharp')
      const png    = await sharp(buffer).png().toBuffer()
      await sock.sendMessage(jid, { image: png, caption: '🖼️ Done' }, { quoted: msg })
    } catch (err) {
      await reply(`❌ Failed: ${err.message}`)
    }
  },
  async steal(ctx) { return module.exports.take(ctx) },
  async toimg(ctx)  { return module.exports.take(ctx) },

  async dbstatus({ reply, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const tables = ['users','groups','warnings','afk','messages','cooldowns','inventory','cards','user_cards','user_pokemon','games','guilds','guild_members','blacklist','disabled_commands']
    const results = await Promise.all(tables.map(async t => {
      try {
        const { count, error } = await db.supabase.from(t).select('*', { count: 'exact', head: true })
        return { t, ok: !error, count: count || 0 }
      } catch { return { t, ok: false } }
    }))
    const lines = results.map(r => `${r.ok ? '✅' : '❌'} ${r.t}${r.ok ? ` (${r.count})` : ' — MISSING'}`).join('\n')
    await reply(`🗄️ *DB STATUS*\n\n${lines}\n\n📊 ${results.filter(r => r.ok).length}/${tables.length} ready`)
  },
}
