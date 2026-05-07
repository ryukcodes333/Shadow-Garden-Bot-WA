const db = require('../database')

const UNO_COLORS = ['🔴', '🔵', '🟢', '🟡']
const UNO_VALUES = ['0','1','2','3','4','5','6','7','8','9','Skip','Reverse','+2']
const SPECIAL_CARDS = ['Wild', 'Wild+4']

function createDeck() {
  const deck = []
  for (const color of UNO_COLORS) {
    for (const val of UNO_VALUES) {
      deck.push({ color, value: val })
      if (val !== '0') deck.push({ color, value: val })
    }
  }
  for (const s of SPECIAL_CARDS) {
    for (let i = 0; i < 4; i++) deck.push({ color: '⬛', value: s })
  }
  return deck.sort(() => Math.random() - 0.5)
}

function dealHand(deck, count = 7) {
  return deck.splice(0, count)
}

function cardStr(card) {
  return `${card.color}${card.value}`
}

function canPlay(card, topCard, currentColor) {
  if (card.value === 'Wild' || card.value === 'Wild+4') return true
  if (card.color === currentColor) return true
  if (card.value === topCard.value) return true
  return false
}

const unoGames = {}

module.exports = {
  async uno({ sock, msg, jid, senderJid, sender, reply, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: *.uno @player2 [@player3 @player4]*\n\nStart a UNO game!')
    if (unoGames[jid]) return reply('❌ A UNO game is already active! Use *.stopgame* to end it.')
    const players = [senderJid, ...mentioned].slice(0, 4)
    if (players.length < 2) return reply('❌ Need at least 2 players!')
    const deck = createDeck()
    const hands = {}
    for (const p of players) {
      hands[p] = dealHand(deck)
    }
    const topCard = deck.splice(0, 1)[0]
    const game = {
      players, hands, deck,
      topCard, currentColor: topCard.color,
      turn: 0, direction: 1,
      createdBy: senderJid,
    }
    unoGames[jid] = game
    const playerNames = players.map(p => `@${p.split('@')[0]}`).join('\n👤 ')
    await sock.sendMessage(jid, {
      text: `🃏 *UNO GAME STARTED*\n\n👤 ${playerNames}\n\n━━━━━━━━━━━━━━━\n\n🎴 *Starting Card:* ${cardStr(topCard)}\n🎨 *Color:* ${topCard.color}\n\n⚡ *Current Turn:* @${players[0].split('@')[0]}\n\n📌 Rule:\nSay .unoplay <card> or .unodraw to pick a card\n\n🚨 Don't forget to say *UNO* when you have 1 card left!\n\n_The chaos of cards begins…_ 🖤`,
      mentions: players
    })
  },

  async startuno(ctx) { return module.exports.uno(ctx) },

  async unoplay({ sock, msg, jid, senderJid, sender, reply, args }) {
    const game = unoGames[jid]
    if (!game) return reply('❌ No UNO game active. Start one with *.uno @players*')
    const currentPlayer = game.players[game.turn]
    if (senderJid !== currentPlayer) return reply('⚠️ It\'s not your turn!')
    const hand = game.hands[senderJid]
    const cardInput = args.join('').toLowerCase()
    const cardIdx = hand.findIndex(c => cardStr(c).toLowerCase().includes(cardInput) || `${c.color}${c.value}`.toLowerCase().includes(cardInput))
    if (cardIdx === -1) return reply(`❌ Card not found in your hand!\n\nYour cards: ${hand.map(cardStr).join(' ')}\n\n💡 Usage: *.unoplay 🔴5* or *.unoplay Wild*`)
    const card = hand[cardIdx]
    if (!canPlay(card, game.topCard, game.currentColor)) {
      return reply(`❌ Can't play ${cardStr(card)}!\n\nTop card: ${cardStr(game.topCard)}\nCurrent color: ${game.currentColor}\n\n_Match color or value to play._ 🖤`)
    }
    hand.splice(cardIdx, 1)
    game.topCard = card
    game.currentColor = card.color === '⬛' ? (args[1] || UNO_COLORS[Math.floor(Math.random() * 4)]) : card.color

    if (hand.length === 0) {
      const winner = senderJid.split('@')[0]
      const reward = 500
      await db.updateUser(winner, { wallet: ((await db.getOrCreateUser(winner)).wallet || 0) + reward })
      const handsLeft = game.players.filter(p => p !== senderJid).map(p => `• @${p.split('@')[0]}: ${(game.hands[p] || []).length} cards`).join('\n')
      delete unoGames[jid]
      return sock.sendMessage(jid, {
        text: `🏆 *UNO WINNER*\n\n👤 *Winner:* @${winner}\n\n━━━━━━━━━━━━━━━\n\n🎴 *Final Hands:*\n${handsLeft}\n\n🎁 Reward: ${reward} coins\n📈 Win Streak: +1\n\n_The last card decides destiny…_ 🖤`,
        mentions: game.players
      })
    }

    if (card.value === '+2') {
      const nextIdx = (game.turn + game.direction + game.players.length) % game.players.length
      const nextPlayer = game.players[nextIdx]
      const drawn = game.deck.splice(0, 2)
      game.hands[nextPlayer] = [...(game.hands[nextPlayer] || []), ...drawn]
      await sock.sendMessage(jid, { text: `⚠️ @${nextPlayer.split('@')[0]} draws 2 cards! 😈`, mentions: [nextPlayer] })
    } else if (card.value === 'Wild+4') {
      const nextIdx = (game.turn + game.direction + game.players.length) % game.players.length
      const nextPlayer = game.players[nextIdx]
      const drawn = game.deck.splice(0, 4)
      game.hands[nextPlayer] = [...(game.hands[nextPlayer] || []), ...drawn]
      await sock.sendMessage(jid, { text: `⚠️ @${nextPlayer.split('@')[0]} draws 4 cards! 💀`, mentions: [nextPlayer] })
    } else if (card.value === 'Reverse') {
      game.direction *= -1
    } else if (card.value === 'Skip') {
      game.turn = (game.turn + game.direction * 2 + game.players.length) % game.players.length
    }

    if (card.value !== 'Skip') {
      game.turn = (game.turn + game.direction + game.players.length) % game.players.length
    }

    const nextPlayer = game.players[game.turn]
    const handsInfo = game.players.map(p => `• @${p.split('@')[0]}: ${(game.hands[p] || []).length} cards`).join('\n')

    await sock.sendMessage(jid, {
      text: `🎴 *CARD PLAYED*\n\n👤 *Player:* @${sender}\n\n🃏 Card: ${cardStr(card)}\n🎨 Color changed to: ${game.currentColor}\n\n━━━━━━━━━━━━━━━\n\n📊 *Hands Left*\n${handsInfo}\n\n⚡ Next Turn: @${nextPlayer.split('@')[0]}\n\n${hand.length === 1 ? `🚨 @${sender} has 1 card — call UNO!` : ''}\n\n_One card changes everything…_ 🖤`,
      mentions: game.players
    })

    if (hand.length === 1) {
      game._unoAlert = sender
    }
  },

  async unodraw({ sock, msg, jid, senderJid, sender, reply }) {
    const game = unoGames[jid]
    if (!game) return reply('❌ No UNO game active.')
    if (senderJid !== game.players[game.turn]) return reply('⚠️ It\'s not your turn!')
    if (!game.deck.length) game.deck = createDeck().splice(0, 20)
    const card = game.deck.splice(0, 1)[0]
    game.hands[senderJid].push(card)
    game.turn = (game.turn + game.direction + game.players.length) % game.players.length
    const nextPlayer = game.players[game.turn]
    await sock.sendMessage(jid, {
      text: `🎴 *CARD DRAWN*\n\n👤 @${sender} drew a card.\nHand size: ${game.hands[senderJid].length}\n\n⚡ Next Turn: @${nextPlayer.split('@')[0]}\n\n_Sometimes you must draw…_ 🖤`,
      mentions: [senderJid, nextPlayer]
    })
  },

  async unohand({ reply, senderJid }) {
    let gameFound = null
    for (const g of Object.values(unoGames)) {
      if (g.players.includes(senderJid)) { gameFound = g; break }
    }
    if (!gameFound) return reply('❌ You\'re not in any UNO game.')
    const hand = gameFound.hands[senderJid] || []
    await reply(`🃏 *YOUR HAND*\n\n${hand.map(cardStr).join(' ')}\n\nCards: ${hand.length}\n\n_Choose wisely._ 🖤`)
  },

  async uno_warning({ sock, jid, msg, senderJid, sender, reply, textRaw }) {
    for (const [gJid, game] of Object.entries(unoGames)) {
      if (gJid !== jid) continue
      if (textRaw?.toLowerCase().includes('uno') && game._unoAlert !== sender) {
        if (game.hands[senderJid]?.length === 1 && game._unoAlert !== sender) {
          return
        }
      }
      if (game._unoAlert && game._unoAlert !== sender && game.players.includes(senderJid)) {
        const alertPlayer = game.players.find(p => p.split('@')[0] === game._unoAlert)
        if (alertPlayer && game.hands[alertPlayer]?.length === 1) {
          const penalty = game.deck.splice(0, 2)
          game.hands[alertPlayer] = [...game.hands[alertPlayer], ...penalty]
          game._unoAlert = null
          await sock.sendMessage(jid, {
            text: `🚨 *UNO WARNING*\n\n👤 *Player:* @${game._unoAlert || sender}\n\n⚠️ You forgot to say *UNO!*\n📉 Penalty: +2 cards drawn\n\n💡 Always call UNO when you reach 1 card!\n\n_The system punishes silence…_ 🖤`,
            mentions: alertPlayer ? [alertPlayer] : []
          })
        }
      }
    }
  },
}
