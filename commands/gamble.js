const db = require('../database')

// ── Unpredictable entropy pool ──────────────────────────────────────────────
// Mixes multiple sources so no external model can detect a pattern
const _pool = { v: 0x5A3C }
function shadowRoll() {
  const r1 = Math.random()
  const r2 = Math.random()
  const r3 = Math.random()
  const ns  = process.hrtime()[1]            // nanosecond noise
  const ts  = Date.now() % 97               // low-freq time chaos

  // Non-linear mixing: trig + XOR-like ops on floats
  const wave   = Math.abs(Math.sin(ns * r1 + ts * r2 + _pool.v))
  const ripple = (r1 * r3 + Math.cos(r2 * Math.PI + wave)) * 0.5 + 0.5
  const spike  = (ns % 7 === 0) ? r3 * 0.18 : 0   // sudden entropy spikes

  // Update pool (stateful chaos)
  _pool.v = (_pool.v * 1664525 + 1013904223) & 0xFFFFFFFF

  const score = (ripple + spike) % 1
  return score < 0.471   // target ~47.1% win rate
}

// Weighted secondary roll for multiplier (only called if shadowRoll() wins)
function winMultiplier() {
  const r = Math.random()
  if (r < 0.06)  return { mult: 4.0, label: '💎 JACKPOT' }
  if (r < 0.20)  return { mult: 2.5, label: '⭐ BIG WIN' }
  if (r < 0.55)  return { mult: 1.8, label: '🏆 WIN' }
  return           { mult: 1.3, label: '✅ WIN' }
}

module.exports = {
  async bet({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: .bet <amount>')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins! You have $${(u.wallet || 0).toLocaleString()}`)
    const win = shadowRoll()
    if (win) {
      const { mult, label } = winMultiplier()
      const payout = Math.floor(amount * mult)
      const net    = payout - amount
      await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
      return reply(`🎲 ${label}!\n\n💰 Bet: $${amount.toLocaleString()} → ${mult}x → *+$${net.toLocaleString()}*\n💵 Balance: $${((u.wallet || 0) + net).toLocaleString()}`)
    }
    await db.updateUser(sender, { wallet: (u.wallet || 0) - amount })
    return reply(`🎲 Lost!\n\n💸 -$${amount.toLocaleString()}\n💵 Balance: $${((u.wallet || 0) - amount).toLocaleString()}`)
  },

  async cf({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const choice = args[0]?.toLowerCase()
    const amount = parseInt(args[1])
    if (!['heads','tails','h','t'].includes(choice) || !amount || amount <= 0) {
      return reply('⚠️ Usage: .cf heads/tails <amount>')
    }
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins! You have $${(u.wallet || 0).toLocaleString()}`)
    const flip  = shadowRoll() ? 'heads' : 'tails'
    const norm  = choice === 'h' ? 'heads' : choice === 't' ? 'tails' : choice
    const win   = norm === flip
    const net   = win ? amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(`🪙 *COIN FLIP*\n\n🤞 ${norm.toUpperCase()} | Result: *${flip.toUpperCase()}*\n\n${win ? `✅ WIN! +$${amount.toLocaleString()}` : `❌ LOSE! -$${amount.toLocaleString()}`}\n💵 Balance: $${((u.wallet || 0) + net).toLocaleString()}`)
  },

  async slots({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: .slots <amount>')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins!`)
    const syms = ['🍒','🍋','🍇','⭐','💎','🔔','🃏']
    const reels = [0,1,2].map(() => syms[Math.floor(Math.random() * syms.length)])
    const win = shadowRoll()
    let mult = 0, label = 'No Match'
    if (win) {
      if (reels[0] === reels[1] && reels[1] === reels[2]) {
        if (reels[0] === '💎') { mult = 10; label = '💎 JACKPOT!' }
        else if (reels[0] === '⭐') { mult = 5; label = '⭐ MEGA WIN!' }
        else { mult = 3; label = '🎉 THREE OF A KIND!' }
      } else {
        mult = 1.5; label = '✨ Match!'
      }
    } else {
      // Force reels to not match for visual consistency
      while (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
        reels[2] = syms[Math.floor(Math.random() * syms.length)]
      }
    }
    const net = mult > 0 ? Math.floor(amount * mult) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(`🎰 *SLOTS*\n\n│ ${reels[0]} │ ${reels[1]} │ ${reels[2]} │\n\n${mult > 0 ? `🏆 ${label} — ${mult}x → +$${Math.floor(amount * mult).toLocaleString()}` : `❌ No Match — -$${amount.toLocaleString()}`}\n💵 Balance: $${((u.wallet || 0) + net).toLocaleString()}`)
  },
  async sl(ctx) { return module.exports.slots(ctx) },

  async dice({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    const guess  = parseInt(args[1])
    if (!amount || !guess || guess < 1 || guess > 6) {
      return reply('⚠️ Usage: .dice <amount> <guess 1-6>')
    }
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins!`)
    const roll = Math.floor(Math.random() * 6) + 1
    const win  = roll === guess && shadowRoll()  // must match AND pass win gate
    const net  = win ? amount * 5 - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(`🎲 *DICE*\n\n🤞 Guess: ${guess} | Rolled: *${roll}*\n\n${win ? `🏆 CORRECT! +$${(amount * 5).toLocaleString()} (5x)` : `❌ WRONG! -$${amount.toLocaleString()}`}\n💵 Balance: $${((u.wallet || 0) + net).toLocaleString()}`)
  },

  async rps({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[1]) || parseInt(args[0])
    const choice = (args[0]?.toLowerCase() === args[0] && isNaN(parseInt(args[0]))) ? args[0].toLowerCase() : null
    if (!choice || !['rock','paper','scissors','r','p','s'].includes(choice)) {
      return reply('⚠️ Usage: .rps <rock/paper/scissors> <amount>')
    }
    if (!amount || amount <= 0 || amount > (u.wallet || 0)) return reply(`❌ Invalid amount. You have $${(u.wallet || 0).toLocaleString()}`)
    const map  = { r: 'rock', p: 'paper', s: 'scissors' }
    const pm   = map[choice] || choice
    const moves= ['rock', 'paper', 'scissors']
    const emojis = { rock: '🪨', paper: '📄', scissors: '✂️' }
    const win  = shadowRoll()
    // If win, pick a losing bot move; if lose, pick a winning bot move; draw otherwise
    let bm
    if (win) {
      const losing = { rock: 'scissors', paper: 'rock', scissors: 'paper' }
      bm = losing[pm]
    } else if (Math.random() < 0.1) {
      bm = pm  // draw ~10% of losses
    } else {
      const winning = { rock: 'paper', paper: 'scissors', scissors: 'rock' }
      bm = winning[pm]
    }
    const result = pm === bm ? 'draw' : win ? 'win' : 'lose'
    const net = result === 'win' ? amount : result === 'draw' ? 0 : -amount
    if (result !== 'draw') await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(`🪨📄✂️ *RPS*\n\n🤜 You: ${emojis[pm]} | 🤖 Bot: ${emojis[bm]}\n\n${result === 'win' ? `🏆 WIN! +$${amount.toLocaleString()}` : result === 'draw' ? `🤝 DRAW!` : `❌ LOSE! -$${amount.toLocaleString()}`}\n💵 Balance: $${((u.wallet || 0) + net).toLocaleString()}`)
  },

  async blackjack({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: .blackjack <amount>')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins!`)
    const card = () => Math.min(Math.floor(Math.random() * 13) + 1, 10)
    const playerCards = [card(), card()]
    const dealerCards = [card(), card()]
    const ps = playerCards.reduce((a, b) => a + b, 0)
    const ds = dealerCards.reduce((a, b) => a + b, 0)
    const pBust = ps > 21
    const dBust = ds > 21
    const win = shadowRoll()
    let result = 'lose'
    if (!pBust && (win || dBust)) result = 'win'
    else if (!pBust && ps === ds) result = 'draw'
    const net = result === 'win' ? amount : result === 'draw' ? 0 : -amount
    if (result !== 'draw') await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(`🃏 *BLACKJACK*\n\n🎴 You: ${playerCards.join('+')} = *${ps}*\n🤖 Dealer: ${dealerCards.join('+')} = *${ds}*\n\n${pBust ? '💥 BUST!' : dBust ? '💥 Dealer BUST!' : ''} ${result === 'win' ? `🏆 WIN! +$${amount.toLocaleString()}` : result === 'draw' ? `🤝 PUSH!` : `❌ LOSE! -$${amount.toLocaleString()}`}\n💵 Balance: $${((u.wallet || 0) + net).toLocaleString()}`)
  },
  async bj(ctx)     { return module.exports.blackjack(ctx) },
  async casino(ctx) { return module.exports.blackjack(ctx) },

  async poker({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: .poker <amount>')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins!`)
    const suits = ['♠️','♥️','♦️','♣️']
    const vals  = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
    const deck  = suits.flatMap(s => vals.map(v => `${v}${s}`))
    const hand  = [...deck].sort(() => Math.random() - 0.5).slice(0, 5)
    const wins  = shadowRoll()
    const hands = ['High Card','One Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush']
    const mults = [0, 1.5, 2, 3, 5, 7, 10, 15, 25]
    const idx   = wins ? Math.floor(Math.random() * 8) + 1 : 0
    const mult  = mults[idx] || 0
    const net   = mult > 0 ? Math.floor(amount * mult) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(`🂡 *POKER*\n\n🃏 Hand: ${hand.join(' ')}\n\n🎯 ${hands[idx]}\n${mult > 0 ? `🏆 ${mult}x → +$${Math.floor(amount * mult).toLocaleString()}` : `❌ No winning hand — -$${amount.toLocaleString()}`}\n💵 Balance: $${((u.wallet || 0) + net).toLocaleString()}`)
  },

  async spin({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: .spin <amount>')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins!`)
    const outcomes = [
      { label: '💀 Bankrupt', mult: 0 },
      { label: '💸 x0.5',     mult: 0.5 },
      { label: '🔄 x1 Back',  mult: 1 },
      { label: '💰 x1.5',     mult: 1.5 },
      { label: '⭐ x2',       mult: 2 },
      { label: '💎 x3',       mult: 3 },
      { label: '🌟 x5 BONUS', mult: 5 },
    ]
    const win    = shadowRoll()
    const winOutcomes  = outcomes.filter(o => o.mult >= 1.5)
    const loseOutcomes = outcomes.filter(o => o.mult < 1.5)
    const pool   = win ? winOutcomes : loseOutcomes
    const result = pool[Math.floor(Math.random() * pool.length)]
    const net    = Math.floor(amount * result.mult) - amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(`🎡 *WHEEL SPIN*\n\n🎯 Landed: *${result.label}*\n\n${net >= 0 ? `💰 +$${net.toLocaleString()}` : `💸 -$${Math.abs(net).toLocaleString()}`}\n💵 Balance: $${((u.wallet || 0) + net).toLocaleString()}`)
  },

  async jackpot({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: .jackpot <amount>')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins!`)
    // Jackpot: 5% base win chance, gated through shadowRoll for unpredictability
    const win = shadowRoll() && Math.random() < 0.10
    const net = win ? amount * 50 - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (win) return reply(`💥 *JACKPOT HIT!!!*\n\n🌟 YOU HIT THE JACKPOT! 🌟\n\n💰 $${amount.toLocaleString()} → *$${(amount * 50).toLocaleString()}* (50x!)\n💵 Balance: $${((u.wallet || 0) + net).toLocaleString()}`)
    return reply(`🎰 *JACKPOT MISS*\n\n💸 -$${amount.toLocaleString()} (5% chance)\n💵 Balance: $${((u.wallet || 0) - amount).toLocaleString()}`)
  },

  async highlow({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[1]) || parseInt(args[0])
    const choice = isNaN(parseInt(args[0])) ? args[0]?.toLowerCase() : null
    if (!choice || !['high','low','h','l'].includes(choice) || !amount || amount <= 0) {
      return reply('⚠️ Usage: .highlow high/low <amount>\n\nGuess if the next card is Higher or Lower than 7.')
    }
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins!`)
    const win      = shadowRoll()
    const guessHigh = choice === 'high' || choice === 'h'
    // Generate card that matches the outcome
    const card = win
      ? (guessHigh ? Math.floor(Math.random() * 6) + 8 : Math.floor(Math.random() * 6) + 1)
      : (guessHigh ? Math.floor(Math.random() * 7) + 1 : Math.floor(Math.random() * 6) + 8)
    const net = win ? amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(`🃏 *HIGH OR LOW*\n\n🤞 Guess: ${guessHigh ? 'HIGH' : 'LOW'} (vs 7) | Card: *${card}*\n\n${win ? `🏆 WIN! +$${amount.toLocaleString()}` : `❌ LOSE! -$${amount.toLocaleString()}`}\n💵 Balance: $${((u.wallet || 0) + net).toLocaleString()}`)
  },
  async hl(ctx) { return module.exports.highlow(ctx) },

  async roulette({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[1]) || parseInt(args[0])
    const bet    = args.find(a => isNaN(parseInt(a)))?.toLowerCase()
    if (!bet || !amount || amount <= 0) return reply('⚠️ Usage: .roulette red/black/green/odd/even <amount>')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins!`)
    const num  = Math.floor(Math.random() * 37)   // 0-36
    const col  = num === 0 ? 'green' : num % 2 === 0 ? 'black' : 'red'
    const parity = num === 0 ? 'none' : num % 2 === 0 ? 'even' : 'odd'
    const win  = shadowRoll() && (
      (bet === 'green'  && num === 0) ||
      (bet === 'red'    && col === 'red')   ||
      (bet === 'black'  && col === 'black') ||
      (bet === 'odd'    && parity === 'odd')  ||
      (bet === 'even'   && parity === 'even')
    )
    const mult = bet === 'green' ? 17 : 2
    const net  = win ? Math.floor(amount * mult) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    const colEmoji = { red: '🔴', black: '⚫', green: '🟢' }[col]
    return reply(`🎡 *ROULETTE*\n\n🎯 Bet: ${bet.toUpperCase()} | Ball: *${num}* ${colEmoji}\n\n${win ? `🏆 WIN! ${mult}x → +$${Math.floor(amount * mult).toLocaleString()}` : `❌ LOSE! -$${amount.toLocaleString()}`}\n💵 Balance: $${((u.wallet || 0) + net).toLocaleString()}`)
  },

  async horse({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[1]) || parseInt(args[0])
    const pick   = parseInt(args.find(a => !isNaN(parseInt(a)) && parseInt(a) >= 1 && parseInt(a) <= 4))
    if (!pick || !amount || amount <= 0) return reply('⚠️ Usage: .horse <1-4> <amount>\n\nPick a horse (1-4) and bet on it winning.')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins!`)
    const winner = shadowRoll()
      ? pick     // if player wins, their horse wins
      : (pick % 4) + 1   // otherwise a different horse wins
    const win  = winner === pick
    const mult = 3.5
    const net  = win ? Math.floor(amount * mult) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    const horses = ['🐴','🐎','🏇','🦄']
    return reply(`🏇 *HORSE RACE*\n\n${horses.map((h, i) => `${h} Horse ${i + 1}${i + 1 === pick ? ' ← you' : ''}${i + 1 === winner ? ' 🏆' : ''}`).join(' | ')}\n\n${win ? `🏆 Your horse won! +$${Math.floor(amount * mult).toLocaleString()} (3.5x)` : `❌ Horse ${winner} won! -$${amount.toLocaleString()}`}\n💵 Balance: $${((u.wallet || 0) + net).toLocaleString()}`)
  },
}
