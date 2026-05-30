// Universal lottery — one active lottery across ALL groups at once
// Only owner / mod / guardian can START a lottery
// 3 winners: 1st 200k, 2nd 120k, 3rd 80k coins
let globalLottery = null

const { generateWAMessageFromContent } = require('@whiskeysockets/baileys')
const db = require('../database')

const WINNER_PRIZES = [200000, 120000, 80000]

function isStaff(user) {
  const role = (user?.role || '').toLowerCase()
  return role === 'owner' || role === 'mod' || role === 'guardian'
}

module.exports = {
  // ── .lottery (view status) ────────────────────────────────────────
  async lottery({ reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender, pushName)

    if (!globalLottery) {
      return reply(
        `🎰 *SHADOW GARDEN LOTTERY*\n\n` +
        `ℹ️ No active lottery right now.\n\n` +
        `_A mod, guardian, or owner can start one with *.startlottery <ticket price>*_ 🖤`
      )
    }

    const { ticketPrice, tickets, endsAt, startedBy } = globalLottery
    const timeLeft = Math.max(0, Math.floor((endsAt - Date.now()) / 1000))
    const mins     = Math.floor(timeLeft / 60)
    const secs     = timeLeft % 60
    const myTickets = tickets.filter(t => t.sender === sender).length
    const totalPot  = tickets.length * ticketPrice
    const prizeLines = WINNER_PRIZES.map((p, i) => `  ${['🥇','🥈','🥉'][i]} ${i+1}st: *$${p.toLocaleString()}*`).join('\n')

    return reply(
      `🎰 *SHADOW GARDEN LOTTERY*\n` +
      `——————————————————\n\n` +
      `💰 Ticket Price: *$${ticketPrice.toLocaleString()}*\n` +
      `🎟 Tickets Sold: *${tickets.length}*\n` +
      `💵 Total Pot: *$${totalPot.toLocaleString()}*\n` +
      `⏳ Ends in: *${mins}m ${secs}s*\n\n` +
      `🏆 *Prizes:*\n${prizeLines}\n\n` +
      `🎟 Your tickets: *${myTickets}*\n\n` +
      `📌 *.buylottery <amount>* to buy tickets\n\n` +
      `_Good luck, adventurer!_ 🖤`
    )
  },

  // ── .startlottery <price> ─────────────────────────────────────────
  async startlottery({ reply, sender, user, pushName, args }) {
    const u = user || await db.getOrCreateUser(sender, pushName)

    if (!isStaff(u)) {
      return reply(
        `❌ *Permission Denied*\n\n` +
        `Only *Mods*, *Guardians*, or the *Owner* can start a lottery.\n\n` +
        `_Ask a staff member to start one!_ 🖤`
      )
    }

    if (globalLottery) {
      const mins = Math.max(0, Math.floor((globalLottery.endsAt - Date.now()) / 60000))
      return reply(`❌ A lottery is already running!\n\n⏳ Ends in ~${mins} minutes.\n\nUse *.endlottery* to end it early.`)
    }

    const price = parseInt(args[0])
    if (!price || price < 100) return reply(`❌ Set a ticket price of at least $100.\n\nUsage: *.startlottery <price>*`)

    const durationMs = 30 * 60 * 1000  // 30 minutes
    globalLottery = {
      ticketPrice: price,
      tickets:     [],
      endsAt:      Date.now() + durationMs,
      startedBy:   sender,
      startedByName: u.name || pushName || sender,
    }

    const prizeLines = WINNER_PRIZES.map((p, i) => `  ${['🥇','🥈','🥉'][i]} ${i+1}st: *$${p.toLocaleString()}*`).join('\n')

    return reply(
      `🎰 *LOTTERY STARTED!*\n` +
      `——————————————————\n\n` +
      `Started by: *${u.name || pushName || sender}*\n` +
      `💰 Ticket Price: *$${price.toLocaleString()}*\n\n` +
      `🏆 *Prizes:*\n${prizeLines}\n\n` +
      `⏳ Duration: *30 minutes*\n\n` +
      `📌 *.buylottery <amount>* to buy tickets\n` +
      `📌 *.lottery* to check status\n\n` +
      `_The lottery is now open — good luck!_ 🖤`
    )
  },

  // ── .buylottery <amount> ──────────────────────────────────────────
  async buylottery({ reply, sender, user, pushName, args }) {
    const u = user || await db.getOrCreateUser(sender, pushName)

    if (!globalLottery) {
      return reply(`❌ No lottery is currently running.\n\nWait for a mod to start one with *.startlottery* 🖤`)
    }
    if (Date.now() > globalLottery.endsAt) {
      return reply(`❌ The lottery has ended! Wait for results.`)
    }

    const amount = Math.max(1, parseInt(args[0]) || 1)
    const cost   = amount * globalLottery.ticketPrice

    if ((u.wallet || 0) < cost)
      return reply(`❌ You need *$${cost.toLocaleString()}* for ${amount} ticket(s).\nYou have: *$${(u.wallet || 0).toLocaleString()}*`)

    await db.updateUser(sender, { wallet: (u.wallet || 0) - cost })

    for (let i = 0; i < amount; i++) {
      globalLottery.tickets.push({ sender, name: u.name || pushName || sender })
    }

    const myTickets = globalLottery.tickets.filter(t => t.sender === sender).length
    return reply(
      `🎟 *${amount} Ticket(s) Bought!*\n\n` +
      `💰 Cost: $${cost.toLocaleString()}\n` +
      `🎟 Your total tickets: *${myTickets}*\n` +
      `📊 Total entries: *${globalLottery.tickets.length}*\n\n` +
      `_Good luck!_ 🖤`
    )
  },

  // ── .endlottery ───────────────────────────────────────────────────
  async endlottery({ sock, jid, reply, sender, user, pushName }) {
    const u = user || await db.getOrCreateUser(sender, pushName)

    if (!isStaff(u)) {
      return reply(`❌ Only *Mods*, *Guardians*, or the *Owner* can end a lottery.`)
    }

    if (!globalLottery) {
      return reply(`❌ No lottery is currently running.`)
    }

    await module.exports._drawLottery(sock, jid, reply)
  },

  // ── Internal: draw winners ────────────────────────────────────────
  async _drawLottery(sock, jid, reply) {
    if (!globalLottery) return

    const { tickets, ticketPrice, startedByName } = globalLottery
    globalLottery = null   // end it

    if (tickets.length === 0) {
      return reply(`🎰 *LOTTERY ENDED*\n\nNo tickets were sold. No winners. 🖤`)
    }

    // Shuffle tickets and pick up to 3 unique winners
    const shuffled = tickets.sort(() => Math.random() - 0.5)
    const winners  = []
    const seenSenders = new Set()
    for (const ticket of shuffled) {
      if (!seenSenders.has(ticket.sender)) {
        winners.push(ticket)
        seenSenders.add(ticket.sender)
      }
      if (winners.length >= 3) break
    }

    // Pay out winners
    for (let i = 0; i < winners.length; i++) {
      const prize = WINNER_PRIZES[i] || 0
      if (prize > 0) {
        await db.updateUser(winners[i].sender, { wallet: prize }).catch(() => {})
      }
    }

    const winnerLines = winners.map((w, i) => {
      const prize = WINNER_PRIZES[i] || 0
      return `${['🥇','🥈','🥉'][i]} *${w.name || w.sender}* — won *$${prize.toLocaleString()}*`
    }).join('\n')

    const totalPot = tickets.length * ticketPrice

    const resultMsg =
      `🎰 *LOTTERY RESULTS!*\n` +
      `——————————————————\n\n` +
      `🎟 Total Tickets Sold: *${tickets.length}*\n` +
      `💵 Total Pot: *$${totalPot.toLocaleString()}*\n\n` +
      `🏆 *WINNERS:*\n${winnerLines}\n\n` +
      `_Prizes sent directly to winners' wallets!_\n\n` +
      `_Next lottery coming soon — started by ${startedByName}_ 🖤`

    if (sock && jid) {
      await sock.sendMessage(jid, { text: resultMsg }).catch(() => {})
    } else {
      await reply(resultMsg)
    }
  },

  // ── Auto-draw timer check (call this periodically from bot main) ──
  async checkLotteryExpiry(sock, jid) {
    if (!globalLottery) return
    if (Date.now() >= globalLottery.endsAt) {
      await module.exports._drawLottery(sock, jid, async () => {})
    }
  },
}
