const db = require('../database')

// ── Auto Lottery System ─────────────────────────────────────────────────────
// - Costs 200,000 coins to enter
// - 25 participants required
// - 3 winners: 1st 200k | 2nd 140k | 3rd 70k
// - Auto-draws when full, then auto-restarts a new lottery

const TICKET_PRICE   = 200000
const REQUIRED       = 25
const PRIZE_1ST      = 200000
const PRIZE_2ND      = 140000
const PRIZE_3RD      = 70000
const LOTTERY_TITLE  = 'Shadow Garden Grand Lottery'

let globalLottery = null   // current active lottery

function newLotteryState() {
  return {
    title:   LOTTERY_TITLE,
    required: REQUIRED,
    entries: new Map(),   // senderJid → { phone, name, group }
    startedAt: Date.now(),
    sourceGroup: null,
  }
}

// Announce new lottery in the given group
async function announceNewLottery(sock, jid) {
  await sock.sendMessage(jid, {
    text:
      `🎰 *NEW LOTTERY STARTED!*\n\n` +
      `┏❐🎰 *sʜᴀᴅᴏᴡ ɢᴀʀᴅᴇɴ ʟᴏᴛᴛᴇʀʏ* 🎰❐\n` +
      `┃» *ᴘʀɪᴄᴇ* : $${TICKET_PRICE.toLocaleString()} per ticket\n` +
      `┃» *sʟᴏᴛs* : ${REQUIRED} participants\n` +
      `┃» *ᴡɪɴɴᴇʀs* : 3\n` +
      `┃» *ᴛʏᴘᴇ* : Auto-draw\n` +
      `┗❐\n\n` +
      `🏆 *Prizes*\n` +
      `🥇 1st — $${PRIZE_1ST.toLocaleString()}\n` +
      `🥈 2nd — $${PRIZE_2ND.toLocaleString()}\n` +
      `🥉 3rd — $${PRIZE_3RD.toLocaleString()}\n\n` +
      `Type *.lottery* to enter! 🖤`
  }).catch(() => {})
}

async function autoDraw(sock, jid) {
  if (!globalLottery || globalLottery.entries.size < 3) return

  const entries = [...globalLottery.entries.entries()]
  // Shuffle using Fisher-Yates
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]]
  }

  const [first, second, third] = entries
  const total = entries.length
  const sourceGroup = globalLottery.sourceGroup || jid

  // Award prizes
  try {
    const u1 = await db.getOrCreateUser(first[1].phone)
    await db.updateUser(first[1].phone,  { wallet: (u1.wallet || 0) + PRIZE_1ST })
    const u2 = await db.getOrCreateUser(second[1].phone)
    await db.updateUser(second[1].phone, { wallet: (u2.wallet || 0) + PRIZE_2ND })
    const u3 = await db.getOrCreateUser(third[1].phone)
    await db.updateUser(third[1].phone,  { wallet: (u3.wallet || 0) + PRIZE_3RD })
  } catch (e) {
    console.error('[lottery] Prize error:', e.message)
  }

  const resultText =
    `🎰 *SHADOW GARDEN LOTTERY — RESULTS*\n\n` +
    `👥 *Participants:* ${total}\n\n` +
    `🥇 *1st Place:* @${first[1].phone} — *$${PRIZE_1ST.toLocaleString()}*\n` +
    `🥈 *2nd Place:* @${second[1].phone} — *$${PRIZE_2ND.toLocaleString()}*\n` +
    `🥉 *3rd Place:* @${third[1].phone} — *$${PRIZE_3RD.toLocaleString()}*\n\n` +
    `_The shadows have chosen… 🖤_`

  const mentions = [first[0], second[0], third[0]]

  globalLottery = null

  await sock.sendMessage(sourceGroup, { text: resultText, mentions }).catch(() => {})

  // Auto-restart after 5 seconds
  setTimeout(async () => {
    globalLottery = newLotteryState()
    globalLottery.sourceGroup = sourceGroup
    await announceNewLottery(sock, sourceGroup)
  }, 5000)
}

module.exports = {
  // Main entry: .lottery
  async lottery(ctx) {
    const { sock, jid, senderJid, sender, pushName, isGroup, reply, user } = ctx
    if (!isGroup) return reply('⚠️ This command only works in groups.')

    // Auto-start if no lottery running
    if (!globalLottery) {
      globalLottery = newLotteryState()
      globalLottery.sourceGroup = jid
      await announceNewLottery(sock, jid)
    }

    // Already entered
    if (globalLottery.entries.has(senderJid)) {
      const needed = REQUIRED - globalLottery.entries.size
      return reply(
        `⚠️ You already entered! 🎟️\n\n` +
        `👥 Participants: ${globalLottery.entries.size}/${REQUIRED}\n` +
        `⏳ Still needed: ${needed}\n\n` +
        `_Wait for the draw… 🖤_`
      )
    }

    // Check wallet
    const u = user || await db.getOrCreateUser(sender, pushName)
    if ((u.wallet || 0) < TICKET_PRICE) {
      return reply(`❌ You need *$${TICKET_PRICE.toLocaleString()}* to enter.\n💵 Your wallet: $${(u.wallet || 0).toLocaleString()}`)
    }

    // Deduct ticket price
    await db.updateUser(sender, { wallet: (u.wallet || 0) - TICKET_PRICE })

    globalLottery.entries.set(senderJid, { phone: sender, name: pushName || sender, group: jid })
    const count  = globalLottery.entries.size
    const needed = REQUIRED - count

    await reply(
      `🎟️ Entered! -$${TICKET_PRICE.toLocaleString()}\n\n` +
      `👥 Participants: ${count}/${REQUIRED}\n` +
      `⏳ ${needed > 0 ? `${needed} more needed` : 'Drawing now!'}\n\n` +
      `_Good luck… 🖤_`
    )

    if (count >= REQUIRED) {
      await sock.sendMessage(jid, {
        text: `🎰 *${REQUIRED} REACHED! Auto-drawing 3 winners now…* 🖤`
      })
      await autoDraw(sock, jid)
    }
  },

  // Status
  async lotterystatus(ctx) {
    const { reply } = ctx
    if (!globalLottery) {
      return reply('⚠️ No active lottery.\n\nType *.lottery* to start one automatically.')
    }
    const count  = globalLottery.entries.size
    const needed = REQUIRED - count
    const pct    = Math.round((count / REQUIRED) * 100)
    const bar    = '[' + '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10)) + `] ${count}/${REQUIRED}`
    await reply(
      `🎰 *LOTTERY STATUS*\n\n` +
      `🏆 Prize pool: $${(PRIZE_1ST + PRIZE_2ND + PRIZE_3RD).toLocaleString()}\n` +
      `🎟️ Ticket price: $${TICKET_PRICE.toLocaleString()}\n\n` +
      `${bar}\n\n` +
      `⏳ ${needed > 0 ? `${needed} more needed` : 'READY TO DRAW!'}\n\n` +
      `_Type *.lottery* to join!_ 🖤`
    )
  },

  async ls(ctx) { return module.exports.lotterystatus(ctx) },

  // Admin: force draw
  async lotterydraw(ctx) {
    const { sock, jid, senderJid, isGroup, isOwner, reply } = ctx
    if (!isGroup) return reply('⚠️ Groups only.')
    const meta   = await sock.groupMetadata(jid).catch(() => null)
    const admins = (meta?.participants || []).filter(p => p.admin).map(p => p.id)
    if (!isOwner && !admins.includes(senderJid)) return reply('⚠️ Admins only.')
    if (!globalLottery || !globalLottery.entries.size) return reply('⚠️ No active lottery or no entries.')
    if (globalLottery.entries.size < 3) return reply('⚠️ Need at least 3 entries to draw.')
    await sock.sendMessage(jid, { text: '🎲 Force-drawing winners now…' })
    await autoDraw(sock, jid)
  },

  // Admin: cancel
  async lotteryend(ctx) {
    const { sock, jid, senderJid, isGroup, isOwner, reply } = ctx
    if (!isGroup) return reply('⚠️ Groups only.')
    const meta   = await sock.groupMetadata(jid).catch(() => null)
    const admins = (meta?.participants || []).filter(p => p.admin).map(p => p.id)
    if (!isOwner && !admins.includes(senderJid)) return reply('⚠️ Admins only.')
    if (!globalLottery) return reply('⚠️ No active lottery.')
    const entries = globalLottery.entries.size
    globalLottery = null
    await reply(`❌ *Lottery cancelled.*\n\n👥 ${entries} entries were cleared.`)
  },

  // Start manually (admin)
  async lotterystart(ctx) {
    const { sock, jid, senderJid, isOwner, isGroup, reply } = ctx
    if (!isGroup) return reply('⚠️ Groups only.')
    if (globalLottery) return reply('⚠️ A lottery is already running! Use *.ls* for status.')
    globalLottery = newLotteryState()
    globalLottery.sourceGroup = jid
    await announceNewLottery(sock, jid)
  },

  // Poll-style status
  async ll(ctx) { return module.exports.lotterystatus(ctx) },
}
