const db = require('../database')

const tttBoards = {}
const wcgGames = {}

function renderTTT(board) {
  const sym = (v) => v === 1 ? '❌' : v === 2 ? '⭕' : v.toString()
  return `${sym(board[0])} │ ${sym(board[1])} │ ${sym(board[2])}\n──┼───┼──\n${sym(board[3])} │ ${sym(board[4])} │ ${sym(board[5])}\n──┼───┼──\n${sym(board[6])} │ ${sym(board[7])} │ ${sym(board[8])}`
}

function checkWin(board, player) {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
  return wins.some(combo => combo.every(i => board[i] === player))
}

module.exports = {
  async ttt({ sock, msg, jid, senderJid, sender, reply, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: .ttt @user')
    const p2 = mentioned[0]
    if (p2 === senderJid) return reply('❌ You can\'t play against yourself!')
    const game = { board: [1,2,3,4,5,6,7,8,9], players: [senderJid, p2], turn: 0, id: Date.now() }
    tttBoards[jid] = game
    await sock.sendMessage(jid, {
      text: `🎮 *TIC TAC TOE*\n\n👤 @${sender} ❌ vs @${p2.split('@')[0]} ⭕\n\n${renderTTT(game.board)}\n\n⚔️ Turn: @${sender} (❌)\n💡 Use .play <1-9>`,
      mentions: [senderJid, p2]
    })
  },

  async play({ sock, msg, jid, senderJid, sender, reply, args }) {
    const game = tttBoards[jid]
    if (!game) {
      const unoGame = await db.getGame(jid, 'uno')
      if (unoGame) return require('./uno').unoplay({ sock, msg, jid, senderJid, sender, reply, args })
      return reply('❌ No active game. Start one with .ttt @user')
    }
    const pos = parseInt(args[0]) - 1
    if (isNaN(pos) || pos < 0 || pos > 8) return reply('⚠️ Enter a number 1-9')
    const currentPlayer = game.players[game.turn]
    if (senderJid !== currentPlayer) return reply('⚠️ It\'s not your turn!')
    if (typeof game.board[pos] !== 'number') return reply('❌ That position is taken!')
    const symbol = game.turn === 0 ? 1 : 2
    game.board[pos] = symbol
    if (checkWin(game.board, symbol)) {
      delete tttBoards[jid]
      const reward = 150
      await db.updateUser(sender, { wallet: ((await db.getOrCreateUser(sender)).wallet || 0) + reward })
      return sock.sendMessage(jid, {
        text: `🏆 *WINNER: @${sender}*\n\n${renderTTT(game.board)}\n\n💰 +${reward} coins!`,
        mentions: [senderJid]
      })
    }
    if (!game.board.some(v => typeof v === 'number')) {
      delete tttBoards[jid]
      return sock.sendMessage(jid, { text: `🤝 *DRAW!*\n\n${renderTTT(game.board)}` })
    }
    game.turn = game.turn === 0 ? 1 : 0
    const nextPlayer = game.players[game.turn]
    const nextSym = game.turn === 0 ? '❌' : '⭕'
    await sock.sendMessage(jid, {
      text: `🎮 *TIC TAC TOE*\n\n${renderTTT(game.board)}\n\n⚔️ Turn: @${nextPlayer.split('@')[0]} (${nextSym})\n💡 .play <1-9>`,
      mentions: [nextPlayer]
    })
  },

  async wcg({ sock, msg, jid, senderJid, sender, reply }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: .wcg @user')
    const p2 = mentioned[0]
    const starters = ['apple', 'elephant', 'tiger', 'rabbit', 'night', 'tree', 'eagle', 'dark', 'shadow']
    const startWord = starters[Math.floor(Math.random() * starters.length)]
    wcgGames[jid] = { players: [senderJid, p2], turn: 0, lastWord: startWord, chain: [startWord], id: Date.now() }
    await sock.sendMessage(jid, {
      text: `🎮 *WORD CHAIN*\n\n👤 @${sender} vs @${p2.split('@')[0]}\n\n📌 Rule: Each word must start with the last letter of the previous word.\n\n🧠 First Word: *${startWord}*\n⚔️ Turn: @${p2.split('@')[0]}`,
      mentions: [senderJid, p2]
    })
  },

  async wordchain({ sock, msg, jid, senderJid, sender, reply, textRaw }) {
    const game = wcgGames[jid]
    if (!game) return
    const currentPlayer = game.players[game.turn]
    if (senderJid !== currentPlayer) return
    const word = textRaw.trim().toLowerCase().replace(/^\./, '')
    if (word.startsWith('.')) return
    if (word[0] !== game.lastWord[game.lastWord.length - 1]) {
      delete wcgGames[jid]
      const opponent = game.players[game.turn === 0 ? 1 : 0]
      const winner = opponent.split('@')[0]
      await db.updateUser(winner, { wallet: ((await db.getOrCreateUser(winner)).wallet || 0) + 200 })
      return sock.sendMessage(jid, {
        text: `🏆 *WINNER: @${winner}*\n\n📊 Chain: ${game.chain.join(' → ')}\n\n🎁 +200 coins\n\n❌ @${sender} failed — "${word}" doesn't start with "${game.lastWord[game.lastWord.length - 1]}"`,
        mentions: [opponent, senderJid]
      })
    }
    game.lastWord = word
    game.chain.push(word)
    game.turn = game.turn === 0 ? 1 : 0
    const next = game.players[game.turn]
    await sock.sendMessage(jid, {
      text: `✅ *${word}*\n\n⚔️ Turn: @${next.split('@')[0]}\nNext letter: *${word[word.length - 1].toUpperCase()}*\nChain: ${game.chain.slice(-5).join(' → ')}`,
      mentions: [next]
    })
  },

  async stopgame({ sock, jid, reply, senderJid, isOwner }) {
    delete tttBoards[jid]
    delete wcgGames[jid]
    await db.endGame && (await db.getGame(jid, 'uno'))?.id && await db.endGame((await db.getGame(jid, 'uno')).id)
    await reply('✅ All active games in this group have been stopped.')
  },

  async startbattle({ sock, msg, jid, sender, senderJid, reply }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: .startbattle @user')
    const target = mentioned[0]
    const myAtk = Math.floor(Math.random() * 30) + 20
    const theirAtk = Math.floor(Math.random() * 30) + 20
    const myFinalHp = Math.max(0, 100 - theirAtk)
    const theirFinalHp = Math.max(0, 100 - myAtk)
    const winner = myFinalHp > theirFinalHp ? sender : target.split('@')[0]
    await db.updateUser(winner, { wallet: ((await db.getOrCreateUser(winner)).wallet || 0) + 300, xp: ((await db.getOrCreateUser(winner)).xp || 0) + 100 })
    await sock.sendMessage(jid, {
      text: `⚔️ *BATTLE*\n\n@${sender} vs @${target.split('@')[0]}\n\n💥 @${sender} dealt ${myAtk} dmg\n💥 @${target.split('@')[0]} dealt ${theirAtk} dmg\n\n❤️ @${sender}: ${myFinalHp}/100 HP\n❤️ @${target.split('@')[0]}: ${theirFinalHp}/100 HP\n\n🏆 Winner: @${winner} — +300 coins!`,
      mentions: [senderJid, target]
    })
  },

  async c4({ sock, msg, jid, sender, senderJid, reply }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: .c4 @user')
    const p2 = mentioned[0]
    await sock.sendMessage(jid, {
      text: `🎮 *CONNECT 4*\n\n👤 @${sender} 🔴 vs @${p2.split('@')[0]} 🟡\n\n⬛⬛⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛⬛⬛\n1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣\n\n⚔️ Turn: @${sender} 🔴\n💡 Use .drop <1-7>`,
      mentions: [senderJid, p2]
    })
  },
}
