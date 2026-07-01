// Custom frame system:
//   .upload frame <name>   (staff only, reply to an image)
//   .frames                (anyone — shows every uploaded frame as one image)
//   .setframe <name>       (anyone — equips a named custom frame)
//   .clearframes           (owner only — wipes all custom frames)
const db = require('../database')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')
const { buildFramesGridImage } = require('../frameHelper')

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

module.exports = {
  async uploadFrame({ sock, msg, jid, reply, args, isOwner, isMod, isGuardian, sender }) {
    if (!isOwner && !isMod && !isGuardian) {
      return reply('*🚫 Access Denied* — only staff (mods, guardians, owner) can upload frames.')
    }
    const name = args.slice(1).join(' ').trim()
    if (!name) return reply('⚠️ Usage: *.upload frame <name>* (reply to an image)')

    const target = getQuotedImageTarget(msg)
    if (!target) return reply('↩️ Reply to an image with *.upload frame <name>*')

    let buffer
    try {
      buffer = await downloadMediaMessage(target, 'buffer', {}, {
        logger: { level: () => {}, info: () => {}, warn: () => {}, error: () => {} },
        reuploadRequest: sock.updateMediaMessage,
      })
    } catch (err) {
      return reply(`❌ Failed to download image: ${err.message}`)
    }
    if (!buffer || buffer.length < 50) return reply('❌ Could not read that image.')

    try {
      const frame = await db.addFrame(name, buffer.toString('base64'), 'image/png', sender)
      await reply(`✅ Frame *${frame.name}* uploaded!\n\nUse *.frames* to view it or *.setframe ${frame.name}* to equip it.`)
    } catch (err) {
      await reply(`❌ Failed to save frame: ${err.message}`)
    }
  },

  async listFrames({ sock, msg, jid, reply }) {
    const frames = await db.getFrames().catch(() => [])
    if (!frames.length) {
      return reply('🖼️ No custom frames uploaded yet.\n\nStaff can add one with *.upload frame <name>* (reply to an image).')
    }

    await reply(`⏳ Generating frames gallery (${frames.length} frame${frames.length === 1 ? '' : 's'})…`)
    try {
      const png = await buildFramesGridImage(frames)
      await sock.sendMessage(
        jid,
        {
          image: png,
          caption: `🖼️ *CUSTOM FRAMES GALLERY*\n\n${frames.map((f) => `⌬ ${f.name}`).join('\n')}\n\n⚙️ Use *.setframe <name>* to equip one.`,
        },
        { quoted: msg }
      )
    } catch (err) {
      await reply(`❌ Failed to generate gallery: ${err.message}`)
    }
  },

  async setCustomFrame({ reply, args, sender }) {
    const name = args.join(' ').trim().toLowerCase()
    if (!name) return reply('⚠️ Usage: *.setframe <name>*')
    const frame = await db.getFrameByName(name).catch(() => null)
    if (!frame) return reply(`❌ No frame named *${name}* found. Use *.frames* to see available frames.`)
    await db.setEquippedFrame(sender, frame.name)
    await reply(`✅ Equipped frame *${frame.name}*!`)
  },

  async clearFrames({ reply, isOwner }) {
    if (!isOwner) return reply('*🚫 Access Denied* — owner only.')
    const count = await db.clearFrames().catch(() => 0)
    await reply(`🗑️ Cleared *${count}* frame${count === 1 ? '' : 's'} from the database.`)
  },
}
