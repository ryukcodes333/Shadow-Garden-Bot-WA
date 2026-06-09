'use strict'
// ╔══════════════════════════════════════════════╗
// ║        🎴  UNO  —  commands/uno.js           ║
// ╚══════════════════════════════════════════════╝
// Lobby-based multiplayer UNO with buttons + lists.
// .uno → create lobby  .joinuno → join  .unostart → start

const COLORS = ['🔴','🔵','🟡','🟢']
const COLOR_NAMES = { '🔴':'Red','🔵':'Blue','🟡':'Yellow','🟢':'Green' }
const VALUES = ['0','1','2','3','4','5','6','7','8','9','Skip','Reverse','+2']
const WILDS  = ['Wild','Wild+4']

// keyed by chatJid
const unoGames = new Map()

// ── Card helpers ─────────────────────────────────────────────────────────────

function mkCard(color, value) { return { color, value } }

function cardStr(c) {
  if (c.color === '⚫') return `⚫ ${c.value}`
  return `${c.color} ${c.value}`
}

function cardRowId(c) {
  const col = c.color === '⚫' ? 'wild' : c.color.codePointAt(0).toString(36)
  return `play_${col}_${c.value.replace('+','p').replace(' ','_')}`
}

function cardFromRowId(rowId) {
  const rest = rowId.replace('play_', '')
  const colCode = rest.split('_')[0]
  const val = rest.slice(colCode.length + 1).replace('p','+').replace('_',' ')
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
  for (const w of WILDS) {
    for (let i = 0; i < 4; i++) d.push(mkCard('⚫', w))
  }
  return d.sort(() => Math.random() - 0.5)
}

function dealCards(deck, n = 7) { return deck.splice(0, n) }

function canPlay(card, topCard, currentColor) {
  if (card.color === '⚫') return true
  if (card.color === currentColor) return true
  if (card.value === topCard.value) return true
  return false
}

function handValue(hand) { return hand.length } // for display

// ── Rendering ────────────────────────────────────────────────────────────────

function gameStatus(game) {
  const cur = game.players[game.turn]
  const curName = `@${cur.split('@')[0]}`
  const counts = game.players.map(p => `• @${p.split('@')[0]}: ${game.hands[p].length} cards`).join('\n')
  return (
    `🎴 *UNO*\n\n` +
    `📌 *Top Card:* ${cardStr(game.topCard)}\n` +
    `🎨 *Color:* ${game.currentColor === '⚫' ? '⚫ Wild' : COLOR_NAMES[game.currentColor] || game.currentColor}\n` +
    `🃏 *Draw pile:* ~${game.deck.length} cards\n\n` +
    `📊 *Card counts:*\n${counts}\n\n` +
    `⚡ *Turn:* ${curName}`
  )
}

async function sendTurnMessage(sock, jid, game) {
  const cur = game.players[game.turn]
  const text = gameStatus(game)
  const mentions = game.players
  await sock.sendMessage(jid, {
    template: true,
    text,
    footer: '🎴 UNO',
    templateButtons: [
      { index: 1, quickReplyButton: { displayText: '🃏 View My Hand', id: `uno_hand_${jid}` } },
      { index: 2, quickReplyButton: { displayText: '➕ Draw Card',    id: `uno_draw_${jid}` } },
      { index: 3, quickReplyButton: { displayText: '🔴 UNO!',         id: `uno_call_${jid}` } },
    ],
    mentions,
  })
}

// ── Game flow helpers ────────────────────────────────────────────────────────

function nextPlayer(game, skip = 0) {
  game.turn = (game.turn + game.direction * (1 + skip) + game.players.length * 10) % game.players.length
}

function reshuffleDeck(game) {
  const top = game.topCard
  const discards = game.discardPile.splice(0, game.discardPile.length - 1)
  game.deck = discards.sort(() => Math.random() - 0.5)
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
    const winner = `@${playerJid.split('@')[0]}`
    const mentions = game.players
    unoGames.delete(jid)
    try {
      await sock.sendMessage(jid, {
        text: `🏆 *UNO WINNER!*\n\n🎉 ${winner} has played all their cards!\n\n_The chaos ends…_`,
        template: true,
        templateButtons: [
          { index: 1, quickReplyButton: { displayText: '🔄 Play Again', id: `uno_rematch_${jid}` } },
          { index: 2, quickReplyButton: { displayText: '❌ End Game',   id: `uno_end_${jid}`     } },
        ],
        mentions,
      })
    } catch {
      await sock.sendMessage(jid, {
        text: `🏆 *UNO WINNER!*\n\n🎉 ${winner} has played all their cards!`,
        mentions,
      })
    }
    return true
  }
  return false
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  unoGames,

  // .uno — create lobby
  async uno({ sock, msg, jid, senderJid, sender, reply }) {
    if (unoGames.has(jid)) {
      const g = unoGames.get(jid)
      if (g.status === 'lobby') return reply(`❌ A lobby already exists! Use *.joinuno* to join or *.unostart* to begin.`)
      return reply('❌ A UNO game is already active here!')
    }
    unoGames.set(jid, {
      status: 'lobby',
      host: senderJid,
      players: [senderJid],
      hands: {},
      deck: [],
      discardPile: [],
      topCard: null,
      currentColor: null,
      turn: 0,
      direction: 1,
      pendingColor: null,
      unoCalled: new Set(),
      lastPlayTime: Date.now(),
    })
    await sock.sendMessage(jid, {
      text: `🎴 *UNO LOBBY CREATED!*\n\n👑 Host: @${sender}\n\n📢 Others can type *.joinuno* to join (max 8 players)\n\nWhen ready, host types *.unostart*`,
      mentions: [senderJid],
    })
  },

  // .joinuno
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

  // .unostart
  async unostart({ sock, msg, jid, senderJid, sender, reply }) {
    const game = unoGames.get(jid)
    if (!game || game.status !== 'lobby') return reply('❌ No UNO lobby active. Use *.uno* to create one.')
    if (senderJid !== game.host) return reply('⚠️ Only the host can start the game!')
    if (game.players.length < 2) return reply('❌ Need at least 2 players to start!')

    const deck = newDeck()
    for (const p of game.players) game.hands[p] = dealCards(deck, 7)

    // First card — skip wilds
    let topCard
    do { topCard = deck.shift() } while (topCard.color === '⚫')
    game.deck = deck
    game.discardPile = [topCard]
    game.topCard = topCard
    game.currentColor = topCard.color
    game.status = 'active'
    game.turn = 0

    const playerList = game.players.map(p => `• @${p.split('@')[0]}`).join('\n')
    await sock.sendMessage(jid, {
      text: `🎴 *UNO GAME STARTED!*\n\n${playerList}\n\n🃏 Starting card: ${cardStr(topCard)}\n\n_Let the chaos begin!_ 🖤`,
      mentions: game.players,
    })
    return sendTurnMessage(sock, jid, game)
  },

  // .stopgame / .unostop
  async stopgame({ sock, msg, jid, senderJid, sender, reply, isOwner }) {
    const game = unoGames.get(jid)
    if (!game) return reply('❌ No active UNO game.')
    if (senderJid !== game.host && !isOwner) return reply('⚠️ Only the host or admin can stop the game.')
    unoGames.delete(jid)
    return reply('✅ UNO game ended.')
  },

  // .caught — penalty for forgetting to call UNO
  async caught({ sock, msg, jid, senderJid, sender, reply }) {
    const game = unoGames.get(jid)
    if (!game || game.status !== 'active') return reply('❌ No active UNO game.')

    // Find any player with 1 card who hasn't called UNO
    const culprit = game.players.find(p => game.hands[p]?.length === 1 && !game.unoCalled.has(p))
    if (!culprit) return reply('⚠️ No one forgot to call UNO!')

    drawCards(game, culprit, 2)
    game.unoCalled.delete(culprit)
    await sock.sendMessage(jid, {
      text: `🚨 *CAUGHT!*\n\n@${culprit.split('@')[0]} forgot to call UNO!\n⚠️ +2 penalty cards drawn!`,
      mentions: [culprit],
    })
  },

  // ── Button handler ──────────────────────────────────────────────────────────
  async handleButton(sock, msg, buttonId) {
    const jid = msg.key.remoteJid
    const senderJid = msg.key.participant || msg.key.remoteJid
    const game = unoGames.get(jid)

    if (buttonId.startsWith('uno_end_') || buttonId.startsWith('uno_rematch_')) {
      const isRematch = buttonId.startsWith('uno_rematch_')
      if (isRematch && game?.status !== 'active') {
        // Restart
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

    if (buttonId.startsWith('uno_call_')) {
      if (!game.players.includes(senderJid)) return
      if (game.hands[senderJid]?.length !== 1) {
        return sock.sendMessage(jid, { text: `⚠️ @${senderJid.split('@')[0]} — you can only call UNO when you have 1 card!`, mentions: [senderJid] })
      }
      game.unoCalled.add(senderJid)
      return sock.sendMessage(jid, {
        text: `🔴 *UNO!* @${senderJid.split('@')[0]} called UNO!`,
        mentions: [senderJid],
      })
    }

    if (buttonId.startsWith('uno_draw_')) {
      const cur = game.players[game.turn]
      if (senderJid !== cur) {
        return sock.sendMessage(jid, { text: `⏳ It's not your turn, @${senderJid.split('@')[0]}!`, mentions: [senderJid] })
      }
      const [drawn] = drawCards(game, senderJid, 1)
      await sock.sendMessage(jid, {
        text: `➕ @${cur.split('@')[0]} drew a card. Hand: ${game.hands[cur].length} cards.`,
        mentions: [cur],
      })
      nextPlayer(game)
      return sendTurnMessage(sock, jid, game)
    }

    if (buttonId.startsWith('uno_hand_')) {
      if (!game.players.includes(senderJid)) return
      const hand = game.hands[senderJid] || []
      const isMyTurn = game.players[game.turn] === senderJid
      const topCard = game.topCard

      const playable = hand.filter(c => canPlay(c, topCard, game.currentColor))
      const rows = playable.map((c, i) => ({
        title: cardStr(c),
        description: '',
        rowId: cardRowId(c) + `_${i}`,
      }))

      const handStr = hand.map(cardStr).join('  ')
      const text = `🃏 *Your Hand* (${hand.length} cards)\n\n${handStr}\n\n📌 Top: ${cardStr(topCard)} | Color: ${COLOR_NAMES[game.currentColor] || '⚫'}`

      if (!isMyTurn) {
        return sock.sendMessage(jid, { text: text + '\n\n⏳ Wait for your turn.' })
      }

      if (!rows.length) {
        return sock.sendMessage(jid, { text: text + '\n\n❌ No playable cards! Use ➕ Draw Card.' })
      }

      try {
        await sock.sendMessage(jid, {
          text: text + '\n\n✅ Playable cards — choose one:',
          footer: 'Play a card',
          buttonText: '📋 Play Card',
          sections: [{ title: 'Playable Cards', rows }],
        }, { quoted: msg })
      } catch {
        const list = rows.map(r => `• ${r.title} [${r.rowId}]`).join('\n')
        await sock.sendMessage(jid, { text: text + '\n\n' + list })
      }
    }
  },

  // ── List handler ─────────────────────────────────────────────────────────────
  async handleList(sock, msg, rowId) {
    const jid  = msg.key.remoteJid
    const senderJid = msg.key.participant || msg.key.remoteJid
    const game = unoGames.get(jid)
    if (!game || game.status !== 'active') return

    // Color pick after Wild
    if (rowId.startsWith('color_')) {
      if (senderJid !== game.pendingColor) return
      const colorCode = rowId.replace('color_','')
      const colorMap = { red:'🔴', blue:'🔵', yellow:'🟡', green:'🟢' }
      const chosen = colorMap[colorCode]
      if (!chosen) return
      game.currentColor = chosen
      game.pendingColor = null
      await sock.sendMessage(jid, {
        text: `🎨 Color set to *${COLOR_NAMES[chosen]}*!`,
        mentions: game.players,
      })
      return sendTurnMessage(sock, jid, game)
    }

    if (rowId.startsWith('play_')) {
      const cur = game.players[game.turn]
      if (senderJid !== cur) return sock.sendMessage(jid, { text: '⏳ It\'s not your turn!' })

      // Strip trailing index suffix (_0, _1 …)
      const cleanRowId = rowId.replace(/_\d+$/, '')
      const card = cardFromRowId(cleanRowId)
      const hand = game.hands[cur] || []

      const idx = hand.findIndex(c => c.color === card.color && c.value === card.value)
      if (idx === -1) return sock.sendMessage(jid, { text: '❌ Card not found in your hand!' })

      const chosenCard = hand[idx]
      if (!canPlay(chosenCard, game.topCard, game.currentColor)) {
        return sock.sendMessage(jid, { text: `❌ You can't play ${cardStr(chosenCard)} right now!` })
      }

      hand.splice(idx, 1)
      game.topCard = chosenCard
      game.discardPile.push(chosenCard)
      if (chosenCard.color !== '⚫') game.currentColor = chosenCard.color

      // Clear UNO call if player no longer at 1 card
      if (hand.length !== 1) game.unoCalled.delete(cur)

      await sock.sendMessage(jid, {
        text: `🃏 @${cur.split('@')[0]} played *${cardStr(chosenCard)}*!`,
        mentions: [cur],
      })

      if (await checkWin(sock, jid, game, cur)) return

      // Wild color pick
      if (chosenCard.color === '⚫') {
        game.pendingColor = cur
        nextPlayer(game)
        try {
          await sock.sendMessage(jid, {
            text: '🌈 Pick a color:',
            footer: 'Choose Color',
            buttonText: '🎨 Color',
            sections: [{
              title: 'Colors',
              rows: [
                { title: '🔴 Red',    rowId: 'color_red'    },
                { title: '🔵 Blue',   rowId: 'color_blue'   },
                { title: '🟡 Yellow', rowId: 'color_yellow' },
                { title: '🟢 Green',  rowId: 'color_green'  },
              ],
            }],
          }, { quoted: msg })
        } catch {
          await sock.sendMessage(jid, { text: '🌈 Pick a color: Reply color_red / color_blue / color_yellow / color_green' })
        }

        if (chosenCard.value === 'Wild+4') {
          const next = game.players[game.turn]
          drawCards(game, next, 4)
          await sock.sendMessage(jid, {
            text: `💀 @${next.split('@')[0]} draws 4 cards! 😈`,
            mentions: [next],
          })
        }
        return
      }

      // Special cards
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
