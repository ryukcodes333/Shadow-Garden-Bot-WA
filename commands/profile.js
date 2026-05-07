const db = require('../database')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')
const { generateProfileCard, generateFrameCatalog, fetchBuffer, getFrame, FRAMES } = require('../profileHelper')
const { execFile } = require('child_process')
const os = require('os')
const path = require('path')
const fs = require('fs')

const { createClient } = require('@supabase/supabase-js')
function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || 'https://uwpcfhrbffhegfvxmxoa.supabase.co',
    process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cGNmaHJiZmZoZWdmdnhteG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NDUwMTgsImV4cCI6MjA5MzMyMTAxOH0.jvqoR2I0-irG1Xbh36eTMfmHFJYK-6Bo0IxIyVclQmA'
  )
}

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

// Upload a buffer to Supabase storage, return public URL
async function uploadToStorage(buffer, path, mime = 'image/jpeg') {
  const supabase = getSupabase()
  const { error } = await supabase.storage
    .from('card-images')
    .upload(path, buffer, { contentType: mime, upsert: true })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('card-images').getPublicUrl(path)
  return data.publicUrl
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

    await sock.sendMessage(
      jid,
      {
        image: cardBuffer,
        caption:
          `🌑 *${u.name || sender}\'s Profile*\n\n` +
          `⭐ Level ${u.level || 1}  |  🎭 ${u.role || 'member'}\n` +
          `💰 ${Number(u.wallet || 0).toLocaleString()} coins  •  💎 ${Number(u.gems || 0).toLocaleString()} gems\n` +
          `🃏 Cards: ${cardCount}\n` +
          `🖼️ Frame: ${frameName} (#${frameId})\n\n` +
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

    await reply(
      `👤 *USER PROFILE*\n\n` +
      `🧑 *Name:* ${u.name || targetPhone}\n` +
      `🆔 *User ID:* ${targetPhone}\n\n` +
      `📊 *Level:* ${u.level || 1}\n` +
      `🔥 *XP:* ${u.xp || 0} / ${xpNeeded}\n` +
      `⭐ *Rank:* ${u.role || 'member'}\n\n` +
      `💰 *Wallet:* ${u.wallet || 0} coins\n` +
      `🏦 *Bank:* ${u.bank || 0} coins\n` +
      `💎 *Gems:* ${u.gems || 0}\n\n` +
      `🎮 *Games Won:* 0\n` +
      `❌ *Games Lost:* 0\n\n` +
      `📈 *Streak:* ${u.streak || 0} days\n` +
      `⚡ *Status:* Active\n\n` +
      `🧠 *Title:* ${u.title || 'Newcomer'}\n` +
      `🎴 *Card Tier:* N/A\n\n` +
      `🚫 *Banned:* ${u.banned ? 'Yes' : 'No'}\n` +
      `📅 *Joined:* ${joinDate}\n` +
      `🌍 *Registered:* ${u.created_at ? 'Yes' : 'No'}\n\n` +
      `_The system records everything… even what you don't notice._ 🖤`
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
      if (err.message && err.message.includes('row-level security')) {
        return reply(
          `❌ *UPLOAD BLOCKED — RLS Policy Missing*\n\n` +
          `Run this SQL in your *Supabase SQL Editor* once:\n\n` +
          `CREATE POLICY "allow_all_card_images"\n` +
          `ON storage.objects AS PERMISSIVE\n` +
          `FOR ALL TO public\n` +
          `USING (bucket_id = 'card-images')\n` +
          `WITH CHECK (bucket_id = 'card-images');\n\n` +
          `Then try *.setpp* again. 🖤`
        )
      }
      await reply(`❌ Failed to upload profile picture: ${err.message}`)
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
      if (err.message && err.message.includes('row-level security')) {
        return reply(
          `❌ *UPLOAD BLOCKED — RLS Policy Missing*\n\n` +
          `Run this SQL in your *Supabase SQL Editor* once:\n\n` +
          `CREATE POLICY "allow_all_card_images"\n` +
          `ON storage.objects AS PERMISSIVE\n` +
          `FOR ALL TO public\n` +
          `USING (bucket_id = 'card-images')\n` +
          `WITH CHECK (bucket_id = 'card-images');\n\n` +
          `Then try *.setbg* again. 🖤`
        )
      }
      await reply(`❌ Failed to upload background: ${err.message}`)
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
      return reply(
        `❌ *SETFRAME FAILED*\n\n` +
        `The profile columns don't exist in your database yet.\n\n` +
        `Run this SQL in your *Supabase SQL Editor*:\n\n` +
        `ALTER TABLE users\n` +
        `  ADD COLUMN IF NOT EXISTS profile_frame INTEGER DEFAULT 1,\n` +
        `  ADD COLUMN IF NOT EXISTS profile_pp TEXT DEFAULT NULL,\n` +
        `  ADD COLUMN IF NOT EXISTS profile_bg TEXT DEFAULT NULL;\n\n` +
        `Then try *.setframe* again.\n\n` +
        `_The schema must be updated first._ 🖤`
      )
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
