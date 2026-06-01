const db = require('../database')

// ── Daily gambling tracker (in-memory, resets per calendar day) ──
const dailyTracker = {}
const DAILY_LIMIT  = 15

// ── Per-user cooldown: 10 seconds between any gambling command ──
// This prevents message flooding that causes WhatsApp to force-disconnect the session.
const gambleCooldown = {}
const GAMBLE_CD_MS   = 10000  // 10 seconds

function checkGambleCooldown(phone) {
  const now = Date.now()
  if (gambleCooldown[phone] && now < gambleCooldown[phone]) {
    return gambleCooldown[phone] - now  // ms remaining
  }
  gambleCooldown[phone] = now + GAMBLE_CD_MS
  return 0
}

function checkDailyLimit(phone) {
  const today = new Date().toISOString().split('T')[0]
  if (!dailyTracker[phone] || dailyTracker[phone].date !== today) {
    dailyTracker[phone] = { count: 0, date: today }
  }
  dailyTracker[phone].count++
  return dailyTracker[phone].count > DAILY_LIMIT
}

function getRemainingGambles(phone) {
  const today = new Date().toISOString().split('T')[0]
  if (!dailyTracker[phone] || dailyTracker[phone].date !== today) return DAILY_LIMIT
  return Math.max(0, DAILY_LIMIT - dailyTracker[phone].count)
}

// Win rates: 20% normal, 2% for high stakes (>5000)
function winChance(amount) {
  return amount > 5000 ? 0.02 : 0.20
}

// Wraps a gambling handler to apply the shared 10-second cooldown
function withCooldown(fn) {
  return async function(ctx) {
    try {
      const wait = checkGambleCooldown(ctx.sender)
      if (wait > 0) {
        const secs = Math.ceil(wait / 1000)
        return await ctx.reply(`⏳ Slow down! Wait *${secs}s* before gambling again.`)
      }
      return await fn(ctx)
    } catch (err) {
      console.error('[gamble error]', err?.message || err)
      try { await ctx.reply(`⚠️ Gambling error: ${err?.message || 'unknown'}`) } catch {}
    }
  }
}

module.exports = {
  async bet({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('❌ Usage: `.bet <amount>`')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const win = Math.random() < winChance(amount)
    const payout = win ? Math.floor(amount * 1.8) : 0
    const net = win ? payout - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })

    const remaining = getRemainingGambles(sender)
    if (win) return reply(`🎲 *WIN!*\n\n$${amount} → *+$${payout}*\n💵 Balance: $${((u.wallet || 0) + net).toLocaleString()}\n\n_${remaining} gambles left today._`)
    return reply(`🎲 *LOST*\n\n-$${amount}\n💵 Balance: $${((u.wallet || 0) - amount).toLocaleString()}\n\n_${remaining} gambles left today._`)
  },

  async cf({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const choice = args[0]?.toLowerCase()
    const amount = parseInt(args[1])
    if (!['heads', 'tails', 'h', 't'].includes(choice) || !amount || amount <= 0) {
      return reply('❌ Usage: `.cf heads/tails <amount>`')
    }
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const normalised = choice === 'h' ? 'heads' : choice === 't' ? 'tails' : choice
    const win        = Math.random() < winChance(amount)
    const flip       = win ? normalised : (normalised === 'heads' ? 'tails' : 'heads')
    const net        = win ? amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })

    const remaining = getRemainingGambles(sender)
    return reply(
      `🪙 *Coin Flip!*\n\n` +
      `Your bet: *${normalised.toUpperCase()}* | Result: *${flip.toUpperCase()}*\n\n` +
      `${win ? `✅ +$${amount}` : `❌ -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}\n\n_${remaining} gambles left today._`
    )
  },

  async slots({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('❌ Usage: `.slots <amount>`')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const symbols = ['🍒', '🍋', '🍇', '⭐', '💎', '🔔', '🃏']
    const win     = Math.random() < winChance(amount)
    let reels, multiplier, label

    if (win) {
      // Rigged win: pick a matching triple or a pair
      const sym = symbols[Math.floor(Math.random() * symbols.length)]
      const pairWin = Math.random() < 0.5
      if (pairWin) {
        const third = symbols[Math.floor(Math.random() * symbols.length)]
        reels = [sym, sym, third]
        reels.sort(() => Math.random() - 0.5)
        multiplier = 1.5; label = '✨ Two of a Kind!'
      } else {
        reels = [sym, sym, sym]
        if      (sym === '💎') { multiplier = 5; label = '💎 JACKPOT!' }
        else if (sym === '⭐') { multiplier = 3; label = '⭐ MEGA WIN!' }
        else                   { multiplier = 2; label = '🎉 Three of a Kind!' }
      }
    } else {
      reels = [0, 1, 2].map(() => symbols[Math.floor(Math.random() * symbols.length)])
      while (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
        reels = [0, 1, 2].map(() => symbols[Math.floor(Math.random() * symbols.length)])
      }
      multiplier = 0; label = 'No Match'
    }

    const net = multiplier > 0 ? Math.floor(amount * multiplier) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    const remaining = getRemainingGambles(sender)
    return reply(
      `🎰 *Slots!*\n\n│ ${reels[0]} │ ${reels[1]} │ ${reels[2]} │\n\n` +
      `${multiplier > 0 ? `🏆 ${label} - +$${Math.floor(amount * multiplier)}` : `❌ Miss - -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}\n\n_${remaining} gambles left today._`
    )
  },
  async sl(ctx) { return module.exports.slots(ctx) },

  async dice({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    const guess  = parseInt(args[1])
    if (!amount || !guess || guess < 1 || guess > 6) {
      return reply('❌ Usage: `.dice <amount> <guess 1-6>`')
    }
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const win  = Math.random() < winChance(amount)
    const roll = win ? guess : (() => { let r; do { r = Math.floor(Math.random() * 6) + 1 } while (r === guess); return r })()
    const net  = win ? amount * 4 - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    const remaining = getRemainingGambles(sender)
    return reply(
      `🎲 *Dice Roll!*\n\nGuess: ${guess} | Rolled: *${roll}*\n\n` +
      `${win ? `🏆 Correct! *+$${amount * 4}* (×4)` : `❌ Wrong! -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}\n\n_${remaining} gambles left today._`
    )
  },

  async rps({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[1]) || parseInt(args[0])
    const choice = (args[0]?.toLowerCase() === args[0] && isNaN(parseInt(args[0]))) ? args[0].toLowerCase() : null
    if (!choice || !['rock', 'paper', 'scissors', 'r', 'p', 's'].includes(choice)) {
      return reply('❌ Usage: `.rps <rock/paper/scissors> <amount>`')
    }
    if (!amount || amount <= 0 || amount > (u.wallet || 0)) return reply(`❌ Invalid amount. Wallet: $${(u.wallet || 0).toLocaleString()}`)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const map        = { r: 'rock', p: 'paper', s: 'scissors' }
    const playerMove = map[choice] || choice
    const moves      = ['rock', 'paper', 'scissors']
    const emojis     = { rock: '🪨', paper: '📄', scissors: '✂️' }
    const win        = Math.random() < winChance(amount)
    let botMove
    if (win) {
      // Pick a move that loses to player
      const losers = { rock: 'scissors', paper: 'rock', scissors: 'paper' }
      botMove = losers[playerMove]
    } else {
      // Pick a move that beats player (or draw, but let's always lose player)
      const winners = { rock: 'paper', paper: 'scissors', scissors: 'rock' }
      botMove = Math.random() < 0.1 ? playerMove : winners[playerMove]
    }
    let result = 'lose'
    if ((playerMove === 'rock' && botMove === 'scissors') || (playerMove === 'scissors' && botMove === 'paper') || (playerMove === 'paper' && botMove === 'rock')) result = 'win'
    else if (playerMove === botMove) result = 'draw'
    const net = result === 'win' ? amount : result === 'draw' ? 0 : -amount
    if (result !== 'draw') await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    const remaining = getRemainingGambles(sender)
    return reply(
      `🪨📄✂️ *Rock Paper Scissors!*\n\nYou: ${emojis[playerMove]} | Bot: ${emojis[botMove]}\n\n` +
      `${result === 'win' ? `🏆 WIN! *+$${amount}*` : result === 'draw' ? `🤝 Draw` : `❌ Lose! -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}\n\n_${remaining} gambles left today._`
    )
  },

  async blackjack({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('❌ Usage: `.blackjack <amount>`')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const card        = () => Math.min(Math.floor(Math.random() * 13) + 1, 10)
    const win         = Math.random() < winChance(amount)
    const playerCards = [card(), card()]
    const playerSum   = playerCards.reduce((a, b) => a + b, 0)
    let dealerCards, dealerSum
    if (win) {
      // Dealer busts or gets lower
      dealerCards = [card(), card()]
      dealerSum   = dealerCards.reduce((a, b) => a + b, 0)
      if (dealerSum >= playerSum) dealerCards.push(Math.max(1, 22 - dealerSum))
      dealerSum = dealerCards.reduce((a, b) => a + b, 0)
    } else {
      // Dealer wins
      dealerCards = [card(), card()]
      dealerSum   = dealerCards.reduce((a, b) => a + b, 0)
      while (dealerSum < playerSum && dealerSum <= 21) dealerCards.push(card())
      dealerSum = Math.min(dealerCards.reduce((a, b) => a + b, 0), 21)
    }
    const playerBust = playerSum > 21
    const dealerBust = dealerSum > 21
    let result = 'lose'
    if (!playerBust && (dealerBust || playerSum > dealerSum)) result = 'win'
    else if (!playerBust && playerSum === dealerSum) result = 'draw'
    const net = result === 'win' ? amount : result === 'draw' ? 0 : -amount
    if (result !== 'draw') await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    const remaining = getRemainingGambles(sender)
    return reply(
      `🃏 *Blackjack!*\n\n` +
      `🎴 You: ${playerCards.join('+')} = *${playerSum}*\n` +
      `🤖 Dealer: ${dealerCards.join('+')} = *${dealerSum}*\n\n` +
      `${playerBust ? '💥 BUST! ' : dealerBust ? '💥 Dealer BUST! ' : ''}` +
      `${result === 'win' ? `🏆 WIN! *+$${amount}*` : result === 'draw' ? `🤝 Push` : `❌ Lose -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}\n\n_${remaining} gambles left today._`
    )
  },
  async bj(ctx)     { return module.exports.blackjack(ctx) },
  async casino(ctx) { return module.exports.blackjack(ctx) },

  async poker({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('❌ Usage: `.poker <amount>`')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const suits  = ['♠️', '♥️', '♦️', '♣️']
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    const deck   = suits.flatMap(s => values.map(v => `${v}${s}`))
    const hand   = [...deck].sort(() => Math.random() - 0.5).slice(0, 5)
    const win    = Math.random() < winChance(amount)
    const handIdx = win ? Math.floor(Math.random() * 4) + 1 : 0
    const hands  = ['High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush']
    const handName = hands[handIdx] || hands[0]
    const multipliers = [0, 1.5, 2, 2.5, 3.5, 5]
    const mult = multipliers[handIdx] || 0
    const net  = mult > 0 ? Math.floor(amount * mult) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    const remaining = getRemainingGambles(sender)
    return reply(
      `🂡 *Poker!*\n\n🃏 ${hand.join(' ')}\n\n🎯 ${handName}\n` +
      `${mult > 0 ? `🏆 WIN! ×${mult} → *+$${Math.floor(amount * mult)}*` : `❌ No win - -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}\n\n_${remaining} gambles left today._`
    )
  },

  async spin({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('❌ Usage: `.spin <amount>`')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const win    = Math.random() < winChance(amount)
    const winOut = [
      { label: '💰 ×1.5', mult: 1.5 },
      { label: '⭐ ×2',   mult: 2   },
    ]
    const loseOut = [
      { label: '💀 Bankrupt', mult: 0   },
      { label: '💸 ×0.5',    mult: 0.5 },
    ]
    const result = win
      ? winOut[Math.floor(Math.random() * winOut.length)]
      : loseOut[Math.floor(Math.random() * loseOut.length)]
    const net    = Math.floor(amount * result.mult) - amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    const remaining = getRemainingGambles(sender)
    return reply(
      `🎡 *Wheel Spin!*\n\n🎯 *${result.label}*\n\n` +
      `${net >= 0 ? `💰 +$${net}` : `💸 -$${Math.abs(net)}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}\n\n_${remaining} gambles left today._`
    )
  },

  async roulette({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const bet    = args[0]?.toLowerCase()
    const amount = parseInt(args[1])
    if (!bet || !amount || amount <= 0) {
      return reply('❌ Usage: `.roulette <red/black/green/odd/even/number> <amount>`\n\nExample: `.roulette red 500`')
    }
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const win   = Math.random() < winChance(amount)
    let num, color
    if (win) {
      // Pick a number that satisfies the bet
      if      (bet === 'green')                 { num = 0; color = 'green' }
      else if (bet === 'red')                   { num = 1; color = 'red' }
      else if (bet === 'black')                 { num = 2; color = 'black' }
      else if (bet === 'odd')                   { num = 1; color = 'red' }
      else if (bet === 'even')                  { num = 2; color = 'black' }
      else if (!isNaN(parseInt(bet)))           { num = parseInt(bet); color = num === 0 ? 'green' : num % 2 === 0 ? 'black' : 'red' }
      else                                      { num = Math.floor(Math.random() * 37); color = num === 0 ? 'green' : num % 2 === 0 ? 'black' : 'red' }
    } else {
      do { num = Math.floor(Math.random() * 37) } while (
        (bet === 'red'   && num % 2 !== 0 && num !== 0) ||
        (bet === 'black' && num % 2 === 0 && num !== 0) ||
        (bet === 'green' && num === 0)                  ||
        (bet === 'odd'   && num % 2 !== 0 && num !== 0) ||
        (bet === 'even'  && num % 2 === 0 && num !== 0) ||
        (!isNaN(parseInt(bet)) && parseInt(bet) === num)
      )
      color = num === 0 ? 'green' : num % 2 === 0 ? 'black' : 'red'
    }
    const emoji = color === 'green' ? '🟢' : color === 'red' ? '🔴' : '⚫'
    let mult = 0
    if (bet === 'red'   && color === 'red')   mult = 2
    if (bet === 'black' && color === 'black') mult = 2
    if (bet === 'green' && color === 'green') mult = 7
    if (bet === 'odd'   && num > 0 && num % 2 !== 0) mult = 2
    if (bet === 'even'  && num > 0 && num % 2 === 0) mult = 2
    if (!isNaN(parseInt(bet)) && parseInt(bet) === num) mult = 18
    const net = mult > 0 ? Math.floor(amount * mult) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    const remaining = getRemainingGambles(sender)
    return reply(
      `🎰 *Roulette!*\n\n` +
      `${emoji} Ball landed on: *${num}* (${color})\n` +
      `Your bet: *${bet}*\n\n` +
      `${win ? `🏆 WIN! ×${mult} → *+$${Math.floor(amount * mult)}*` : `❌ Lose -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}\n\n_${remaining} gambles left today._`
    )
  },

  async horse({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const horse  = parseInt(args[0])
    const amount = parseInt(args[1])
    if (!horse || horse < 1 || horse > 6 || !amount || amount <= 0) {
      return reply('❌ Usage: `.horse <1-6> <amount>`\n\nPick a horse (1-6) and bet!')
    }
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const win    = Math.random() < winChance(amount)
    const winner = win ? horse : (() => { let w; do { w = Math.floor(Math.random() * 6) + 1 } while (w === horse); return w })()
    const net    = win ? Math.floor(amount * 2.5) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    const raceLines = [1,2,3,4,5,6].map(i => `🐴 Horse ${i}${i === winner ? ' 🏁' : ''}`).join('\n')
    const remaining = getRemainingGambles(sender)
    return reply(
      `🏇 *Horse Race!*\n\n${raceLines}\n\n` +
      `Your pick: Horse ${horse} | Winner: Horse ${winner}\n\n` +
      `${win ? `🏆 WIN! ×2.5 → *+$${Math.floor(amount * 2.5)}*` : `❌ Lose -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}\n\n_${remaining} gambles left today._`
    )
  },

  async jackpot({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('❌ Usage: `.jackpot <amount>`')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const win = Math.random() < 0.01
    const net = win ? amount * 20 - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    const remaining = getRemainingGambles(sender)
    if (win) return reply(`💥 *JACKPOT!!!*\n\n🌟 ×20 → *+$${amount * 20}*\n💵 $${((u.wallet || 0) + net).toLocaleString()}\n\n_${remaining} gambles left today._`)
    return reply(`🎰 *Jackpot Miss*\n\n-$${amount} (1% chance)\n💵 $${((u.wallet || 0) - amount).toLocaleString()}\n\n_${remaining} gambles left today._`)
  },

  async highlow({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[1]) || parseInt(args[0])
    const choice = isNaN(parseInt(args[0])) ? args[0]?.toLowerCase() : null
    if (!choice || !['high', 'low', 'h', 'l'].includes(choice) || !amount || amount <= 0) {
      return reply('❌ Usage: `.highlow high/low <amount>`')
    }
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    if (checkDailyLimit(sender)) return reply(`🚫 *Daily limit reached!*\n\nYou've used all *${DAILY_LIMIT}* gambles today.\n\n_Come back tomorrow._ 🖤`)

    const win       = Math.random() < winChance(amount)
    const guessHigh = choice === 'high' || choice === 'h'
    const card      = win
      ? (guessHigh ? Math.floor(Math.random() * 6) + 8 : Math.floor(Math.random() * 6) + 1)
      : (guessHigh ? Math.floor(Math.random() * 6) + 1 : Math.floor(Math.random() * 6) + 8)
    const net = win ? amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    const remaining = getRemainingGambles(sender)
    return reply(
      `🃏 *High or Low!*\n\nGuess: *${guessHigh ? 'HIGH' : 'LOW'}* | Card: *${card}*\n\n` +
      `${win ? `🏆 WIN! *+$${amount}*` : `❌ Lose -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}\n\n_${remaining} gambles left today._`
    )
  },
  async hl(ctx) { return module.exports.highlow(ctx) },

  async trivia({ reply }) {
    const questions = [
      { q: 'What is the capital of France?', a: 'Paris', choices: 'A) London\nB) Paris\nC) Berlin\nD) Rome' },
      { q: 'What is 7 × 8?', a: '56', choices: 'A) 54\nB) 56\nC) 63\nD) 48' },
      { q: 'Which planet is closest to the Sun?', a: 'Mercury', choices: 'A) Venus\nB) Earth\nC) Mercury\nD) Mars' },
      { q: 'Who wrote Romeo and Juliet?', a: 'Shakespeare', choices: 'A) Dickens\nB) Shakespeare\nC) Austen\nD) Twain' },
      { q: 'What is H2O?', a: 'Water', choices: 'A) Hydrogen\nB) Oxygen\nC) Water\nD) Helium' },
      { q: 'How many sides does a hexagon have?', a: '6', choices: 'A) 5\nB) 6\nC) 7\nD) 8' },
      { q: 'What is the largest ocean?', a: 'Pacific', choices: 'A) Atlantic\nB) Indian\nC) Arctic\nD) Pacific' },
    ]
    const q = questions[Math.floor(Math.random() * questions.length)]
    await reply(`🧠 *Trivia!*\n\n${q.q}\n\n${q.choices}\n\n_Answer: ${q.a}_`)
  },

  async math({ reply, args }) {
    const expr = args.join(' ').replace(/[^0-9+\-*/().%\s]/g, '')
    if (!expr) return reply('❌ Usage: `.math <expression>`\n\nExample: `.math 100 * 3.5 / 2`')
    try {
      const result = Function(`"use strict"; return (${expr})`)()
      if (!isFinite(result)) return reply(`❌ Result is not finite`)
      await reply(`🧮 ${expr} = *${result}*`)
    } catch { await reply(`❌ Invalid expression`) }
  },
}

// ── Apply 10-second cooldown to all money-gambling commands ──────────────────
// trivia and math are skipped (no wallet risk, no flood potential)
const MONEY_GAMBLES = ['bet','cf','slots','sl','dice','rps','blackjack','bj','casino','poker','spin','roulette','horse','jackpot','highlow','hl']
for (const name of MONEY_GAMBLES) {
  if (typeof module.exports[name] === 'function') {
    module.exports[name] = withCooldown(module.exports[name])
  }
}
