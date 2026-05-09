const db = require('../database')
const fs = require('fs')
const path = require('path')

const MENU_IMAGE = path.join(__dirname, '../assets/menu.jpg')
const BOT_VERSION = '1.0.0'

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

// Build phone→actualJid map from group participants (handles @lid users)
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

  // ── .menu ─────────────────────────────────────────────────────
  async menu({ sock, msg, jid, sender }) {
    const menuText =
      `╔『 🌑 𝐒𝐇𝚫𝐃𝐎𝐖 𝐆𝚫𝐑𝐃𝚵𝐍 🌑 』╗\n` +
      `┃ 𖤐 Prefix : .\n┃ 𖤐 Name : Alpha\n┃ 𖤐 Core : Alpha\n┃ 𖤐 Dev : Ryuk\n` +
      `╚═══════════════════╝\n\n` +
      `✦ *.support* → Join the Shadow Garden Community.\n✦ *.addbot* → Add Shadow Garden Bot to your group.\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `📋 『 𝗠𝗔𝗜𝗡 』\n✦ .menu\n✦ .ping\n✦ .website\n✦ .community\n✦ .afk\n✦ .help\n✦ .info\n✦ .uptime\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `⚙️ 『 𝗔𝗗𝗠𝗜𝗡 』\n✦ .kick .delete .antilink .warn .resetwarn\n✦ .groupinfo / .gi .groupstats / .gs\n✦ .welcome on/off .setwelcome\n✦ .leave on/off .setleave\n✦ .promote .demote .mute .unmute\n✦ .hidetag .tagall .activity .active .inactive\n✦ .open .close .antism on/off\n✦ .blacklist add/remove/list\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `💰 『 𝗘𝗖𝗢𝗡𝗢𝗠𝗬 』\n✦ .bal / .balance .gems .daily\n✦ .withdraw / .wid .deposit / .dep\n✦ .donate .work .dig .fish .beg\n✦ .richlist .leaderboard / .lb\n✦ .shop .buy .inv .sell\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `🎴 『 𝗖𝗔𝗥𝗗 𝗦𝗬𝗦𝗧𝗘𝗠 』\n✦ .collection / .coll .deck .card .ci\n✦ .mycolls .cardlb .get .stardust\n✦ .vs .cg .sellc .tc .accept / .decline\n✦ .ctd .lc .lcd .retrieve\n✦ .auction .myauc .listauc\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `🎮 『 𝗚𝗔𝗠𝗘𝗦 』\n✦ .ttt .c4 .wcg .wordchain\n✦ .startbattle .stopgame\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `🎲 『 𝗚𝗔𝗠𝗕𝗟𝗘 』\n✦ .slots .dice .casino .cf .db .dp\n✦ .roulette .horse .spin\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `📜 『 𝗣𝗢𝗞𝗘́𝗠𝗢𝗡 𝗦𝗬𝗦𝗧𝗘𝗠 』\n✦ *#phelp* — Full Pokémon menu\n✦ *#start* — Begin your journey\n✦ *#hunt* — Find wild Pokémon\n✦ *#catch / #c <slot> --<ball>* — Catch Pokémon\n✦ *#party / #team / #pc* — Manage team\n✦ *#dex <name/id>* — Pokédex info\n✦ *#trainer* — Trainer profile\n✦ *#mart / #mbuy / #use* — PokéMart\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `⚔️ 『 𝗥𝗣𝗚 』\n✦ .rpg .selectclass .skillinfo\n✦ .dungeon .attack .heavy .defend .special .heal .flee\n✦ .adventure .quest .raid\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `🏰 『 𝗚𝗨𝗜𝗟𝗗𝗦 』\n✦ .guild create/join/leave/info/list\n✦ .guildbattle .guildleaderboard / .glb\n✦ .guildraid .raidjoin .raidattack\n\n` +
      `━━━━━━━━━━━━━━━━━\n\n` +
      `🤖 『 𝗜𝗡𝗙𝗢 』\n✦ .law — Community rules\n✦ .pbenefits — Premium benefits\n✦ .mods / .modlist — View staff\n✦ .setms — Set mention sticker\n✦ .delms — Remove mention sticker\n\n` +
      `╚═════════════════╝\n  「 Rule from the Shadows. 🖤 」`

    if (fs.existsSync(MENU_IMAGE)) {
      await sock.sendMessage(jid, { image: { url: MENU_IMAGE }, caption: menuText }, { quoted: msg })
    } else {
      await sock.sendMessage(jid, { text: menuText }, { quoted: msg })
    }
  },

  async ping({ sock, msg, jid }) {
    const start = Date.now()
    await sock.sendMessage(jid, { text: '🏓' }, { quoted: msg })
    await sock.sendMessage(jid, { text: `Alpha's here!\n> ${Date.now() - start}Ms` }, { quoted: msg })
  },

  async uptime({ reply }) {
    await reply(`⏱️ *Uptime:* ${uptime()}`)
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
    const reason = args.join(' ') || 'No reason given'
    await db.setAFK(sender, reason)
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    await reply(
      `💤 *AFK MODE ACTIVATED*\n\n👤 @${sender}\n📌 *Reason:* ${reason}\n⏰ *Time:* ${now}\n\n` +
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
    await reply(`💬 *SHADOW GARDEN SUPPORT*\n\nContact a mod via *.mods* to get the invite link.`)
  },

  async addbot({ reply }) {
    await reply(`🤖 *ADD BOT REQUEST*\n\nContact staff with your group link.\n\nUse *.mods* to see available staff.`)
  },

  async help({ reply, args }) {
    if (args[0]) return reply(`📖 *HELP: .${args[0]}*\n\nSee *.menu* for full command list.`)
    await reply(`📖 *HELP MENU*\n\n• *.menu* — All commands\n• *#phelp* — Pokémon commands\n• *.law* — Community rules\n• *.pbenefits* — Premium info`)
  },

  async memory({ reply }) {
    const mem = process.memoryUsage()
    const toMB = b => (b / 1024 / 1024).toFixed(2)
    await reply(`💾 *MEMORY*\n\nHeap Used: ${toMB(mem.heapUsed)} MB\nRSS: ${toMB(mem.rss)} MB`)
  },

  // ── .law ─────────────────────────────────────────────────────
  async law({ reply }) {
    await reply(
      `📜 *SHADOW GARDEN LAWS AND REGULATIONS* 📜\n\n*(All members must comply with these rules at all times)*\n\n` +

      `⚖️ *BASIC RULES*\n\n` +
      `1. Respect all Moderators, Guardians, and Staff at all times. Disrespect or toxic behavior toward staff will not be tolerated.\n\n` +
      `2. Maintain proper behavior in all community spaces. Avoid being disruptive or engaging in actions that may lead to punishment.\n\n` +
      `3. Impersonating staff members in any form is strictly prohibited and will result in immediate punishment.\n\n` +
      `4. Follow instructions from staff when given. Failure to comply may lead to disciplinary action.\n\n\n` +

      `💰🎴 *ECONOMY, CARDS AND PLAY RULES*\n\n` +
      `1. Multiple accounts (alts) are strictly prohibited. Any user caught using more than one account will be permanently banned.\n\n` +
      `2. The use of scripts, cheats, macros, or any bot-assisted automation to gain unfair advantage is strictly forbidden.\n\n` +
      `3. Fake card spawns are not allowed under any circumstance.\n\n` +
      `4. Exploiting bugs or glitches for personal gain is strictly prohibited and must be reported immediately to staff.\n\n` +
      `5. Any form of fraud, scam trading, or manipulation of card systems will lead to severe penalties, including bans.\n\n\n` +

      `🤖 *BOT RULES AND CONDUCT*\n\n` +
      `1. If the bot is offline, do NOT spam commands. Doing so will result in punishment.\n\n` +
      `2. Attempting to overload, crash, or disrupt the bot through spam is strictly forbidden.\n\n` +
      `3. Do not DM staff asking why the bot is offline. Updates will be provided when necessary.\n\n` +
      `4. Do not DM moderators requesting bot replacements. Announcements will be made officially.\n\n` +
      `5. Misusing bot commands intentionally or repeatedly will lead to restriction or blacklist from bot features.\n\n\n` +

      `🏠 *REQUIREMENTS FOR BOT ACCESS IN GROUPS*\n\n` +
      `1. Groups must maintain a minimum of 80 active members to qualify for bot access.\n\n` +
      `2. At least one Moderator or Guardian must be present in the group.\n\n` +
      `3. The bot and assigned staff must be granted full administrative permissions.\n\n` +
      `4. Removing or tampering with assigned staff or bot permissions may result in immediate bot removal.\n\n` +
      `5. If a group becomes inactive, the bot will be removed without notice.\n\n\n` +

      `📩 *STAFF CONTACT RULES*\n\n` +
      `1. To view available staff members, use: *.modslist*\n\n` +
      `2. When contacting staff, clearly state your issue. Do NOT send empty messages like "hi" or "wsp".\n\n` +
      `3. Spamming staff DMs is strictly forbidden.\n\n` +
      `4. Do not contact multiple staff for the same issue. Choose one and wait.\n\n` +
      `5. Do not DM staff begging for unbans. Repeated requests will only worsen your case.\n\n\n` +

      `🚫 *FINAL NOTICE*\n\n` +
      `No one is exempt from these rules regardless of rank or status.\n\nViolating any rule may result in warnings, restrictions, or permanent bans.\n\n` +

      `🔄 *UPDATES*\n\nThese rules may be updated at any time without prior notice.`
    )
  },

  // ── .pbenefits ───────────────────────────────────────────────
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

      `📌 *IMPORTANT NOTICE*\n\n` +
      `All transactions must be handled only by official staff members.\n\nDo not trust unofficial sellers or third parties.\n\n` +

      `◈════════════════════◈`
    )
  },

  // ── .restart ─────────────────────────────────────────────────
  async restart({ sock, jid, msg, reply, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Staff only.')
    await sock.sendMessage(jid, {
      text:
        `🤖 *SYSTEM NOTICE*\n\n⚠️ *Shadow Garden Bot is restarting...*\n\n` +
        `The bot is undergoing a quick reboot to apply updates.\n\n` +
        `🔄 *Status:* Restart in progress\n⏳ *Estimated time:* A few moments\n\n` +
        `✨ Please wait patiently while we bring everything back online.`
    }, { quoted: msg })
    setTimeout(() => process.exit(0), 2000)
  },

  // ── .setms ───────────────────────────────────────────────────
  async setms(ctx) {
    return require('./pokemon').setms(ctx)
  },

  // ── .delms ───────────────────────────────────────────────────
  async delms(ctx) {
    return require('./pokemon').delms(ctx)
  },

  // ── .tagall — FIXED: use actual p.id for mentions, phone for display ──
  async tagall({ sock, msg, jid, senderJid, sender, isGroup, isOwner, args, reply }) {
    if (!isGroup) return reply('❌ Groups only.')

    const meta = await sock.groupMetadata(jid)
    const admins = meta.participants.filter(p => p.admin).map(p => p.id)
    if (!admins.includes(senderJid) && !isOwner) return reply('⚠️ Admin only.')

    const message  = args.join(' ') || 'Attention everyone!'
    const owner    = meta.owner || meta.participants.find(p => p.admin === 'superadmin')?.id || ''
    const ownerNum = owner.split('@')[0].split(':')[0]

    // Use actual participant JIDs (including @lid) for the mentions array
    // This is the correct JID WhatsApp knows — avoids LID display
    const actualJids = meta.participants.map(p => p.id)

    // For display text always extract just the numeric phone
    // (p.id could be "2347012345678@s.whatsapp.net" or "123456@lid")
    // We show the number portion only — which is human-readable either way
    const activePhones = await db.getActiveUsers(jid, 24 * 7).catch(() => [])
    const activeSet    = new Set(activePhones)

    const memberLines = meta.participants.map(p => {
      const num      = p.id.split('@')[0].split(':')[0]
      const isActive = activeSet.has(num)
      return `${isActive ? '🟢' : '🔴'} 💠 @${num}`
    }).join('\n')

    const text =
      `📣 *Tagging All...*\n\n` +
      `🏷️ *Message:* ${message}\n` +
      `🎃 *Group:* ${meta.subject}\n` +
      `🆔 *Group JID:* ${jid}\n` +
      `👑 *Group Owner:* @${ownerNum}\n` +
      `👥 *Group Members Count:* ${meta.participants.length}\n\n` +
      `${memberLines}`

    await sock.sendMessage(jid, { text, mentions: actualJids })
  },

  // ── .modlist / .modslist ─────────────────────────────────────
  async modlist({ sock, jid, msg, reply, isGroup }) {
    const { data: mods }      = await db.supabase.from('users').select('phone,name').eq('role', 'mod')
    const { data: guardians } = await db.supabase.from('users').select('phone,name').eq('role', 'guardian')

    const modList      = mods      || []
    const guardianList = guardians || []

    // Get actual JIDs from group participants where possible
    const phoneToJid = isGroup ? await buildPhoneMap(sock, jid) : {}

    const allMentions = [
      ...modList.map(u => phoneToJid[u.phone] || `${u.phone}@s.whatsapp.net`),
      ...guardianList.map(u => phoneToJid[u.phone] || `${u.phone}@s.whatsapp.net`),
    ]

    const modLines = modList.length
      ? modList.map((u, i) => `│   ${i === modList.length - 1 ? '└──' : '├──'} @${u.phone}`).join('\n')
      : '│   └── None'

    const guardianLines = guardianList.length
      ? guardianList.map((u, i) => `     ${i === guardianList.length - 1 ? '└──' : '├──'} @${u.phone}`).join('\n')
      : '     └── None'

    const text =
      `┌─「 𝗦𝗧𝗔𝗙𝗙𝗦 」─┐\n│\n` +
      `├── 👑 𝗠𝗢𝗗𝗦 👑\n${modLines}\n│\n` +
      `└── 🛡️ 𝗚𝗨𝗔𝗥𝗗𝗜𝗔𝗡𝗦 🛡️\n${guardianLines}\n\n` +
      `> ⚠️ Inappropriate use of this command will lead to a *Shadow Ban*.`

    await sock.sendMessage(jid, { text, mentions: allMentions }, { quoted: msg })
  },
  async modslist(ctx) { return module.exports.modlist(ctx) },

  // ── .sticker ─────────────────────────────────────────────────
  async sticker({ sock, msg, jid, reply }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const target = quoted ? {
      message: quoted,
      key: {
        remoteJid: jid,
        id: msg.message.extendedTextMessage.contextInfo.stanzaId,
        participant: msg.message.extendedTextMessage.contextInfo.participant,
      },
    } : msg

    const content = quoted || msg.message
    const imgMsg  = content?.imageMessage || content?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage

    if (!imgMsg) {
      return reply(`🖼️ *STICKER MAKER*\n\nSend or quote a *JPG / PNG* image with *.s* to convert it.`)
    }
    if ((imgMsg.mimetype || '').includes('gif')) {
      return reply(`❌ GIFs not supported. Send a *JPG or PNG* image only.`)
    }

    try {
      const { downloadMediaMessage } = require('@whiskeysockets/baileys')
      const buffer = await downloadMediaMessage(target, 'buffer', {}, {
        logger: { level: () => {}, info: () => {}, warn: () => {}, error: () => {} },
        reuploadRequest: sock.updateMediaMessage,
      })
      // Use sharp to convert to webp sticker
      const sharp  = require('sharp')
      const webp   = await sharp(buffer).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer()
      await sock.sendMessage(jid, { sticker: webp }, { quoted: msg })
    } catch (err) {
      await reply(`❌ Sticker creation failed: ${err.message}`)
    }
  },
  async s(ctx) { return module.exports.sticker(ctx) },

  async dbstatus({ reply, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const tables = ['users','groups','warnings','afk','messages','cooldowns','inventory','cards','user_cards','user_pokemon','games','summer_tokens','guilds','guild_members','blacklist','disabled_commands']
    const results = await Promise.all(tables.map(async t => {
      try {
        const { count, error } = await db.supabase.from(t).select('*', { count: 'exact', head: true })
        return { t, ok: !error, count: count || 0 }
      } catch { return { t, ok: false } }
    }))
    const lines = results.map(r => `${r.ok ? '✅' : '❌'} ${r.t}${r.ok ? ` (${r.count})` : ' — MISSING'}`).join('\n')
    await reply(`🗄️ *DATABASE STATUS*\n\n${lines}\n\n📊 *Tables:* ${results.filter(r => r.ok).length}/${tables.length} ready`)
  },
}
