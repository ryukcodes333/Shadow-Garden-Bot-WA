const db = require('../database')
const axios = require('axios')

// ── Media helpers ─────────────────────────────────────────────────────────────
async function genImage(prompt, w = 1024, h = 1024) {
  const seed = Math.floor(Math.random() * 99999)
  const url  = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&model=flux&seed=${seed}`
  const res  = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 })
  return Buffer.from(res.data)
}

async function genVideo(prompt, w = 512, h = 512) {
  const seed = Math.floor(Math.random() * 99999)
  const url  = `https://video.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&seed=${seed}&duration=3`
  const res  = await axios.get(url, { responseType: 'arraybuffer', timeout: 90000 })
  return Buffer.from(res.data)
}

// Try video first → image → plain text
async function sendMedia(sock, jid, msg, vPrompt, iPrompt, caption) {
  try {
    const buf = await genVideo(vPrompt)
    return await sock.sendMessage(jid, { video: buf, caption, gifPlayback: true }, { quoted: msg })
  } catch {}
  try {
    const buf = await genImage(iPrompt)
    return await sock.sendMessage(jid, { image: buf, caption }, { quoted: msg })
  } catch {}
  return sock.sendMessage(jid, { text: caption }, { quoted: msg })
}

// ── Pending marriage proposals ────────────────────────────────────────────────
const pendingProposals = new Map()

// ── GTA RP data ───────────────────────────────────────────────────────────────
const CRIMES = [
  { place:'Downtown Bank',   min:500,   max:5000,   risk:0.35 },
  { place:'Jewelry Store',   min:300,   max:3000,   risk:0.40 },
  { place:'Corner Store',    min:100,   max:1200,   risk:0.25 },
  { place:'Night Club',      min:800,   max:4000,   risk:0.45 },
  { place:'Liquor Store',    min:200,   max:1500,   risk:0.30 },
  { place:'ATM Hack',        min:400,   max:2000,   risk:0.38 },
  { place:'Warehouse Raid',  min:1000,  max:6000,   risk:0.50 },
]
const HEISTS = [
  { name:'Fleeca Bank',          min:5000,   max:20000,  risk:0.45 },
  { name:'Pacific Standard',     min:15000,  max:50000,  risk:0.50 },
  { name:'Diamond Casino Heist', min:20000,  max:80000,  risk:0.55 },
  { name:'Cayo Perico',          min:30000,  max:100000, risk:0.60 },
  { name:'Union Depository',     min:10000,  max:30000,  risk:0.45 },
]
const HUSTLES = [
  { job:'drug run to the harbor',   min:300,  max:1500, risk:0.25 },
  { job:'arms deal behind the lot', min:500,  max:2500, risk:0.35 },
  { job:'sold stolen goods',        min:200,  max:1000, risk:0.20 },
  { job:'counterfeit stack flip',   min:800,  max:4000, risk:0.40 },
  { job:'quick courier delivery',   min:150,  max:700,  risk:0.15 },
]
const CARS = ['Sultan RS','Comet S2','Zentorno','Vagner','Scramjet','Pariah','Reaper','T20','Infernus','Turismo R']
const COP_QUOTES = [
  'This is the LSPD. Drop the weapon and put your hands where I can see them!',
  'You have the right to remain silent. Anything you say will be used against you.',
  'All units, suspect located. Requesting backup at Maze Bank Tower.',
  "Detective Harris here — you just made the worst mistake of your life.",
  "BCSO is ON scene. We don't negotiate with criminals.",
  "Freeze! Nobody has to get hurt tonight. But if you run... we will chase.",
  "Central, suspect is fleeing eastbound on Rockford Hills — all units respond!",
]
const WANTED_LEVELS = [
  { stars:0, label:'😇 Clean',             desc:'No heat. Walk freely.' },
  { stars:1, label:'⭐ Noticed',            desc:'Cops clocking you. Keep moving.' },
  { stars:2, label:'⭐⭐ Suspicious',       desc:'Patrol units tailing you.' },
  { stars:3, label:'⭐⭐⭐ Armed & Dangerous', desc:'SWAT deployed.' },
  { stars:4, label:'⭐⭐⭐⭐ Manhunt',      desc:'FIB + military on your tail.' },
  { stars:5, label:'⭐⭐⭐⭐⭐ PUBLIC ENEMY', desc:'Every agency in San Andreas hunting you.' },
]

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

module.exports = {

  // ─── .newc ────────────────────────────────────────────────────────────────────
  async newc({ reply }) {
    await reply(
      `╭─「 🌑 *NEW COMMANDS* 」─\n│\n` +
      `├─── 🎰 *GAMBLING UPDATES*\n` +
      `├ *.slots* — animated slot machine video 🎰\n` +
      `├ *.blackjack / .bj* — interactive cards + image\n` +
      `├ *.spin* — wheel of fortune video\n` +
      `├ *.roulette* — roulette table video\n` +
      `├ *.horse* — horse racing video\n` +
      `├ *.jackpot* — 50× high-risk video\n` +
      `├ *.highlow / .hl* — hi-lo card game video\n` +
      `├ *.poker* — 5-card draw video\n│\n` +
      `├─── 💍 *SOCIAL*\n` +
      `├ *.marry @user* — propose marriage (with image)\n` +
      `├ *.married* — check marriage status\n` +
      `├ *.divorce* — dissolve your marriage\n│\n` +
      `├─── 🏦 *ECONOMY*\n` +
      `├ *.bs* — bank statement (last 20 transactions)\n│\n` +
      `├─── 🌆 *GTA RP* (all with videos/images)\n` +
      `├ *.crime* — street crime\n` +
      `├ *.heist* — big heist operation\n` +
      `├ *.hustle* — street hustle run\n` +
      `├ *.carjack* — steal a vehicle\n` +
      `├ *.rob @user* — rob a player\n` +
      `├ *.smuggle* — smuggling run\n` +
      `├ *.launder <amount>* — launder dirty cash\n` +
      `├ *.wanted* — check wanted level\n` +
      `├ *.police* — LSPD cop quote\n│\n` +
      `├─── 🤖 *BOT MANAGEMENT*\n` +
      `├ *.join <link>* — bot joins a group [Staff]\n` +
      `├ *.exit* — bot leaves group [Staff]\n│\n` +
      `├─── 🖼️ *PROFILES*\n` +
      `├ *.setbg <video>* — live video bg [Staff/Premium]\n` +
      `├ *.setpp <video>* — video PP [Staff/Premium]\n│\n` +
      `├─── ⚙️ *OWNER*\n` +
      `├ *.setwin <0-100>* — set global win rate\n│\n` +
      `╰─ _Shadow Garden — Always Evolving_ 🖤`
    )
  },

  // ─── .bs ─────────────────────────────────────────────────────────────────────
  async bs({ reply, sender, user, msg }) {
    const mentioned   = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const targetPhone = mentioned.length ? mentioned[0].split('@')[0].split(':')[0] : sender
    const u = (user && targetPhone === sender) ? user : await db.getOrCreateUser(targetPhone)
    if (!u) return reply('❌ User not found.')

    const txns    = await db.getTransactions(targetPhone, 20).catch(() => [])
    const total   = (u.wallet || 0) + (u.bank || 0)
    const joinDate = u.created_at
      ? new Date(u.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
      : 'N/A'
    const lastTxn = txns.length
      ? new Date(txns[0].created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
      : 'No transactions'

    const typeLabel = t => (t.type || 'transfer').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

    const txnLines = txns.length
      ? txns.map((t, i) => {
          const sign = Number(t.amount) >= 0 ? '📈 +' : '📉 '
          const date = new Date(t.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })
          return `│ ${i + 1}. ${sign}${Math.abs(Number(t.amount)).toLocaleString()} Bnhz · ${typeLabel(t)} — ${date}`
        }).join('\n')
      : '│ _No recent transactions found._'

    await reply(
      `🏦 *ACCOUNT STATEMENT*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 *Account:* ${u.name || targetPhone}\n` +
      `🆔 *ID:* ${targetPhone}\n` +
      `💳 *Type:* ${u.premium ? 'Premium ⭐' : 'Standard'}\n` +
      `📅 *Since:* ${joinDate}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💵 *Wallet:* ${(u.wallet||0).toLocaleString()} Bnhz\n` +
      `🏦 *Bank:*   ${(u.bank||0).toLocaleString()} Bnhz\n` +
      `💎 *Gems:*   ${u.gems||0}\n` +
      `📊 *Net Worth:* ${total.toLocaleString()} Bnhz\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *Last 20 Transactions*\n│\n` +
      txnLines + '\n│\n' +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🕒 *Last Activity:* ${lastTxn}\n\n` +
      `> _𝐒𝐇𝚫𝐃𝐎𝐖 𝐆𝚫𝐑𝐃𝚵𝐍 Financial Services_ 🖤`
    )
  },

  // ─── .marry @user ─────────────────────────────────────────────────────────────
  async marry({ sock, msg, jid, sender, user, pushName, reply }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('💍 Usage: *.marry @user*\n\nMention the person you want to propose to!')

    const targetJid   = mentioned[0]
    const targetPhone = targetJid.split('@')[0].split(':')[0]
    if (targetPhone === sender) return reply('❌ You cannot marry yourself! 😂')

    const u = user || await db.getOrCreateUser(sender)
    const t = await db.getOrCreateUser(targetPhone).catch(() => null)

    const myM    = await db.getMarriage(sender).catch(() => null)
    const theirM = await db.getMarriage(targetPhone).catch(() => null)

    if (myM)    return reply(`💔 You're already married!\n💍 Partner: *${myM.proposer_phone === sender ? myM.target_name : myM.proposer_name}*\nType *.divorce* to end it first.`)
    if (theirM) return reply(`💔 *${t?.name || targetPhone}* is already married to someone else!`)

    await reply('💍 *Generating proposal...*')

    let imgBuf = null
    try {
      imgBuf = await genImage(
        `romantic anime wedding proposal cherry blossoms magical night sky sparkling diamond ring warm golden light cinematic anime art ultra HD beautiful`
      )
    } catch {}

    const caption =
      `💍 *MARRIAGE PROPOSAL*\n\n` +
      `💌 *${u?.name || pushName || sender}* is proposing to *${t?.name || targetPhone}*!\n\n` +
      `🌹 *"Will you marry me? 💍"*\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `@${targetPhone} — *Quote this message* and reply:\n\n` +
      `✅ *yes* — Accept\n` +
      `❌ *no* — Decline\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `_You have 5 minutes to respond._ ⏳`

    let sentMsg
    if (imgBuf) sentMsg = await sock.sendMessage(jid, { image: imgBuf, caption, mentions: [targetJid] }, { quoted: msg })
    else sentMsg = await sock.sendMessage(jid, { text: caption, mentions: [targetJid] }, { quoted: msg })

    const stanzaId = sentMsg?.key?.id
    if (stanzaId) {
      pendingProposals.set(`${jid}:${stanzaId}`, {
        proposer: sender, proposerName: u?.name || pushName || sender,
        target: targetPhone, targetJid, targetName: t?.name || targetPhone, jid,
      })
      setTimeout(() => {
        const key = `${jid}:${stanzaId}`
        if (pendingProposals.has(key)) {
          pendingProposals.delete(key)
          sock.sendMessage(jid, { text: `💔 The proposal from @${sender} expired with no response.`, mentions: [`${sender}@s.whatsapp.net`] }).catch(() => {})
        }
      }, 5 * 60 * 1000)
    }
  },

  // Called from index.js when user quotes the proposal message
  async handleMarriageResponse({ sock, msg, jid, sender, textRaw }) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo
    if (!ctx?.stanzaId) return false

    const key      = `${jid}:${ctx.stanzaId}`
    const proposal = pendingProposals.get(key)
    if (!proposal || proposal.target !== sender) return false

    const ans = textRaw.trim().toLowerCase()
    if (!['yes','no','yeah','nope','nah','yep','nah'].includes(ans)) return false

    pendingProposals.delete(key)
    const accepted = ['yes','yeah','yep'].includes(ans)

    if (!accepted) {
      await sock.sendMessage(jid, {
        text: `💔 *PROPOSAL DECLINED*\n\n@${sender} said *no* to @${proposal.proposer}.\n\n_Better luck next time._ 😢`,
        mentions: [`${proposal.proposer}@s.whatsapp.net`, `${sender}@s.whatsapp.net`],
      }, { quoted: msg })
      return true
    }

    await db.createMarriage(proposal.proposer, proposal.proposerName, proposal.target, proposal.targetName).catch(() => {})

    let imgBuf = null
    try {
      imgBuf = await genImage(
        `beautiful anime wedding ceremony two characters white wedding dress tuxedo flowers confetti magical sparkles romantic sunset ultra HD cinematic anime art`
      )
    } catch {}

    const caption =
      `💍 *IT'S A WEDDING!* 🎊\n\n` +
      `👰 *${proposal.proposerName}* & *${proposal.targetName}* are now married!\n\n` +
      `💌 @${proposal.proposer} × @${proposal.target}\n\n` +
      `🕊️ *May your journey together be blessed!*\n\n` +
      `💎 *.married* — view your certificate\n` +
      `💔 *.divorce* — dissolve the marriage\n\n` +
      `> _𝐒𝐇𝚫𝐃𝐎𝐖 𝐆𝚫𝐑𝐃𝚵𝐍 Registry_ 🖤`

    const mentions = [`${proposal.proposer}@s.whatsapp.net`, `${proposal.target}@s.whatsapp.net`]
    if (imgBuf) await sock.sendMessage(jid, { image: imgBuf, caption, mentions }, { quoted: msg })
    else await sock.sendMessage(jid, { text: caption, mentions }, { quoted: msg })
    return true
  },

  // ─── .married ─────────────────────────────────────────────────────────────────
  async married({ reply, sender, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const target    = mentioned.length ? mentioned[0].split('@')[0].split(':')[0] : sender
    const m         = await db.getMarriage(target).catch(() => null)
    if (!m) return reply(`💔 *${target === sender ? 'You are' : target + ' is'} not married.*\n\nPropose with *.marry @user* 💍`)

    const since = m.married_since
      ? new Date(m.married_since).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
      : 'Unknown'
    const days  = m.married_since ? Math.floor((Date.now() - new Date(m.married_since).getTime()) / 86400000) : 0

    await reply(
      `💍 *MARRIAGE CERTIFICATE*\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 *${m.proposer_name}* × @${m.proposer_phone}\n` +
      `💑 married to\n` +
      `👤 *${m.target_name}* × @${m.target_phone}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💌 *Married Since:* ${since}\n` +
      `❤️ *Together:* ${days} day(s)\n` +
      `🕊️ *Status:* Happily Married 💕\n\n` +
      `> _𝐒𝐇𝚫𝐃𝐎𝐖 𝐆𝚫𝐑𝐃𝚵𝐍 Registry_ 🖤`
    )
  },

  // ─── .divorce ─────────────────────────────────────────────────────────────────
  async divorce({ reply, sender }) {
    const m = await db.getMarriage(sender).catch(() => null)
    if (!m) return reply('💔 You are not married.')
    const partner = m.proposer_phone === sender ? m.target_name : m.proposer_name
    await db.deleteMarriage(sender).catch(() => {})
    await reply(`💔 *DIVORCE FINALIZED*\n\nYour marriage with *${partner}* has been dissolved.\n\n_The shadow garden records all separations._ 🖤`)
  },

  // ─── .join <link> ─────────────────────────────────────────────────────────────
  async join({ sock, reply, args, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const link = args[0]
    if (!link) return reply('⚠️ Usage: *.join <invite link>*\n\nExample: .join https://chat.whatsapp.com/AbCd1234')
    try {
      const code = link.includes('chat.whatsapp.com/')
        ? link.split('chat.whatsapp.com/')[1].split(/[?/ ]/)[0]
        : link.trim()
      await sock.groupAcceptInvite(code)
      await reply(`✅ *Bot joined successfully!*\n\n🔗 Code: \`${code}\`\n\n_The shadow expands._ 🖤`)
    } catch (err) {
      await reply(`❌ Failed to join: ${err.message}\n\nCheck the link is valid and not expired.`)
    }
  },

  // ─── .exit ────────────────────────────────────────────────────────────────────
  async exit({ sock, jid, reply, isOwner, isMod, isGuardian, isGroup }) {
    if (!isGroup) return reply('❌ Use this inside a group.')
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    await reply(`👋 *Bot leaving this group...*\n\n_Goodbye from Shadow Garden._ 🖤`)
    setTimeout(async () => { try { await sock.groupLeave(jid) } catch {} }, 2000)
  },

  // ════════════════════════════════════════════════════════════════════════════
  // GTA RP — ALL produce videos/images via pollinations
  // ════════════════════════════════════════════════════════════════════════════

  // ─── .crime ───────────────────────────────────────────────────────────────────
  async crime({ sock, msg, jid, sender, user, reply }) {
    const u = user || await db.getOrCreateUser(sender)
    const cdLeft = await db.getCooldown(sender, 'crime').catch(() => 0)
    if (cdLeft > 0) {
      const mins = Math.floor(cdLeft / 60000), secs = Math.floor((cdLeft % 60000) / 1000)
      return reply(`🚔 *Laying low!* Police are watching.\n⏳ Try again in *${mins}m ${secs}s*`)
    }

    const c      = rand(CRIMES)
    const caught = Math.random() < c.risk
    const earned = caught ? 0 : randInt(c.min, c.max)
    const fine   = caught ? randInt(100, 500) : 0
    const net    = earned - fine
    const newWal = Math.max(0, (u.wallet || 0) + net)

    await db.updateUser(sender, { wallet: newWal })
    await db.setCooldown(sender, 'crime', 15 * 60).catch(() => {})
    await db.logTransaction(sender, caught ? 'crime_caught' : 'crime_success', net, 0).catch(() => {})

    const successOuts = [
      'Slipped past the cameras and cleaned out the register.',
      'In and out in 3 minutes. No witnesses.',
      'Security guard was sleeping on the job. Easy.',
      'Your boys held the door. Smooth operation.',
    ]
    const caughtOuts = [
      'Silent alarm triggered. You ran empty-handed.',
      'LSPD was waiting. You barely escaped but dropped the bag.',
      'Someone snitched. Cops were already there.',
      'Dye pack exploded. Useless cash everywhere.',
    ]

    const caption = caught
      ? `🚨 *BUSTED!*\n\n📍 *Location:* ${c.place}\n\n_${rand(caughtOuts)}_\n\n💸 Fine: *-${fine.toLocaleString()} Bnhz*\n💵 Balance: *${newWal.toLocaleString()} Bnhz*\n\n> ⭐ Wanted Level +1\n⏳ Cooldown: 15 min`
      : `🔫 *CRIME SUCCESSFUL*\n\n📍 *${c.place}*\n💰 Loot: *+${earned.toLocaleString()} Bnhz*\n\n_${rand(successOuts)}_\n\n💵 Balance: *${newWal.toLocaleString()} Bnhz*\n⏳ Cooldown: 15 min`

    const vP = caught
      ? 'GTA V style police chase city night neon lights suspect running dramatic cinematic animation'
      : 'GTA V style successful heist robbery getaway car speeding city night neon lights animation'
    const iP = caught
      ? 'GTA V city police chase suspect neon night dramatic'
      : 'GTA V robbery success getaway car city neon night cinematic'
    await sendMedia(sock, jid, msg, vP, iP, caption)
  },

  // ─── .heist ───────────────────────────────────────────────────────────────────
  async heist({ sock, msg, jid, sender, user, reply }) {
    const u = user || await db.getOrCreateUser(sender)
    const cdLeft = await db.getCooldown(sender, 'heist').catch(() => 0)
    if (cdLeft > 0) {
      const hrs = Math.floor(cdLeft / 3600000), mins = Math.floor((cdLeft % 3600000) / 60000)
      return reply(`🚨 *Cops still hot on your trail.*\n⏳ Next heist in: *${hrs}h ${mins}m*`)
    }

    const h       = rand(HEISTS)
    const success = Math.random() > h.risk
    const earned  = success ? randInt(h.min, h.max) : 0
    const fine    = success ? 0 : randInt(500, 2000)
    const net     = earned - fine
    const newWal  = Math.max(0, (u.wallet || 0) + net)

    await db.updateUser(sender, { wallet: newWal })
    await db.setCooldown(sender, 'heist', 60 * 60).catch(() => {})
    await db.logTransaction(sender, success ? 'heist_success' : 'heist_fail', net, 0).catch(() => {})

    const caption = success
      ? `💣 *HEIST COMPLETE!*\n\n🏢 *Target:* ${h.name}\n💰 *Your Cut:* +${earned.toLocaleString()} Bnhz\n\n_Crew executed flawlessly. Legends._\n\n💵 Balance: *${newWal.toLocaleString()} Bnhz*\n⏳ Cooldown: 1 hour`
      : `💣 *HEIST FAILED*\n\n🏢 *Target:* ${h.name}\n💥 Crew got arrested. You barely escaped.\n💸 Bail+Damages: *-${fine.toLocaleString()} Bnhz*\n\n💵 Balance: *${newWal.toLocaleString()} Bnhz*\n> ⭐⭐⭐⭐ Wanted\n⏳ Cooldown: 1 hour`

    const vP = success
      ? `GTA 5 heist success ${h.name} vault robbery gang cinematic explosion animation`
      : `GTA 5 heist fail police raid SWAT explosion city night dramatic animation`
    const iP = success
      ? `GTA 5 heist vault robbery success gold coins cinematic`
      : `GTA 5 heist fail police bust dramatic`
    await sendMedia(sock, jid, msg, vP, iP, caption)
  },

  // ─── .hustle ──────────────────────────────────────────────────────────────────
  async hustle({ sock, msg, jid, sender, user, reply }) {
    const u = user || await db.getOrCreateUser(sender)
    const cdLeft = await db.getCooldown(sender, 'hustle').catch(() => 0)
    if (cdLeft > 0) {
      const mins = Math.floor(cdLeft / 60000)
      return reply(`🌆 *Still on the block.*\n⏳ Next hustle in *${mins}m*`)
    }

    const h      = rand(HUSTLES)
    const busted = Math.random() < h.risk
    const earned = busted ? 0 : randInt(h.min, h.max)
    const fine   = busted ? randInt(200, 800) : 0
    const net    = earned - fine
    const newWal = Math.max(0, (u.wallet || 0) + net)

    await db.updateUser(sender, { wallet: newWal })
    await db.setCooldown(sender, 'hustle', 20 * 60).catch(() => {})
    await db.logTransaction(sender, 'hustle', net, 0).catch(() => {})

    const caption = busted
      ? `🚓 *HUSTLE BUSTED*\n\n💊 *Job:* ${h.job}\n_Narcs were watching the block._\n💸 *-${fine.toLocaleString()} Bnhz*\n💵 Balance: *${newWal.toLocaleString()} Bnhz*\n⏳ Cooldown: 20 min`
      : `💰 *HUSTLE COMPLETE*\n\n💊 *Job:* ${h.job}\n_Smooth transaction. No heat._\n💰 *+${earned.toLocaleString()} Bnhz*\n💵 Balance: *${newWal.toLocaleString()} Bnhz*\n⏳ Cooldown: 20 min`

    const vP = busted
      ? 'GTA V street bust undercover police arrest dealer night city animation'
      : 'GTA V street deal success dark alley city neon animation'
    const iP = busted
      ? 'GTA V street bust police city night dramatic'
      : 'GTA V street deal success neon alley night'
    await sendMedia(sock, jid, msg, vP, iP, caption)
  },

  // ─── .carjack ─────────────────────────────────────────────────────────────────
  async carjack({ sock, msg, jid, sender, user, reply }) {
    const u = user || await db.getOrCreateUser(sender)
    const cdLeft = await db.getCooldown(sender, 'carjack').catch(() => 0)
    if (cdLeft > 0) {
      const mins = Math.floor(cdLeft / 60000)
      return reply(`🚗 *Too hot right now.*\n⏳ Try in *${mins}m*`)
    }

    const car     = rand(CARS)
    const success = Math.random() > 0.35
    const earned  = success ? randInt(1000, 8000) : 0
    const fine    = success ? 0 : randInt(200, 600)
    const net     = earned - fine
    const newWal  = Math.max(0, (u.wallet || 0) + net)

    await db.updateUser(sender, { wallet: newWal })
    await db.setCooldown(sender, 'carjack', 20 * 60).catch(() => {})
    await db.logTransaction(sender, success ? 'carjack_success' : 'carjack_fail', net, 0).catch(() => {})

    const caption = success
      ? `🚗 *CARJACKED!*\n\n🔑 Boosted a *${car}*\n_Drove straight to the chop shop. Clean._\n💰 *+${earned.toLocaleString()} Bnhz*\n💵 Balance: *${newWal.toLocaleString()} Bnhz*\n⏳ Cooldown: 20 min`
      : `🚗 *FAILED!*\n\n🔑 Target: *${car}*\n_Owner fought back. You ran on foot._\n💸 Hospital: *-${fine.toLocaleString()} Bnhz*\n💵 Balance: *${newWal.toLocaleString()} Bnhz*\n⏳ Cooldown: 20 min`

    const vP = success
      ? `GTA V carjacking ${car} style night city escape speed dramatic animation`
      : `GTA V failed carjack running on foot police city night animation`
    const iP = success
      ? `GTA V luxury sports car stolen city night cinematic`
      : `GTA V failed carjack beaten up city night`
    await sendMedia(sock, jid, msg, vP, iP, caption)
  },

  // ─── .rob @user ───────────────────────────────────────────────────────────────
  async rob({ sock, msg, jid, sender, user, reply }) {
    const u = user || await db.getOrCreateUser(sender)
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.rob @user*')

    const cdLeft = await db.getCooldown(sender, 'rob').catch(() => 0)
    if (cdLeft > 0) {
      const mins = Math.floor(cdLeft / 60000)
      return reply(`🔫 *Laying low after the last job.*\n⏳ Next rob in *${mins}m*`)
    }

    const targetPhone = mentioned[0].split('@')[0].split(':')[0]
    if (targetPhone === sender) return reply("❌ You can't rob yourself!")

    const t = await db.getOrCreateUser(targetPhone).catch(() => null)
    if (!t || (t.wallet || 0) < 100) return reply('❌ That person is too broke to rob!')

    const success = Math.random() > 0.45
    const maxSteal = Math.floor((t.wallet || 0) * 0.30)
    const stolen   = success ? randInt(100, Math.max(100, maxSteal)) : 0
    const fine     = success ? 0 : randInt(100, 500)
    const net      = stolen - fine
    const newWal   = Math.max(0, (u.wallet || 0) + net)

    if (success) {
      await db.updateUser(sender,      { wallet: newWal })
      await db.updateUser(targetPhone, { wallet: Math.max(0, (t.wallet || 0) - stolen) })
      await db.logTransaction(sender, 'rob_gain', stolen, 0).catch(() => {})
    } else {
      await db.updateUser(sender, { wallet: newWal })
      await db.logTransaction(sender, 'rob_fail', -fine, 0).catch(() => {})
    }
    await db.setCooldown(sender, 'rob', 30 * 60).catch(() => {})

    const caption = success
      ? `🔪 *ROBBERY SUCCESS!*\n\n💰 Took *${stolen.toLocaleString()} Bnhz* from @${targetPhone}\n_They never saw it coming._\n\n💵 Your Balance: *${newWal.toLocaleString()} Bnhz*\n⏳ Cooldown: 30 min`
      : `🔪 *ROBBERY FAILED!*\n\n😤 @${targetPhone} fought back and called the cops!\n💸 *-${fine.toLocaleString()} Bnhz*\n💵 Balance: *${newWal.toLocaleString()} Bnhz*\n⏳ Cooldown: 30 min`

    const vP = success
      ? 'GTA V street robbery mugging success alley night animation'
      : 'GTA V failed robbery backfire beaten up police city animation'
    const iP = success
      ? 'GTA V street robbery success city alley night cinematic'
      : 'GTA V failed robbery beaten up city night'
    await sendMedia(sock, jid, msg, vP, iP, caption)
  },

  // ─── .smuggle ─────────────────────────────────────────────────────────────────
  async smuggle({ sock, msg, jid, sender, user, reply }) {
    const u = user || await db.getOrCreateUser(sender)
    const cdLeft = await db.getCooldown(sender, 'smuggle').catch(() => 0)
    if (cdLeft > 0) {
      const mins = Math.floor(cdLeft / 60000)
      return reply(`📦 *Shipment still in transit.*\n⏳ Try in *${mins}m*`)
    }

    const goods   = ['weapons','exotic animals','gold bars','counterfeit cash','tech hardware','uncut diamonds','luxury watches']
    const cargo   = rand(goods)
    const success = Math.random() > 0.40
    const earned  = success ? randInt(2000, 15000) : 0
    const fine    = success ? 0 : randInt(1000, 5000)
    const net     = earned - fine
    const newWal  = Math.max(0, (u.wallet || 0) + net)

    await db.updateUser(sender, { wallet: newWal })
    await db.setCooldown(sender, 'smuggle', 30 * 60).catch(() => {})
    await db.logTransaction(sender, 'smuggle', net, 0).catch(() => {})

    const caption = success
      ? `📦 *SMUGGLE SUCCESSFUL*\n\n📦 Cargo: *${cargo}*\n_Nobody checks the false floor._\n💰 *+${earned.toLocaleString()} Bnhz*\n💵 Balance: *${newWal.toLocaleString()} Bnhz*\n⏳ Cooldown: 30 min`
      : `📦 *INTERCEPTED*\n\n📦 Cargo: *${cargo}*\n_Customs flagged the shipment._\n💸 Seized+Fined: *-${fine.toLocaleString()} Bnhz*\n💵 Balance: *${newWal.toLocaleString()} Bnhz*\n⏳ Cooldown: 30 min`

    const vP = success
      ? 'GTA V smuggling docks boat night successful cargo delivery cinematic animation'
      : 'GTA V customs police confiscate smuggling dock bust dramatic animation'
    const iP = success
      ? 'GTA V smuggling docks boat night cargo cinematic'
      : 'GTA V smuggling bust customs police dock dramatic'
    await sendMedia(sock, jid, msg, vP, iP, caption)
  },

  // ─── .launder <amount> ────────────────────────────────────────────────────────
  async launder({ sock, msg, jid, sender, user, args, reply }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount < 500) return reply('⚠️ Usage: *.launder <amount>*\n\nMinimum: 500 Bnhz')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough! You have *${(u.wallet||0).toLocaleString()} Bnhz*`)

    const fee     = Math.floor(amount * 0.25)
    const cleaned = amount - fee
    const newWal  = Math.max(0, (u.wallet || 0) - amount + cleaned)
    const newBank = (u.bank || 0) + cleaned

    await db.updateUser(sender, { wallet: newWal, bank: newBank })
    await db.logTransaction(sender, 'launder', -fee, amount).catch(() => {})

    const caption =
      `🧺 *MONEY LAUNDERED*\n\n` +
      `💵 Dirty Cash: *${amount.toLocaleString()} Bnhz*\n` +
      `✂️ Laundry Fee (25%): *-${fee.toLocaleString()} Bnhz*\n` +
      `🏦 Clean Cash (Bank): *+${cleaned.toLocaleString()} Bnhz*\n\n` +
      `_Through the car wash, nightclub, and casino. All legit._\n\n` +
      `🏦 Bank: *${newBank.toLocaleString()} Bnhz*`

    const vP = 'GTA V money laundering nightclub cash washing business legitimate cinematic animation'
    const iP = 'GTA V nightclub money laundering cash dramatic cinematic art'
    await sendMedia(sock, jid, msg, vP, iP, caption)
  },

  // ─── .wanted ──────────────────────────────────────────────────────────────────
  async wanted({ reply, sender, user }) {
    const u      = user || await db.getOrCreateUser(sender)
    const crimes = await db.getTransactions(sender, 50).catch(() => [])
    const crimeTypes = ['crime_success','crime_caught','heist_success','heist_fail','hustle','carjack_success','carjack_fail','rob_gain','rob_fail','smuggle','launder']
    const count  = crimes.filter(t => crimeTypes.some(c => t.type?.includes(c.split('_')[0]))).length
    const stars  = Math.min(5, Math.floor(count / 3))
    const level  = WANTED_LEVELS[stars]
    await reply(
      `🚔 *WANTED LEVEL*\n\n` +
      `👤 *${u.name || sender}*\n\n` +
      `${stars > 0 ? '⭐'.repeat(stars) + ' ' : ''}*${level.label}*\n` +
      `📋 ${level.desc}\n\n` +
      `🔫 Crimes on record: *${count}*\n\n` +
      `_Every shadow has a record._ 🖤`
    )
  },

  // ─── .police ──────────────────────────────────────────────────────────────────
  async police({ reply }) {
    const officers = ['Officer Martinez','Detective Harris','Sgt. Williams','Officer Chen','Lt. Rodriguez','Det. Brooks']
    const officer  = rand(officers)
    await reply(`🚔 *${officer} says:*\n\n"${rand(COP_QUOTES)}"\n\n_You have the right to remain fabulous._ 🖤`)
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  ███████╗   COMMANDS  ██████╗
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── .rep @user ───────────────────────────────────────────────────────────────
  async rep({ sock, msg, jid, sender, pushName, reply }) {
    const fs = require('fs')
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⭐ Usage: *.rep @user*\nGive someone reputation points! (once every 8h)')

    const targetPhone = mentioned[0].split('@')[0].split(':')[0]
    if (targetPhone === sender) return reply('❌ You cannot rep yourself!')

    const REP_FILE = './rep_cooldowns.json'
    let data = {}
    try { data = JSON.parse(fs.readFileSync(REP_FILE, 'utf8')) } catch {}

    const key      = `${sender}:${targetPhone}`
    const lastRep  = data[key] || 0
    const cooldown = 8 * 60 * 60 * 1000
    const elapsed  = Date.now() - lastRep

    if (elapsed < cooldown) {
      const left = cooldown - elapsed
      const h    = Math.floor(left / 3600000)
      const m    = Math.floor((left % 3600000) / 60000)
      return reply(`⏳ You already repped this person!\n\n⏱️ Cooldown: *${h}h ${m}m* remaining`)
    }

    const target = await db.getOrCreateUser(targetPhone)
    const newRep  = (target?.reputation || 0) + 1
    await db.updateUser(targetPhone, { reputation: newRep })

    data[key] = Date.now()
    try { fs.writeFileSync(REP_FILE, JSON.stringify(data)) } catch {}

    const tiers = [
      [100,'💜 Legendary'],
      [50, '💙 Elite'],
      [25, '💚 Respected'],
      [10, '💛 Rising'],
      [0,  '🤍 New'],
    ]
    const tier = tiers.find(([min]) => newRep >= min)?.[1] || '🤍 New'

    await reply(
      `⭐ *REPUTATION GIVEN*\n\n` +
      `👤 *From:* ${pushName || sender}\n` +
      `🎯 *To:* ${target?.name || targetPhone}\n\n` +
      `📊 *Total Rep:* ${newRep} ⭐\n` +
      `🏅 *Tier:* ${tier}\n\n` +
      `_Reputation builds legacies._ 🖤`
    )
  },

  // ─── .richlist ────────────────────────────────────────────────────────────────
  async richlist({ sock, msg, jid, reply }) {
    await reply('💰 *Fetching the richest players...*')
    const top = await db.getRichList(10).catch(() => [])
    if (!top || !top.length) return reply('❌ No data found.')

    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟']
    const lines  = top.map((u, i) => {
      const net = (u.wallet || 0) + (u.bank || 0)
      return `${medals[i]} *${u.name || u.phone}* — ${net.toLocaleString()} Bnhz`
    }).join('\n')

    const caption =
      `💎 *RICHLIST — TOP 10*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      lines + '\n\n' +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_Shadow Garden Financial Elite_ 🖤`

    const iP = 'luxury penthouse gold coins money stacks elite wealthy lifestyle cinematic art ultra HD'
    try {
      const buf = await genImage(iP)
      return sock.sendMessage(jid, { image: buf, caption }, { quoted: msg })
    } catch {}
    return sock.sendMessage(jid, { text: caption }, { quoted: msg })
  },

  // ─── .report @user <reason> ───────────────────────────────────────────────────
  async report({ sock, msg, jid, sender, pushName, args, reply }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('🚨 Usage: *.report @user <reason>*')
    const reason      = args.filter(a => !a.includes('@')).join(' ').trim() || 'No reason provided'
    const targetPhone = mentioned[0].split('@')[0].split(':')[0]
    if (targetPhone === sender) return reply('❌ Cannot report yourself.')

    const target   = await db.getOrCreateUser(targetPhone).catch(() => null)
    const OWNER_NUM = '259683117985842'
    const ownerJid  = `${OWNER_NUM}@s.whatsapp.net`

    const reportTxt =
      `🚨 *PLAYER REPORT*\n\n` +
      `📋 *Reporter:* ${pushName || sender} (${sender})\n` +
      `🎯 *Reported:* ${target?.name || targetPhone} (${targetPhone})\n` +
      `📝 *Reason:* ${reason}\n` +
      `🕒 *Time:* ${new Date().toLocaleString()}\n\n` +
      `_Review at your earliest convenience._`

    try { await sock.sendMessage(ownerJid, { text: reportTxt }) } catch {}

    await reply(
      `✅ *REPORT SUBMITTED*\n\n` +
      `🎯 *Against:* ${target?.name || targetPhone}\n` +
      `📝 *Reason:* ${reason}\n\n` +
      `_Staff has been notified. Thank you._ 🖤`
    )
  },

  // ─── .rename <new name> ───────────────────────────────────────────────────────
  async rename({ reply, sender, args }) {
    if (!args.length) return reply('✏️ Usage: *.rename <new name>*\n\nExample: *.rename Shadow King*')
    const name = args.join(' ').slice(0, 32).trim()
    if (name.length < 2) return reply('❌ Name must be at least 2 characters.')
    await db.updateUser(sender, { name })
    await reply(
      `✅ *NAME UPDATED*\n\n` +
      `📛 *New name:* ${name}\n\n` +
      `_Your legend, your name._ 🖤`
    )
  },

  // ─── .rules ───────────────────────────────────────────────────────────────────
  async rules({ reply }) {
    await reply(
      `📜 *SHADOW GARDEN — RULES*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `*1.* 🚫 No spamming commands or flooding the chat.\n` +
      `*2.* 🤝 Respect all members — no toxic behaviour.\n` +
      `*3.* 🔞 No NSFW content unless in a designated group.\n` +
      `*4.* 💸 No scamming or exploiting bot bugs for gain.\n` +
      `*5.* 🛡️ Follow staff instructions without argument.\n` +
      `*6.* 🔗 No advertising other groups or bots.\n` +
      `*7.* 🎮 No abuse of economy commands (alts, exploits).\n` +
      `*8.* 📵 No DM harassment of members or staff.\n` +
      `*9.* 🗣️ Keep discussions in the right channels.\n` +
      `*10.* ⚖️ Staff decisions are final.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_Break the rules, face the ban hammer._ 🖤`
    )
  },

  // ─── .revive (GTA RP) ─────────────────────────────────────────────────────────
  async revive({ sock, msg, jid, sender, pushName, reply }) {
    const u       = await db.getOrCreateUser(sender)
    const cost    = 500
    const wallet  = u?.wallet || 0
    if (wallet < cost) return reply(`❌ Need *${cost.toLocaleString()} Bnhz* to call a medic. You have *${wallet.toLocaleString()}*.`)

    await db.updateUser(sender, { wallet: wallet - cost })
    await db.logTransaction(sender, 'revive', -cost, cost).catch(() => {})

    const caption =
      `🚑 *MEDIC CALLED*\n\n` +
      `👤 *${pushName || sender}* called EMS after getting wrecked.\n` +
      `💊 Patched up and back on the streets.\n` +
      `💸 Medical Bill: *-${cost.toLocaleString()} Bnhz*\n\n` +
      `💰 Wallet: *${(wallet - cost).toLocaleString()} Bnhz*\n\n` +
      `_Death is temporary. The grind is forever._ 🖤`

    const vP = 'GTA V ambulance medic emergency respawn cinematic night city dramatic animation'
    const iP = 'GTA V ambulance EMS medic responding dramatic cinematic city lights'
    await sendMedia(sock, jid, msg, vP, iP, caption)
  },

  // ─── .rankup ──────────────────────────────────────────────────────────────────
  async rankup({ reply, sender, user }) {
    const u       = user || await db.getOrCreateUser(sender)
    const level   = u?.level   || 1
    const xp      = u?.xp      || 0
    const needed  = level * 1000
    const pct     = Math.min(100, Math.floor((xp / needed) * 100))
    const filled  = Math.floor(pct / 5)
    const bar     = '█'.repeat(filled) + '░'.repeat(20 - filled)

    const rankTitles = [
      [50, '👑 Shadow Legend'],
      [40, '💜 Shadow Elite'],
      [30, '💙 Shadow Master'],
      [20, '💚 Shadow Knight'],
      [10, '💛 Shadow Warrior'],
      [1,  '🤍 Shadow Recruit'],
    ]
    const rankTitle = rankTitles.find(([min]) => level >= min)?.[1] || '🤍 Shadow Recruit'

    await reply(
      `📊 *RANK PROGRESS*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 *${u?.name || sender}*\n` +
      `🏆 *Rank:* ${rankTitle}\n\n` +
      `⚡ *Level:* ${level}\n` +
      `✨ *XP:* ${xp.toLocaleString()} / ${needed.toLocaleString()}\n\n` +
      `[${bar}] ${pct}%\n\n` +
      `${pct >= 100
        ? '🎉 *READY TO LEVEL UP!* Use *.levelup* to advance.'
        : `📈 *${(needed - xp).toLocaleString()} XP* needed for Level ${level + 1}`
      }\n\n` +
      `_The grind never stops._ 🖤`
    )
  },

  // ─── .restock (GTA RP) ────────────────────────────────────────────────────────
  async restock({ sock, msg, jid, sender, pushName, args, reply }) {
    const SUPPLY_PACKS = [
      { name:'Weapons Cache',     cost:2000,  reward:randInt(3000,8000),  risk:0.30 },
      { name:'Drug Batch',        cost:1500,  reward:randInt(2500,7000),  risk:0.35 },
      { name:'Stolen Electronics',cost:1000,  reward:randInt(1500,5000),  risk:0.25 },
      { name:'Contraband Run',    cost:3000,  reward:randInt(5000,15000), risk:0.40 },
      { name:'Hot Cars',          cost:2500,  reward:randInt(4000,12000), risk:0.35 },
    ]
    const pack    = rand(SUPPLY_PACKS)
    const u       = await db.getOrCreateUser(sender)
    const wallet  = u?.wallet || 0
    if (wallet < pack.cost) return reply(`❌ Need *${pack.cost.toLocaleString()} Bnhz* for restock. You have *${wallet.toLocaleString()}*.`)

    await db.updateUser(sender, { wallet: wallet - pack.cost })
    const busted  = Math.random() < pack.risk
    let caption, vP, iP

    if (busted) {
      await db.logTransaction(sender, 'restock_bust', -pack.cost, pack.cost).catch(() => {})
      caption =
        `📦 *RESTOCK BUSTED!*\n\n` +
        `👤 *${pushName || sender}* tried to move a *${pack.name}*.\n\n` +
        `🚔 Feds intercepted the shipment. Everything seized.\n` +
        `💸 Lost: *${pack.cost.toLocaleString()} Bnhz*\n\n` +
        `💰 Wallet: *${(wallet - pack.cost).toLocaleString()} Bnhz*\n\n` +
        `_Supply chain is a dangerous game._ 🖤`
      vP = 'GTA V police bust drug seizure dramatic FBI raid cinematic animation night city'
      iP = 'GTA V police bust supply seizure FBI dramatic cinematic dark'
    } else {
      const profit = pack.reward
      const newWallet = wallet - pack.cost + profit
      await db.updateUser(sender, { wallet: newWallet })
      await db.logTransaction(sender, 'restock_success', profit - pack.cost, pack.cost).catch(() => {})
      caption =
        `📦 *RESTOCK SUCCESS!*\n\n` +
        `👤 *${pushName || sender}* moved a *${pack.name}*.\n\n` +
        `💸 Investment: *${pack.cost.toLocaleString()} Bnhz*\n` +
        `💰 Revenue: *+${profit.toLocaleString()} Bnhz*\n` +
        `📈 Profit: *+${(profit - pack.cost).toLocaleString()} Bnhz*\n\n` +
        `💰 Wallet: *${newWallet.toLocaleString()} Bnhz*\n\n` +
        `_Business is booming._ 🖤`
      vP = 'GTA V warehouse supply delivery business operation cinematic night city animation'
      iP = 'GTA V warehouse supply delivery operation business cinematic dark'
    }

    await sendMedia(sock, jid, msg, vP, iP, caption)
  },

  // ─── .radio ───────────────────────────────────────────────────────────────────
  async radio({ reply }) {
    const STATIONS = [
      {
        name: '🎵 Radio Los Santos',
        songs: [
          '"Hood Gone Love It" — Jay Rock',
          '"Compton" — Kendrick Lamar ft. MC Eiht',
          '"Bands" — Future',
          '"Messed Up" — Don Trip',
          '"Bounce" — DOM Kennedy',
        ],
        vibe: 'West Coast hip-hop all day.',
      },
      {
        name: '🎸 Los Santos Rock Radio',
        songs: [
          '"Go Your Own Way" — Fleetwood Mac',
          '"Born to Run" — Bruce Springsteen',
          '"Runnin\' with the Devil" — Van Halen',
          '"Don\'t Stop Me Now" — Queen',
          '"Eye of the Tiger" — Survivor',
        ],
        vibe: 'Classic rock, no skips.',
      },
      {
        name: '🎧 Non-Stop-Pop FM',
        songs: [
          '"Call Me Maybe" — Carly Rae Jepsen',
          '"Roar" — Katy Perry',
          '"Titanium" — David Guetta ft. Sia',
          '"We Found Love" — Rihanna',
          '"Blurred Lines" — Robin Thicke',
        ],
        vibe: 'Pop bangers 24/7.',
      },
      {
        name: '💿 FlyLo FM',
        songs: [
          '"Zodiac Shit" — Flying Lotus',
          '"Never Catch Me" — Flying Lotus ft. Kendrick',
          '"Siren" — Thundercat',
          '"MmmHmm" — Flying Lotus ft. Kendrick',
          '"See Thru to U" — Flying Lotus ft. Erykah Badu',
        ],
        vibe: 'Cosmic jazz-hop. For the thinkers.',
      },
      {
        name: '🌙 Space 1031',
        songs: [
          '"Space Cowboy" — Steve Miller Band',
          '"Major Tom" — Peter Schilling',
          '"Rocket Man" — Elton John',
          '"Space Oddity" — David Bowie',
          '"Starman" — David Bowie',
        ],
        vibe: 'Floating through the galaxy.',
      },
      {
        name: '🔊 Blaine County Radio',
        songs: [
          '"Achy Breaky Heart" — Billy Ray Cyrus',
          '"Friends in Low Places" — Garth Brooks',
          '"Take Me Home, Country Roads" — John Denver',
          '"The Devil Went Down to Georgia" — Charlie Daniels',
          '"Ring of Fire" — Johnny Cash',
        ],
        vibe: 'Country roads, Sandy Shores vibes.',
      },
    ]

    const station = rand(STATIONS)
    const song    = rand(station.songs)

    await reply(
      `📻 *NOW PLAYING*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📡 *Station:* ${station.name}\n` +
      `🎵 *Track:* ${song}\n\n` +
      `💬 _${station.vibe}_\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_Cruising through Los Santos at 3AM._ 🖤`
    )
  },

  // ─── .remind <mins> <message> ─────────────────────────────────────────────────
  async remind({ sock, msg, jid, sender, senderJid, args, reply }) {
    if (args.length < 2) return reply('⏰ Usage: *.remind <minutes> <message>*\n\nExample: *.remind 10 Check my crypto*')
    const mins = parseInt(args[0])
    if (isNaN(mins) || mins < 1 || mins > 1440)
      return reply('❌ Minutes must be between *1* and *1440* (24h).')
    const message = args.slice(1).join(' ').trim()
    if (!message) return reply('❌ Please include a message.')

    const ms = mins * 60 * 1000
    const hm = mins >= 60
      ? `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ''}`.trim()
      : `${mins}m`

    await reply(`⏰ *REMINDER SET*\n\n📝 _${message}_\n⏱️ I'll remind you in *${hm}*. 🖤`)

    setTimeout(async () => {
      try {
        await sock.sendMessage(jid, {
          text: `⏰ *REMINDER!*\n\n@${sender}\n📝 _${message}_\n\n_${hm} ago you asked me to remind you._ 🖤`,
          mentions: [senderJid || `${sender}@s.whatsapp.net`],
        })
      } catch {}
    }, ms)
  },

  // ══════════════════════════════════════════════════════════════════════
  // ░█▀▄░░░  .R  COMMANDS  BLOCK  (16-50)  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  // ══════════════════════════════════════════════════════════════════════

  // ─── .rcmds ───────────────────────────────────────────────────────────────────
  async rcmds({ reply }) {
    await reply(
      `╭─「 🔤 *R COMMANDS* (50 total) 」─\n│\n` +
      `├─── 💬 *SOCIAL*\n` +
      `├ *.rep @user* — give rep (8h cd)\n` +
      `├ *.repcheck [@user]* — view rep score\n` +
      `├ *.replist* — top 10 rep leaderboard\n` +
      `├ *.report @user <reason>* — report a player\n` +
      `├ *.rename <name>* — change display name\n` +
      `├ *.ring @user* — ping someone in chat\n` +
      `├ *.rip @user* — RIP post with image\n` +
      `├ *.roast @user* — roast someone\n` +
      `├ *.rizz @user* — send a rizz line\n` +
      `├ *.rate <thing>* — rate anything /10\n` +
      `├ *.rant <topic>* — rant about a topic\n│\n` +
      `├─── 🎮 *FUN / GAMES*\n` +
      `├ *.riddle* — random riddle\n` +
      `├ *.random* — random interesting fact\n` +
      `├ *.roll <NdN>* — dice roller (e.g. 2d6)\n` +
      `├ *.rng <min> <max>* — random number\n` +
      `├ *.rhyme <word>* — find rhymes\n` +
      `├ *.reverse <text>* — flip text\n` +
      `├ *.rap <text>* — rap-ify your text\n` +
      `├ *.rotate <text>* — scramble letters\n│\n` +
      `├─── 💰 *ECONOMY*\n` +
      `├ *.richlist* — top 10 richest players\n` +
      `├ *.rankup* — XP progress to next level\n` +
      `├ *.rent* — collect daily passive income\n` +
      `├ *.reward* — open daily reward chest\n` +
      `├ *.raffle* — enter daily raffle (200 Bnhz)\n` +
      `├ *.recap* — today's earnings summary\n` +
      `├ *.refill* — buy energy refill (1000 Bnhz)\n│\n` +
      `├─── 🌆 *GTA RP*\n` +
      `├ *.rob @user* — rob a player\n` +
      `├ *.restock* — move supply pack\n` +
      `├ *.revive* — call EMS (500 Bnhz)\n` +
      `├ *.run* — flee cops on foot\n` +
      `├ *.rescue* — hostage rescue mission\n` +
      `├ *.riot* — join a street riot\n` +
      `├ *.roadtrip* — road trip across SA\n` +
      `├ *.race [@user]* — street race\n` +
      `├ *.robbery* — armed robbery operation\n` +
      `├ *.revenge @user* — retaliation mission\n` +
      `├ *.rush* — ambush raid\n` +
      `├ *.rave* — nightclub rave event\n` +
      `├ *.resetwanted* — clear wanted level\n│\n` +
      `├─── 🎵 *MISC*\n` +
      `├ *.radio* — GTA radio station\n` +
      `├ *.remind <m> <msg>* — timed reminder\n` +
      `├ *.rules* — bot/group rules\n│\n` +
      `├─── 🛡️ *STAFF / OWNER*\n` +
      `├ *.reload* — confirm commands [Staff]\n` +
      `├ *.resetstreak @user* — reset streak [Staff]\n` +
      `├ *.refund @user <amt>* — refund Bnhz [Staff]\n` +
      `├ *.remap <prefix>* — change bot prefix [Owner]\n│\n` +
      `╰─ _.rcmds for this list anytime_ 🖤`
    )
  },

  // ─── .roast @user ─────────────────────────────────────────────────────────────
  async roast({ sock, msg, jid, sender, pushName, reply }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const targetPhone = mentioned.length ? mentioned[0].split('@')[0].split(':')[0] : null
    if (!targetPhone) return reply('🔥 Usage: *.roast @user*')
    if (targetPhone === sender) return reply('😂 Roasting yourself? Bold move. Fine:\n\n_You peaked in your own imagination._ 🖤')

    const target = await db.getOrCreateUser(targetPhone).catch(() => null)
    const name   = target?.name || targetPhone

    const ROASTS = [
      `${name} still uses Internet Explorer unironically.`,
      `${name}'s WiFi password is written on a sticky note that fell off.`,
      `${name} thinks 2+2 is a loading screen.`,
      `${name} looked up "how to look smart" and got 0 results.`,
      `${name}'s GPS says "turn around" when they walk in a room.`,
      `${name} got outsmarted by a captcha. Twice.`,
      `${name} called tech support for their microwave.`,
      `${name}'s poker face is just a confused face.`,
      `${name} tried to download more RAM and it worked — that's how basic they are.`,
      `${name} thinks "AFK" means "Absolutely Fine, King".`,
      `${name}'s bank account has trust issues too.`,
      `${name} gets carried in games AND in conversations.`,
    ]
    const roast   = rand(ROASTS)
    const caption = `🔥 *ROASTED*\n\n💀 @${targetPhone}\n\n"${roast}"\n\n_Compliments of ${pushName || sender}._ 🖤`

    const iP = 'GTA V character laughing roasting dramatic cinematic fire street art'
    try {
      const buf = await genImage(iP)
      return sock.sendMessage(jid, { image: buf, caption, mentions: [`${targetPhone}@s.whatsapp.net`] }, { quoted: msg })
    } catch {}
    return sock.sendMessage(jid, { text: caption, mentions: [`${targetPhone}@s.whatsapp.net`] }, { quoted: msg })
  },

  // ─── .rizz @user ──────────────────────────────────────────────────────────────
  async rizz({ sock, msg, jid, sender, pushName, reply }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('💘 Usage: *.rizz @user*')
    const targetPhone = mentioned[0].split('@')[0].split(':')[0]
    const target = await db.getOrCreateUser(targetPhone).catch(() => null)
    const name   = target?.name || targetPhone

    const LINES = [
      `Are you a bank loan? Because you've got my interest.`,
      `Do you have a map? I keep getting lost in your vibe.`,
      `Are you Wi-Fi? Because I'm feeling a connection.`,
      `Is your name Google? Because you've got everything I've been searching for.`,
      `Do you believe in love at first swipe, or should I DM again?`,
      `You must be made of copper and tellurium, because you're CuTe.`,
      `Are you a parking ticket? Because you've got "fine" written all over you.`,
      `If you were a vegetable, you'd be a cute-cumber.`,
      `Do you have a charger? Because you just powered up my entire day.`,
      `Are you a keyboard? Because you're just my type.`,
    ]
    const line    = rand(LINES)
    const caption = `💘 *${pushName || sender}* to *${name}*:\n\n"${line}"\n\n_Rizz level: MAX_ 🖤`

    const iP = 'romantic anime couple moonlight cherry blossoms soft glowing lights cinematic ultra HD'
    try {
      const buf = await genImage(iP)
      return sock.sendMessage(jid, { image: buf, caption, mentions: [`${targetPhone}@s.whatsapp.net`] }, { quoted: msg })
    } catch {}
    return sock.sendMessage(jid, { text: caption, mentions: [`${targetPhone}@s.whatsapp.net`] }, { quoted: msg })
  },

  // ─── .ring @user ──────────────────────────────────────────────────────────────
  async ring({ sock, msg, jid, sender, pushName, reply }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('📞 Usage: *.ring @user*\nPing someone in the chat.')
    const targetPhone = mentioned[0].split('@')[0].split(':')[0]
    const target = await db.getOrCreateUser(targetPhone).catch(() => null)
    await sock.sendMessage(jid, {
      text: `📞 *INCOMING CALL*\n\n☎️ *From:* ${pushName || sender}\n📲 *To:* @${targetPhone}\n\n_${target?.name || targetPhone}, you've been rung. Pick up._ 🖤`,
      mentions: [`${targetPhone}@s.whatsapp.net`],
    }, { quoted: msg })
  },

  // ─── .rip @user ───────────────────────────────────────────────────────────────
  async rip({ sock, msg, jid, sender, pushName, reply }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const targetPhone = mentioned.length ? mentioned[0].split('@')[0].split(':')[0] : sender
    const target = await db.getOrCreateUser(targetPhone).catch(() => null)
    const name   = target?.name || targetPhone

    const EPITAPHS = [
      'They logged off for the last time.',
      'Here lies their dignity. Lost in a gambling session.',
      'They went all-in. They lost.',
      'Gone but not forgotten — mostly forgotten.',
      'Died doing what they loved: getting roasted.',
      'Rest easy. The Wi-Fi is better up there.',
    ]
    const caption =
      `🪦 *R.I.P.*\n\n` +
      `💀 *${name}*\n` +
      `📅 _${new Date().getFullYear()}_\n\n` +
      `"${rand(EPITAPHS)}"\n\n` +
      `_Farewell from ${pushName || sender}._ 🖤`

    const iP = 'gravestone cemetery moonlight dramatic cinematic dark anime art RIP tombstone foggy'
    try {
      const buf = await genImage(iP)
      return sock.sendMessage(jid, { image: buf, caption, mentions: [`${targetPhone}@s.whatsapp.net`] }, { quoted: msg })
    } catch {}
    return sock.sendMessage(jid, { text: caption, mentions: [`${targetPhone}@s.whatsapp.net`] }, { quoted: msg })
  },

  // ─── .rate <thing> ────────────────────────────────────────────────────────────
  async rate({ args, reply, pushName }) {
    if (!args.length) return reply('⭐ Usage: *.rate <anything>*\n\nExample: *.rate Shadow Garden*')
    const thing  = args.join(' ')
    const score  = Math.floor(Math.random() * 11)
    const bars   = ['█'.repeat(score) + '░'.repeat(10 - score)]
    const emojis = ['💀','😬','😐','🤔','😏','😊','😎','🔥','💎','⭐','👑']
    await reply(
      `⭐ *RATING*\n\n` +
      `📋 *"${thing}"*\n\n` +
      `[${bars}] ${score}/10\n` +
      `${emojis[score]} ${score >= 8 ? 'Absolutely elite.' : score >= 5 ? 'Decent, could be worse.' : score >= 3 ? 'Needs work.' : 'Yikes.'}\n\n` +
      `_Rated by ${pushName || 'Shadow AI'}_ 🖤`
    )
  },

  // ─── .rant <topic> ────────────────────────────────────────────────────────────
  async rant({ args, reply }) {
    const topic = args.join(' ') || 'everything'
    const RANTS = [
      `Nobody EVER talks about how ${topic} just ruins the whole vibe. Every single time.`,
      `I'm DONE with ${topic}. Completely done. It's been years and nothing has improved.`,
      `Can we PLEASE talk about ${topic}? Because everyone's just ignoring the obvious problem here.`,
      `${topic} is genuinely one of the worst things to happen in recent memory. Change my mind.`,
      `The disrespect around ${topic} is unreal. People just don't think before they act anymore.`,
      `${topic}? AGAIN? At this point I'm convinced it's personal.`,
      `If I have to deal with ${topic} one more time, I am logging off permanently. Enough is enough.`,
    ]
    await reply(`😤 *RANT MODE*\n\n🎤 "${rand(RANTS)}"\n\n_Shadow Garden Rant Hotline — always open._ 🖤`)
  },

  // ─── .riddle ──────────────────────────────────────────────────────────────────
  async riddle({ sock, msg, jid, reply }) {
    const RIDDLES = [
      { q:'I speak without a mouth and hear without ears. I have no body but come alive with wind. What am I?', a:'An echo' },
      { q:'The more you take, the more you leave behind. What am I?', a:'Footsteps' },
      { q:'I have cities, but no houses live there. Mountains, but no trees. Water, but no fish. Roads, but no cars. What am I?', a:'A map' },
      { q:'What has hands but can\'t clap?', a:'A clock' },
      { q:'The more you share me, the less you have. What am I?', a:'A secret' },
      { q:'I\'m not alive, but I can grow. I don\'t have lungs, but I need air. What am I?', a:'Fire' },
      { q:'What can travel around the world while staying in a corner?', a:'A stamp' },
      { q:'What has one eye but can\'t see?', a:'A needle' },
      { q:'What gets wetter the more it dries?', a:'A towel' },
      { q:'What has teeth but can\'t bite?', a:'A comb' },
    ]
    const { q, a } = rand(RIDDLES)
    const sent = await sock.sendMessage(jid, { text: `🧠 *RIDDLE*\n\n❓ "${q}"\n\n_Answer reveals in 30 seconds..._ 🖤` }, { quoted: msg })
    setTimeout(() => {
      sock.sendMessage(jid, { text: `💡 *ANSWER*\n\n✅ "${a}"` }, { quoted: sent }).catch(() => {})
    }, 30000)
  },

  // ─── .random ──────────────────────────────────────────────────────────────────
  async random({ reply }) {
    const FACTS = [
      'A group of flamingos is called a "flamboyance."',
      'Honey never spoils. Archaeologists found 3000-year-old honey in Egyptian tombs.',
      'Octopuses have three hearts, blue blood, and nine brains.',
      'A day on Venus is longer than a year on Venus.',
      'Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid.',
      'The human body contains enough carbon to make 900 pencils.',
      'Bananas are slightly radioactive due to potassium-40.',
      'There are more possible chess games than atoms in the observable universe.',
      'Sharks are older than trees — they\'ve existed for over 450 million years.',
      'Scotland\'s national animal is the unicorn.',
      'A bolt of lightning is five times hotter than the surface of the sun.',
      'Crows can recognize and remember human faces.',
      'The shortest war in history was between Britain and Zanzibar in 1896 — it lasted 38 minutes.',
      'Wombats produce cube-shaped poop. The only animal known to do so.',
      'There are more stars in the universe than grains of sand on all of Earth\'s beaches.',
    ]
    await reply(`🎲 *RANDOM FACT*\n\n💡 _${rand(FACTS)}_\n\n_Shadow Garden — knowledge is power._ 🖤`)
  },

  // ─── .roll <NdN> ──────────────────────────────────────────────────────────────
  async roll({ args, reply }) {
    const raw = args[0] || '1d6'
    const match = raw.match(/^(\d+)d(\d+)$/i)
    if (!match) return reply('🎲 Usage: *.roll <NdN>*\n\nExample: *.roll 2d6* or *.roll 1d20*')
    const count = Math.min(parseInt(match[1]), 20)
    const sides = Math.min(parseInt(match[2]), 100)
    if (count < 1 || sides < 2) return reply('❌ Invalid dice. Try something like *.roll 2d6*')

    const rolls  = Array.from({ length: count }, () => randInt(1, sides))
    const total  = rolls.reduce((s, r) => s + r, 0)
    const isNat  = count === 1 && sides === 20 && total === 20

    await reply(
      `🎲 *DICE ROLL* — ${count}d${sides}\n\n` +
      `${rolls.map(r => `[${r}]`).join(' ')}\n\n` +
      `📊 *Total:* ${total}\n` +
      `${isNat ? '\n🌟 *NATURAL 20! LEGENDARY ROLL!*' : ''}\n` +
      `_Fortune favours the bold._ 🖤`
    )
  },

  // ─── .rng <min> <max> ─────────────────────────────────────────────────────────
  async rng({ args, reply }) {
    if (args.length < 2) return reply('🎰 Usage: *.rng <min> <max>*\n\nExample: *.rng 1 100*')
    const min = parseInt(args[0])
    const max = parseInt(args[1])
    if (isNaN(min) || isNaN(max) || min >= max) return reply('❌ Give two valid numbers where min < max.')
    const result = randInt(min, max)
    await reply(`🎰 *RANDOM NUMBER*\n\n📊 Range: ${min} — ${max}\n\n🎯 *Result: ${result}*\n\n_The algorithm has spoken._ 🖤`)
  },

  // ─── .rhyme <word> ────────────────────────────────────────────────────────────
  async rhyme({ args, reply }) {
    if (!args.length) return reply('🎵 Usage: *.rhyme <word>*\n\nExample: *.rhyme shadow*')
    const word  = args[0].toLowerCase()
    const RHYME_SETS = {
      shadow: ['meadow','window','fellow','yellow','mellow','pillow','hollow'],
      night:  ['light','right','fight','sight','bright','white','height'],
      fire:   ['higher','wire','hire','prior','desire','entire','inspire'],
      gold:   ['bold','cold','hold','old','told','sold','mold'],
      dark:   ['mark','spark','lark','park','bark','stark','remark'],
      love:   ['dove','above','shove','glove','of'],
      life:   ['wife','knife','strife','rife'],
    }
    const rhymes = RHYME_SETS[word] || []
    if (rhymes.length) {
      await reply(`🎵 *RHYMES FOR "${word.toUpperCase()}"*\n\n${rhymes.map(r => `• ${r}`).join('\n')}\n\n_Drop a bar._ 🖤`)
    } else {
      const vowel  = word[word.length - 1]
      const fakes  = ['night','light','right','fight','might','bright','white'].filter(r => r !== word)
      await reply(`🎵 *RHYMES FOR "${word.toUpperCase()}"*\n\n${fakes.slice(0,5).map(r => `• ${r}`).join('\n')}\n\n_These might not be perfect — I'm a bot, not Drake._ 🖤`)
    }
  },

  // ─── .reverse <text> ──────────────────────────────────────────────────────────
  async reverse({ args, reply }) {
    if (!args.length) return reply('🔄 Usage: *.reverse <text>*')
    const original = args.join(' ')
    const reversed = original.split('').reverse().join('')
    await reply(`🔄 *REVERSED*\n\n📝 Original: _${original}_\n🔄 Flipped:  _${reversed}_\n\n🖤`)
  },

  // ─── .rap <text> ──────────────────────────────────────────────────────────────
  async rap({ args, reply, pushName }) {
    if (!args.length) return reply('🎤 Usage: *.rap <your bars>*\n\nExample: *.rap I run this city*')
    const bars = args.join(' ')
    const HOOKS = [
      'Yeah, yeah, uh',
      'Listen up, pay attention',
      'Shadow Garden on the beat',
      'No cap, straight facts',
      'They don\'t want this smoke',
    ]
    const OUTROS = [
      '(drops mic)',
      '— ${pushName}, 2025',
      '(crowd goes wild)',
      '— straight from the Garden',
      '(beat fades)',
    ]
    await reply(
      `🎤 *RAP VERSE*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `_${rand(HOOKS)}_\n\n` +
      `"${bars}"\n\n` +
      `_${rand(OUTROS).replace('${pushName}', pushName || 'Unknown')}_\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎵 _Shadow Garden Records_ 🖤`
    )
  },

  // ─── .rotate <text> ───────────────────────────────────────────────────────────
  async rotate({ args, reply }) {
    if (!args.length) return reply('🔃 Usage: *.rotate <text>*')
    const text = args.join(' ')
    const MAP  = {
      a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ı',j:'ɾ',
      k:'ʞ',l:'l',m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',
      u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z',
      A:'∀',B:'ᗺ',C:'Ɔ',D:'ᗡ',E:'Ǝ',F:'Ⅎ',G:'פ',H:'H',I:'I',J:'ſ',
      K:'ʞ',L:'˥',M:'W',N:'N',O:'O',P:'Ԁ',Q:'Q',R:'ᴚ',S:'S',T:'┴',
      U:'∩',V:'Λ',W:'M',X:'X',Y:'⅄',Z:'Z',
      '!':'¡','?':'¿',',':'\'','\'':',','.':'˙',
    }
    const flipped = text.split('').map(c => MAP[c] || c).reverse().join('')
    await reply(`🔃 *ROTATED*\n\n📝 ${text}\n🔃 ${flipped}\n\n🖤`)
  },

  // ─── .repcheck [@user] ────────────────────────────────────────────────────────
  async repcheck({ msg, sender, user, pushName, reply }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const targetPhone = mentioned.length ? mentioned[0].split('@')[0].split(':')[0] : sender
    const u = (targetPhone === sender && user) ? user : await db.getOrCreateUser(targetPhone)
    if (!u) return reply('❌ User not found.')
    const rep = u.reputation || 0
    const tiers = [[100,'💜 Legendary'],[50,'💙 Elite'],[25,'💚 Respected'],[10,'💛 Rising'],[0,'🤍 New']]
    const tier  = tiers.find(([min]) => rep >= min)?.[1] || '🤍 New'
    await reply(
      `⭐ *REPUTATION*\n\n` +
      `👤 *${u.name || targetPhone}*\n` +
      `📊 *Rep:* ${rep} ⭐\n` +
      `🏅 *Tier:* ${tier}\n\n` +
      `_Reputation is everything._ 🖤`
    )
  },

  // ─── .replist ─────────────────────────────────────────────────────────────────
  async replist({ sock, msg, jid, reply }) {
    await reply('⭐ *Fetching rep leaderboard...*')
    const { data } = await db.supabase.from('users').select('name,phone,reputation').order('reputation', { ascending: false }).limit(10)
    if (!data || !data.length) return reply('❌ No rep data found.')
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟']
    const lines  = data.map((u, i) => `${medals[i]} *${u.name || u.phone}* — ${u.reputation || 0} ⭐`).join('\n')
    await sock.sendMessage(jid, {
      text: `⭐ *REP LEADERBOARD — TOP 10*\n━━━━━━━━━━━━━━━━━━━━\n\n${lines}\n\n━━━━━━━━━━━━━━━━━━━━\n_Build your legacy._ 🖤`
    }, { quoted: msg })
  },

  // ─── .rent ────────────────────────────────────────────────────────────────────
  async rent({ reply, sender, user }) {
    const u       = user || await db.getOrCreateUser(sender)
    const COOLKEY = `rent:${sender}`
    const last    = await db.getCooldown(COOLKEY).catch(() => null)
    const COOLMS  = 20 * 60 * 60 * 1000
    if (last && (Date.now() - new Date(last).getTime()) < COOLMS) {
      const left = COOLMS - (Date.now() - new Date(last).getTime())
      const h    = Math.floor(left / 3600000)
      const m    = Math.floor((left % 3600000) / 60000)
      return reply(`🏠 Rent already collected!\n\n⏱️ Next collection in: *${h}h ${m}m*`)
    }
    const level   = u?.level || 1
    const base    = 200
    const income  = base + (level * 50) + (u?.premium ? 500 : 0)
    const newBank = (u?.bank || 0) + income
    await db.updateUser(sender, { bank: newBank })
    await db.setCooldown(COOLKEY, new Date().toISOString())
    await db.logTransaction(sender, 'rent', income, 0).catch(() => {})
    await reply(
      `🏠 *RENT COLLECTED*\n\n` +
      `💰 Income: *+${income.toLocaleString()} Bnhz*\n` +
      `${u?.premium ? '⭐ Premium bonus: +500 Bnhz\n' : ''}` +
      `🏦 Bank: *${newBank.toLocaleString()} Bnhz*\n\n` +
      `_Passive income. That's the move._ 🖤`
    )
  },

  // ─── .reward ──────────────────────────────────────────────────────────────────
  async reward({ reply, sender, user }) {
    const COOLKEY = `reward:${sender}`
    const last    = await db.getCooldown(COOLKEY).catch(() => null)
    const COOLMS  = 23 * 60 * 60 * 1000
    if (last && (Date.now() - new Date(last).getTime()) < COOLMS) {
      const left = COOLMS - (Date.now() - new Date(last).getTime())
      const h    = Math.floor(left / 3600000)
      const m    = Math.floor((left % 3600000) / 60000)
      return reply(`🎁 Already claimed today!\n\n⏱️ Next reward in: *${h}h ${m}m*`)
    }
    const REWARDS = [
      { label:'💰 Bnhz Pouch',    type:'wallet',  amount: randInt(500, 2000)  },
      { label:'🏦 Bank Deposit',   type:'bank',    amount: randInt(1000, 5000) },
      { label:'💎 Gem Shard',      type:'gems',    amount: randInt(1, 5)       },
      { label:'💰 Fat Stack',      type:'wallet',  amount: randInt(3000, 8000) },
      { label:'🎰 Jackpot Crumb',  type:'wallet',  amount: randInt(8000,15000) },
    ]
    const reward = rand(REWARDS)
    const u      = user || await db.getOrCreateUser(sender)
    const update = { [reward.type]: (u?.[reward.type] || 0) + reward.amount }
    await db.updateUser(sender, update)
    await db.setCooldown(COOLKEY, new Date().toISOString())
    await db.logTransaction(sender, 'daily_reward', reward.amount, 0).catch(() => {})
    await reply(
      `🎁 *DAILY REWARD*\n\n` +
      `🎉 You received: *${reward.label}*\n` +
      `💸 Amount: *+${reward.amount.toLocaleString()} ${reward.type === 'gems' ? 'Gems' : 'Bnhz'}*\n\n` +
      `_Come back tomorrow for another chest._ 🖤`
    )
  },

  // ─── .raffle ──────────────────────────────────────────────────────────────────
  async raffle({ reply, sender, user }) {
    const TICKET = 200
    const u      = user || await db.getOrCreateUser(sender)
    if ((u?.wallet || 0) < TICKET) return reply(`❌ Need *${TICKET} Bnhz* for a raffle ticket.\nYour wallet: *${u?.wallet || 0} Bnhz*`)

    const COOLKEY = `raffle:${sender}`
    const last    = await db.getCooldown(COOLKEY).catch(() => null)
    const COOLMS  = 6 * 60 * 60 * 1000
    if (last && (Date.now() - new Date(last).getTime()) < COOLMS) {
      const left = COOLMS - (Date.now() - new Date(last).getTime())
      const h    = Math.floor(left / 3600000)
      const m    = Math.floor((left % 3600000) / 60000)
      return reply(`🎟️ You already have a ticket!\n\n⏱️ Next entry in: *${h}h ${m}m*`)
    }

    await db.updateUser(sender, { wallet: (u.wallet || 0) - TICKET })
    await db.setCooldown(COOLKEY, new Date().toISOString())

    const WON      = Math.random() < 0.25
    const PRIZES   = [800, 1500, 3000, 5000, 10000, 25000]
    const prize    = rand(PRIZES)

    if (WON) {
      const newWallet = (u.wallet - TICKET) + prize
      await db.updateUser(sender, { wallet: newWallet })
      await db.logTransaction(sender, 'raffle_win', prize - TICKET, TICKET).catch(() => {})
      await reply(
        `🎟️ *RAFFLE — WINNER!*\n\n` +
        `🎉 You won the draw!\n` +
        `💸 Ticket: *-${TICKET} Bnhz*\n` +
        `🏆 Prize: *+${prize.toLocaleString()} Bnhz*\n` +
        `📈 Net: *+${(prize - TICKET).toLocaleString()} Bnhz*\n\n` +
        `💰 Wallet: *${newWallet.toLocaleString()} Bnhz*\n\n` +
        `_Luck favours the bold._ 🖤`
      )
    } else {
      await db.logTransaction(sender, 'raffle_loss', -TICKET, TICKET).catch(() => {})
      await reply(
        `🎟️ *RAFFLE — NO WIN*\n\n` +
        `😔 Your ticket didn't hit this time.\n` +
        `💸 Lost: *${TICKET} Bnhz*\n\n` +
        `_Try again in 6h._ 🖤`
      )
    }
  },

  // ─── .recap ───────────────────────────────────────────────────────────────────
  async recap({ reply, sender }) {
    const txns   = await db.getTransactions(sender, 50).catch(() => [])
    const today  = new Date().toDateString()
    const todayT = txns.filter(t => new Date(t.created_at).toDateString() === today)
    const gained = todayT.filter(t => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0)
    const lost   = todayT.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
    const net    = gained - lost
    const u      = await db.getOrCreateUser(sender)

    await reply(
      `📊 *TODAY'S RECAP*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📅 *${today}*\n\n` +
      `📈 *Earned:*  +${gained.toLocaleString()} Bnhz\n` +
      `📉 *Spent:*   -${lost.toLocaleString()} Bnhz\n` +
      `📊 *Net:*     ${net >= 0 ? '+' : ''}${net.toLocaleString()} Bnhz\n\n` +
      `🎯 *Transactions today:* ${todayT.length}\n` +
      `💰 *Wallet:* ${(u?.wallet || 0).toLocaleString()} Bnhz\n` +
      `🏦 *Bank:*   ${(u?.bank || 0).toLocaleString()} Bnhz\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${net >= 0 ? '💚 _In the green today._' : '🔴 _Down today. Bounce back tomorrow._'} 🖤`
    )
  },

  // ─── .refill ──────────────────────────────────────────────────────────────────
  async refill({ reply, sender, user }) {
    const COST = 1000
    const u    = user || await db.getOrCreateUser(sender)
    if ((u?.wallet || 0) < COST) return reply(`❌ Need *${COST.toLocaleString()} Bnhz* for an energy refill.\nWallet: *${(u?.wallet || 0).toLocaleString()} Bnhz*`)
    const newWallet = (u.wallet || 0) - COST
    await db.updateUser(sender, { wallet: newWallet, energy_refills: (u.energy_refills || 0) + 1 })
    await db.logTransaction(sender, 'energy_refill', -COST, COST).catch(() => {})
    await reply(
      `⚡ *ENERGY REFILLED*\n\n` +
      `💸 Cost: *-${COST.toLocaleString()} Bnhz*\n` +
      `⚡ Your daily command limits have been reset.\n` +
      `💰 Wallet: *${newWallet.toLocaleString()} Bnhz*\n\n` +
      `_Back in action._ 🖤`
    )
  },

  // ─── .run (GTA RP) ────────────────────────────────────────────────────────────
  async run({ sock, msg, jid, sender, pushName }) {
    const ESCAPES = [
      { desc:'sprinted through back alleys',        success:0.55 },
      { desc:'jumped rooftop to rooftop downtown',  success:0.50 },
      { desc:'stole a bicycle and pedalled hard',   success:0.60 },
      { desc:'hid in a dumpster behind the diner',  success:0.65 },
      { desc:'dove into the Los Santos River',      success:0.45 },
    ]
    const escape  = rand(ESCAPES)
    const escaped = Math.random() < escape.success

    if (escaped) {
      const reward = randInt(200, 800)
      const u      = await db.getOrCreateUser(sender)
      await db.updateUser(sender, { wallet: (u?.wallet || 0) + reward })
      await db.logTransaction(sender, 'run_escape', reward, 0).catch(() => {})
      const caption =
        `🏃 *ESCAPED!*\n\n` +
        `👤 *${pushName || sender}* ${escape.desc} and lost the cops!\n\n` +
        `💰 Adrenaline bonus: *+${reward.toLocaleString()} Bnhz*\n\n` +
        `_Nobody catches a Shadow._ 🖤`
      const vP = 'GTA V character running sprinting escaping police chase cinematic dramatic night city animation'
      const iP = 'GTA V character running from police city night escape dramatic cinematic'
      return sendMedia(sock, jid, msg, vP, iP, caption)
    } else {
      const fine = randInt(300, 900)
      const u    = await db.getOrCreateUser(sender)
      const nw   = Math.max(0, (u?.wallet || 0) - fine)
      await db.updateUser(sender, { wallet: nw })
      await db.logTransaction(sender, 'run_caught', -fine, fine).catch(() => {})
      const caption =
        `🚔 *CAUGHT!*\n\n` +
        `👤 *${pushName || sender}* tried to ${escape.desc} but got tackled.\n\n` +
        `💸 Fine: *-${fine.toLocaleString()} Bnhz*\n\n` +
        `_Should've run faster._ 🖤`
      const vP = 'GTA V police arrest tackle handcuffed dramatic night city cinematic animation'
      const iP = 'GTA V police arrest dramatic cinematic dark night'
      return sendMedia(sock, jid, msg, vP, iP, caption)
    }
  },

  // ─── .rescue (GTA RP) ─────────────────────────────────────────────────────────
  async rescue({ sock, msg, jid, sender, pushName }) {
    const OPS = [
      { name:'Fleeca Vault Extraction',   min:2000, max:9000,  risk:0.40 },
      { name:'Hostage Swap in Vinewood',  min:3000, max:12000, risk:0.45 },
      { name:'Prison Break Pickup',       min:5000, max:20000, risk:0.50 },
      { name:'Underground Bunker Breach', min:4000, max:15000, risk:0.45 },
      { name:'Rooftop Extraction',        min:2500, max:10000, risk:0.35 },
    ]
    const op     = rand(OPS)
    const u      = await db.getOrCreateUser(sender)
    const cost   = randInt(500, 1500)
    if ((u?.wallet || 0) < cost) {
      const vP = 'GTA V tactical extraction helicopter rooftop dramatic night cinematic animation'
      const iP = 'GTA V helicopter extraction tactical rooftop dramatic cinematic'
      return sendMedia(sock, jid, msg, vP, iP, `❌ Need at least *${cost.toLocaleString()} Bnhz* for gear.\nWallet: *${(u?.wallet||0).toLocaleString()} Bnhz*`)
    }
    const busted  = Math.random() < op.risk
    await db.updateUser(sender, { wallet: (u.wallet || 0) - cost })

    let caption, vP, iP
    if (!busted) {
      const reward = randInt(op.min, op.max)
      await db.updateUser(sender, { wallet: (u.wallet - cost) + reward })
      await db.logTransaction(sender, 'rescue_success', reward - cost, cost).catch(() => {})
      caption = `🚁 *RESCUE COMPLETE!*\n\n👤 *${pushName || sender}* pulled off *${op.name}*!\n\n💸 Gear cost: *-${cost.toLocaleString()} Bnhz*\n💰 Payout: *+${reward.toLocaleString()} Bnhz*\n📈 Net: *+${(reward-cost).toLocaleString()} Bnhz*\n\n_Precision operation._ 🖤`
      vP = 'GTA V helicopter rescue extraction tactical night city rooftop dramatic cinematic animation success'
      iP = 'GTA V helicopter rescue tactical extraction dramatic success cinematic'
    } else {
      await db.logTransaction(sender, 'rescue_fail', -cost, cost).catch(() => {})
      caption = `💥 *RESCUE FAILED!*\n\n👤 *${pushName || sender}* attempted *${op.name}* but got ambushed!\n\n💸 Lost gear: *-${cost.toLocaleString()} Bnhz*\n\n_Abort. Abort._ 🖤`
      vP = 'GTA V tactical failure explosion ambush dramatic cinematic night animation'
      iP = 'GTA V ambush explosion failure dramatic cinematic dark'
    }
    await sendMedia(sock, jid, msg, vP, iP, caption)
  },

  // ─── .riot (GTA RP) ───────────────────────────────────────────────────────────
  async riot({ sock, msg, jid, sender, pushName }) {
    const u   = await db.getOrCreateUser(sender)
    const won = Math.random() > 0.40
    if (won) {
      const loot = randInt(1000, 5000)
      await db.updateUser(sender, { wallet: (u?.wallet || 0) + loot })
      await db.logTransaction(sender, 'riot_loot', loot, 0).catch(() => {})
      const caption = `🔥 *RIOT SURVIVOR!*\n\n👤 *${pushName || sender}* looted the streets during the chaos!\n\n💰 Street Loot: *+${loot.toLocaleString()} Bnhz*\n\n_You can't stop what's already in motion._ 🖤`
      return sendMedia(sock, jid, msg, 'GTA V street riot chaos looting crowds fire dramatic night cinematic animation', 'GTA V riot fire chaos street dramatic cinematic dark night', caption)
    } else {
      const lost = randInt(200, 1000)
      await db.updateUser(sender, { wallet: Math.max(0, (u?.wallet || 0) - lost) })
      await db.logTransaction(sender, 'riot_loss', -lost, lost).catch(() => {})
      const caption = `🚔 *RIOT — PINNED DOWN*\n\n👤 *${pushName || sender}* got caught in the crossfire and took losses.\n\n💸 Damage: *-${lost.toLocaleString()} Bnhz*\n\n_Not every riot is worth joining._ 🖤`
      return sendMedia(sock, jid, msg, 'GTA V riot police suppression tear gas dramatic night cinematic animation', 'GTA V riot police suppression dramatic dark cinematic', caption)
    }
  },

  // ─── .roadtrip (GTA RP) ───────────────────────────────────────────────────────
  async roadtrip({ sock, msg, jid, sender, pushName }) {
    const ROUTES = [
      { from:'Los Santos', to:'Sandy Shores',    reward:randInt(500,2000),  event:'ran a red light and outran the sheriffs' },
      { from:'Vinewood',   to:'Paleto Bay',       reward:randInt(800,3000),  event:'picked up a mysterious hitchhiker who paid well' },
      { from:'Del Perro',  to:'Chumash',          reward:randInt(300,1500),  event:'stumbled onto a drug deal and watched safely from the car' },
      { from:'LSIA',       to:'Mount Chiliad',    reward:randInt(1000,4000), event:'delivered a package, no questions asked' },
      { from:'Rockford Hills', to:'Grand Senora', reward:randInt(600,2500),  event:'raced a supercar and won a bet' },
    ]
    const route = rand(ROUTES)
    const u     = await db.getOrCreateUser(sender)
    await db.updateUser(sender, { wallet: (u?.wallet || 0) + route.reward })
    await db.logTransaction(sender, 'roadtrip', route.reward, 0).catch(() => {})
    const caption =
      `🚗 *ROAD TRIP*\n\n` +
      `🗺️ *Route:* ${route.from} → ${route.to}\n` +
      `📖 *Story:* ${pushName || sender} ${route.event}.\n\n` +
      `💰 Road earnings: *+${route.reward.toLocaleString()} Bnhz*\n\n` +
      `_Miles on the clock, money in the pocket._ 🖤`
    await sendMedia(sock, jid, msg, 'GTA V sports car highway road trip sunset Los Santos cinematic driving animation', 'GTA V road trip highway sunset cinematic sports car dramatic', caption)
  },

  // ─── .race [@user] (GTA RP) ───────────────────────────────────────────────────
  async race({ sock, msg, jid, sender, pushName }) {
    const mentioned  = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    const rival      = mentioned.length ? (mentioned[0].split('@')[0].split(':')[0]) : null
    const rivalName  = rival ? (await db.getOrCreateUser(rival).catch(() => null))?.name || rival : 'A random racer'
    const BET        = 1000
    const u          = await db.getOrCreateUser(sender)
    if ((u?.wallet || 0) < BET) return sendMedia(sock, jid, msg, 'GTA V racing car start line dramatic cinematic', 'GTA V racing start line dramatic', `❌ Need *${BET.toLocaleString()} Bnhz* to enter a race.`)

    const won = Math.random() > 0.45
    await db.updateUser(sender, { wallet: (u.wallet || 0) + (won ? BET : -BET) })
    await db.logTransaction(sender, won ? 'race_win' : 'race_loss', won ? BET : -BET, BET).catch(() => {})

    const CARS2 = ['Pariah','Comet S2','Vagner','T20','Scramjet','Zentorno','Reaper','Turismo R']
    const myCar  = rand(CARS2)
    const theirC = rand(CARS2)
    const caption = won
      ? `🏎️ *RACE WIN!*\n\n👤 *${pushName || sender}* (${myCar}) beat *${rivalName}* (${theirC})!\n\n💰 Prize: *+${BET.toLocaleString()} Bnhz*\n\n_Nobody keeps up._ 🖤`
      : `🏎️ *RACE LOSS*\n\n👤 *${pushName || sender}* (${myCar}) got smoked by *${rivalName}* (${theirC}).\n\n💸 Lost: *${BET.toLocaleString()} Bnhz*\n\n_Work on the car._ 🖤`
    await sendMedia(sock, jid, msg, `GTA V street racing ${myCar} ${won?'winning checkpoint':'losing crash'} cinematic night city animation`, `GTA V street race ${myCar} cinematic night dramatic`, caption)
  },

  // ─── .robbery (GTA RP) ────────────────────────────────────────────────────────
  async robbery({ sock, msg, jid, sender, pushName }) {
    const TARGETS = [
      { name:'Armored Truck',         min:5000,  max:25000, risk:0.50 },
      { name:'Downtown Bank',         min:10000, max:40000, risk:0.55 },
      { name:'Casino Vault',          min:20000, max:80000, risk:0.60 },
      { name:'LS Customs Safe',       min:3000,  max:12000, risk:0.40 },
      { name:'Billionaire Mansion',   min:8000,  max:30000, risk:0.50 },
    ]
    const t    = rand(TARGETS)
    const u    = await db.getOrCreateUser(sender)
    const busted = Math.random() < t.risk
    let caption, vP, iP

    if (!busted) {
      const take = randInt(t.min, t.max)
      await db.updateUser(sender, { wallet: (u?.wallet || 0) + take })
      await db.logTransaction(sender, 'robbery_success', take, 0).catch(() => {})
      caption = `🔫 *ROBBERY SUCCESS!*\n\n👤 *${pushName || sender}* hit the *${t.name}*!\n\n💰 Stolen: *+${take.toLocaleString()} Bnhz*\n\n_Untouchable._ 🖤`
      vP = `GTA V armed robbery ${t.name} dramatic heist success cinematic night animation`
      iP = `GTA V armed robbery ${t.name} dramatic success dark cinematic art`
    } else {
      const fine = randInt(1000, 3000)
      await db.updateUser(sender, { wallet: Math.max(0, (u?.wallet || 0) - fine) })
      await db.logTransaction(sender, 'robbery_busted', -fine, fine).catch(() => {})
      caption = `🚔 *ROBBERY BUSTED!*\n\n👤 *${pushName || sender}* tried to hit the *${t.name}* but SWAT was waiting!\n\n💸 Fine: *-${fine.toLocaleString()} Bnhz*\n\n_Always a snitch somewhere._ 🖤`
      vP = `GTA V SWAT raid arrest bank robbery bust dramatic cinematic animation`
      iP = `GTA V SWAT arrest robbery bust dramatic dark cinematic`
    }
    await sendMedia(sock, jid, msg, vP, iP, caption)
  },

  // ─── .revenge @user (GTA RP) ──────────────────────────────────────────────────
  async revenge({ sock, msg, jid, sender, pushName }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return sendMedia(sock, jid, msg, 'GTA V revenge mission dramatic night city cinematic', 'GTA V revenge dramatic night art', '⚠️ Usage: *.revenge @user*\nWho are you targeting?')
    const targetPhone = mentioned[0].split('@')[0].split(':')[0]
    if (targetPhone === sender) return sendMedia(sock, jid, msg, 'GTA V revenge mission dramatic', 'GTA V revenge dramatic', '❌ You cannot take revenge on yourself.')
    const target = await db.getOrCreateUser(targetPhone).catch(() => null)
    const u      = await db.getOrCreateUser(sender)

    const COST = 500
    if ((u?.wallet || 0) < COST) {
      const vP = 'GTA V revenge mission planning dramatic cinematic'
      const iP = 'GTA V revenge dramatic dark cinematic art'
      return sendMedia(sock, jid, msg, vP, iP, `❌ Need *${COST} Bnhz* to fund the hit.\nWallet: *${u?.wallet || 0} Bnhz*`)
    }

    const won = Math.random() > 0.45
    await db.updateUser(sender, { wallet: (u.wallet || 0) - COST })
    let caption, vP, iP

    if (won) {
      const stolen = Math.min(randInt(500, 3000), target?.wallet || 0)
      if (stolen > 0) {
        await db.updateUser(targetPhone, { wallet: Math.max(0, (target?.wallet || 0) - stolen) })
        await db.updateUser(sender, { wallet: (u.wallet - COST) + stolen })
        await db.logTransaction(sender, 'revenge_win', stolen - COST, COST).catch(() => {})
      }
      caption = `🔫 *REVENGE SERVED!*\n\n👤 *${pushName || sender}* got back at *${target?.name || targetPhone}*.\n\n💸 Hit cost: *-${COST} Bnhz*\n💰 Taken from them: *+${stolen.toLocaleString()} Bnhz*\n\n_Debts get paid in this city._ 🖤`
      vP = 'GTA V revenge mission success cinematic night city dramatic explosion animation'
      iP = 'GTA V revenge success dramatic cinematic dark night city'
    } else {
      await db.logTransaction(sender, 'revenge_fail', -COST, COST).catch(() => {})
      caption = `💀 *REVENGE FAILED*\n\n👤 *${pushName || sender}* went after *${target?.name || targetPhone}* but got countered!\n\n💸 Lost: *${COST} Bnhz*\n\n_They saw you coming._ 🖤`
      vP = 'GTA V ambush counter attack dramatic night city cinematic animation'
      iP = 'GTA V counter ambush dramatic dark cinematic night'
    }
    await sendMedia(sock, jid, msg, vP, iP, caption)
  },

  // ─── .rush (GTA RP) ───────────────────────────────────────────────────────────
  async rush({ sock, msg, jid, sender, pushName }) {
    const TARGETS2 = ['enemy safehouse','rival gang territory','downtown penthouse','police evidence lock-up','casino back room']
    const target   = rand(TARGETS2)
    const u        = await db.getOrCreateUser(sender)
    const won      = Math.random() > 0.40

    if (won) {
      const loot = randInt(1500, 7000)
      await db.updateUser(sender, { wallet: (u?.wallet || 0) + loot })
      await db.logTransaction(sender, 'rush_success', loot, 0).catch(() => {})
      const caption = `⚡ *RUSH SUCCESSFUL!*\n\n👤 *${pushName || sender}* stormed the ${target} and cleared it out!\n\n💰 Loot: *+${loot.toLocaleString()} Bnhz*\n\n_Speed is everything._ 🖤`
      return sendMedia(sock, jid, msg, `GTA V tactical rush assault ${target} dramatic night cinematic animation`, `GTA V tactical rush assault dramatic night cinematic`, caption)
    } else {
      const loss = randInt(500, 2000)
      await db.updateUser(sender, { wallet: Math.max(0, (u?.wallet || 0) - loss) })
      await db.logTransaction(sock, 'rush_fail', -loss, loss).catch(() => {})
      const caption = `💥 *RUSH FAILED*\n\n👤 *${pushName || sender}* rushed the ${target} but got repelled!\n\n💸 Lost: *${loss.toLocaleString()} Bnhz*\n\n_They were ready._ 🖤`
      return sendMedia(sock, jid, msg, `GTA V tactical assault failure repelled explosion dramatic cinematic`, `GTA V assault failure dramatic dark cinematic`, caption)
    }
  },

  // ─── .rave (GTA RP) ───────────────────────────────────────────────────────────
  async rave({ sock, msg, jid, sender, pushName }) {
    const CLUBS   = ['Vangelico','Bahama Mamas','Vanilla Unicorn','The Diamond','Maze Bank Arena After-Party']
    const club    = rand(CLUBS)
    const u       = await db.getOrCreateUser(sender)
    const ENTRY   = 200
    if ((u?.wallet || 0) < ENTRY) return sendMedia(sock, jid, msg, 'GTA V nightclub DJ rave neon lights cinematic', 'GTA V nightclub rave neon dramatic', `❌ Need *${ENTRY} Bnhz* entry fee for ${club}.`)

    await db.updateUser(sender, { wallet: (u.wallet || 0) - ENTRY })
    const EVENTS  = [
      { desc:'ran into a supplier contact and made a deal', earn: randInt(1000, 4000) },
      { desc:'won the dance battle and pocketed the prize', earn: randInt(500, 2000)  },
      { desc:'got VIP'd and networked with a big spender',  earn: randInt(2000, 6000) },
      { desc:'found a lost wallet on the dancefloor',       earn: randInt(300, 1500)  },
      { desc:'got jumped leaving. Lost wallet.',            earn: -randInt(300, 800)  },
    ]
    const event    = rand(EVENTS)
    const finalW   = (u.wallet - ENTRY) + event.earn
    await db.updateUser(sender, { wallet: Math.max(0, finalW) })
    await db.logTransaction(sender, 'rave', event.earn - ENTRY, ENTRY).catch(() => {})

    const caption =
      `🎉 *RAVE NIGHT — ${club.toUpperCase()}*\n\n` +
      `👤 *${pushName || sender}* ${event.desc}.\n\n` +
      `🎟️ Entry: *-${ENTRY} Bnhz*\n` +
      `${event.earn >= 0 ? `💰 Earned: *+${event.earn.toLocaleString()} Bnhz*` : `💸 Lost: *${Math.abs(event.earn).toLocaleString()} Bnhz*`}\n\n` +
      `💰 Wallet: *${Math.max(0, finalW).toLocaleString()} Bnhz*\n\n` +
      `_The night always has a price._ 🖤`
    await sendMedia(sock, jid, msg, 'GTA V nightclub rave DJ neon lights dancing crowd cinematic animation', 'GTA V nightclub rave neon crowd dramatic cinematic', caption)
  },

  // ─── .resetwanted (GTA RP) ────────────────────────────────────────────────────
  async resetwanted({ reply, sender, user }) {
    const COST = 2500
    const u    = user || await db.getOrCreateUser(sender)
    if ((u?.wallet || 0) < COST) return reply(`❌ Bribing the LSPD costs *${COST.toLocaleString()} Bnhz*.\nWallet: *${(u?.wallet||0).toLocaleString()} Bnhz*`)
    await db.updateUser(sender, { wallet: (u.wallet || 0) - COST })
    await db.logTransaction(sender, 'wanted_clear', -COST, COST).catch(() => {})
    await reply(
      `🚔 *WANTED LEVEL CLEARED*\n\n` +
      `💸 Bribe paid: *${COST.toLocaleString()} Bnhz*\n\n` +
      `✅ All outstanding warrants have been dropped.\n` +
      `😇 You're a model citizen again... for now.\n\n` +
      `_Money talks in Los Santos._ 🖤`
    )
  },

  // ─── .reload [Staff] ──────────────────────────────────────────────────────────
  async reload({ reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    await reply(
      `🔄 *BOT STATUS*\n\n` +
      `✅ Commands loaded and responding.\n` +
      `🖥️ Process uptime: ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m\n` +
      `💾 Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB used\n` +
      `🕒 Server time: ${new Date().toLocaleString()}\n\n` +
      `_All systems operational._ 🖤`
    )
  },

  // ─── .resetstreak @user [Staff] ───────────────────────────────────────────────
  async resetstreak({ msg, reply, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')
    const mentioned   = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.resetstreak @user*')
    const targetPhone = mentioned[0].split('@')[0].split(':')[0]
    await db.updateUser(targetPhone, { streak: 0 })
    await reply(`✅ Streak reset for *${targetPhone}*.`)
  },

  // ─── .refund @user <amount> [Staff] ───────────────────────────────────────────
  async refund({ msg, args, reply, isOwner, isMod }) {
    if (!isOwner && !isMod) return reply('⚠️ Mod/Owner only.')
    const mentioned   = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.refund @user <amount>*')
    const targetPhone = mentioned[0].split('@')[0].split(':')[0]
    const amount      = parseInt(args.find(a => /^\d+$/.test(a)))
    if (!amount || amount < 1) return reply('❌ Provide a valid amount.')
    const u       = await db.getOrCreateUser(targetPhone)
    const newWal  = (u?.wallet || 0) + amount
    await db.updateUser(targetPhone, { wallet: newWal })
    await db.logTransaction(targetPhone, 'staff_refund', amount, 0).catch(() => {})
    await reply(`✅ *REFUNDED* *${amount.toLocaleString()} Bnhz* to *${u?.name || targetPhone}*.\n💰 New wallet: *${newWal.toLocaleString()} Bnhz*`)
  },

  // ─── .remap <prefix> [Owner] ──────────────────────────────────────────────────
  async remap({ args, reply, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    if (!args.length) return reply('⚠️ Usage: *.remap <new_prefix>*\n\nExample: *.remap !*')
    const newPrefix = args[0].trim().slice(0, 3)
    if (!newPrefix) return reply('❌ Invalid prefix.')
    global.prefix = newPrefix
    await reply(
      `✅ *PREFIX UPDATED*\n\n` +
      `🔤 New prefix: *${newPrefix}*\n\n` +
      `_Example: *${newPrefix}help*_\n\n` +
      `⚠️ Note: This resets on bot restart. Update in your config file to make it permanent.`
    )
  },

  getPendingProposals() { return pendingProposals },
}
