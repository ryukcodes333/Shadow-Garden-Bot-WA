const db = require('../database')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')
const { generateProfileCard, generateFrameCatalog, fetchBuffer, getFrame, FRAMES } = require('../profileHelper')
const { execFile } = require('child_process')
const os = require('os')
const path = require('path')
const fs = require('fs')

// MongoDB-based image storage — stores images as base64 data URLs in the user document

// Download an attached or quoted image from a message, returns buffer or null
async function getImageBuffer(sock, msg) {
  const imgMsg =
    msg.message?.imageMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage

  if (!imgMsg) return null

  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const targetMsg = quoted
    ? {
        message: quoted,
        key: {
          remoteJid: msg.key.remoteJid,
          id: msg.message.extendedTextMessage.contextInfo.stanzaId,
          participant: msg.message.extendedTextMessage.contextInfo.participant,
        },
      }
    : msg

  return downloadMediaMessage(
    targetMsg, 'buffer', {},
    { logger: console, reuploadRequest: sock.updateMediaMessage }
  )
}

// Search raw binary for the first embedded JPEG (SOI…EOI)
function extractJpegFromBinary(buf) {
  let start = -1
  for (let i = 0; i < buf.length - 2; i++) {
    if (buf[i] === 0xFF && buf[i + 1] === 0xD8 && buf[i + 2] === 0xFF) { start = i; break }
  }
  if (start === -1) return null
  let end = -1
  for (let i = buf.length - 2; i > start; i--) {
    if (buf[i] === 0xFF && buf[i + 1] === 0xD9) { end = i + 2; break }
  }
  if (end === -1 || end - start < 500) return null
  return buf.slice(start, end)
}

// Download the raw video from a message — returns the mp4 buffer as-is.
async function getRawVideoBuffer(sock, msg) {
  const vidMsg =
    msg.message?.videoMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage
  if (!vidMsg) return null

  const fileSize = Number(vidMsg.fileLength || 0)
  if (fileSize > 50 * 1024 * 1024) {
    throw new Error('Video too large (max 50 MB). Try sending a shorter clip.')
  }

  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const targetMsg = quoted
    ? {
        message: quoted,
        key: {
          remoteJid: msg.key.remoteJid,
          id: msg.message.extendedTextMessage.contextInfo.stanzaId,
          participant: msg.message.extendedTextMessage.contextInfo.participant,
        },
      }
    : msg

  let videoBuf
  try {
    videoBuf = await downloadMediaMessage(
      targetMsg, 'buffer', {},
      { logger: { level: 'silent', ...console }, reuploadRequest: sock.updateMediaMessage }
    )
  } catch (err) {
    throw new Error('Could not download video: ' + err.message)
  }

  if (!videoBuf || videoBuf.length < 100) {
    throw new Error('Downloaded video is empty. Try sending it again.')
  }

  return videoBuf
}

// Use ffmpeg to extract the first frame of a video buffer as a PNG buffer.
// Used when rendering profile cards where the bg/pp is a saved video.
async function extractVideoFrame(videoBuf) {
  const tmpDir = os.tmpdir()
  const tmpIn  = path.join(tmpDir, `sgbot_vin_${Date.now()}.mp4`)
  const tmpOut = path.join(tmpDir, `sgbot_frm_${Date.now()}.png`)
  try {
    fs.writeFileSync(tmpIn, videoBuf)
    await new Promise((resolve, reject) => {
      execFile('ffmpeg', [
        '-y', '-i', tmpIn,
        '-frames:v', '1',
        '-q:v', '2',
        tmpOut,
      ], { timeout: 20000 }, (err, _out, stderr) => {
        if (err) reject(new Error('ffmpeg frame error: ' + (stderr || err.message).slice(0, 200)))
        else resolve()
      })
    })
    const frameBuf = fs.readFileSync(tmpOut)
    if (frameBuf && frameBuf.length > 100) return frameBuf
    throw new Error('Frame output is empty.')
  } finally {
    try { fs.unlinkSync(tmpIn)  } catch {}
    try { fs.unlinkSync(tmpOut) } catch {}
  }
}

// Store image buffer as base64 data URL (saved directly in MongoDB user document)
async function uploadToStorage(buffer, storagePath, mime = 'image/jpeg') {
  const base64 = buffer.toString('base64')
  return `data:${mime};base64,${base64}`
}

module.exports = {
  // ─── .p — image profile card ──────────────────────────────────────────────
  async p({ sock, msg, jid, sender, user, reply, isOwner, isMod, isGuardian }) {
    await reply('⏳ Generating your profile card…')

    const u = user || await db.getOrCreateUser(sender)
    if (!u) return reply('❌ Could not load your profile. Make sure the database is set up.')

    // Override displayed role using runtime permission flags so owner/mod/guardian
    // always shows the correct badge even if the DB role column hasn't been set
    const effectiveRole = isOwner ? 'owner'
      : isMod                     ? 'mod'
      : isGuardian                ? 'guardian'
      : (u.role || 'member')
    const displayUser = { ...u, role: effectiveRole }

    // Fetch custom bg + pp if set
    let ppBuffer  = null
    let bgBuffer  = null

    try {
      if (u.profile_pp) {
        const raw = await fetchBuffer(u.profile_pp)
        ppBuffer = u.profile_pp.endsWith('.mp4')
          ? await extractVideoFrame(raw)
          : raw
      }
    } catch { ppBuffer = null }

    try {
      if (u.profile_bg) {
        const raw = await fetchBuffer(u.profile_bg)
        bgBuffer = u.profile_bg.endsWith('.mp4')
          ? await extractVideoFrame(raw)
          : raw
      }
    } catch { bgBuffer = null }

    let cardBuffer
    try {
      cardBuffer = await generateProfileCard(displayUser, ppBuffer, bgBuffer)
    } catch (err) {
      console.error('[profile] Card gen error:', err)
      return reply(`❌ Failed to generate profile card: ${err.message}`)
    }

    const frameId   = u.profile_frame || 1
    const frameName = getFrame(frameId).name
    const cardCount = await db.getUserCardCount(sender).catch(() => '?')
    const pokemon   = await db.getUserPokemon(sender).catch(() => [])
    const pokeCount = (pokemon || []).length
    const partySize = (pokemon || []).filter(p => p.in_party).length
    const xpNeeded  = (u.level || 1) * 1000
    const joinDate  = u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : 'Unknown'
    const barFilled = Math.round(((u.xp || 0) % 1000) / 100)
    const xpBar     = '█'.repeat(barFilled) + '░'.repeat(10 - barFilled)
    const netWorth  = (Number(u.wallet || 0) + Number(u.bank || 0))

    await sock.sendMessage(
      jid,
      {
        image: cardBuffer,
        caption:
          `✦ *${u.name || sender}'s Profile* ✦\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `👤 *Rank:* ${(u.role || 'member').toUpperCase()}  |  🏷️ *Title:* ${u.title || 'Newcomer'}\n` +
          `⭐ *Level:* ${u.level || 1}  |  🔥 *Streak:* ${u.streak || 0} days\n` +
          `📊 *XP:* ${(u.xp || 0).toLocaleString()} / ${xpNeeded.toLocaleString()}\n` +
          `[${xpBar}]\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `💰 *Wallet:* $${Number(u.wallet || 0).toLocaleString()}\n` +
          `🏦 *Bank:* $${Number(u.bank || 0).toLocaleString()}\n` +
          `💎 *Gems:* ${Number(u.gems || 0).toLocaleString()}\n` +
          `💵 *Net Worth:* $${netWorth.toLocaleString()}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🃏 *Cards Owned:* ${cardCount}\n` +
          `🖼️ *Frame:* ${frameName} (#${frameId})\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🎮 *Trainer Stats*\n` +
          `🐾 *Pokémon Owned:* ${pokeCount}  |  🎒 *In Party:* ${partySize}\n` +
          `🏆 *Gym Badges:* ${u.pokemon_badges || 0}\n` +
          `⚔️ *Battle Wins:* ${u.pokemon_wins || 0}  |  💥 *Losses:* ${u.pokemon_losses || 0}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📅 *Joined:* ${joinDate}\n` +
          `_Type .frames to browse all 30 frames_ 🖤`,
      },
      { quoted: msg }
    )
  },

  // ─── .profile — text profile ─────────────────────────────────────────────
  async profile({ reply, sender, user, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const targetPhone = mentioned.length ? mentioned[0].split('@')[0] : sender
    const u = (user && targetPhone === sender) ? user : await db.getOrCreateUser(targetPhone)
    if (!u) return reply('❌ Could not load profile.')

    const xpNeeded = (u.level || 1) * 1000
    const joinDate = u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Unknown'

    const pokemonList = await db.getUserPokemon(targetPhone).catch(() => [])
    const cardCount2  = await db.getUserCardCount(targetPhone).catch(() => 0)
    const pokeCount2  = (pokemonList || []).length
    const partyPoke   = (pokemonList || []).filter(p => p.in_party).slice(0, 3)
    const netWorth2   = Number(u.wallet || 0) + Number(u.bank || 0)
    const xpBar2fill  = Math.round(((u.xp || 0) % 1000) / 100)
    const xpBar2      = '█'.repeat(xpBar2fill) + '░'.repeat(10 - xpBar2fill)
    const partyLine   = partyPoke.length
      ? partyPoke.map(p => `  • *${p.name}* Lv.${p.level || 1}`).join('\n')
      : '  _No Pokémon in party_'

    await reply(
      `✦ *${u.name || targetPhone}'s Profile* ✦\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🧑 *Name:* ${u.name || targetPhone}\n` +
      `🆔 *ID:* ${targetPhone.slice(-6)}\n` +
      `⭐ *Rank:* ${(u.role || 'member').toUpperCase()}\n` +
      `🏷️ *Title:* ${u.title || 'Newcomer'}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📊 *Level:* ${u.level || 1}\n` +
      `🔥 *XP:* ${(u.xp || 0).toLocaleString()} / ${xpNeeded}\n` +
      `[${xpBar2}]\n` +
      `📈 *Streak:* ${u.streak || 0} days\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💰 *Wallet:* $${Number(u.wallet || 0).toLocaleString()}\n` +
      `🏦 *Bank:* $${Number(u.bank || 0).toLocaleString()}\n` +
      `💎 *Gems:* ${Number(u.gems || 0).toLocaleString()}\n` +
      `💵 *Net Worth:* $${netWorth2.toLocaleString()}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🃏 *Cards Owned:* ${cardCount2}\n` +
      `🚫 *Banned:* ${u.banned ? '⛔ Yes' : '✅ No'}\n` +
      `📅 *Joined:* ${joinDate}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎮 *Trainer Stats*\n` +
      `🐾 *Pokémon Owned:* ${pokeCount2}\n` +
      `🏆 *Gym Badges:* ${u.pokemon_badges || 0}\n` +
      `⚔️ *Wins:* ${u.pokemon_wins || 0}  |  💥 *Losses:* ${u.pokemon_losses || 0}\n\n` +
      `*🎒 Active Party (${partyPoke.length}/6):*\n${partyLine}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_The shadows know your every move._ 🖤`
    )
  },

  // ─── .setpp ───────────────────────────────────────────────────────────────
  async setpp({ sock, msg, jid, sender, user, reply, isOwner, isMod, isGuardian }) {
    const isStaff = isOwner || isMod || isGuardian

    // Check for video first (staff only)
    const isVideoMsg =
      !!msg.message?.videoMessage ||
      !!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage

    if (isVideoMsg && isStaff) {
      await reply('⏳ Saving your video profile picture…')
      let videoBuf
      try {
        videoBuf = await getRawVideoBuffer(sock, msg)
      } catch (err) {
        return reply(`❌ Video error: ${err.message}`)
      }
      try {
        const storagePath = `profiles/pp/${sender}.mp4`
        const url = await uploadToStorage(videoBuf, storagePath, 'video/mp4')
        await db.updateUser(sender, { profile_pp: url })
        await sock.sendMessage(
          jid,
          {
            video: videoBuf,
            caption:
              `✅ *PROFILE PICTURE UPDATED*\n\n` +
              `Your video PP has been saved! 🎬\n\n` +
              `📸 Type *.p* to see your updated card.\n\n` +
              `_The shadows reflect your true face._ 🖤`,
          },
          { quoted: msg }
        )
      } catch (err) {
        await reply(`❌ Failed to upload video: ${err.message}`)
      }
      return
    }

    // Image path
    const buffer = await getImageBuffer(sock, msg)

    if (!buffer) {
      const staffNote = isStaff
        ? '\n\n👑 *Staff perk:* You can also send/quote a *video* to use it as your PP.'
        : ''
      return reply(
        `🖼️ *SET PROFILE PICTURE*\n\n` +
        `Send or quote a *JPG/PNG* image with *.setpp*\n\n` +
        `This sets the inner circle of your profile card.\n\n` +
        `_The image will be cropped to a circle._ 🖤${staffNote}`
      )
    }

    await reply('⏳ Uploading your profile picture…')

    try {
      const storagePath = `profiles/pp/${sender}.jpg`
      const url = await uploadToStorage(buffer, storagePath, 'image/jpeg')
      await db.updateUser(sender, { profile_pp: url })
      await sock.sendMessage(
        jid,
        {
          image: buffer,
          caption:
            `✅ *PROFILE PICTURE UPDATED*\n\n` +
            `Your PP has been saved.\n\n` +
            `📸 Type *.p* to see your updated card.\n\n` +
            `_The shadows reflect your true face._ 🖤`,
        },
        { quoted: msg }
      )
    } catch (err) {
      await reply(`❌ Failed to save profile picture: ${err.message}`)
    }
  },

  // ─── .setbg ───────────────────────────────────────────────────────────────
  async setbg({ sock, msg, jid, sender, user, reply, isOwner, isMod, isGuardian }) {
    const isStaff = isOwner || isMod || isGuardian

    // Check for video first (staff only)
    const isVideoMsg =
      !!msg.message?.videoMessage ||
      !!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage

    if (isVideoMsg && isStaff) {
      await reply('⏳ Saving your video background…')
      let videoBuf
      try {
        videoBuf = await getRawVideoBuffer(sock, msg)
      } catch (err) {
        return reply(`❌ Video error: ${err.message}`)
      }
      try {
        const storagePath = `profiles/bg/${sender}.mp4`
        const url = await uploadToStorage(videoBuf, storagePath, 'video/mp4')
        await db.updateUser(sender, { profile_bg: url })
        await sock.sendMessage(
          jid,
          {
            video: videoBuf,
            caption:
              `✅ *PROFILE BACKGROUND UPDATED*\n\n` +
              `Your video background has been saved! 🎬\n\n` +
              `📸 Type *.p* to see your card (uses first frame).\n\n` +
              `_Your shadow now has a new stage._ 🖤`,
          },
          { quoted: msg }
        )
      } catch (err) {
        await reply(`❌ Failed to upload video: ${err.message}`)
      }
      return
    }

    // Image path
    const buffer = await getImageBuffer(sock, msg)

    if (!buffer) {
      const staffNote = isStaff
        ? '\n\n👑 *Staff perk:* You can also send/quote a *video* to use it as your background.'
        : ''
      return reply(
        `🎨 *SET PROFILE BACKGROUND*\n\n` +
        `Send or quote a *JPG/PNG* image with *.setbg*\n\n` +
        `This sets the background of your profile card.\n\n` +
        `_Any image works — landscapes, gradients, etc._ 🖤${staffNote}`
      )
    }

    await reply('⏳ Uploading your background…')

    try {
      const storagePath = `profiles/bg/${sender}.jpg`
      const url = await uploadToStorage(buffer, storagePath, 'image/jpeg')
      await db.updateUser(sender, { profile_bg: url })
      await sock.sendMessage(
        jid,
        {
          image: buffer,
          caption:
            `✅ *PROFILE BACKGROUND UPDATED*\n\n` +
            `Your background has been saved.\n\n` +
            `📸 Type *.p* to see your updated card.\n\n` +
            `_Your shadow now has a new stage._ 🖤`,
        },
        { quoted: msg }
      )
    } catch (err) {
      await reply(`❌ Failed to save background: ${err.message}`)
    }
  },

  // ─── .frames ──────────────────────────────────────────────────────────────
  async frames({ sock, msg, jid, reply, args }) {
    const page = parseInt(args[0]) || 1

    if (page < 1 || page > 3) {
      return reply(
        `🖼️ *FRAMES CATALOG*\n\n` +
        `Usage:\n` +
        `• *.frames* or *.frames 1* — Page 1 (frames 1–35, Basic)\n` +
        `• *.frames 2* — Page 2 (frames 36–70, Anime)\n` +
        `• *.frames 3* — Page 3 (frames 71–100, 3D Prestige)\n\n` +
        `_100 frames total across three pages._ 🖤`
      )
    }

    await reply(`⏳ Generating frames catalog page ${page}…`)

    let catalog
    try {
      catalog = await generateFrameCatalog(page)
    } catch (err) {
      console.error('[frames] Catalog gen error:', err)
      return reply(`❌ Failed to generate catalog: ${err.message}`)
    }

    const captions = {
      1:
        `🖼️ *FRAMES COLLECTION — Page 1/3 (Basic)*\n\n` +
        `*35 frames* across 7 categories:\n` +
        `• Basic (1–5)  • Neon (6–10)  • Gradient (11–15)\n` +
        `• Ornate (16–20)  • Nature (21–25)\n` +
        `• Prestige (26–30)  • Extra (31–35)\n\n` +
        `📖 *.frames 2* — Anime frames (36–70)\n` +
        `📖 *.frames 3* — 3D Prestige frames (71–100)\n` +
        `⚙️ *.setframe <id>* — Equip a frame\n\n` +
        `_e.g. .setframe 14_ 🖤`,

      2:
        `🎌 *FRAMES COLLECTION — Page 2/3 (Anime)*\n\n` +
        `*35 anime & cartoon frames* (36–70):\n` +
        `• Anime Basics (36–40)  • Anime Fantasy (41–45)\n` +
        `• Anime Magic (46–50)  • Anime Nature (51–55)\n` +
        `• Cyberpunk (56–60)  • Anime Prestige (61–65)\n` +
        `• Anime Ultimate (66–70)\n\n` +
        `📖 *.frames* — Page 1 (basic)  |  *.frames 3* — 3D frames\n` +
        `⚙️ *.setframe <id>* — Equip a frame\n\n` +
        `_Cartoonish, anime-styled shadows await._ 🖤`,

      3:
        `✨ *FRAMES COLLECTION — Page 3/3 (3D Prestige)*\n\n` +
        `*30 three-dimensional prestige frames* (71–100):\n` +
        `• Shadow Depth (71–80)  • Neon 3D (81–90)\n` +
        `• Void Prism (91–100)\n\n` +
        `💎 These frames feature: radial gradients, bevel edges,\n` +
        `   specular highlights, glow rings & accent gems.\n\n` +
        `📖 *.frames* — Page 1  |  *.frames 2* — Anime\n` +
        `⚙️ *.setframe <id>* — Equip a frame\n\n` +
        `_Only the strongest carry these marks._ 🖤`,
    }

    await sock.sendMessage(
      jid,
      { image: catalog, caption: captions[page] },
      { quoted: msg }
    )
  },

  // ─── .setframe <id> ───────────────────────────────────────────────────────
  async setframe({ reply, sender, args }) {
    const id = parseInt(args[0])

    if (!id || id < 1 || id > 100) {
      return reply(
        `🖼️ *SET FRAME*\n\n` +
        `Usage: *.setframe <1–100>*\n\n` +
        `• *.frames*   — Page 1 (frames 1–35, Basic)\n` +
        `• *.frames 2* — Page 2 (frames 36–70, Anime)\n` +
        `• *.frames 3* — Page 3 (frames 71–100, 3D Prestige)\n\n` +
        `_e.g. .setframe 88_ 🖤`
      )
    }

    const frame = getFrame(id)
    const result = await db.updateUser(sender, { profile_frame: id })

    if (!result) {
      return reply('❌ Could not update frame. Make sure your profile exists. Try `.p` first.')
    }

    await reply(
      `✅ *FRAME EQUIPPED*\n\n` +
      `🖼️ *Frame:* ${frame.name}\n` +
      `🏷️ *Category:* ${frame.category}\n` +
      `🔢 *ID:* #${frame.id}\n\n` +
      `Type *.profile* to see it on your card.\n\n` +
      `_Your shadow wears a new crown._ 🖤`
    )
  },
}
