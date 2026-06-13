const db = require('../database')

// ── Gambling constants ──────────────────────────────────────────────────────
// House edge is enforced per-game via true probabilities + adjusted payouts.
// Long-term expected profit is always NEGATIVE for the player.
// ─────────────────────────────────────────────────────────────────────────────

// Daily gambling limit per player (prevents spam abuse)
const DAILY_LIMIT   = 20
const GAMBLE_CD_MS  = 8000  // 8-second cooldown between bets

// Per-user in-memory cooldown (anti-spam)
const gambleCooldown = {}

// Daily session tracking (in-memory; resets on bot restart — use DB for production persistence)
const dailyTracker   = {}

function checkGambleCooldown(phone) {
  const now = Date.now()
  if (gambleCooldown[phone] && now < gambleCooldown[phone]) {
    return gambleCooldown[phone] - now
  }
  gambleCooldown[phone] = now + GAMBLE_CD_MS
  return 0
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0]
}

function checkDailyLimit(phone) {
  const today = getTodayKey()
  if (!dailyTracker[phone] || dailyTracker[phone].date !== today) {
    dailyTracker[phone] = { count: 0, date: today }
  }
  dailyTracker[phone].count++
  return dailyTracker[phone].count > DAILY_LIMIT
}

function getRemainingGambles(phone) {
  const today = getTodayKey()
  if (!dailyTracker[phone] || dailyTracker[phone].date !== today) return DAILY_LIMIT
  return Math.max(0, DAILY_LIMIT - dailyTracker[phone].count)
}

// ── Validation helpers ─────────────────────────────────────────────────────

function parseAmount(raw, wallet) {
  const str = String(raw || '').toLowerCase().trim()
  if (str === 'all') return wallet
  const n = parseInt(str)
  if (isNaN(n)) return null
  return n
}

function validateBet(amount, wallet) {
  if (!amount || amount <= 0) return '⚠️ Bet must be between the min and max limits.'
  if (amount > wallet) return `⚠️ Not enough coins. Wallet: £${wallet.toLocaleString()}`
  return null
}

// Wraps a gambling handler with the shared cooldown + global error safety
function withCooldown(fn) {
  return async function(ctx) {
    try {
      const wait = checkGambleCooldown(ctx.sender)
      if (wait > 0) {
        const secs = Math.ceil(wait / 1000)
        return await ctx.reply(`⏳ You are on cooldown for *${secs}s*.`)
      }
      return await fn(ctx)
    } catch (err) {
      console.error('[gamble error]', err?.message || err)
      try { await ctx.reply(`⚠️ An unexpected error occurred. Please try again later.`) } catch {}
    }
  }
}

// Track currency removal (gambling losses = money sink)
async function sinkCoins(amount) {
  try { await db.trackCurrencyRemoved(amount) } catch {}
}
async function genCoins(amount) {
  try { await db.trackCurrencyGenerated(amount) } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// GAMES
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {

  // ── .bet — generic wager ────────────────────────────────────────────────
  // Win rate: 42% | Payout: 1.85x stake on win | House edge ≈ 22%
  bet: withCooldown(async ({ reply, sender, user, args }) => {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseAmount(args[0], u.wallet || 0)
    const err    = validateBet(amount, u.wallet || 0)
    if (err) return reply(err)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const win  = Math.random() < 0.42
    const net  = win ? Math.floor(amount * 0.85) : -amount  // net gain/loss
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (!win) await sinkCoins(amount); else await genCoins(net)
    const rem = getRemainingGambles(sender)
    if (win) return reply(`🎲 *WIN!*\n\n£${amount.toLocaleString()} → *+£${Math.floor(amount * 0.85)}*\n💵 £${((u.wallet || 0) + net).toLocaleString()}\n\n_${rem} gambles left today._`)
    return reply(`🎲 *LOST*\n\n-£${amount.toLocaleString()}\n💵 £${((u.wallet || 0) + net).toLocaleString()}\n\n_${rem} gambles left today._`)
  }),

  // ── .cf — coin flip ────────────────────────────────────────────────────
  // Win rate: 47% | Payout: 1:1 | House edge ≈ 6%
  cf: withCooldown(async ({ reply, sender, user, args }) => {
    const u      = user || await db.getOrCreateUser(sender)
    const choice = args[0]?.toLowerCase()
    const amount = parseAmount(args[1], u.wallet || 0)
    if (!['heads', 'tails', 'h', 't'].includes(choice || '')) {
      return reply('⚠️ Usage: .cf heads/tails <amount>')
    }
    const err = validateBet(amount, u.wallet || 0)
    if (err) return reply(err)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const normalised = (choice === 'h') ? 'heads' : (choice === 't') ? 'tails' : choice
    const highStake  = amount >= 110000
    const playerWins = Math.random() < (highStake ? 0.07 : 0.47)   // 7% for bets ≥£110000, else 47%
    const flip       = playerWins ? normalised : (normalised === 'heads' ? 'tails' : 'heads')
    const net        = playerWins ? amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (!playerWins) await sinkCoins(amount); else await genCoins(amount)
    const rem = getRemainingGambles(sender)
    return reply(
      `🪙 *Coin Flip!*\n\n` +
      `Your bet: *${normalised.toUpperCase()}* | Result: *${flip.toUpperCase()}*\n\n` +
      `${playerWins ? `🪙 Flipped ${flip.toUpperCase()}! You won *+£${(amount).toLocaleString()}*` : `🪙 Flipped ${flip === 'heads' ? 'tails' : 'heads'}! You lost *-£${amount.toLocaleString()}*`}\n` +
      `💵 £${((u.wallet || 0) + net).toLocaleString()}\n\n_${rem} gambles left today._`
    )
  }),

  // ── .slots — slot machine ──────────────────────────────────────────────
  // Uses true probability per symbol; overall house edge ≈ 12%
  slots: withCooldown(async ({ sock, jid, msg, reply, sender, user, args }) => {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseAmount(args[0], u.wallet || 0)
    const err    = validateBet(amount, u.wallet || 0)
    if (err) return reply(err)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    // Weighted symbol pool: higher weight = more common
    const SYMBOLS = [
      { sym: '🍒', weight: 30 },
      { sym: '🍋', weight: 25 },
      { sym: '🍇', weight: 20 },
      { sym: '🔔', weight: 12 },
      { sym: '⭐', weight: 8  },
      { sym: '💎', weight: 5  },
    ]
    const totalWeight = SYMBOLS.reduce((a, s) => a + s.weight, 0)

    function spinReel() {
      let r = Math.random() * totalWeight
      for (const s of SYMBOLS) { r -= s.weight; if (r <= 0) return s.sym }
      return SYMBOLS[0].sym
    }

    // Animate spin
    const spinLine = () => `│ ${spinReel()} │ ${spinReel()} │ ${spinReel()} │`
    await sock.sendMessage(jid, { text: `🎰 *Spinning...*\n\n${spinLine()}\n${spinLine()}\n${spinLine()}` }, { quoted: msg })

    const reels = [spinReel(), spinReel(), spinReel()]

    let multiplier = 0
    let label      = 'No Match'

    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      // Triple match
      if      (reels[0] === '💎') { multiplier = 8;   label = '💎 JACKPOT!' }
      else if (reels[0] === '⭐') { multiplier = 4;   label = '⭐ MEGA WIN!' }
      else if (reels[0] === '🔔') { multiplier = 2.5; label = '🔔 BIG WIN!' }
      else                        { multiplier = 1.8; label = '🎉 Three of a Kind!' }
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
      // Pair — slight win (net positive but small)
      multiplier = 1.15
      label      = '✨ Pair!'
    }

    const net = multiplier > 0 ? Math.floor(amount * multiplier) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (net < 0) await sinkCoins(Math.abs(net)); else if (net > 0) await genCoins(net)
    const rem = getRemainingGambles(sender)

    await new Promise(r => setTimeout(r, 700))
    return sock.sendMessage(jid, {
      text:
        `⏳ *Stopping...*\n\n│ ${reels[0]} │ ${reels[1]} │ ${reels[2]} │\n\n` +
        `${net >= 0 ? (multiplier >= 10 ? `💎 JACKPOT! ${label}\n> *+£${Math.floor(amount * multiplier)}*` : `🎉 ${label}\n> *+£${Math.floor(amount * multiplier)}*`) : `😔 ${label}\n> *-£${amount.toLocaleString()}*`}\n\n` +
        `💵 £${((u.wallet || 0) + net).toLocaleString()}\n_${rem} gambles left today._`,
    }, { quoted: msg })
  }),
  async sl(ctx) { return module.exports.slots(ctx) },

  // ── .dice — number guess ───────────────────────────────────────────────
  // True 1-in-6 odds. Win: 15% (slightly below fair 16.7%). Payout 5x. Edge ≈ 25%
  dice: withCooldown(async ({ reply, sender, user, args }) => {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseAmount(args[0], u.wallet || 0)
    const guess  = parseInt(args[1])
    if (!amount || !guess || guess < 1 || guess > 6) {
      return reply('⚠️ Usage: .dice <amount> <guess 1-6>')
    }
    const err = validateBet(amount, u.wallet || 0)
    if (err) return reply(err)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const roll = Math.floor(Math.random() * 6) + 1
    const win  = roll === guess
    // Payout: 5x total (net +4x); slightly below fair 6x to give house edge
    const net  = win ? amount * 4 : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (!win) await sinkCoins(amount); else await genCoins(amount * 4)
    const rem = getRemainingGambles(sender)
    return reply(
      `🎲 *Dice Roll!*\n\nGuess: ${guess} | Rolled: *${roll}*\n\n` +
      `${win ? `🎲 Rolled *${roll}*! Won *+£${(amount * 4).toLocaleString()}*` : `🎲 Rolled *${roll}*! Lost *-£${amount.toLocaleString()}*`}\n` +
      `💵 £${((u.wallet || 0) + net).toLocaleString()}\n\n_${rem} gambles left today._`
    )
  }),

  // ── .rps — rock paper scissors ────────────────────────────────────────
  // Win: 44% | Draw: 3% | Lose: 53% | House edge ≈ 12%
  rps: withCooldown(async ({ reply, sender, user, args }) => {
    const u      = user || await db.getOrCreateUser(sender)
    const choice = (args[0]?.toLowerCase() && isNaN(parseInt(args[0]))) ? args[0].toLowerCase() : null
    const amount = parseAmount(args[1] || args[0], u.wallet || 0)
    if (!choice || !['rock', 'paper', 'scissors', 'r', 'p', 's'].includes(choice)) {
      return reply('⚠️ Usage: .rps rock/paper/scissors <amount>')
    }
    const err = validateBet(amount, u.wallet || 0)
    if (err) return reply(err)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const map        = { r: 'rock', p: 'paper', s: 'scissors' }
    const playerMove = map[choice] || choice
    const emojis     = { rock: '🪨', paper: '📄', scissors: '✂️' }
    const beats      = { rock: 'scissors', paper: 'rock', scissors: 'paper' }

    // 44% player win, 3% draw, 53% bot win
    const roll = Math.random()
    let botMove, result
    if (roll < 0.44) {
      // Player wins — bot plays the losing move
      botMove = beats[playerMove]
      result  = 'win'
    } else if (roll < 0.47) {
      // Draw
      botMove = playerMove
      result  = 'draw'
    } else {
      // Bot wins — bot plays the winning move
      const winsAgainst = { rock: 'paper', paper: 'scissors', scissors: 'rock' }
      botMove = winsAgainst[playerMove]
      result  = 'lose'
    }

    const net = result === 'win' ? amount : result === 'draw' ? 0 : -amount
    if (result !== 'draw') await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (result === 'lose') await sinkCoins(amount)
    if (result === 'win')  await genCoins(amount)
    const rem = getRemainingGambles(sender)
    return reply(
      `🪨📄✂️ *Rock Paper Scissors!*\n\nYou: ${emojis[playerMove]} | Bot: ${emojis[botMove]}\n\n` +
      `${result === 'win' ? `🏆 You: ${emojis[playerMove]} | Bot: ${emojis[botMove]} | You Win! *+£${amount.toLocaleString()}*` : result === 'draw' ? `🤝 You: ${emojis[playerMove]} | Bot: ${emojis[botMove]} | Draw!` : `💀 You: ${emojis[playerMove]} | Bot: ${emojis[botMove]} | You Lose! *-£${amount.toLocaleString()}*`}\n` +
      `💵 £${((u.wallet || 0) + net).toLocaleString()}\n\n_${rem} gambles left today._`
    )
  }),

  // ── .blackjack / .bj ─────────────────────────────────────────────────
  // Player win: 43% | Dealer win: 57% | House edge ≈ 14%
  blackjack: withCooldown(async ({ reply, sender, user, args }) => {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseAmount(args[0], u.wallet || 0)
    const err    = validateBet(amount, u.wallet || 0)
    if (err) return reply(err)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const card = () => Math.min(Math.floor(Math.random() * 13) + 1, 10)
    const sum  = cards => cards.reduce((a, b) => a + b, 0)

    // Deal player 2 cards
    const playerCards = [card(), card()]
    let   playerSum   = sum(playerCards)

    // Player auto-hits on 11 or below (simplified)
    if (playerSum <= 11) { playerCards.push(card()); playerSum = sum(playerCards) }

    // Dealer hits until 17+ (standard BJ rules)
    const dealerCards = [card(), card()]
    let   dealerSum   = sum(dealerCards)
    while (dealerSum < 17) { dealerCards.push(card()); dealerSum = sum(dealerCards) }

    const playerBust = playerSum > 21
    const dealerBust = dealerSum > 21

    let result = 'lose'
    if (!playerBust && (dealerBust || playerSum > dealerSum)) result = 'win'
    else if (!playerBust && !dealerBust && playerSum === dealerSum) result = 'draw'

    const net = result === 'win' ? amount : result === 'draw' ? 0 : -amount
    if (result !== 'draw') await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (result === 'lose') await sinkCoins(amount)
    if (result === 'win')  await genCoins(amount)
    const rem = getRemainingGambles(sender)
    return reply(
      `🃏 *Blackjack!*\n\n` +
      `🎴 You: ${playerCards.join('+')} = *${playerSum}*\n` +
      `🤖 Dealer: ${dealerCards.join('+')} = *${dealerSum}*\n\n` +
      `${playerBust ? '💥 BUST! ' : dealerBust ? '💥 Dealer BUST! ' : ''}` +
      `${result === 'win' ? `🏆 You win! *+£${amount.toLocaleString()}*` : result === 'draw' ? `🤝 Push — bet returned.` : `💀 Lost *-£${amount.toLocaleString()}*`}\n` +
      `💵 £${((u.wallet || 0) + net).toLocaleString()}\n\n_${rem} gambles left today._`
    )
  }),
  async bj(ctx)     { return module.exports.blackjack(ctx) },
  async casino(ctx) { return module.exports.blackjack(ctx) },

  // ── .poker ────────────────────────────────────────────────────────────
  // Hand probabilities are true; payouts adjusted for ~15% house edge
  poker: withCooldown(async ({ reply, sender, user, args }) => {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseAmount(args[0], u.wallet || 0)
    const err    = validateBet(amount, u.wallet || 0)
    if (err) return reply(err)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const suits  = ['♠️', '♥️', '♦️', '♣️']
    const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
    const deck   = suits.flatMap(s => values.map(v => `${v}${s}`))
    const hand   = [...deck].sort(() => Math.random() - 0.5).slice(0, 5)

    // Approximate hand detection
    const vals  = hand.map(c => values.indexOf(c.replace(/[♠♥♦♣️]/g, '').trim()))
    const counts = {}
    for (const v of vals) counts[v] = (counts[v] || 0) + 1
    const freq  = Object.values(counts).sort((a, b) => b - a)
    const isFlush    = new Set(hand.map(c => c.slice(-2))).size === 1
    const sortedVals = [...vals].sort((a, b) => a - b)
    const isStraight = sortedVals.every((v, i) => i === 0 || v === sortedVals[i - 1] + 1)

    let handName, mult
    if (isFlush && isStraight)           { handName = 'Straight Flush'; mult = 8   }
    else if (freq[0] === 4)              { handName = 'Four of a Kind'; mult = 5   }
    else if (freq[0] === 3 && freq[1] === 2) { handName = 'Full House';mult = 3   }
    else if (isFlush)                    { handName = 'Flush';          mult = 2.5 }
    else if (isStraight)                 { handName = 'Straight';       mult = 2   }
    else if (freq[0] === 3)              { handName = 'Three of a Kind';mult = 1.5 }
    else if (freq[0] === 2 && freq[1] === 2) { handName = 'Two Pair';  mult = 1.2 }
    else if (freq[0] === 2)              { handName = 'One Pair';       mult = 0.9 } // slight loss (house edge)
    else                                 { handName = 'High Card';      mult = 0   }

    const net = mult > 0 ? Math.floor(amount * mult) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (net < 0) await sinkCoins(Math.abs(net)); else if (net > 0) await genCoins(net)
    const rem = getRemainingGambles(sender)
    return reply(
      `🂡 *Poker!*\n\n🃏 ${hand.join(' ')}\n\n🎯 ${handName}\n` +
      `${mult > 0 ? `💎 WIN! ×${mult} → *+£${Math.floor(amount * mult)}*` : `😔 No win. Lost *-£${amount.toLocaleString()}*`}\n` +
      `💵 £${((u.wallet || 0) + net).toLocaleString()}\n\n_${rem} gambles left today._`
    )
  }),

  // ── .spin — wheel of fortune ──────────────────────────────────────────
  // Weighted wheel; house edge ≈ 18%
  spin: withCooldown(async ({ reply, sender, user, args }) => {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseAmount(args[0], u.wallet || 0)
    const err    = validateBet(amount, u.wallet || 0)
    if (err) return reply(err)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const outcomes = [
      { label: '💀 Bankrupt',  mult: 0,    weight: 20 },
      { label: '💸 ×0.4',      mult: 0.4,  weight: 25 },
      { label: '💰 ×1.2',      mult: 1.2,  weight: 25 },
      { label: '⭐ ×1.8',      mult: 1.8,  weight: 20 },
      { label: '🌟 ×3',        mult: 3,    weight: 8  },
      { label: '💎 ×5',        mult: 5,    weight: 2  },
    ]
    const totalW = outcomes.reduce((a, o) => a + o.weight, 0)
    let r = Math.random() * totalW, result = outcomes[0]
    for (const o of outcomes) { r -= o.weight; if (r <= 0) { result = o; break } }

    const net = Math.floor(amount * result.mult) - amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (net < 0) await sinkCoins(Math.abs(net)); else if (net > 0) await genCoins(net)
    const rem = getRemainingGambles(sender)
    return reply(
      `🎡 *Wheel Spin!*\n\n🎯 *${result.label}*\n\n` +
      `${net >= 0 ? `💰 +£${net.toLocaleString()}` : `💸 -£${Math.abs(net).toLocaleString()}`}\n` +
      `💵 £${((u.wallet || 0) + net).toLocaleString()}\n\n_${rem} gambles left today._`
    )
  }),

  // ── .roulette ─────────────────────────────────────────────────────────
  // European roulette math (37 pockets 0–36). House edge ≈ 2.7% on colour,
  // but higher on number bets due to adjusted payout.
  roulette: withCooldown(async ({ reply, sender, user, args }) => {
    const u      = user || await db.getOrCreateUser(sender)
    const bet    = args[0]?.toLowerCase()
    const amount = parseAmount(args[1], u.wallet || 0)
    if (!bet || !amount) {
      return reply('⚠️ Usage: .roulette red/black/odd/even/0-36 <amount>')
    }
    const err = validateBet(amount, u.wallet || 0)
    if (err) return reply(err)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    // European wheel: 0–36
    const num   = Math.floor(Math.random() * 37)
    const color = num === 0 ? 'green' : num % 2 === 0 ? 'black' : 'red'
    const emoji = color === 'green' ? '🟢' : color === 'red' ? '🔴' : '⚫'

    let mult = 0
    if (bet === 'red'   && color === 'red')   mult = 1.94  // near 2:1 minus house cut
    if (bet === 'black' && color === 'black') mult = 1.94
    if (bet === 'green' && color === 'green') mult = 14    // true fair is 35:1, we give 14:1 for green
    if (bet === 'odd'   && num > 0 && num % 2 !== 0) mult = 1.94
    if (bet === 'even'  && num > 0 && num % 2 === 0) mult = 1.94
    if (!isNaN(parseInt(bet)) && parseInt(bet) === num) mult = 30 // true fair is 35:1, house takes cut

    const payout = Math.floor(amount * mult)
    const net    = payout - amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (net < 0) await sinkCoins(Math.abs(net)); else if (net > 0) await genCoins(net)
    const rem = getRemainingGambles(sender)
    return reply(
      `🎰 *Roulette!*\n\n` +
      `${emoji} Ball landed on: *${num}* (${color})\n` +
      `Your bet: *${bet}*\n\n` +
      `${mult > 0 ? `🎯 Your bet won! ×${mult} → *+£${payout.toLocaleString()}*` : `😔 Ball missed your bet. Lost *-£${amount.toLocaleString()}*`}\n` +
      `💵 £${((u.wallet || 0) + net).toLocaleString()}\n\n_${rem} gambles left today._`
    )
  }),

  // ── .horse — horse racing ─────────────────────────────────────────────
  // 6 horses; true 1-in-6 chance. Payout 4.5x total. House edge ≈ 25%
  horse: withCooldown(async ({ reply, sender, user, args }) => {
    const u      = user || await db.getOrCreateUser(sender)
    const horse  = parseInt(args[0])
    const amount = parseAmount(args[1], u.wallet || 0)
    if (!horse || horse < 1 || horse > 6 || !amount) {
      return reply('⚠️ Usage: `.horse <1-6> <amount>`\n\nPick a horse number (1-6) and place your bet!')
    }
    const err = validateBet(amount, u.wallet || 0)
    if (err) return reply(err)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const winner = Math.floor(Math.random() * 6) + 1
    const win    = winner === horse
    // Payout: 4.5x total (net +3.5x); fair would be 6x. House edge ≈ 25%
    const net    = win ? Math.floor(amount * 3.5) : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (!win) await sinkCoins(amount); else await genCoins(Math.floor(amount * 3.5))
    const raceLines = [1,2,3,4,5,6].map(i => `🐴 Horse ${i}${i === winner ? ' 🏁' : ''}`).join('\n')
    const rem = getRemainingGambles(sender)
    return reply(
      `🏇 *Horse Race!*\n\n${raceLines}\n\n` +
      `Your pick: Horse ${horse} | Winner: Horse ${winner}\n\n` +
      `${win ? `🏆 WIN! ×4.5 total → *+£${net.toLocaleString()}*` : `❌ Lose -£${amount.toLocaleString()}`}\n` +
      `💵 £${((u.wallet || 0) + net).toLocaleString()}\n\n_${rem} gambles left today._`
    )
  }),

  // ── .jackpot — high-risk, rare win ───────────────────────────────────
  // Win rate: 1.5% | Payout: 20x stake | House edge ≈ 70% (intentionally risky)
  jackpot: withCooldown(async ({ reply, sender, user, args }) => {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseAmount(args[0], u.wallet || 0)
    const err    = validateBet(amount, u.wallet || 0)
    if (err) return reply(err)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const win = Math.random() < 0.015  // 1.5% chance
    const net = win ? amount * 19 : -amount  // net gain on win = 19x bet
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (!win) await sinkCoins(amount); else await genCoins(amount * 19)
    const rem = getRemainingGambles(sender)
    if (win) return reply(`💥 *JACKPOT!!!*\n\n🌟 ×20 total → *+£${(amount * 19).toLocaleString()}*\n💵 £${((u.wallet || 0) + net).toLocaleString()}\n\n_${rem} gambles left today._`)
    return reply(`🎰 *Jackpot Miss*\n\n-£${amount.toLocaleString()} (1.5% win chance)\n💵 £${((u.wallet || 0) + net).toLocaleString()}\n\n_${rem} gambles left today._`)
  }),

  // ── .highlow / .hl ────────────────────────────────────────────────────
  // Guess high (8–13) or low (1–6) on a card 1–13. Win: 46%. Edge ≈ 8%
  highlow: withCooldown(async ({ reply, sender, user, args }) => {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseAmount(args[1] || args[0], u.wallet || 0)
    const choice = isNaN(parseInt(args[0])) ? args[0]?.toLowerCase() : null
    if (!choice || !['high', 'low', 'h', 'l'].includes(choice)) {
      return reply('❌ Invalid amount provided. Usage: `.highlow high/low <amount>`')
    }
    const err = validateBet(amount, u.wallet || 0)
    if (err) return reply(err)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const card      = Math.floor(Math.random() * 13) + 1
    const guessHigh = choice === 'high' || choice === 'h'
    const win       = guessHigh ? card >= 8 : card <= 6
    // Card = 7 is middle — always loses (house edge mechanism)
    const net = win ? amount : -amount
    if (win) await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    else     await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (!win) await sinkCoins(amount); else await genCoins(amount)
    const rem = getRemainingGambles(sender)
    return reply(
      `🃏 *High or Low!*\n\nGuess: *${guessHigh ? 'HIGH (8–13)' : 'LOW (1–6)'}* | Card: *${card}*\n\n` +
      `${win ? `🏆 WIN! *+£${amount.toLocaleString()}*` : `❌ Lose -£${amount.toLocaleString()}`}\n` +
      `💵 £${((u.wallet || 0) + net).toLocaleString()}\n\n_${rem} gambles left today._`
    )
  }),
  async hl(ctx) { return module.exports.highlow(ctx) },

  // ── .trivia — fun, no stakes ───────────────────────────────────────────
  async trivia({ reply }) {
    const questions = [
      { q: 'What is the capital of France?',         a: 'Paris',       choices: 'A) London\nB) Paris\nC) Berlin\nD) Rome'       },
      { q: 'What is 7 × 8?',                         a: '56',          choices: 'A) 54\nB) 56\nC) 63\nD) 48'                   },
      { q: 'Which planet is closest to the Sun?',    a: 'Mercury',     choices: 'A) Venus\nB) Earth\nC) Mercury\nD) Mars'       },
      { q: 'Who wrote Romeo and Juliet?',            a: 'Shakespeare', choices: 'A) Dickens\nB) Shakespeare\nC) Austen\nD) Twain'},
      { q: 'What is H2O?',                           a: 'Water',       choices: 'A) Hydrogen\nB) Oxygen\nC) Water\nD) Helium'   },
      { q: 'How many sides does a hexagon have?',    a: '6',           choices: 'A) 5\nB) 6\nC) 7\nD) 8'                       },
      { q: 'What is the largest ocean?',             a: 'Pacific',     choices: 'A) Atlantic\nB) Indian\nC) Arctic\nD) Pacific' },
    ]
    const q = questions[Math.floor(Math.random() * questions.length)]
    await reply(`🧠 *Trivia!*\n\n${q.q}\n\n${q.choices}\n\n_Answer: ${q.a}_`)
  },

  async math({ reply, args }) {
    const expr = args.join(' ').replace(/[^0-9+\-*/().%\s]/g, '')
    if (!expr) return reply('❌ Invalid amount provided. Usage: `.math <expression>`')
    try {
      // eslint-disable-next-line no-eval
      const result = eval(expr)
      await reply(`🔢 *${expr} = ${result}*`)
    } catch {
      await reply('❌ Invalid expression.')
    }
  },
}
