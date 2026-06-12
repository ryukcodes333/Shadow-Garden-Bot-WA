'use strict'
// ╔══════════════════════════════════════════════╗
// ║        🎴  UNO  —  commands/uno.js           ║
// ╚══════════════════════════════════════════════╝
// Lobby-based multiplayer UNO with interactive quick-reply buttons.
// Uses @dark-yasiya/baileys interactiveButtons API.

const COLORS      = ['🔴','🔵','🟡','🟢']
const COLOR_NAMES = { '🔴':'Red','🔵':'Blue','🟡':'Yellow','🟢':'Green' }
const VALUES      = ['0','1','2','3','4','5','6','7','8','9','Skip','Reverse','+2']
const WILDS       = ['Wild','Wild+4']

const unoGames = new Map()

// ── Card helpers ─────────────────────────────────────────────────────────────

function mkCard(color, value) { return { color, value } }
function cardStr(c) { return c.color === '⚫' ? `⚫ ${c.value}` : `${c.color} ${c.value}` }

function cardRowId(c) {
  const col = c.color === '⚫' ? 'wild' : c.color.codePointAt(0).toString(36)
  return `play_${col}_${c.value.replace('+','p').replace(' ','_')}`
}

function cardFromRowId(rowId) {
  const rest    = rowId.replace('play_', '')
  const colCode = rest.split('_')[0]
  const val     = rest.slice(colCode.length + 1).replace('p','+').replace('_',' ')
  let color
  if (colCode === 'wild') color = '⚫'
  else color = COLORS.find(c => c.codePointAt(0).toString(36) === colCode) || '⚫'
  return { color, value: val }
}

function newDeck() {
  const d = []
  for (const color of COLORS) {
    d.push(mkCard(color, '0'))
    for (const val of VALUES.filter(v => v !== '0')) {
      d.push(mkCard(color, val))
      d.push(mkCard(color, val))
    }
  }
  for (const w of WILDS) for (let i = 0; i < 4; i++) d.push(mkCard('⚫', w))
  return d.sort(() => Math.random() - 0.5)
}

function dealCards(deck, n = 7) { return deck.splice(0, n) }

function canPlay(card, topCard, currentColor) {
  if (card.color === '⚫') return true
  if (card.color === currentColor) return true
  if (card.value === topCard.value) return true
  return false
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function gameStatus(game) {
  const cur     = game.players[game.turn]
  const curName = `@${cur.split('@')[0]}`
  const counts  = game.players.map(p => `• @${p.split('@')[0]}: ${game.hands[p].length} cards`).join('\n')
  return (
    `🎴 *UNO*\n\n` +
    `📌 *Top Card:* ${cardStr(game.topCard)}\n` +
    `🎨 *Color:* ${game.currentColor === '⚫' ? '⚫ Wild' : COLOR_NAMES[game.currentColor] || game.currentColor}\n` +
    `🃏 *Draw pile:* ~${game.deck.length} cards\n\n` +
    `📊 *Card counts:*\n${counts}\n\n` +
    `⚡ *Turn:* ${curName}`
  )
}

// ── Send turn message with quick-reply buttons ────────────────────────────────

async function sendTurnMessage(sock, jid, game) {
  const cur = game.players[game.turn]
  try {
    await sock.sendMessage(jid, {
      text: gameStatus(game),
      title: '🎴 UNO',
      footer: `@${cur.split('@')[0]}'s turn`,
      interactiveButtons: [
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: '🃏 View My Hand', id: `uno_hand_${jid}` })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: '➕ Draw Card', id: `uno_draw_${jid}` })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: '🔴 UNO!', id: `uno_call_${jid}` })
        },
      ],
      mentions: game.players,
    })
  } catch {
    await sock.sendMessage(jid, { text: gameStatus(game) + '\n\n_Reply uno_hand, uno_draw, or uno_call_', mentions: game.players })
  }
}

// ── Color picker buttons ──────────────────────────────────────────────────────

async function sendColorPicker(sock, jid, msg) {
  try {
    await sock.sendMessage(jid, {
      text: '🌈 *Pick a color for the Wild card:*',
      title: '🎴 UNO — Choose Color',
      footer: 'Tap your color',
      interactiveButtons: [
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: '🔴 Red', id: `color_red` })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: '🔵 Blue', id: `color_blue` })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: '🟡 Yellow', id: `color_yellow` })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: '🟢 Green', id: `color_green` })
        },
      ],
    }, { quoted: msg })
  } catch {
    await sock.sendMessage(jid, { text: '🌈 Pick a color: Reply *red*, *blue*, *yellow*, or *green*' })
  }
}

// ── Game flow helpers ─────────────────────────────────────────────────────────

function nextPlayer(game, skip = 0) {
  game.turn = (game.turn + game.direction * (1 + skip) + game.players.length * 10) % game.players.length
}

function reshuffleDeck(game) {
  const top      = game.topCard
  const discards = game.discardPile.splice(0, game.discardPile.length - 1)
  game.deck      = discards.sort(() => Math.random() - 0.5)
  game.discardPile = [top]
}

function drawCards(game, jid, n) {
  if (game.deck.length < n) reshuffleDeck(game)
  const drawn = game.deck.splice(0, n)
  game.hands[jid] = [...(game.hands[jid] || []), ...drawn]
  return drawn
}

async function checkWin(sock, jid, game, playerJid) {
  if (game.hands[playerJid].length === 0) {
    const winner   = `@${playerJid.split('@')[0]}`
    const mentions = game.players
    unoGames.delete(jid)
    await sock.sendMessage(jid, {
      text: `🏆 *UNO WINNER!*\n\n🎉 ${winner} has played all their cards!\n\n_The chaos ends…_`,
      mentions,
    })
    try {
      await sock.sendMessage(jid, {
        text: 'Want to play again?',
        title: '🎴 UNO',
        footer: 'Game Over',
        interactiveButtons: [
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({ display_text: '🔄 Play Again', id: `uno_rematch_${jid}` })
          },
          {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({ display_text: '❌ End Game', id: `uno_end_${jid}` })
          },
        ],
      })
    } catch {
      await sock.sendMessage(jid, { text: 'Game over! Type *.uno* to start a new game.' })
    }
    return true
  }
  return false
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  unoGames,

  async uno({ sock, msg, jid, senderJid, sender, reply }) {
    if (unoGames.has(jid)) {
      const g = unoGames.get(jid)
      if (g.status === 'lobby') return reply(`❌ A lobby already exists! Use *.joinuno* to join or *.unostart* to begin.`)
      return reply('❌ A UNO game is already active here!')
    }
    unoGames.set(jid, {
      status: 'lobby', host: senderJid, players: [senderJid],
      hands: {}, deck: [], discardPile: [],
      topCard: null, currentColor: null,
      turn: 0, direction: 1, pendingColor: null,
      unoCalled: new Set(), lastPlayTime: Date.now(),
    })
    await sock.sendMessage(jid, {
      text: `🎴 *UNO LOBBY CREATED!*\n\n👑 Host: @${sender}\n\n📢 Others can type *.joinuno* to join (max 8 players)\n\nWhen ready, host types *.unostart*`,
      mentions: [senderJid],
    })
  },

  async joinuno({ sock, msg, jid, senderJid, sender, reply }) {
    const game = unoGames.get(jid)
    if (!game || game.status !== 'lobby') return reply('❌ No UNO lobby to join. Start one with *.uno*')
    if (game.players.includes(senderJid)) return reply('⚠️ You\'re already in the lobby!')
    if (game.players.length >= 8) return reply('❌ Lobby is full (max 8 players)!')
    game.players.push(senderJid)
    await sock.sendMessage(jid, {
      text: `✅ @${sender} joined the UNO lobby!\n\n👥 Players (${game.players.length}): ${game.players.map(p => `@${p.split('@')[0]}`).join(', ')}`,
      mentions: game.players,
    })
  },

  async unostart({ sock, msg, jid, senderJid, sender, reply }) {
    const game = unoGames.get(jid)
    if (!game || game.status !== 'lobby') return reply('❌ No UNO lobby active. Use *.uno* to create one.')
    if (senderJid !== game.host) return reply('⚠️ Only the host can start the game!')
    if (game.players.length < 2) return reply('❌ Need at least 2 players to start!')

    const deck = newDeck()
    for (const p of game.players) game.hands[p] = dealCards(deck, 7)
    let topCard
    do { topCard = deck.shift() } while (topCard.color === '⚫')
    game.deck        = deck
    game.discardPile = [topCard]
    game.topCard     = topCard
    game.currentColor = topCard.color
    game.status      = 'active'
    game.turn        = 0

    const playerList = game.players.map(p => `• @${p.split('@')[0]}`).join('\n')
    await sock.sendMessage(jid, {
      text: `🎴 *UNO GAME STARTED!*\n\n${playerList}\n\n🃏 Starting card: ${cardStr(topCard)}\n\n_Let the chaos begin!_ 🖤`,
      mentions: game.players,
    })
    return sendTurnMessage(sock, jid, game)
  },

  async stopgame({ sock, msg, jid, senderJid, sender, reply, isOwner }) {
    const game = unoGames.get(jid)
    if (!game) return reply('❌ No active UNO game.')
    if (senderJid !== game.host && !isOwner) return reply('⚠️ Only the host or admin can stop the game.')
    unoGames.delete(jid)
    return reply('✅ UNO game ended.')
  },

  async caught({ sock, msg, jid, senderJid, sender, reply }) {
    const game = unoGames.get(jid)
    if (!game || game.status !== 'active') return reply('❌ No active UNO game.')
    const culprit = game.players.find(p => game.hands[p]?.length === 1 && !game.unoCalled.has(p))
    if (!culprit) return reply('⚠️ No one forgot to call UNO!')
    drawCards(game, culprit, 2)
    game.unoCalled.delete(culprit)
    await sock.sendMessage(jid, {
      text: `🚨 *CAUGHT!*\n\n@${culprit.split('@')[0]} forgot to call UNO!\n⚠️ +2 penalty cards drawn!`,
      mentions: [culprit],
    })
  },

  // ── Button handler ────────────────────────────────────────────────────────────
  async handleButton(sock, msg, buttonId) {
    const jid       = msg.key.remoteJid
    const senderJid = msg.key.participant || msg.key.remoteJid
    const game      = unoGames.get(jid)

    // ── End / Rematch ─────────────────────────────────────────────────────────
    if (buttonId.startsWith('uno_end_') || buttonId.startsWith('uno_rematch_')) {
      const isRematch = buttonId.startsWith('uno_rematch_')
      if (isRematch) {
        const players = game?.players || [senderJid]
        unoGames.delete(jid)
        const ng = {
          status: 'lobby', host: senderJid, players,
          hands: {}, deck: [], discardPile: [],
          topCard: null, currentColor: null,
          turn: 0, direction: 1, pendingColor: null,
          unoCalled: new Set(), lastPlayTime: Date.now(),
        }
        unoGames.set(jid, ng)
        return sock.sendMessage(jid, {
          text: `🔄 *UNO Rematch Lobby!*\n\n${players.map(p=>`• @${p.split('@')[0]}`).join('\n')}\n\nHost type *.unostart* when ready!`,
          mentions: players,
        })
      }
      unoGames.delete(jid)
      return sock.sendMessage(jid, { text: '✅ UNO game ended. Thanks for playing!' })
    }

    if (!game || game.status !== 'active') return

    // ── UNO call ──────────────────────────────────────────────────────────────
    if (buttonId.startsWith('uno_call_')) {
      if (!game.players.includes(senderJid)) return
      if (game.hands[senderJid]?.length !== 1) {
        return sock.sendMessage(jid, {
          text: `⚠️ @${senderJid.split('@')[0]} — you can only call UNO when you have 1 card!`,
          mentions: [senderJid],
        })
      }
      game.unoCalled.add(senderJid)
      return sock.sendMessage(jid, {
        text: `🔴 *UNO!* @${senderJid.split('@')[0]} called UNO!`,
        mentions: [senderJid],
      })
    }

    // ── Draw card ─────────────────────────────────────────────────────────────
    if (buttonId.startsWith('uno_draw_')) {
      const cur = game.players[game.turn]
      if (senderJid !== cur) {
        return sock.sendMessage(jid, { text: `⏳ It's not your turn, @${senderJid.split('@')[0]}!`, mentions: [senderJid] })
      }
      drawCards(game, senderJid, 1)
      await sock.sendMessage(jid, {
        text: `➕ @${cur.split('@')[0]} drew a card. Hand: ${game.hands[cur].length} cards.`,
        mentions: [cur],
      })
      nextPlayer(game)
      return sendTurnMessage(sock, jid, game)
    }

    // ── View hand ─────────────────────────────────────────────────────────────
    if (buttonId.startsWith('uno_hand_')) {
      if (!game.players.includes(senderJid)) return
      const hand      = game.hands[senderJid] || []
      const isMyTurn  = game.players[game.turn] === senderJid
      const topCard   = game.topCard
      const playable  = hand.filter(c => canPlay(c, topCard, game.currentColor))
      const handStr   = hand.map(cardStr).join('  ')
      const text      = `🃏 *Your Hand* (${hand.length} cards)\n\n${handStr}\n\n📌 Top: ${cardStr(topCard)} | Color: ${COLOR_NAMES[game.currentColor] || '⚫'}`

      if (!isMyTurn) return sock.sendMessage(jid, { text: text + '\n\n⏳ Wait for your turn.' })
      if (!playable.length) return sock.sendMessage(jid, { text: text + '\n\n❌ No playable cards! Use ➕ Draw Card.' })

      // Send each playable card as a quick-reply button (up to 10 at a time)
      const cardButtons = playable.slice(0, 10).map((c, i) => ({
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: cardStr(c),
          id: cardRowId(c) + `_${i}`
        })
      }))

      try {
        await sock.sendMessage(jid, {
          text: text + '\n\n✅ Tap a card to play it:',
          title: '🎴 UNO — Play a Card',
          footer: `${playable.length} playable card${playable.length !== 1 ? 's' : ''}`,
          interactiveButtons: cardButtons,
        }, { quoted: msg })
      } catch {
        const list = playable.map(c => `• ${cardStr(c)}`).join('\n')
        await sock.sendMessage(jid, { text: text + '\n\nPlayable cards:\n' + list })
      }
    }

    // ── Color choice (from interactiveButton) ─────────────────────────────────
    if (buttonId.startsWith('color_')) {
      await module.exports.handleList(sock, msg, buttonId)
    }

    // ── Card play (play_ prefix from button) ──────────────────────────────────
    if (buttonId.startsWith('play_')) {
      await module.exports.handleList(sock, msg, buttonId)
    }
  },

  // ── List / direct-id handler ──────────────────────────────────────────────────
  async handleList(sock, msg, rowId) {
    const jid       = msg.key.remoteJid
    const senderJid = msg.key.participant || msg.key.remoteJid
    const game      = unoGames.get(jid)
    if (!game || game.status !== 'active') return

    // ── Color pick ─────────────────────────────────────────────────────────────
    if (rowId.startsWith('color_')) {
      if (senderJid !== game.pendingColor) return
      const colorMap = { red:'🔴', blue:'🔵', yellow:'🟡', green:'🟢' }
      const chosen   = colorMap[rowId.replace('color_','')]
      if (!chosen) return
      game.currentColor = chosen
      game.pendingColor = null
      await sock.sendMessage(jid, { text: `🎨 Color set to *${COLOR_NAMES[chosen]}*!`, mentions: game.players })
      return sendTurnMessage(sock, jid, game)
    }

    // ── Card play ──────────────────────────────────────────────────────────────
    if (rowId.startsWith('play_')) {
      const cur = game.players[game.turn]
      if (senderJid !== cur) return sock.sendMessage(jid, { text: '⏳ It\'s not your turn!' })

      const cleanRowId = rowId.replace(/_\d+$/, '')
      const card       = cardFromRowId(cleanRowId)
      const hand       = game.hands[cur] || []
      const idx        = hand.findIndex(c => c.color === card.color && c.value === card.value)
      if (idx === -1) return sock.sendMessage(jid, { text: '❌ Card not found in your hand!' })

      const chosenCard = hand[idx]
      if (!canPlay(chosenCard, game.topCard, game.currentColor)) {
        return sock.sendMessage(jid, { text: `❌ You can't play ${cardStr(chosenCard)} right now!` })
      }

      hand.splice(idx, 1)
      game.topCard     = chosenCard
      game.discardPile.push(chosenCard)
      if (chosenCard.color !== '⚫') game.currentColor = chosenCard.color
      if (hand.length !== 1) game.unoCalled.delete(cur)

      await sock.sendMessage(jid, {
        text: `🃏 @${cur.split('@')[0]} played *${cardStr(chosenCard)}*!`,
        mentions: [cur],
      })

      if (await checkWin(sock, jid, game, cur)) return

      if (chosenCard.color === '⚫') {
        game.pendingColor = cur
        nextPlayer(game)
        await sendColorPicker(sock, jid, msg)
        if (chosenCard.value === 'Wild+4') {
          const next = game.players[game.turn]
          drawCards(game, next, 4)
          await sock.sendMessage(jid, { text: `💀 @${next.split('@')[0]} draws 4 cards! 😈`, mentions: [next] })
        }
        return
      }

      if (chosenCard.value === 'Skip') {
        nextPlayer(game, 1)
        const skipped = game.players[(game.turn - game.direction + game.players.length) % game.players.length]
        await sock.sendMessage(jid, { text: `🚫 @${skipped.split('@')[0]}'s turn is skipped!`, mentions: [skipped] })
      } else if (chosenCard.value === 'Reverse') {
        game.direction *= -1
        nextPlayer(game)
        await sock.sendMessage(jid, { text: `🔄 Turn order reversed!` })
      } else if (chosenCard.value === '+2') {
        nextPlayer(game)
        const next = game.players[game.turn]
        drawCards(game, next, 2)
        await sock.sendMessage(jid, { text: `⚠️ @${next.split('@')[0]} draws 2 cards!`, mentions: [next] })
        nextPlayer(game)
      } else {
        nextPlayer(game)
      }

      return sendTurnMessage(sock, jid, game)
    }
  },
}
