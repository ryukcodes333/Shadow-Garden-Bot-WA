const db = require('../database')

module.exports = {
  async bet({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('❌ Usage: `.bet <amount>`')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    const roll = Math.random()
    const win  = roll > 0.5
    const multiplier = win ? (roll > 0.9 ? 3 : roll > 0.75 ? 2 : 1.5) : 0
    const net  = win ? Math.floor(amount * multiplier) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (win) return reply(`🎲 *WIN!*\n\n$${amount} × ${multiplier} → *+$${Math.floor(amount * multiplier)}*\n💵 Balance: $${((u.wallet || 0) + net).toLocaleString()}`)
    return reply(`🎲 *LOST*\n\n-$${amount}\n💵 Balance: $${((u.wallet || 0) - amount).toLocaleString()}`)
  },

  async cf({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const choice = args[0]?.toLowerCase()
    const amount = parseInt(args[1])
    if (!['heads', 'tails', 'h', 't'].includes(choice) || !amount || amount <= 0) {
      return reply('❌ Usage: `.cf heads/tails <amount>`')
    }
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    const flip       = Math.random() > 0.5 ? 'heads' : 'tails'
    const normalised = choice === 'h' ? 'heads' : choice === 't' ? 'tails' : choice
    const win        = normalised === flip
    const net        = win ? amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(
      `🪙 *Coin Flip!*\n\n` +
      `Your bet: *${normalised.toUpperCase()}* | Result: *${flip.toUpperCase()}*\n\n` +
      `${win ? `✅ +$${amount}` : `❌ -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}`
    )
  },

  async slots({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('❌ Usage: `.slots <amount>`')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    const symbols  = ['🍒', '🍋', '🍇', '⭐', '💎', '🔔', '🃏']
    const reels    = [0, 1, 2].map(() => symbols[Math.floor(Math.random() * symbols.length)])
    let multiplier = 0, label = 'No Match'
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      if      (reels[0] === '💎') { multiplier = 10; label = '💎 JACKPOT!' }
      else if (reels[0] === '⭐') { multiplier = 5;  label = '⭐ MEGA WIN!' }
      else                        { multiplier = 3;  label = '🎉 Three of a Kind!' }
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
      multiplier = 1.5; label = '✨ Two of a Kind!'
    }
    const net = multiplier > 0 ? Math.floor(amount * multiplier) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(
      `🎰 *Slots!*\n\n│ ${reels[0]} │ ${reels[1]} │ ${reels[2]} │\n\n` +
      `${multiplier > 0 ? `🏆 ${label} - +$${Math.floor(amount * multiplier)}` : `❌ Miss - -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}`
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
    const roll = Math.floor(Math.random() * 6) + 1
    const win  = roll === guess
    const net  = win ? amount * 5 - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(
      `🎲 *Dice Roll!*\n\nGuess: ${guess} | Rolled: *${roll}*\n\n` +
      `${win ? `🏆 Correct! *+$${amount * 5}* (×5)` : `❌ Wrong! -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}`
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
    const map        = { r: 'rock', p: 'paper', s: 'scissors' }
    const playerMove = map[choice] || choice
    const moves      = ['rock', 'paper', 'scissors']
    const botMove    = moves[Math.floor(Math.random() * 3)]
    const emojis     = { rock: '🪨', paper: '📄', scissors: '✂️' }
    let result = 'draw'
    if ((playerMove === 'rock' && botMove === 'scissors') || (playerMove === 'scissors' && botMove === 'paper') || (playerMove === 'paper' && botMove === 'rock')) result = 'win'
    else if (playerMove !== botMove) result = 'lose'
    const net = result === 'win' ? amount : result === 'draw' ? 0 : -amount
    if (result !== 'draw') await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(
      `🪨📄✂️ *Rock Paper Scissors!*\n\nYou: ${emojis[playerMove]} | Bot: ${emojis[botMove]}\n\n` +
      `${result === 'win' ? `🏆 WIN! *+$${amount}*` : result === 'draw' ? `🤝 Draw` : `❌ Lose! -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}`
    )
  },

  async blackjack({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('❌ Usage: `.blackjack <amount>`')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    const card       = () => Math.min(Math.floor(Math.random() * 13) + 1, 10)
    const playerCards = [card(), card()]
    const dealerCards = [card(), card()]
    const playerSum  = playerCards.reduce((a, b) => a + b, 0)
    const dealerSum  = dealerCards.reduce((a, b) => a + b, 0)
    const playerBust = playerSum > 21
    const dealerBust = dealerSum > 21
    let result = 'lose'
    if (!playerBust && (dealerBust || playerSum > dealerSum)) result = 'win'
    else if (!playerBust && playerSum === dealerSum) result = 'draw'
    const net = result === 'win' ? amount : result === 'draw' ? 0 : -amount
    if (result !== 'draw') await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(
      `🃏 *Blackjack!*\n\n` +
      `🎴 You: ${playerCards.join('+')} = *${playerSum}*\n` +
      `🤖 Dealer: ${dealerCards.join('+')} = *${dealerSum}*\n\n` +
      `${playerBust ? '💥 BUST! ' : dealerBust ? '💥 Dealer BUST! ' : ''}` +
      `${result === 'win' ? `🏆 WIN! *+$${amount}*` : result === 'draw' ? `🤝 Push` : `❌ Lose -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}`
    )
  },
  async bj(ctx)     { return module.exports.blackjack(ctx) },
  async casino(ctx) { return module.exports.blackjack(ctx) },

  async poker({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('❌ Usage: `.poker <amount>`')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    const suits  = ['♠️', '♥️', '♦️', '♣️']
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
    const deck   = suits.flatMap(s => values.map(v => `${v}${s}`))
    const hand   = [...deck].sort(() => Math.random() - 0.5).slice(0, 5)
    const hands  = ['High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind']
    const handIdx = Math.floor(Math.random() * (hand.join('').includes('A') ? 5 : 4))
    const handName = hands[handIdx]
    const multipliers = [0, 1.5, 2, 3, 5, 7, 10, 15]
    const mult = multipliers[handIdx] || 0
    const net  = mult > 0 ? Math.floor(amount * mult) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(
      `🂡 *Poker!*\n\n🃏 ${hand.join(' ')}\n\n🎯 ${handName}\n` +
      `${mult > 0 ? `🏆 WIN! ×${mult} → *+$${Math.floor(amount * mult)}*` : `❌ No win - -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}`
    )
  },

  async spin({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('❌ Usage: `.spin <amount>`')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    const outcomes = [
      { label: '💀 Bankrupt', mult: 0 },
      { label: '💸 ×0.5',    mult: 0.5 },
      { label: '🔄 ×1 Back', mult: 1 },
      { label: '💰 ×1.5',    mult: 1.5 },
      { label: '⭐ ×2',      mult: 2 },
      { label: '💎 ×3',      mult: 3 },
      { label: '🌟 ×5 BONUS',mult: 5 },
    ]
    const result = outcomes[Math.floor(Math.random() * outcomes.length)]
    const net    = Math.floor(amount * result.mult) - amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(
      `🎡 *Wheel Spin!*\n\n🎯 *${result.label}*\n\n` +
      `${net >= 0 ? `💰 +$${net}` : `💸 -$${Math.abs(net)}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}`
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
    const num    = Math.floor(Math.random() * 37)
    const color  = num === 0 ? 'green' : num % 2 === 0 ? 'black' : 'red'
    const emoji  = color === 'green' ? '🟢' : color === 'red' ? '🔴' : '⚫'
    let win = false, mult = 0
    if (bet === 'red'   && color === 'red')   { win = true; mult = 2 }
    if (bet === 'black' && color === 'black') { win = true; mult = 2 }
    if (bet === 'green' && color === 'green') { win = true; mult = 14 }
    if (bet === 'odd'   && num > 0 && num % 2 !== 0) { win = true; mult = 2 }
    if (bet === 'even'  && num > 0 && num % 2 === 0) { win = true; mult = 2 }
    if (!isNaN(parseInt(bet)) && parseInt(bet) === num) { win = true; mult = 36 }
    const net = win ? Math.floor(amount * mult) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(
      `🎰 *Roulette!*\n\n` +
      `${emoji} Ball landed on: *${num}* (${color})\n` +
      `Your bet: *${bet}*\n\n` +
      `${win ? `🏆 WIN! ×${mult} → *+$${Math.floor(amount * mult)}*` : `❌ Lose -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}`
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
    const winner   = Math.floor(Math.random() * 6) + 1
    const odds     = [1.5, 2, 2.5, 3, 4, 5]
    const horseOdd = odds[Math.floor(Math.random() * odds.length)]
    const win      = winner === horse
    const net      = win ? Math.floor(amount * horseOdd) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    const raceLines = [1,2,3,4,5,6].map(i => `🐴 Horse ${i}${i === winner ? ' 🏁' : ''}`).join('\n')
    return reply(
      `🏇 *Horse Race!*\n\n${raceLines}\n\n` +
      `Your pick: Horse ${horse} | Winner: Horse ${winner}\n\n` +
      `${win ? `🏆 WIN! ×${horseOdd} → *+$${Math.floor(amount * horseOdd)}*` : `❌ Lose -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}`
    )
  },

  async jackpot({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('❌ Usage: `.jackpot <amount>`')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    const win = Math.random() < 0.05
    const net = win ? amount * 50 - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (win) return reply(`💥 *JACKPOT!!!*\n\n🌟 ×50 → *+$${amount * 50}*\n💵 $${((u.wallet || 0) + net).toLocaleString()}`)
    return reply(`🎰 *Jackpot Miss*\n\n-$${amount} (5% chance)\n💵 $${((u.wallet || 0) - amount).toLocaleString()}`)
  },

  async highlow({ reply, sender, user, args }) {
    const u      = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[1]) || parseInt(args[0])
    const choice = isNaN(parseInt(args[0])) ? args[0]?.toLowerCase() : null
    if (!choice || !['high', 'low', 'h', 'l'].includes(choice) || !amount || amount <= 0) {
      return reply('❌ Usage: `.highlow high/low <amount>`')
    }
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins! Wallet: $${(u.wallet || 0).toLocaleString()}`)
    const card     = Math.floor(Math.random() * 13) + 1
    const isHigh   = card > 7
    const guessHigh = choice === 'high' || choice === 'h'
    const win      = (guessHigh && isHigh) || (!guessHigh && !isHigh)
    const net      = win ? amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(
      `🃏 *High or Low!*\n\nGuess: *${guessHigh ? 'HIGH' : 'LOW'}* | Card: *${card}*\n\n` +
      `${win ? `🏆 WIN! *+$${amount}*` : `❌ Lose -$${amount}`}\n` +
      `💵 $${((u.wallet || 0) + net).toLocaleString()}`
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
