// Owner-only multi-bot pairing commands:
//   .pair <number>   — connects an additional bot instance (real Baileys pairing code)
//   .pfp             — (reply to image) sets that PAIRED bot's WhatsApp profile picture
//   .img             — (reply to image) sets a menu image only for that paired bot
//   .name <name>     — renames that paired bot everywhere "Aqua" is mentioned
//   .unpair          — disconnects and forgets a paired bot
//   .pairedbots      — lists active paired bots
//
// IMPORTANT: .pfp / .img / .name only ever operate on bots connected via
// .pair. They explicitly refuse to run against the main (file/web-paired)
// bot — the original bot must never be renamed or have its pfp/menu changed
// through this feature.
const { downloadMediaMessage } = require('@whiskeysockets/baileys')
const db = require('../database')
const botManager = require('../botManager')
const { editResponse } = require('../responseHelper')

function getQuotedImageTarget(msg) {
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const imgMsg = msg.message?.imageMessage || quoted?.imageMessage
  if (!imgMsg) return null
  return quoted
    ? {
        message: quoted,
        key: {
          remoteJid: msg.key.remoteJid,
          id: msg.message.extendedTextMessage.contextInfo.stanzaId,
          participant: msg.message.extendedTextMessage.contextInfo.participant,
        },
      }
    : msg
}

async function downloadReplyImage(sock, msg) {
  const target = getQuotedImageTarget(msg)
  if (!target) return null
  return downloadMediaMessage(target, 'buffer', {}, {
    logger: { level: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    reuploadRequest: sock.updateMediaMessage,
  })
}

module.exports = {
  async pair({ reply, isOwner, args, sender, jid }) {
    if (!isOwner) return reply('*🚫 Access Denied* — owner only.')
    const phone = (args[0] || '').replace(/[^0-9]/g, '')
    if (!phone) return reply('⚠️ Usage: *.pair <number>* (no "+", e.g. .pair 15551234567)')

    const existing = botManager.getActiveBot(phone)
    if (existing?.sock?.user) {
      return reply(`ℹ️ ${phone} is already paired and connected as *${existing.name}*.`)
    }

    await reply(`⏳ Requesting pairing code for *${phone}*… this can take up to 20 seconds.`)
    try {
      await botManager.startPairedBot(phone, {
        pairedBy: sender,
        onCode: async (code, err) => {
          if (code) {
            await reply(`🔗 *Pairing code for ${phone}:*\n\n*${code}*\n\nOpen WhatsApp on that number → Linked Devices → Link with phone number, then enter this code.`)
          } else if (err) {
            await reply(`❌ Failed to generate pairing code: ${err.message}`)
          }
        },
        onStatus: async (status) => {
          if (status === 'connected') await reply(`✅ *${phone}* is now connected as an additional bot!`)
          if (status === 'logged_out') await reply(`⚠️ *${phone}* was logged out and removed.`)
        },
      })
    } catch (err) {
      await reply(`❌ Could not start pairing: ${err.message}`)
    }
  },

  async unpair({ reply, isOwner, args }) {
    if (!isOwner) return reply('*🚫 Access Denied* — owner only.')
    const phone = (args[0] || '').replace(/[^0-9]/g, '')
    if (!phone) return reply('⚠️ Usage: *.unpair <number>*')
    const ok = await botManager.stopPairedBot(phone).catch(() => false)
    await reply(ok ? `✅ Unpaired *${phone}*.` : `❌ No active paired bot found for *${phone}*.`)
  },

  async listBots({ reply }) {
    const bots = botManager.listActiveBots()
    if (!bots.length) return reply('📋 No paired bots are currently active.')
    const lines = bots.map((b) => `⌬ ${b.phone} — *${b.name}*${b.sock?.user ? ' (connected)' : ' (connecting…)'}`)
    await reply(`📋 *Active paired bots:*\n\n${lines.join('\n')}`)
  },

  // ── The following three commands are ONLY valid on a paired-bot socket ──

  async pfp({ sock, msg, reply, isOwner, botIdentity }) {
    if (!isOwner) return reply('*🚫 Access Denied* — owner only.')
    if (!botIdentity || botIdentity.isMainBot) {
      return reply('🚫 *.pfp* only works on bots connected via *.pair* — the main bot cannot be changed this way.')
    }
    const buffer = await downloadReplyImage(sock, msg).catch(() => null)
    if (!buffer) return reply('↩️ Reply to an image with *.pfp* to set this bot\'s profile picture.')
    try {
      await sock.updateProfilePicture(sock.user.id, buffer)
      await reply(`✅ Updated *${botIdentity.name || 'this bot'}*\'s profile picture!`)
    } catch (err) {
      await reply(`❌ Failed to update profile picture: ${err.message}`)
    }
  },

  async img({ sock, msg, reply, isOwner, botIdentity }) {
    if (!isOwner) return reply('*🚫 Access Denied* — owner only.')
    if (!botIdentity || botIdentity.isMainBot) {
      return reply('🚫 *.img* only works on bots connected via *.pair* — the main bot\'s menu image cannot be changed this way.')
    }
    const buffer = await downloadReplyImage(sock, msg).catch(() => null)
    if (!buffer) return reply('↩️ Reply to an image with *.img* to set this bot\'s menu image.')
    try {
      const base64 = buffer.toString('base64')
      await db.updatePairedBot(botIdentity.phone, { menuImage: base64, menuImageMime: 'image/png' })
      botManager.updateActiveBotIdentity(botIdentity.phone, { menuImage: base64, menuImageMime: 'image/png' })
      await reply(`✅ Updated *${botIdentity.name || 'this bot'}*\'s menu image!`)
    } catch (err) {
      await reply(`❌ Failed to update menu image: ${err.message}`)
    }
  },

  async name({ reply, isOwner, args, botIdentity }) {
    if (!isOwner) return reply('*🚫 Access Denied* — owner only.')
    if (!botIdentity || botIdentity.isMainBot) {
      return reply('🚫 *.name* only works on bots connected via *.pair* — the main bot must always stay "Aqua".')
    }
    const newName = args.join(' ').trim()
    if (!newName) return reply('⚠️ Usage: *.name <new name>*')
    if (!/^[A-Za-z0-9 _-]{1,24}$/.test(newName)) {
      return reply('⚠️ Name must be 1-24 characters (letters, numbers, spaces, - or _).')
    }
    try {
      await db.updatePairedBot(botIdentity.phone, { name: newName })
      botManager.updateActiveBotIdentity(botIdentity.phone, { name: newName })
      await reply(`✅ This bot is now named *${newName}* — every mention of "Aqua" (menu, ping, AI chat, etc.) now uses this name for this bot only.`)
    } catch (err) {
      await reply(`❌ Failed to rename bot: ${err.message}`)
    }
  },

  // ── .edit — owner-only response editor ──────────────────────────────────
  // Usage:
  //   .edit "command" "response text"
  //   .edit "command" outcome | "response text"
  //
  // Examples:
  //   .edit "daily" success | "🌟 Daily done! +£{coins} — streak {streak}"
  //   .edit "bet" win | "🎲 You won £{payout}!"
  //   .edit "rob" fail | "👮 Got caught! Fined £{fine}."
  //
  // Placeholders:  use {name} tokens — they are filled at runtime.
  async edit({ reply, isOwner, args, textRaw }) {
    if (!isOwner) return reply('*🚫 Access Denied* — owner only.')

    // Parse: .edit "command" [outcome |] "text"
    // Strip the leading command word (.edit already stripped by router, so args holds the rest)
    const raw = (textRaw || '').replace(/^[.!#/]edit\s*/i, '').trim()

    // Extract quoted strings and optional outcome token
    // Format A:  "command" outcome | "text"
    // Format B:  "command" "text"
    const quoted = [...raw.matchAll(/"([^"]+)"/g)].map(m => m[1])
    if (quoted.length < 2) {
      return reply(
        '⚠️ Usage:\n' +
        '`.edit "command" "response text"`\n' +
        '`.edit "command" outcome | "response text"`\n\n' +
        '_Outcome examples: success, fail, win, lose, cooldown_'
      )
    }

    const command  = quoted[0].toLowerCase()
    const text     = quoted[1]

    // Detect optional outcome between the two quoted strings
    const between  = raw.slice(raw.indexOf('"' + quoted[0] + '"') + quoted[0].length + 2).trim()
    const outcomeM = between.match(/^(\w+)\s*\|/)
    const outcome  = outcomeM ? outcomeM[1].toLowerCase() : null

    try {
      editResponse(command, outcome, text)
      const label = outcome ? `*${command}* → *${outcome}*` : `*${command}*`
      await reply(`✅ Response updated for ${label}:\n\n_${text}_`)
    } catch (err) {
      await reply(`❌ Failed to save response: ${err.message}`)
    }
  },
}
