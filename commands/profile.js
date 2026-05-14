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

async function getImageBuffer(sock, msg) {
  const imgMsg =
    msg.message?.imageMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
  if (!imgMsg) return null
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const targetMsg = quoted
    ? { message: quoted, key: { remoteJid: msg.key.remoteJid, id: msg.message.extendedTextMessage.contextInfo.stanzaId, participant: msg.message.extendedTextMessage.contextInfo.participant } }
    : msg
  return downloadMediaMessage(targetMsg, 'buffer', {}, { logger: console, reuploadRequest: sock.updateMediaMessage })
}

async function getRawVideoBuffer(sock, msg) {
  const vidMsg =
    msg.message?.videoMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage
  if (!vidMsg) return null
  const fileSize = Number(vidMsg.fileLength || 0)
  if (fileSize > 50 * 1024 * 1024) throw new Error('Video too large (max 50 MB). Try a shorter clip.')
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const targetMsg = quoted
    ? { message: quoted, key: { remoteJid: msg.key.remoteJid, id: msg.message.extendedTextMessage.contextInfo.stanzaId, participant: msg.message.extendedTextMessage.contextInfo.participant } }
    : msg
  let videoBuf
  try {
    videoBuf = await downloadMediaMessage(targetMsg, 'buffer', {}, { logger: { level: 'silent', ...console }, reuploadRequest: sock.updateMediaMessage })
  } catch (err) { throw new Error('Could not download video: ' + err.message) }
  if (!videoBuf || videoBuf.length < 100) throw new Error('Downloaded video is empty. Try sending it again.')
  return videoBuf
}

async function extractVideoFrame(videoBuf) {
  const tmpDir = os.tmpdir()
  const tmpIn  = path.join(tmpDir, `sgbot_vin_${Date.now()}.mp4`)
  const tmpOut = path.join(tmpDir, `sgbot_frm_${Date.now()}.png`)
  try {
    fs.writeFileSync(tmpIn, videoBuf)
    await new Promise((resolve, reject) => {
      execFile('ffmpeg', ['-y', '-i', tmpIn, '-frames:v', '1', '-q:v', '2', tmpOut], { timeout: 20000 }, (err, _out, stderr) => {
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

async function uploadToStorage(buffer, storagePath, mime = 'image/jpeg') {
  const supabase = getSupabase()
  const { error } = await supabase.storage.from('card-images').upload(storagePath, buffer, { contentType: mime, upsert: true })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('card-images').getPublicUrl(storagePath)
  return data.publicUrl
}

// ── Badge / rank helper ────────────────────────────────────────────────────────
function getRoleBadge(role) {
  const badges = { owner:'👑 Owner', mod:'🛡️ Moderator', guardian:'🗡️ Guardian', card_maker:'🎴 Card Maker', premium:'⭐ Premium' }
  return badges[role] || '🌑 Member'
}

function getXPBar(xp, level) {
  const needed = level * 1000
  const pct    = Math.min(1, (xp % needed) / needed)
  const filled = Math.round(pct * 10)
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}] ${Math.floor(pct * 100)}%`
}

function getAchievements(u) {
  const ach = []
  if ((u.level || 1) >= 5)   ach.push('🏅 Rising Star (Lvl 5)')
  if ((u.level || 1) >= 10)  ach.push('🥈 Veteran (Lvl 10)')
  if ((u.level || 1) >= 25)  ach.push('🥇 Elite (Lvl 25)')
  if ((u.gems  || 0) >= 100) ach.push('💎 Gem Collector')
  if ((u.streak|| 0) >= 7)   ach.push('🔥 Week Streak')
  if ((u.streak|| 0) >= 30)  ach.push('🌟 Month Streak')
  if (u.premium)             ach.push('👑 Premium Member')
  if (u.role === 'mod')      ach.push('🛡️ Staff Guard')
  return ach.length ? ach.join('\n') : '🔒 No achievements yet'
}

module.exports = {
  // ─── .p — profile card ──────────────────────────────────────────────────────
  async p({ sock, msg, jid, sender, user, reply, isOwner, isMod, isGuardian }) {
    await reply('⏳ Generating your profile card…')

    const u = user || await db.getOrCreateUser(sender)
    if (!u) return reply('❌ Could not load your profile.')

    const effectiveRole = isOwner ? 'owner' : isMod ? 'mod' : isGuardian ? 'guardian' : (u.role || 'member')
    const displayUser   = { ...u, role: effectiveRole }

    const xpNeeded  = (u.level || 1) * 1000
    const xpBar     = getXPBar(u.xp || 0, u.level || 1)
    const cardCount = await db.getUserCardCount(sender).catch(() => 0)
    const frameId   = u.profile_frame || 1
    const frameName = getFrame(frameId).name
    const joinDate  = u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : 'Unknown'
    const marriage  = await db.getMarriage(sender).catch(() => null)
    const partner   = marriage
      ? (marriage.proposer_phone === sender ? marriage.target_name : marriage.proposer_name)
      : null

    const profileCaption =
      `╭─「 🌑 *${u.name || sender}* 」─\n` +
      `│\n` +
      `├ 👤 *Name:* ${u.name || sender}\n` +
      `├ 🆔 *ID:* ${sender}\n` +
      `├ 🎭 *Role:* ${getRoleBadge(effectiveRole)}\n` +
      `├ 🧠 *Title:* ${u.title || 'Newcomer'}\n` +
      `│\n` +
      `├─── 📊 *STATS*\n` +
      `├ ⭐ Level: *${u.level || 1}*\n` +
      `├ 🔥 XP: *${(u.xp||0).toLocaleString()} / ${xpNeeded.toLocaleString()}*\n` +
      `├ ${xpBar}\n` +
      `├ 🔁 Streak: *${u.streak || 0} days*\n` +
      `│\n` +
      `├─── 💰 *ECONOMY*\n` +
      `├ 💵 Wallet: *${(u.wallet||0).toLocaleString()} Bnhz*\n` +
      `├ 🏦 Bank: *${(u.bank||0).toLocaleString()} Bnhz*\n` +
      `├ 💎 Gems: *${u.gems || 0}*\n` +
      `├ 📊 Net Worth: *${((u.wallet||0)+(u.bank||0)).toLocaleString()} Bnhz*\n` +
      `│\n` +
      `├─── 🎴 *COLLECTION*\n` +
      `├ 🃏 Cards: *${cardCount}*\n` +
      `├ 🖼️ Frame: *${frameName}* (#${frameId})\n` +
      (partner ? `├ 💍 Married to: *${partner}*\n` : '') +
      `│\n` +
      `├─── 🏆 *ACHIEVEMENTS*\n` +
      getAchievements(u).split('\n').map(a => `├ ${a}`).join('\n') + '\n' +
      `│\n` +
      `├ 📅 Joined: *${joinDate}*\n` +
      `├ 🌍 Status: *${u.banned ? '🚫 Banned' : '✅ Active'}*\n` +
      `│\n` +
      `╰─ _The shadow garden remembers all._ 🖤`

    // If user has a VIDEO background — send the actual video playing
    if (u.profile_bg && (u.profile_bg.endsWith('.mp4') || u.profile_bg.includes('video'))) {
      try {
        const videoBuf = await fetchBuffer(u.profile_bg)
        await sock.sendMessage(jid, { video: videoBuf, caption: profileCaption, gifPlayback: false }, { quoted: msg })
        return
      } catch (e) {
        // fallback to image card if video fetch fails
      }
    }

    // Normal image card
    let ppBuffer = null
    let bgBuffer = null
    try {
      if (u.profile_pp) {
        const raw = await fetchBuffer(u.profile_pp)
        ppBuffer = u.profile_pp.endsWith('.mp4') ? await extractVideoFrame(raw) : raw
      }
    } catch { ppBuffer = null }

    try {
      if (u.profile_bg) {
        const raw = await fetchBuffer(u.profile_bg)
        bgBuffer = u.profile_bg.endsWith('.mp4') ? await extractVideoFrame(raw) : raw
      }
    } catch { bgBuffer = null }

    let cardBuffer
    try {
      cardBuffer = await generateProfileCard(displayUser, ppBuffer, bgBuffer)
    } catch (err) {
      return reply(`❌ Failed to generate profile card: ${err.message}`)
    }

    await sock.sendMessage(jid, { image: cardBuffer, caption: profileCaption }, { quoted: msg })
  },

  // ─── .profile ────────────────────────────────────────────────────────────────
  async profile({ reply, sender, user, msg }) {
    const mentioned   = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const targetPhone = mentioned.length ? mentioned[0].split('@')[0].split(':')[0] : sender
    const u = (user && targetPhone === sender) ? user : await db.getOrCreateUser(targetPhone)
    if (!u) return reply('❌ Could not load profile.')

    const xpNeeded  = (u.level || 1) * 1000
    const xpBar     = getXPBar(u.xp || 0, u.level || 1)
    const cardCount = await db.getUserCardCount(targetPhone).catch(() => 0)
    const joinDate  = u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : 'Unknown'
    const marriage  = await db.getMarriage(targetPhone).catch(() => null)
    const partner   = marriage
      ? (marriage.proposer_phone === targetPhone ? marriage.target_name : marriage.proposer_name)
      : null

    await reply(
      `╭─「 🌑 *${u.name || targetPhone} — PROFILE* 」─\n` +
      `│\n` +
      `├ 👤 *Name:* ${u.name || targetPhone}\n` +
      `├ 🆔 *User ID:* ${targetPhone}\n` +
      `├ 🎭 *Role:* ${getRoleBadge(u.role || 'member')}\n` +
      `├ 🧠 *Title:* ${u.title || 'Newcomer'}\n` +
      `├ 📝 *Bio:* ${u.bio || 'No bio set'}\n` +
      `│\n` +
      `├─── 📊 *STATS*\n` +
      `├ ⭐ Level: *${u.level || 1}*\n` +
      `├ 🔥 XP: *${(u.xp||0).toLocaleString()} / ${xpNeeded.toLocaleString()}*\n` +
      `├ ${xpBar}\n` +
      `├ 🔁 Daily Streak: *${u.streak || 0} days*\n` +
      `│\n` +
      `├─── 💰 *ECONOMY*\n` +
      `├ 💵 Wallet: *${(u.wallet||0).toLocaleString()} Bnhz*\n` +
      `├ 🏦 Bank: *${(u.bank||0).toLocaleString()} Bnhz*\n` +
      `├ 💎 Gems: *${u.gems || 0}*\n` +
      `├ 📊 Net Worth: *${((u.wallet||0)+(u.bank||0)).toLocaleString()} Bnhz*\n` +
      `│\n` +
      `├─── 🎴 *COLLECTION*\n` +
      `├ 🃏 Cards Owned: *${cardCount}*\n` +
      `├ 🖼️ Frame: *#${u.profile_frame || 1}*\n` +
      (partner ? `├ 💍 Married to: *${partner}*\n` : `├ 💔 Marital Status: *Single*\n`) +
      `│\n` +
      `├─── 🏆 *ACHIEVEMENTS*\n` +
      getAchievements(u).split('\n').map(a => `├ ${a}`).join('\n') + '\n' +
      `│\n` +
      `├ 📅 Member Since: *${joinDate}*\n` +
      `├ ⚡ Account Status: *${u.banned ? '🚫 Banned' : u.premium ? '⭐ Premium' : '✅ Active'}*\n` +
      `│\n` +
      `╰─ _𝐒𝐇𝚫𝐃𝐎𝐖 𝐆𝚫𝐑𝐃𝚵𝐍 Records_ 🖤`
    )
  },

  // ─── .setpp ───────────────────────────────────────────────────────────────────
  async setpp({ sock, msg, jid, sender, user, reply, isOwner, isMod, isGuardian }) {
    const u       = user || await db.getOrCreateUser(sender)
    const isStaff = isOwner || isMod || isGuardian
    const isPrem  = u?.premium || false
    const canVideo = isStaff || isPrem

    const isVideoMsg =
      !!msg.message?.videoMessage ||
      !!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage

    if (isVideoMsg) {
      if (!canVideo)
        return reply('⚠️ Video profile pictures are for *Staff* and *Premium members* only.\n\nUpgrade to premium with *.premium* or ask a staff member.')
      await reply('⏳ Saving your video profile picture…')
      let videoBuf
      try { videoBuf = await getRawVideoBuffer(sock, msg) }
      catch (err) { return reply(`❌ Video error: ${err.message}`) }
      try {
        const url = await uploadToStorage(videoBuf, `profiles/pp/${sender}.mp4`, 'video/mp4')
        await db.updateUser(sender, { profile_pp: url })
        await sock.sendMessage(jid, { video: videoBuf, caption: `✅ *VIDEO PROFILE PICTURE UPDATED*\n\n🎬 Your video PP is saved! Type *.p* to see your card.\n\n_The shadows reflect your true face._ 🖤` }, { quoted: msg })
      } catch (err) { await reply(`❌ Failed to upload: ${err.message}`) }
      return
    }

    const buffer = await getImageBuffer(sock, msg)
    if (!buffer) {
      return reply(
        `🖼️ *SET PROFILE PICTURE*\n\nSend or quote a *JPG/PNG* image with *.setpp*\nThis sets the inner circle of your profile card.\n\n` +
        (canVideo ? `🎬 *You can also send a video* to use it as your PP.` : `👑 *Staff & Premium perk:* Send a video to use it as your PP.`) +
        `\n\n_The image will be cropped to a circle._ 🖤`
      )
    }

    await reply('⏳ Uploading your profile picture…')
    try {
      const url = await uploadToStorage(buffer, `profiles/pp/${sender}.jpg`, 'image/jpeg')
      await db.updateUser(sender, { profile_pp: url })
      await sock.sendMessage(jid, { image: buffer, caption: `✅ *PROFILE PICTURE UPDATED*\n\nYour PP is saved.\n\n📸 Type *.p* to see your card.\n\n_The shadows reflect your true face._ 🖤` }, { quoted: msg })
    } catch (err) {
      if (err.message?.includes('row-level security'))
        return reply(`❌ *UPLOAD BLOCKED — RLS Policy Missing*\n\nRun this SQL in your Supabase SQL Editor:\n\nCREATE POLICY "allow_all_card_images"\nON storage.objects AS PERMISSIVE\nFOR ALL TO public\nUSING (bucket_id = 'card-images')\nWITH CHECK (bucket_id = 'card-images');\n\nThen try *.setpp* again. 🖤`)
      await reply(`❌ Failed to upload: ${err.message}`)
    }
  },

  // ─── .setbg ───────────────────────────────────────────────────────────────────
  // Video bg: Staff + Premium only. Image bg: All users.
  async setbg({ sock, msg, jid, sender, user, reply, isOwner, isMod, isGuardian }) {
    const u       = user || await db.getOrCreateUser(sender)
    const isStaff = isOwner || isMod || isGuardian
    const isPrem  = u?.premium || false
    const canVideo = isStaff || isPrem

    const isVideoMsg =
      !!msg.message?.videoMessage ||
      !!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage

    if (isVideoMsg) {
      if (!canVideo)
        return reply(
          `🎬 *VIDEO BACKGROUNDS*\n\nVideo backgrounds are for *Staff* and *Premium members* only.\n\n` +
          `To set a static image background (for everyone), send/quote an *image* with *.setbg*\n\n` +
          `_Upgrade to premium to unlock video backgrounds._ 🖤`
        )

      await reply('⏳ Saving your video background…\n\n_When you type .p, the video will play automatically!_')
      let videoBuf
      try { videoBuf = await getRawVideoBuffer(sock, msg) }
      catch (err) { return reply(`❌ Video error: ${err.message}`) }
      try {
        const url = await uploadToStorage(videoBuf, `profiles/bg/${sender}.mp4`, 'video/mp4')
        await db.updateUser(sender, { profile_bg: url })
        await sock.sendMessage(jid, {
          video: videoBuf,
          caption:
            `✅ *VIDEO BACKGROUND SAVED!* 🎬\n\n` +
            `Your profile background is now a *live video*!\n\n` +
            `📱 Type *.p* — your profile card will send the video playing automatically.\n\n` +
            `_Your shadow now moves._ 🖤`,
        }, { quoted: msg })
      } catch (err) { await reply(`❌ Failed to upload video: ${err.message}`) }
      return
    }

    // Image background — available to ALL users
    const buffer = await getImageBuffer(sock, msg)
    if (!buffer) {
      return reply(
        `🎨 *SET PROFILE BACKGROUND*\n\n` +
        `Send or quote a *JPG/PNG* image with *.setbg*\nThis sets the background of your profile card.\n\n` +
        (canVideo
          ? `🎬 *You can also send a video* — your *.p* card will play it live!`
          : `👑 *Staff & Premium perk:* Send a video to make your background play live.`) +
        `\n\n_Any image works — landscapes, gradients, art._ 🖤`
      )
    }

    await reply('⏳ Uploading your background…')
    try {
      const url = await uploadToStorage(buffer, `profiles/bg/${sender}.jpg`, 'image/jpeg')
      await db.updateUser(sender, { profile_bg: url })
      await sock.sendMessage(jid, { image: buffer, caption: `✅ *PROFILE BACKGROUND UPDATED*\n\nYour background is saved.\n\n📸 Type *.p* to see your updated card.\n\n_Your shadow now has a new stage._ 🖤` }, { quoted: msg })
    } catch (err) {
      if (err.message?.includes('row-level security'))
        return reply(`❌ *UPLOAD BLOCKED — RLS Policy Missing*\n\nRun this SQL in Supabase:\n\nCREATE POLICY "allow_all_card_images"\nON storage.objects AS PERMISSIVE\nFOR ALL TO public\nUSING (bucket_id = 'card-images')\nWITH CHECK (bucket_id = 'card-images');\n\nThen try *.setbg* again. 🖤`)
      await reply(`❌ Failed to upload: ${err.message}`)
    }
  },

  // ─── .frames ─────────────────────────────────────────────────────────────────
  async frames({ sock, msg, jid, reply, args }) {
    const page = parseInt(args[0]) || 1
    if (page < 1 || page > 3) {
      return reply(`🖼️ *FRAMES CATALOG*\n\nUsage:\n• *.frames* or *.frames 1* — Page 1 (frames 1–35, Basic)\n• *.frames 2* — Page 2 (frames 36–70, Anime)\n• *.frames 3* — Page 3 (frames 71–100, 3D Prestige)\n\n_100 frames total across three pages._ 🖤`)
    }
    await reply(`⏳ Generating frames catalog page ${page}…`)
    let catalog
    try { catalog = await generateFrameCatalog(page) }
    catch (err) { return reply(`❌ Failed to generate catalog: ${err.message}`) }
    const captions = {
      1: `🖼️ *FRAMES — Page 1/3 (Basic)*\n\n*35 frames* across 7 categories:\n• Basic (1–5)  • Neon (6–10)  • Gradient (11–15)\n• Ornate (16–20)  • Nature (21–25)\n• Prestige (26–30)  • Extra (31–35)\n\n📖 *.frames 2* — Anime  |  *.frames 3* — 3D\n⚙️ *.setframe <id>* — Equip a frame\n\n_e.g. .setframe 14_ 🖤`,
      2: `🎌 *FRAMES — Page 2/3 (Anime)*\n\n*35 anime frames* (36–70)\n\n📖 *.frames* — Basic  |  *.frames 3* — 3D\n⚙️ *.setframe <id>* — Equip\n\n_Anime shadows await._ 🖤`,
      3: `✨ *FRAMES — Page 3/3 (3D Prestige)*\n\n*30 prestige frames* (71–100)\n\n📖 *.frames* — Basic  |  *.frames 2* — Anime\n⚙️ *.setframe <id>* — Equip\n\n_Only the strongest carry these._ 🖤`,
    }
    await sock.sendMessage(jid, { image: catalog, caption: captions[page] }, { quoted: msg })
  },

  // ─── .setframe <id> ──────────────────────────────────────────────────────────
  async setframe({ reply, sender, args }) {
    const id = parseInt(args[0])
    if (!id || id < 1 || id > 100) {
      return reply(`🖼️ *SET FRAME*\n\nUsage: *.setframe <1–100>*\n\n• *.frames*   — Page 1 (Basic)\n• *.frames 2* — Page 2 (Anime)\n• *.frames 3* — Page 3 (3D)\n\n_e.g. .setframe 88_ 🖤`)
    }
    const frame  = getFrame(id)
    const result = await db.updateUser(sender, { profile_frame: id })
    if (!result) {
      return reply(`❌ *SETFRAME FAILED*\n\nRun this SQL in Supabase:\n\nALTER TABLE users\n  ADD COLUMN IF NOT EXISTS profile_frame INTEGER DEFAULT 1,\n  ADD COLUMN IF NOT EXISTS profile_pp TEXT DEFAULT NULL,\n  ADD COLUMN IF NOT EXISTS profile_bg TEXT DEFAULT NULL;\n\nThen try *.setframe* again.\n\n_The schema must be updated first._ 🖤`)
    }
    await reply(`✅ *FRAME EQUIPPED*\n\n🖼️ *Frame:* ${frame.name}\n🏷️ *Category:* ${frame.category}\n🔢 *ID:* #${frame.id}\n\nType *.p* to see it on your card.\n\n_Your shadow wears a new crown._ 🖤`)
  },
                                                                              }
