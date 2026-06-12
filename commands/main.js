const db = require('../database')
const fs = require('fs')
const path = require('path')
const { makeSticker, makeStickerFromVideo } = require('../stickerHelper')
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

  async menu({ sock, msg, jid, sender, pushName }) {
    const userName = pushName || sender || 'Traveller'
    const menuText =
      `Hᴇʏʏʏʏʏ ${userName}... ɪ'ᴍ Aǫᴜᴀ ꜰʀᴏᴍ ᴛʜᴇ 𝐊𝚯𝐍𝚯𝐒𝐔𝐁𝚫 ᴄᴏᴍᴜɴɪᴛʏ ɴɪᴄᴇ ᴛᴏ ᴍᴇᴇᴛ ʏᴏᴜ!\n\n` +
      `Cʜᴇᴄᴋ ʙᴇʟᴏᴡ ғᴏʀ ᴀᴠᴀɪʟᴀʙʟᴇ ᴄᴏᴍᴍᴀɴᴅs ✦\n\n` +

      `*⚙️ ADMIN ⚙️*\n` +
      `┃\n` +
      `┃ ⤷ .kick @user\n` +
      `┃ ⤷ .mute @user\n` +
      `┃ ⤷ .unmute @user\n` +
      `┃ ⤷ .warn @user\n` +
      `┃ ⤷ .warnings @user\n` +
      `┃ ⤷ .clearwarns @user\n` +
      `┃ ⤷ .promote @user\n` +
      `┃ ⤷ .demote @user\n` +
      `┃ ⤷ .ban @user\n` +
      `┃ ⤷ .unban @user\n` +
      `┃ ⤷ .addmod @user\n` +
      `┃ ⤷ .removemod @user\n` +
      `┃ ⤷ .lockgroup\n` +
      `┃ ⤷ .unlockgroup\n` +
      `┃ ⤷ .setname <name>\n` +
      `┃ ⤷ .setdesc <description>\n` +
      `┃ ⤷ .setpp (reply image)\n` +
      `┃ ⤷ .tagall\n` +
      `┃ ⤷ .hidetag <message>\n` +
      `┃ ⤷ .delete (reply msg)\n` +
      `┃ ⤷ .antilink on/off\n` +
      `┃ ⤷ .antispam on/off\n` +
      `┃ ⤷ .welcome on/off\n` +
      `┃ ⤷ .goodbye on/off\n` +
      `┃ ⤷ .autoreply on/off\n` +
      `┃ ⤷ .active\n` +
      `┃ ⤷ .resetlink\n` +
      `┃ ⤷ .revoke\n` +
      `┃ ⤷ .invitelink\n` +
      `┃ ⤷ .stafflist\n` +
      `┃ ⤷ .myrole\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━\n\n` +

      `*💰 ECONOMY 💰*\n` +
      `┃\n` +
      `┃ ⤷ .balance / .bal\n` +
      `┃ ⤷ .wallet\n` +
      `┃ ⤷ .bank\n` +
      `┃ ⤷ .deposit <amount>\n` +
      `┃ ⤷ .withdraw <amount>\n` +
      `┃ ⤷ .pay @user <amount>\n` +
      `┃ ⤷ .loan <amount>\n` +
      `┃ ⤷ .repay <amount>\n` +
      `┃ ⤷ .daily\n` +
      `┃ ⤷ .fish\n` +
      `┃ ⤷ .dig\n` +
      `┃ ⤷ .weekly\n` +
      `┃ ⤷ .monthly\n` +
      `┃ ⤷ .work\n` +
      `┃ ⤷ .beg\n` +
      `┃ ⤷ .crime\n` +
      `┃ ⤷ .rob @user\n` +
      `┃ ⤷ .heist\n` +
      `┃ ⤷ .market\n` +
      `┃ ⤷ .buy <item>\n` +
      `┃ ⤷ .sell <item>\n` +
      `┃ ⤷ .inventory / .inv\n` +
      `┃ ⤷ .use <item>\n` +
      `┃ ⤷ .gift @user <item>\n` +
      `┃ ⤷ .topmoney\n` +
      `┃ ⤷ .topbank\n` +
      `┃ ⤷ .cooldowns / .cds\n` +
      `┃ ⤷ .profile / .p\n` +
      `┃ ⤷ .rank\n` +
      `┃ ⤷ .xp\n` +
      `┃ ⤷ .achievements\n` +
      `┃ ⤷ .quests\n` +
      `┃ ⤷ .claim\n` +
      `┃ ⤷ .bonus\n` +
      `┃ ⤷ .upgrade\n` +
      `┃ ⤷ .prestige\n` +
      `┃ ⤷ .bankupgrade\n` +
      `┃ ⤷ .withdrawall\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━\n\n` +

      `*🎲 GAMBLING 🎲*\n` +
      `┃\n` +
      `┃ ⤷ .coinflip <amount>\n` +
      `┃ ⤷ .slots <amount>\n` +
      `┃ ⤷ .blackjack <amount>\n` +
      `┃ ⤷ .roulette <amount>\n` +
      `┃ ⤷ .dice <amount>\n` +
      `┃ ⤷ .lottery\n` +
      `┃ ⤷ .bet <amount>\n` +
      `┃ ⤷ .highlow <amount>\n` +
      `┃ ⤷ .crash <amount>\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━\n\n` +

      `*🎉 FUN 🎉*\n` +
      `┃\n` +
      `┃ ⤷ .joke\n` +
      `┃ ⤷ .meme\n` +
      `┃ ⤷ .quote\n` +
      `┃ ⤷ .fact\n` +
      `┃ ⤷ .8ball <question>\n` +
      `┃ ⤷ .truth\n` +
      `┃ ⤷ .dare\n` +
      `┃ ⤷ .ship @user @user\n` +
      `┃ ⤷ .rate @user\n` +
      `┃ ⤷ .roast @user\n` +
      `┃ ⤷ .compliment @user\n` +
      `┃ ⤷ .pick <option1/option2>\n` +
      `┃ ⤷ .reverse <text>\n` +
      `┃ ⤷ .fliptext <text>\n` +
      `┃ ⤷ .emojify <text>\n` +
      `┃ ⤷ .rps <rock/paper/scissors>\n` +
      `┃ ⤷ .wouldyourather\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━\n\n` +

      `*💞 INTERACTIONS 💞*\n` +
      `┃\n` +
      `┃ ⤷ .hug @user\n` +
      `┃ ⤷ .kiss @user\n` +
      `┃ ⤷ .pat @user\n` +
      `┃ ⤷ .slap @user\n` +
      `┃ ⤷ .punch @user\n` +
      `┃ ⤷ .bite @user\n` +
      `┃ ⤷ .cuddle @user\n` +
      `┃ ⤷ .poke @user\n` +
      `┃ ⤷ .tickle @user\n` +
      `┃ ⤷ .wave @user\n` +
      `┃ ⤷ .highfive @user\n` +
      `┃ ⤷ .stare @user\n` +
      `┃ ⤷ .blush\n` +
      `┃ ⤷ .smile\n` +
      `┃ ⤷ .cry\n` +
      `┃ ⤷ .laugh\n` +
      `┃ ⤷ .dance\n` +
      `┃ ⤷ .angry\n` +
      `┃ ⤷ .sleep\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━\n\n` +

      `*💜 VIBE 💜*\n` +
      `┃\n` +
      `┃ ⤷ .hornycheck\n` +
      `┃ ⤷ .simp\n` +
      `┃ ⤷ .rizz\n` +
      `┃ ⤷ .pickupline\n` +
      `┃ ⤷ .relationship\n` +
      `┃ ⤷ .confess\n` +
      `┃ ⤷ .match\n` +
      `┃ ⤷ .waifu\n` +
      `┃ ⤷ .husbando\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━\n\n` +

      `*🎮 GAMES 🎮*\n` +
      `┃\n` +
      `┃ ⤷ .tictactoe @user\n` +
      `┃ ⤷ .hangman\n` +
      `┃ ⤷ .quiz\n` +
      `┃ ⤷ .trivia\n` +
      `┃ ⤷ .mathquiz\n` +
      `┃ ⤷ .wordgame\n` +
      `┃ ⤷ .riddle\n` +
      `┃ ⤷ .guessnumber\n` +
      `┃ ⤷ .fasttype\n` +
      `┃ ⤷ .minesweeper\n` +
      `┃ ⤷ .snake\n` +
      `┃ ⤷ .2048\n` +
      `┃ ⤷ .duel @user\n` +
      `┃ ⤷ .arcade\n` +
      `┃ ⤷ .leaderboard\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━\n\n` +

      `*🐾 POKÉMONS 🐾*\n` +
      `┃\n` +
      `┃ ⤷ .pokemon\n` +
      `┃ ⤷ .party\n` +
      `┃ ⤷ .pc\n` +
      `┃ ⤷ .starter\n` +
      `┃ ⤷ .catch\n` +
      `┃ ⤷ .hunt\n` +
      `┃ ⤷ .battle @user\n` +
      `┃ ⤷ .heal\n` +
      `┃ ⤷ .evolve <pokemon>\n` +
      `┃ ⤷ .release <pokemon>\n` +
      `┃ ⤷ .rename <pokemon> <name>\n` +
      `┃ ⤷ .buddy <pokemon>\n` +
      `┃ ⤷ .feed <pokemon>\n` +
      `┃ ⤷ .train <pokemon>\n` +
      `┃ ⤷ .moves <pokemon>\n` +
      `┃ ⤷ .pokeshop\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━\n\n` +

      `*⬇️ DOWNLOADER ⬇️*\n` +
      `┃\n` +
      `┃ ⤷ .play <song>\n` +
      `┃ ⤷ .ytmp3 <link>\n` +
      `┃ ⤷ .ytmp4 <link>\n` +
      `┃ ⤷ .tiktok <link>\n` +
      `┃ ⤷ .instagram <link>\n` +
      `┃ ⤷ .facebook <link>\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━\n\n` +

      `*⚔️ RPG ⚔️*\n` +
      `┃\n` +
      `┃ ⤷ .rpg\n` +
      `┃ ⤷ .stats\n` +
      `┃ ⤷ .hunt\n` +
      `┃ ⤷ .boss\n` +
      `┃ ⤷ .raid\n` +
      `┃ ⤷ .dungeon\n` +
      `┃ ⤷ .quest\n` +
      `┃ ⤷ .equip <item>\n` +
      `┃ ⤷ .unequip <item>\n` +
      `┃ ⤷ .skills\n` +
      `┃ ⤷ .craft <item>\n` +
      `┃ ⤷ .forge\n` +
      `┃ ⤷ .shop\n` +
      `┃ ⤷ .prestige\n` +
      `┃ ⤷ .rparty\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━\n\n` +

      `*🏰 GUILD 🏰*\n` +
      `┃\n` +
      `┃ ⤷ .createguild <name>\n` +
      `┃ ⤷ .guild\n` +
      `┃ ⤷ .guildinfo\n` +
      `┃ ⤷ .joinguild <name>\n` +
      `┃ ⤷ .leaveguild\n` +
      `┃ ⤷ .invite @user\n` +
      `┃ ⤷ .kickmember @user\n` +
      `┃ ⤷ .guildtop\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━\n\n` +

      `*🎴 CARDS 🎴*\n` +
      `┃\n` +
      `┃ ⤷ .collection / .coll\n` +
      `┃ ⤷ .deck\n` +
      `┃ ⤷ .card\n` +
      `┃ ⤷ .ci <name> [tier]\n` +
      `┃ ⤷ .ss <name>\n` +
      `┃ ⤷ .fs <series> [tier]\n` +
      `┃ ⤷ .cardlb\n` +
      `┃ ⤷ .get <card_id>\n` +
      `┃ ⤷ .stardust\n` +
      `┃ ⤷ .tc @user\n` +
      `┃ ⤷ .dc <number>\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━\n\n` +

      `*📱 MEDIA 📱*\n` +
      `┃\n` +
      `┃ ⤷ .upscale\n` +
      `┃ ⤷ .enhance\n` +
      `┃ ⤷ .remini\n` +
      `┃ ⤷ .removebg\n` +
      `┃ ⤷ .night\n` +
      `┃ ⤷ .sunset\n` +
      `┃ ⤷ .rain\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━\n\n` +

      `*💸 PAYMENTS 💸*\n` +
      `┃\n` +
      `┃ ⤷ .pay @user <amount>\n` +
      `┃ ⤷ .confirmpy —\n` +
      `┃ ⤷ .cooldowns / .cds\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━`

    if (fs.existsSync(MENU_IMAGE)) {
      await sock.sendMessage(jid, { image: { url: MENU_IMAGE }, caption: menuText }, { quoted: msg })
    } else {
      await sock.sendMessage(jid, { text: menuText }, { quoted: msg })
    }
  },

  async ping({ sock, msg, jid }) {
    const start = Date.now()
    await sock.sendMessage(jid, { text: `Aqua's here!\n> ${Date.now() - start}ms` }, { quoted: msg })
  },

  async speed({ sock, msg, jid }) {
    const start = Date.now()
    await sock.sendMessage(jid, { text: '⚡ Testing...' }, { quoted: msg })
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
    await reply(`📜 Konosuba Community Bot v${BOT_VERSION}`)
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
        `📌 *BOT INFORMATION*\n\n🤖 *Name:* ${global.botName || 'Konosuba Bot'}\n⚙️ *Version:* ${BOT_VERSION}\n` +
        `📡 *Status:* Online\n⚡ *Speed:* ${ping} ms\n\n` +
        `👥 *Users:* ${userCount}\n🏠 *Groups:* ${groupCount}\n` +
        `🧠 *RAM:* ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB\n\n` +
        `📊 *Uptime:* ${uptime()}`
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
    await reply(`You are now AFK`)
  },

  async unafk({ reply, sender, args, isOwner, isMod, isGuardian, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!isOwner && !isMod && !isGuardian) {
      return reply('⚠️ Staff only.')
    }
    const targetPhone = mentioned.length
      ? mentioned[0].split('@')[0].split(':')[0]
      : (args[0] ? args[0].replace(/[^0-9]/g, '') : null)
    if (!targetPhone) return reply('❌ Usage: *.unafk @user*')
    await db.removeAFK(targetPhone)
    await reply(`✅ AFK removed for *${targetPhone}*.`)
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
    if (args[0]) return reply(`📖 .${args[0]} - check *.menu* for details`)
    await reply(`📖 *Help*\n\n• *.menu* - all commands\n• *#phelp* - pokémon help\n• *.law* - rules\n• *.pbenefits* - premium info`)
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
      `📜 *KONOSUBA COMMUNITY LAWS AND REGULATIONS* 📜\n\n*(All members must comply with these rules at all times)*\n\n` +
      `⚖️ *BASIC RULES*\n\n` +
      `1. Respect all Moderators, Guardians, and Staff at all times.\n\n` +
      `2. Maintain proper behavior in all community spaces.\n\n` +
      `3. Impersonating staff is strictly prohibited.\n\n` +
      `4. Follow instructions from staff when given.\n\n\n` +
      `💰🎴 *ECONOMY, CARDS AND PLAY RULES*\n\n` +
      `1. Multiple accounts (alts) are strictly prohibited.\n\n` +
      `2. No scripts, cheats, macros, or bot automation.\n\n` +
      `3. Fake card spawns are not allowed.\n\n` +
      `4. Report bugs - don't exploit them.\n\n` +
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
      `2. State your issue clearly - no empty "hi" messages.\n\n` +
      `3. No spamming staff DMs.\n\n` +
      `4. Contact only one staff member at a time.\n\n` +
      `5. Don't beg for unbans.\n\n\n` +
      `🚫 No one is exempt from these rules.\nViolations = warnings, restrictions, or bans.\n\n` +
      `🔄 Rules may be updated at any time.`
    )
  },

  async pbenefits({ reply }) {
    await reply(
      `『 𝗞𝗢𝗡𝗢𝗦𝗨𝗕𝗔 𝗣𝗥𝗘𝗠𝗜𝗨𝗠 』 ◈════════════════════◈\n\n` +
      `✨ *PREMIUM BENEFITS*\n\n` +
      `💰 *Instant Reward*\n\nReceive 500,000 coins deposited into your bank upon activation.\n\n` +
      `⚡ *Boosted Efficiency*\n\n75% cooldown reduction on all bot commands.\n(Excludes daily reward commands.)\n\n` +
      `💎 *Exclusive Currency*\n\nAccess to premium currency: Obsidian Shards.\n\n` +
      `🏷️ *Personalization Perks*\n\nCustom mention sticker for your profile.\n\nAnimated profile & background effects.\n\nAnimated card deck backgrounds.\n\n` +
      `◈════════════════════◈\n\n` +
      `🛒 *HOW TO PURCHASE PREMIUM*\n\n` +
      `1. Use: *.mods* to contact staff.\n\n` +
      `2. A moderator will respond with full purchase instructions.\n\n` +
      `3. Follow the official steps to complete your purchase.\n\n` +
      `◈════════════════════◈\n\n` +
      `📌 All transactions must be handled only by official staff members.\n\n` +
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
    const meta   = await sock.groupMetadata(jid)
    const admins = meta.participants.filter(p => p.admin).map(p => p.id)
    if (!admins.includes(senderJid) && !isOwner) return reply('⚠️ Admin only.')

    const message    = args.join(' ') || 'Attention everyone!'
    const actualJids = meta.participants.map(p => p.id)
    const taggerNum  = senderJid.split('@')[0].split(':')[0]
    const groupName  = meta.subject || 'Group'
    const memberLines = actualJids.map(j => `💠 @${j.split('@')[0].split(':')[0]}`).join('\n')

    const text =
      `*🔖 Message:* ${message}\n` +
      `*🎃 Group:* ${groupName}\n` +
      `*👥 Members:* ${actualJids.length}\n` +
      `*🗣️ Tagger:* @${taggerNum}\n\n` +
      memberLines

    await sock.sendMessage(jid, { text, mentions: [...actualJids, senderJid] })
  },

  async modlist({ sock, jid, msg, reply, isGroup }) {
    const staffUsers = await db.getMods().catch(() => [])
    const mods      = (staffUsers || []).filter(u => u.role === 'mod')
    const guardians = (staffUsers || []).filter(u => u.role === 'guardian')

    const phoneToJid = isGroup ? await buildPhoneMap(sock, jid) : {}

    const allMentions = [
      ...mods.map(u => phoneToJid[u.phone] || `${u.phone}@s.whatsapp.net`),
      ...guardians.map(u => phoneToJid[u.phone] || `${u.phone}@s.whatsapp.net`),
    ]

    const modLines = mods.length
      ? mods.map((u, i) => {
          const resolved   = phoneToJid[u.phone] || `${u.phone}@s.whatsapp.net`
          const displayNum = resolved.split('@')[0].split(':')[0]
          return `│   ${i === mods.length - 1 ? '└──' : '├──'} @${displayNum}`
        }).join('\n')
      : '│   └── None'

    const guardianLines = guardians.length
      ? guardians.map((u, i) => {
          const resolved   = phoneToJid[u.phone] || `${u.phone}@s.whatsapp.net`
          const displayNum = resolved.split('@')[0].split(':')[0]
          return `     ${i === guardians.length - 1 ? '└──' : '├──'} @${displayNum}`
        }).join('\n')
      : '     └── None'

    const text =
      `┌─「 𝗦𝗧𝗔𝗙𝗙𝗦 」─┐\n│\n` +
      `├── 👑 𝗠𝗢𝗗𝗦 👑\n${modLines}\n│\n` +
      `└── 🛡️ 𝗚𝗨𝗔𝗥𝗗𝗜𝗔𝗡𝗦 🛡️\n${guardianLines}\n\n` +
      `> ⚠️ Inappropriate use of this command will lead to a *Konosuba Ban*.`

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
      return reply(`🖼️ Send or reply to an *image/video/gif* with *.s* to make a sticker`)
    }

    const isVideo   = isVideoMsg || !!quotedVid
    const targetMsg = (quotedImg || quotedVid)
      ? { message: quoted, key: { remoteJid: jid, id: ctx.stanzaId, participant: ctx.participant } }
      : msg

    try {
      const buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, {
        logger: { level: () => {}, info: () => {}, warn: () => {}, error: () => {} },
        reuploadRequest: sock.updateMediaMessage,
      })
      const stickerBuf = isVideo
        ? await makeStickerFromVideo(buffer)
        : await makeSticker(buffer)
      await sock.sendMessage(jid, { sticker: stickerBuf }, { quoted: msg })
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
    const collections = ['users','groups','warnings','afk','messages','cooldowns','inventory','cards','usercards','userpokemons','games','guilds','guildmembers','blacklists','disabledcommands']
    try {
      const db_module = require('../database')
      const mongoose  = db_module.mongoose
      const counts = await Promise.all(collections.map(async c => {
        try {
          const col = mongoose.connection.db?.collection(c)
          const n   = col ? await col.countDocuments() : '?'
          return { c, ok: true, n }
        } catch { return { c, ok: false } }
      }))
      const lines = counts.map(r => `${r.ok ? '✅' : '❌'} ${r.c}${r.ok ? ` (${r.n})` : ' - error'}`).join('\n')
      await reply(`🗄️ *DB STATUS (MongoDB)*\n\n${lines}`)
    } catch (e) {
      await reply(`❌ DB error: ${e.message}`)
    }
  },

  async checkdb({ reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')

    const db_module = require('../database')
    const mongoose  = db_module.mongoose

    const stateMap = { 0: '🔴 Disconnected', 1: '🟢 Connected', 2: '🟡 Connecting', 3: '🟠 Disconnecting' }
    const connState = stateMap[mongoose.connection.readyState] || '❓ Unknown'

    const uptimeSec = Math.floor(process.uptime())
    const uptimeH   = Math.floor(uptimeSec / 3600)
    const uptimeM   = Math.floor((uptimeSec % 3600) / 60)
    const uptimeS   = uptimeSec % 60
    const uptimeStr = `${uptimeH}h ${uptimeM}m ${uptimeS}s`

    const collections = [
      'users', 'groups', 'warnings', 'cooldowns',
      'inventory', 'cards', 'usercards', 'userpokemons',
      'guilds', 'guildmembers', 'suspensions', 'loans',
    ]

    let collectionLines = ''
    let indexLines = ''
    let problemFound = false

    try {
      const dbConn = mongoose.connection.db

      const counts = await Promise.all(collections.map(async name => {
        try {
          const col = dbConn?.collection(name)
          const n   = col ? await col.countDocuments() : null
          return { name, ok: n !== null, n }
        } catch { return { name, ok: false, n: null } }
      }))
      collectionLines = counts
        .map(r => `${r.ok ? '✅' : '❌'} *${r.name}*${r.ok ? `: ${r.n.toLocaleString()} docs` : ': error'}`)
        .join('\n')

      const usersCol  = dbConn?.collection('users')
      const indexes   = usersCol ? await usersCol.indexes() : []
      const idxIssues = []
      for (const idx of indexes) {
        const isBadJid = idx.name === 'jid_1' && !idx.sparse
        if (isBadJid) {
          idxIssues.push(`⚠️ *jid_1* — non-sparse unique index (blocks new users)`)
          problemFound = true
        }
      }
      const goodIndexes = indexes.filter(i => !(i.name === 'jid_1' && !i.sparse))
      const goodLines   = goodIndexes.map(i => `✅ *${i.name}*${i.unique ? ' (unique)' : ''}${i.sparse ? ' (sparse)' : ''}`).join('\n')
      indexLines = [...idxIssues, goodLines].filter(Boolean).join('\n')

    } catch (e) {
      collectionLines = `❌ Could not fetch collection info: ${e.message}`
      indexLines      = '❌ Could not fetch index info'
    }

    const memUsage = process.memoryUsage()
    const heapMB   = (memUsage.heapUsed / 1024 / 1024).toFixed(1)
    const rssMB    = (memUsage.rss       / 1024 / 1024).toFixed(1)

    await reply(
      `🔍 *DATABASE HEALTH CHECK*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `*🔌 Connection*\n${connState}\n\n` +
      `*⏱️ Bot Uptime*\n${uptimeStr}\n\n` +
      `*🧠 Memory*\nHeap: ${heapMB} MB  |  RSS: ${rssMB} MB\n\n` +
      `*📦 Collections*\n${collectionLines}\n\n` +
      `*🗂️ users Indexes*\n${indexLines || '✅ No issues found'}\n\n` +
      (problemFound
        ? `⚠️ *Index issues detected!* Restart the bot to auto-fix them.`
        : `✅ *All systems healthy.*`)
    )
  },

  async myid({ sock, jid, sender, msg, reply }) {
    const websiteUrl = process.env.WEBSITE_URL || 'https://konosuba-bot.vercel.app'
    await reply(
      `🆔 *Your Bot ID*\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `Your unique ID is:\n` +
      `*${sender}*\n\n` +
      `📋 _Copy the number above (no spaces)._\n\n` +
      `🌐 *To login on the website:*\n` +
      `1. Go to: ${websiteUrl}\n` +
      `2. Tap *Login*\n` +
      `3. Enter *${sender}* as your Phone / ID\n` +
      `4. Enter the password you set with *.reg*\n\n` +
      `❓ *Haven't registered yet?*\n` +
      `Send: *.reg YourName | YourPassword*\n` +
      `Example: _.reg Shadow | mypass123_\n\n` +
      `> This ID is how the bot and website recognise you.`
    )
  },

  async id({ sock, jid, sender, msg, reply }) {
    return module.exports.myid({ sock, jid, sender, msg, reply })
  },

  async git({ sock, jid, msg, isOwner, reply }) {
    if (!isOwner) return reply('*🚫 Access Denied*')
    await sock.sendMessage(jid, { text: '♻️ Pulling latest upload from git...' }, { quoted: msg })
      .then(() => process.exit(0))
  },
}
