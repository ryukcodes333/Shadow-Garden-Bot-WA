'use strict'
// ╔══════════════════════════════════════════════╗
// ║     🃏  BLACKJACK  —  commands/blackjack.js  ║
// ╚══════════════════════════════════════════════╝
// .bj <amount> — start a game, bet deducted from wallet.
// Uses @dark-yasiya/baileys interactiveButtons for Hit / Stand / Double Down.

const db = require('../database')

const SUITS  = ['♠','♥','♦','♣']
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']

// keyed by senderPhone (DM) or `${jid}:${phone}` (group)
const bjGames = new Map()

function gameKey(jid, phone) {
  return jid.endsWith('@g.us') ? `${jid}:${phone}` : phone
}

function newDeck() {
  const d = []
  for (const s of SUITS) for (const v of VALUES) d.push({ v, s })
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

function cardStr({ v, s }) { return `[ ${v}${s} ]` }

function handValue(hand) {
  let total = 0, aces = 0
  for (const { v } of hand) {
    if (v === 'A') { total += 11; aces++ }
    else if (['J','Q','K'].includes(v)) total += 10
    else total += parseInt(v)
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

function renderHands(game, reveal = false) {
  const dealerHand = reveal
    ? game.dealer.map(cardStr).join(' ')
    : `${cardStr(game.dealer[0])} [ ?? ]`
  const dealerVal  = reveal ? ` = ${handValue(game.dealer)}` : ''
  const playerHand = game.player.map(cardStr).join(' ')
  const playerVal  = handValue(game.player)
  return `🃏 *Dealer:* ${dealerHand}${dealerVal}\n🎴 *You:*   ${playerHand} = ${playerVal}`
}

// ── Send game state with quick-reply action buttons ───────────────────────────

async function sendGameButtons(sock, jid, game, text, quoted) {
  const canDouble = game.player.length === 2 && game.bet * 2 <= game.walletSnapshot
  const interactiveButtons = [
    {
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({ display_text: '🃏 Hit', id: `bj_hit_${game.key}` })
    },
    {
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({ display_text: '✋ Stand', id: `bj_stand_${game.key}` })
    },
  ]
  if (canDouble) {
    interactiveButtons.push({
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({
        display_text: `💰 Double ($${(game.bet * 2).toLocaleString()})`,
        id: `bj_double_${game.key}`
      })
    })
  }

  try {
    await sock.sendMessage(jid, {
      text,
      title: '🃏 Blackjack',
      footer: `Bet: $${game.bet.toLocaleString()}`,
      interactiveButtons,
    }, quoted ? { quoted } : undefined)
  } catch {
    await sock.sendMessage(jid, { text: text + '\n\n_Reply: bj_hit / bj_stand' + (canDouble ? ' / bj_double' : '') + '_' })
  }
}

// ── Send end-of-game result with rematch / leave buttons ──────────────────────

async function sendEndButtons(sock, jid, text, key) {
  await sock.sendMessage(jid, { text })
  try {
    await sock.sendMessage(jid, {
      text: 'What would you like to do?',
      title: '🃏 Blackjack',
      footer: 'Game over',
      interactiveButtons: [
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: '🔄 Play Again ($100)', id: `bj_again_${key}` })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: '❌ Leave Table', id: `bj_leave_${key}` })
        },
      ],
    })
  } catch {
    await sock.sendMessage(jid, { text: 'Type *.bj 100* to play again.' })
  }
}

// ── Resolve game (dealer draws, compare hands) ────────────────────────────────

async function resolveGame(sock, jid, game) {
  while (handValue(game.dealer) < 17) game.dealer.push(game.deck.pop())

  const pVal  = handValue(game.player)
  const dVal  = handValue(game.dealer)
  const hands = renderHands(game, true)

  let result, delta
  if (dVal > 21 || pVal > dVal) {
    delta  = game.bet
    result = `✅ *YOU WIN!* +$${game.bet.toLocaleString()}`
  } else if (pVal === dVal) {
    delta  = 0
    result = `🤝 *PUSH!* Bet returned.`
  } else {
    delta  = -game.bet
    result = `❌ *YOU LOSE!* -$${game.bet.toLocaleString()}`
  }

  const user      = await db.getOrCreateUser(game.phone)
  const newWallet = (user.wallet || 0) + game.bet + delta
  await db.updateUser(game.phone, { wallet: Math.max(0, newWallet) })

  bjGames.delete(game.key)
  const text = `🃏 *BLACKJACK*\n\n${hands}\n\n━━━━━━━━━━━━\n${result}\n\n💰 New balance: $${Math.max(0, newWallet).toLocaleString()}`
  return sendEndButtons(sock, jid, text, game.key)
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  bjGames,

  async bj({ sock, msg, jid, senderJid, sender, args, reply, user }) {
    const phone = user?.phone || sender
    const key   = gameKey(jid, phone)

    if (bjGames.has(key)) return reply('❌ You already have an active Blackjack game! Finish it first.')

    const rawAmt = args[0]
    if (!rawAmt) return reply('Usage: *.bj <amount>*\nExample: .bj 500')

    const wallet = user?.wallet ?? 0
    let bet
    if (rawAmt.toLowerCase() === 'all') {
      bet = wallet
    } else {
      bet = parseInt(rawAmt)
    }

    if (isNaN(bet) || bet <= 0) return reply('❌ Invalid bet amount.')
    if (bet > wallet) return reply(`❌ Insufficient funds.\n💰 Your wallet: $${wallet.toLocaleString()}`)
    if (bet < 10) return reply('❌ Minimum bet is $10.')

    await db.updateUser(phone, { wallet: wallet - bet })

    const deck   = newDeck()
    const player = [deck.pop(), deck.pop()]
    const dealer = [deck.pop(), deck.pop()]

    const game = { key, phone, jid, bet, deck, player, dealer, walletSnapshot: wallet, done: false }
    bjGames.set(key, game)

    const pVal = handValue(player)
    const hands = renderHands(game)

    if (pVal === 21) {
      const prize = Math.floor(bet * 1.5)
      const user2 = await db.getOrCreateUser(phone)
      await db.updateUser(phone, { wallet: (user2.wallet || 0) + bet + prize })
      bjGames.delete(key)
      const text = `🃏 *BLACKJACK!*\n\n${renderHands(game, true)}\n\n━━━━━━━━━━━━\n🎉 *BLACKJACK! You win $${prize.toLocaleString()}!*\n💰 Payout: 1.5x`
      return sendEndButtons(sock, jid, text, key)
    }

    const text = `🃏 *BLACKJACK* — Bet: $${bet.toLocaleString()}\n\n${hands}\n\n━━━━━━━━━━━━\nWhat will you do?`
    return sendGameButtons(sock, jid, game, text, msg)
  },

  async handleButton(sock, msg, buttonId) {
    const jid = msg.key.remoteJid

    // ── Leave table ───────────────────────────────────────────────────────────
    if (buttonId.startsWith('bj_leave_')) {
      const key = buttonId.replace('bj_leave_', '')
      bjGames.delete(key)
      return sock.sendMessage(jid, { text: '👋 You left the Blackjack table.' })
    }

    // ── Play again ────────────────────────────────────────────────────────────
    if (buttonId.startsWith('bj_again_')) {
      const key   = buttonId.replace('bj_again_', '')
      const phone = key.includes(':') ? key.split(':')[1] : key
      const user  = await db.getOrCreateUser(phone)
      return module.exports.bj({
        sock, msg, jid,
        senderJid: msg.key.participant || msg.key.remoteJid,
        sender: phone,
        args: ['100'],
        reply: (t) => sock.sendMessage(jid, { text: t }),
        user,
      })
    }

    // ── Hit / Stand / Double ──────────────────────────────────────────────────
    const keyMatch = buttonId.match(/^bj_(hit|stand|double)_(.+)$/)
    if (!keyMatch) return
    const [, action, key] = keyMatch
    const game = bjGames.get(key)
    if (!game || game.done) return

    const senderJid   = msg.key.participant || msg.key.remoteJid
    const senderPhone = senderJid.split('@')[0].split(':')[0]
    if (senderPhone !== game.phone) return

    if (action === 'hit') {
      game.player.push(game.deck.pop())
      const val = handValue(game.player)
      if (val > 21) {
        bjGames.delete(key)
        const text = `🃏 *BUST!* 💥\n\n${renderHands(game)}\n\n━━━━━━━━━━━━\n❌ You busted! Lost $${game.bet.toLocaleString()}`
        return sendEndButtons(sock, jid, text, key)
      }
      if (val === 21) return resolveGame(sock, jid, game)
      const text = `🃏 *BLACKJACK* — Bet: $${game.bet.toLocaleString()}\n\n${renderHands(game)}\n\n━━━━━━━━━━━━\nYou drew a card. What now?`
      return sendGameButtons(sock, jid, game, text)
    }

    if (action === 'double') {
      const u = await db.getOrCreateUser(game.phone)
      if (u.wallet < game.bet) {
        return sock.sendMessage(jid, { text: `❌ Not enough funds to double down! Wallet: $${u.wallet.toLocaleString()}` })
      }
      await db.updateUser(game.phone, { wallet: u.wallet - game.bet })
      game.bet *= 2
      game.player.push(game.deck.pop())
      await sock.sendMessage(jid, { text: `💰 *DOUBLE DOWN!*\n\n${renderHands(game)}\n\nNew bet: $${game.bet.toLocaleString()}` })
      return resolveGame(sock, jid, game)
    }

    if (action === 'stand') return resolveGame(sock, jid, game)
  },
}
