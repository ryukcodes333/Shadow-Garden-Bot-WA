const db = require('../database')

module.exports = {
  async bet({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: .bet <amount>')
    if (amount > (u.wallet || 0)) return reply(`❌ Insufficient funds! You have: ${u.wallet || 0} coins`)
    const roll = Math.random()
    const win = roll > 0.5
    const multiplier = win ? (roll > 0.9 ? 3 : roll > 0.75 ? 2 : 1.5) : 0
    const winnings = win ? Math.floor(amount * multiplier) : 0
    const net = win ? winnings - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (win) {
      return reply(`🎲 *BET WON!*\n\n👤 ${u.name || sender}\n💰 Bet: ${amount} | ${multiplier}x → *+${winnings} coins*\n💵 Balance: ${(u.wallet || 0) + net}`)
    }
    return reply(`🎲 *BET LOST*\n\n👤 ${u.name || sender}\n💸 Lost: ${amount} coins\n💵 Balance: ${(u.wallet || 0) - amount}`)
  },

  async cf({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const choice = args[0]?.toLowerCase()
    const amount = parseInt(args[1])
    if (!['heads','tails','h','t'].includes(choice) || !amount || amount <= 0) {
      return reply('⚠️ Usage: .cf heads/tails <amount>')
    }
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins! You have ${u.wallet || 0}.`)
    const flip = Math.random() > 0.5 ? 'heads' : 'tails'
    const normalised = choice === 'h' ? 'heads' : choice === 't' ? 'tails' : choice
    const win = normalised === flip
    const winnings = win ? amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + winnings })
    return reply(`🪙 *COIN FLIP BET*\n\n👤 ${u.name || sender}\n🤞 Bet: ${normalised.toUpperCase()} | Result: ${flip.toUpperCase()}\n\n${win ? `✅ WIN! +${amount} coins` : `❌ LOSE! -${amount} coins`}\n💵 Balance: ${(u.wallet || 0) + winnings}`)
  },

  async slots({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: .slots <amount>')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins! You have ${u.wallet || 0}.`)
    const symbols = ['🍒','🍋','🍇','⭐','💎','🔔','🃏']
    const reels = [0,1,2].map(() => symbols[Math.floor(Math.random() * symbols.length)])
    let multiplier = 0
    let label = 'No Match'
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      if (reels[0] === '💎') { multiplier = 10; label = '💎 JACKPOT!' }
      else if (reels[0] === '⭐') { multiplier = 5; label = '⭐ MEGA WIN!' }
      else { multiplier = 3; label = '🎉 THREE OF A KIND!' }
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
      multiplier = 1.5; label = '✨ Two of a Kind!'
    }
    const net = multiplier > 0 ? Math.floor(amount * multiplier) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(`🎰 *SLOTS*\n\n│ ${reels[0]} │ ${reels[1]} │ ${reels[2]} │\n\n${multiplier > 0 ? `🏆 ${label} — ${multiplier}x → +${Math.floor(amount * multiplier)} coins` : `❌ No Match — -${amount} coins`}\n💵 Balance: ${(u.wallet || 0) + net}`)
  },

  async sl(ctx) { return module.exports.slots(ctx) },

  async dice({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    const guess = parseInt(args[1])
    if (!amount || !guess || guess < 1 || guess > 6) {
      return reply('⚠️ Usage: .dice <amount> <guess 1-6>')
    }
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins!`)
    const roll = Math.floor(Math.random() * 6) + 1
    const win = roll === guess
    const net = win ? amount * 5 - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(`🎲 *DICE*\n\n👤 ${u.name || sender}\n🤞 Guess: ${guess} | Rolled: *${roll}*\n\n${win ? `🏆 CORRECT! +${amount * 5} coins (5x)` : `❌ WRONG! -${amount} coins`}\n💵 Balance: ${(u.wallet || 0) + net}`)
  },

  async rps({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[1]) || parseInt(args[0])
    const choice = (args[0]?.toLowerCase() === args[0] && isNaN(parseInt(args[0]))) ? args[0].toLowerCase() : null
    if (!choice || !['rock','paper','scissors','r','p','s'].includes(choice)) {
      return reply('⚠️ Usage: .rps <rock/paper/scissors> <amount>')
    }
    if (!amount || amount <= 0 || amount > (u.wallet || 0)) return reply(`❌ Invalid amount. You have ${u.wallet || 0} coins.`)
    const map = { r: 'rock', p: 'paper', s: 'scissors' }
    const playerMove = map[choice] || choice
    const moves = ['rock', 'paper', 'scissors']
    const botMove = moves[Math.floor(Math.random() * 3)]
    const emojis = { rock: '🪨', paper: '📄', scissors: '✂️' }
    let result = 'draw'
    if ((playerMove === 'rock' && botMove === 'scissors') || (playerMove === 'scissors' && botMove === 'paper') || (playerMove === 'paper' && botMove === 'rock')) result = 'win'
    else if (playerMove !== botMove) result = 'lose'
    const net = result === 'win' ? amount : result === 'draw' ? 0 : -amount
    if (result !== 'draw') await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(`🪨📄✂️ *RPS*\n\n🤜 You: ${emojis[playerMove]} | 🤖 Bot: ${emojis[botMove]}\n\n${result === 'win' ? `🏆 WIN! +${amount}` : result === 'draw' ? `🤝 DRAW!` : `❌ LOSE! -${amount}`} coins\n💵 Balance: ${(u.wallet || 0) + net}`)
  },

  async blackjack({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: .blackjack <amount>')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins! You have ${u.wallet || 0}.`)
    const card = () => Math.min(Math.floor(Math.random() * 13) + 1, 10)
    const playerCards = [card(), card()]
    const dealerCards = [card(), card()]
    const playerSum = playerCards.reduce((a, b) => a + b, 0)
    const dealerSum = dealerCards.reduce((a, b) => a + b, 0)
    const playerBust = playerSum > 21
    const dealerBust = dealerSum > 21
    let result = 'lose'
    if (!playerBust && (dealerBust || playerSum > dealerSum)) result = 'win'
    else if (!playerBust && playerSum === dealerSum) result = 'draw'
    const net = result === 'win' ? amount : result === 'draw' ? 0 : -amount
    if (result !== 'draw') await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(`🃏 *BLACKJACK*\n\n🎴 You: ${playerCards.join('+')} = *${playerSum}*\n🤖 Dealer: ${dealerCards.join('+')} = *${dealerSum}*\n\n${playerBust ? '💥 BUST!' : dealerBust ? '💥 Dealer BUST!' : ''}\n${result === 'win' ? `🏆 WIN! +${amount}` : result === 'draw' ? `🤝 PUSH!` : `❌ LOSE! -${amount}`} coins\n💵 Balance: ${(u.wallet || 0) + net}`)
  },

  async bj(ctx) { return module.exports.blackjack(ctx) },

  async poker({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: .poker <amount>')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins! You have ${u.wallet || 0}.`)
    const suits = ['♠️','♥️','♦️','♣️']
    const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
    const deck = suits.flatMap(s => values.map(v => `${v}${s}`))
    const hand = [...deck].sort(() => Math.random() - 0.5).slice(0, 5)
    const hands = ['High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush']
    const handIdx = Math.floor(Math.random() * (hand.join('').includes('A') ? 5 : 4))
    const handName = hands[handIdx]
    const multipliers = [0, 1.5, 2, 3, 5, 7, 10, 15, 25, 100]
    const mult = multipliers[handIdx] || 0
    const net = mult > 0 ? Math.floor(amount * mult) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(`🂡 *POKER*\n\n🃏 Hand: ${hand.join(' ')}\n\n🎯 ${handName}\n${mult > 0 ? `🏆 WIN! ${mult}x → +${Math.floor(amount * mult)} coins` : `❌ No winning hand — -${amount} coins`}\n💵 Balance: ${(u.wallet || 0) + net}`)
  },

  async spin({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: .spin <amount>')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins!`)
    const outcomes = [
      { label: '💀 Bankrupt', mult: 0 },
      { label: '💸 x0.5', mult: 0.5 },
      { label: '🔄 x1 Back', mult: 1 },
      { label: '💰 x1.5', mult: 1.5 },
      { label: '⭐ x2', mult: 2 },
      { label: '💎 x3', mult: 3 },
      { label: '🌟 x5 BONUS', mult: 5 },
      { label: '🎯 x0.5', mult: 0.5 },
    ]
    const result = outcomes[Math.floor(Math.random() * outcomes.length)]
    const net = Math.floor(amount * result.mult) - amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(`🎡 *WHEEL SPIN*\n\n🎯 Landed: *${result.label}*\n\n${net >= 0 ? `💰 +${net} coins` : `💸 ${net} coins`}\n💵 Balance: ${(u.wallet || 0) + net}`)
  },

  async jackpot({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: .jackpot <amount>')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins!`)
    const win = Math.random() < 0.05
    const net = win ? amount * 50 - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    if (win) return reply(`💥 *JACKPOT HIT!!!*\n\n🌟🌟🌟 YOU HIT THE JACKPOT! 🌟🌟🌟\n\n💰 Bet: ${amount} → Won: *${amount * 50} coins* (50x!)\n💵 Balance: ${(u.wallet || 0) + net}`)
    return reply(`🎰 *JACKPOT MISS*\n\n💸 Lost ${amount} coins (5% chance)\n💵 Balance: ${(u.wallet || 0) - amount}`)
  },

  async highlow({ reply, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[1]) || parseInt(args[0])
    const choice = isNaN(parseInt(args[0])) ? args[0]?.toLowerCase() : null
    if (!choice || !['high','low','h','l'].includes(choice) || !amount || amount <= 0) {
      return reply('⚠️ Usage: .highlow high/low <amount>\n\nGuess if the next card is Higher or Lower than 7.')
    }
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins!`)
    const card = Math.floor(Math.random() * 13) + 1
    const isHigh = card > 7
    const guessHigh = choice === 'high' || choice === 'h'
    const win = (guessHigh && isHigh) || (!guessHigh && !isHigh)
    const net = win ? amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet || 0) + net })
    return reply(`🃏 *HIGH OR LOW*\n\n🤞 Guess: ${guessHigh ? 'HIGH' : 'LOW'} (vs 7) | Card: *${card}*\n\n${win ? `🏆 WIN! +${amount}` : `❌ LOSE! -${amount}`} coins\n💵 Balance: ${(u.wallet || 0) + net}`)
  },

  async hl(ctx) { return module.exports.highlow(ctx) },
}
