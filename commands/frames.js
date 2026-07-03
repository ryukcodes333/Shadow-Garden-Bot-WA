// Custom frame system:
//   .upload frame <name>      (staff only, reply to an image — transparent overlay)
//   .upload frame <name> bg   (staff only — image becomes the card background)
//   .frames                   (anyone — shows every uploaded frame as one image)
//   .setframe <name>          (anyone — equips a named custom frame)
//   .clearframes              (owner only — wipes all custom frames)
const db = require('../database')
const sharp = require('sharp')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')
const { buildFramesGridImage } = require('../frameHelper')

// ── Auto black-background removal ────────────────────────────────────────────
// Converts a solid-black-background frame PNG into a transparent overlay.
// Pixels with max(r,g,b) below `hardCut` → fully transparent.
// Pixels between `hardCut` and `softEdge` → linearly faded for smooth edges.
async function removeBlackBg(inputBuf, hardCut = 40, softEdge = 80) {
  const { data, info } = await sharp(inputBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let i = 0; i < data.length; i += 4) {
    const brightness = Math.max(data[i], data[i + 1], data[i + 2])
    if (brightness < hardCut) {
      data[i + 3] = 0  // fully transparent
    } else if (brightness < softEdge) {
      // Fade in: 0 at hardCut, original alpha at softEdge
      const t = (brightness - hardCut) / (softEdge - hardCut)
      data[i + 3] = Math.round(t * data[i + 3])
    }
    // else: keep original alpha
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer()
}

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

    // Parse: .upload frame <name> [bg]
    // args[0] = "frame", rest = name parts, optional trailing "bg" keyword
    const rawParts = args.slice(1)
    const hasBgFlag = rawParts.length > 0 && rawParts[rawParts.length - 1].toLowerCase() === 'bg'
    const nameParts = hasBgFlag ? rawParts.slice(0, -1) : rawParts
    const name = nameParts.join(' ').trim()

    if (!name) {
      return reply(
        '⚠️ Usage:\n' +
        '• *.upload frame <name>*    — transparent overlay frame\n' +
        '• *.upload frame <name> bg* — frame image becomes the card background\n\n' +
        '_(Reply to an image)_'
      )
    }

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
      let finalBuffer = buffer

      if (!hasBgFlag) {
        // Overlay frame — strip the black background automatically so the ring
        // composites cleanly over the user's avatar and wallpaper.
        try {
          finalBuffer = await removeBlackBg(buffer)
        } catch (e) {
          console.warn('[frames] removeBlackBg failed, using original:', e.message)
          finalBuffer = buffer
        }
      }

      const frame = await db.addFrame(name, finalBuffer.toString('base64'), 'image/png', sender)
      if (hasBgFlag) await db.setFrameBackground(frame.name, true)

      const bgNote = hasBgFlag
        ? '\n🌟 Marked as *background frame* — it replaces the user\'s wallpaper.'
        : '\n✨ Black background auto-removed — frame is now transparent.'
      await reply(`✅ Frame *${frame.name}* uploaded!${bgNote}\n\nUse *.frames* to view it or *.setframe ${frame.name}* to equip it.`)
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
          caption: `🖼️ *CUSTOM FRAMES GALLERY*\n\n${frames.map((f) => `⌬ ${f.name}${f.has_background ? ' *(bg)*' : ''}`).join('\n')}\n\n⚙️ Use *.setframe <name>* to equip one.\n🌟 *(bg)* = frame includes a custom background`,
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
    // Equip custom frame and clear built-in frame selection so the card uses this one
    await db.setEquippedFrame(sender, frame.name)
    const bgNote = frame.has_background
      ? '\n\n🌟 This frame includes a *custom background* — it will replace your wallpaper on the card.'
      : ''
    await reply(
      `✅ *FRAME EQUIPPED*\n\n` +
      `🖼️ *Frame:* ${frame.name}${bgNote}\n\n` +
      `Type *.p* to see it on your card.\n\n` +
      `_Your shadow wears a new crown._ 🖤`
    )
  },

  async clearFrames({ reply, isOwner }) {
    if (!isOwner) return reply('*🚫 Access Denied* — owner only.')
    const count = await db.clearFrames().catch(() => 0)
    await reply(`🗑️ Cleared *${count}* frame${count === 1 ? '' : 's'} from the database.`)
  },
}
