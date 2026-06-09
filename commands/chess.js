'use strict'
// ╔══════════════════════════════════════════════╗
// ║        ♟️  CHESS  —  commands/chess.js        ║
// ╚══════════════════════════════════════════════╝
// Full legal-move chess with buttons + lists.
// Game state stored in chessGames Map keyed by chatJid.

const W = { P:'♙', N:'♘', B:'♗', R:'♖', Q:'♕', K:'♔' }
const B = { P:'♟', N:'♞', B:'♝', R:'♜', Q:'♛', K:'♚' }

const FILES = ['a','b','c','d','e','f','g','h']
const BACK  = ['R','N','B','Q','K','B','N','R']

// keyed by chatJid
const chessGames = new Map()

// ── Board helpers ───────────────────────────────────────────────────────────

function initBoard() {
  const b = Array.from({ length: 8 }, () => Array(8).fill(null))
  for (let f = 0; f < 8; f++) {
    b[0][f] = { t: BACK[f], c: 'b' }
    b[1][f] = { t: 'P', c: 'b' }
    b[6][f] = { t: 'P', c: 'w' }
    b[7][f] = { t: BACK[f], c: 'w' }
  }
  return b
}

function cloneBoard(board) {
  return board.map(row => row.map(p => p ? { t: p.t, c: p.c } : null))
}

function sq(r, f) { return `${FILES[f]}${8 - r}` }
function pieceEmoji(p) { return (p.c === 'w' ? W : B)[p.t] }

function renderBoard(board) {
  let out = '  a  b  c  d  e  f  g  h\n'
  for (let r = 0; r < 8; r++) {
    out += `${8 - r} `
    for (let f = 0; f < 8; f++) {
      const p = board[r][f]
      out += p ? pieceEmoji(p) + '  ' : '·  '
    }
    out += `${8 - r}\n`
  }
  out += '  a  b  c  d  e  f  g  h'
  return out
}

// ── Move generation ─────────────────────────────────────────────────────────

function pseudoMoves(board, r, f, ep, castling) {
  const p = board[r][f]
  if (!p) return []
  const moves = []

  const addIfValid = (tr, tf, extra = {}) => {
    if (tr < 0 || tr > 7 || tf < 0 || tf > 7) return
    const target = board[tr][tf]
    if (target && target.c === p.c) return
    moves.push({ from: [r, f], to: [tr, tf], ...extra })
  }

  const slide = (dr, df) => {
    let cr = r + dr, cf = f + df
    while (cr >= 0 && cr <= 7 && cf >= 0 && cf <= 7) {
      const target = board[cr][cf]
      if (target) {
        if (target.c !== p.c) moves.push({ from: [r, f], to: [cr, cf] })
        break
      }
      moves.push({ from: [r, f], to: [cr, cf] })
      cr += dr; cf += df
    }
  }

  if (p.t === 'P') {
    const dir = p.c === 'w' ? -1 : 1
    const startR = p.c === 'w' ? 6 : 1
    const promoR = p.c === 'w' ? 0 : 7
    const nr = r + dir
    if (nr >= 0 && nr <= 7) {
      if (!board[nr][f]) {
        moves.push({ from: [r, f], to: [nr, f], promote: nr === promoR })
        if (r === startR && !board[r + 2 * dir][f]) {
          moves.push({ from: [r, f], to: [r + 2 * dir, f], double: true })
        }
      }
      for (const df of [-1, 1]) {
        const tf = f + df
        if (tf < 0 || tf > 7) continue
        if (board[nr][tf] && board[nr][tf].c !== p.c) {
          moves.push({ from: [r, f], to: [nr, tf], promote: nr === promoR })
        }
        if (ep && ep[0] === nr && ep[1] === tf) {
          moves.push({ from: [r, f], to: [nr, tf], ep: true })
        }
      }
    }
  } else if (p.t === 'N') {
    for (const [dr, df] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      addIfValid(r + dr, f + df)
    }
  } else if (p.t === 'B') {
    for (const [dr,df] of [[-1,-1],[-1,1],[1,-1],[1,1]]) slide(dr, df)
  } else if (p.t === 'R') {
    for (const [dr,df] of [[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, df)
  } else if (p.t === 'Q') {
    for (const [dr,df] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, df)
  } else if (p.t === 'K') {
    for (const [dr,df] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      addIfValid(r + dr, f + df)
    }
    const rank = p.c === 'w' ? 7 : 0
    if (r === rank && f === 4) {
      if (castling[p.c + 'K'] && !board[rank][5] && !board[rank][6] &&
          board[rank][7]?.t === 'R' && board[rank][7]?.c === p.c) {
        moves.push({ from: [r, f], to: [rank, 6], castle: 'K' })
      }
      if (castling[p.c + 'Q'] && !board[rank][3] && !board[rank][2] && !board[rank][1] &&
          board[rank][0]?.t === 'R' && board[rank][0]?.c === p.c) {
        moves.push({ from: [r, f], to: [rank, 2], castle: 'Q' })
      }
    }
  }
  return moves
}

function findKing(board, color) {
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++)
      if (board[r][f]?.t === 'K' && board[r][f]?.c === color) return [r, f]
  return null
}

function isAttacked(board, r, f, byColor) {
  for (let pr = 0; pr < 8; pr++) {
    for (let pf = 0; pf < 8; pf++) {
      if (board[pr][pf]?.c !== byColor) continue
      const moves = pseudoMoves(board, pr, pf, null, { wK:false, wQ:false, bK:false, bQ:false })
      if (moves.some(m => m.to[0] === r && m.to[1] === f)) return true
    }
  }
  return false
}

function isInCheck(board, color) {
  const k = findKing(board, color)
  if (!k) return false
  return isAttacked(board, k[0], k[1], color === 'w' ? 'b' : 'w')
}

function applyMove(board, move) {
  const nb = cloneBoard(board)
  const [fr, ff] = move.from
  const [tr, tf] = move.to
  const piece = nb[fr][ff]
  nb[tr][tf] = piece
  nb[fr][ff] = null
  if (move.castle === 'K') {
    nb[tr][5] = nb[tr][7]; nb[tr][7] = null
  } else if (move.castle === 'Q') {
    nb[tr][3] = nb[tr][0]; nb[tr][0] = null
  }
  if (move.ep) {
    nb[fr][tf] = null // remove captured pawn
  }
  if (move.promote) {
    nb[tr][tf] = { t: 'Q', c: piece.c }
  }
  return nb
}

function getLegalMoves(board, color, ep, castling) {
  const opp = color === 'w' ? 'b' : 'w'
  const all = []
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      if (board[r][f]?.c !== color) continue
      const pseudo = pseudoMoves(board, r, f, ep, castling)
      for (const move of pseudo) {
        if (move.castle) {
          if (isInCheck(board, color)) continue
          const rank = color === 'w' ? 7 : 0
          const midFile = move.castle === 'K' ? 5 : 3
          const tb = cloneBoard(board)
          tb[rank][midFile] = board[rank][4]; tb[rank][4] = null
          if (isAttacked(tb, rank, midFile, opp)) continue
        }
        const nb = applyMove(board, move)
        if (!isInCheck(nb, color)) all.push(move)
      }
    }
  }
  return all
}

function updateCastling(castling, move, board) {
  const c = { ...castling }
  const [fr, ff] = move.from
  const p = board[fr][ff]
  if (!p) return c
  if (p.t === 'K') { c[p.c + 'K'] = false; c[p.c + 'Q'] = false }
  if (p.t === 'R') {
    if (fr === 7 && ff === 0) c.wQ = false
    if (fr === 7 && ff === 7) c.wK = false
    if (fr === 0 && ff === 0) c.bQ = false
    if (fr === 0 && ff === 7) c.bK = false
  }
  return c
}

// ── Display helpers ─────────────────────────────────────────────────────────

function boardMessage(game) {
  const { board, turn, lastMove, white, black } = game
  const inCheck = isInCheck(board, turn)
  const turnJid = turn === 'w' ? white : black
  const turnLabel = turnJid === 'bot' ? '🤖 Bot' : `@${turnJid.split('@')[0]}`
  let header = `♟️ *CHESS*\n\n`
  header += `⬜ White: @${white.split('@')[0]}\n`
  header += `⬛ Black: ${black === 'bot' ? '🤖 Bot' : '@' + black.split('@')[0]}\n`
  header += `\n⚡ *Turn:* ${turnLabel} (${turn === 'w' ? '⬜' : '⬛'})\n`
  if (lastMove) header += `📌 Last move: ${sq(...lastMove.from)} → ${sq(...lastMove.to)}\n`
  if (inCheck) header += `\n⚠️ *CHECK!*\n`
  header += `\n\`\`\`\n${renderBoard(board)}\n\`\`\``
  return header
}

async function sendBoardWithButtons(sock, jid, game, quoted) {
  const text = boardMessage(game)
  await sock.sendMessage(jid, {
    template: true,
    text,
    footer: '♟️ Chess',
    templateButtons: [
      { index: 1, quickReplyButton: { displayText: '♟️ Select Piece', id: `chess_select_piece_${jid}` } },
      { index: 2, quickReplyButton: { displayText: '🏳️ Resign',       id: `chess_resign_${jid}`       } },
    ],
    mentions: [game.white, ...(game.black !== 'bot' ? [game.black] : [])],
  }, quoted ? { quoted } : undefined)
}

async function sendEndButtons(sock, jid, text, mentions) {
  await sock.sendMessage(jid, {
    template: true,
    text,
    footer: '♟️ Chess',
    templateButtons: [
      { index: 1, quickReplyButton: { displayText: '🔄 Rematch', id: `chess_rematch_${jid}` } },
      { index: 2, quickReplyButton: { displayText: '❌ Close',   id: `chess_close_${jid}`   } },
    ],
    mentions,
  })
}

// ── Bot move ────────────────────────────────────────────────────────────────

async function doBotMove(sock, jid) {
  const game = chessGames.get(jid)
  if (!game || game.turn !== 'b' || game.black !== 'bot') return
  await new Promise(r => setTimeout(r, 1200))
  const moves = getLegalMoves(game.board, 'b', game.ep, game.castling)
  if (!moves.length) {
    const inCheck = isInCheck(game.board, 'b')
    const result = inCheck ? '🤖 Bot is in *checkmate*! ⬜ White wins!' : '🤝 *Stalemate!* Draw.'
    chessGames.delete(jid)
    return sendEndButtons(sock, jid, result, [game.white])
  }
  const move = moves[Math.floor(Math.random() * moves.length)]
  game.castling = updateCastling(game.castling, move, game.board)
  game.board = applyMove(game.board, move)
  game.ep = move.double ? [move.from[0] + (game.board[move.to[0]][move.to[1]]?.c === 'w' ? -1 : 1), move.from[1]] : null
  game.lastMove = move
  game.turn = 'w'

  const legalForWhite = getLegalMoves(game.board, 'w', game.ep, game.castling)
  if (!legalForWhite.length) {
    const inCheck = isInCheck(game.board, 'w')
    const result = inCheck
      ? `🤖 Bot played ${sq(...move.from)}→${sq(...move.to)}\n\n♚ *Checkmate!* ⬛ Black (Bot) wins!`
      : `🤖 Bot played ${sq(...move.from)}→${sq(...move.to)}\n\n🤝 *Stalemate!* Draw.`
    chessGames.delete(jid)
    return sendEndButtons(sock, jid, result, [game.white])
  }
  await sendBoardWithButtons(sock, jid, game)
}

// ── Command exports ─────────────────────────────────────────────────────────

module.exports = {
  chessGames,

  async chess({ sock, msg, jid, senderJid, sender, args, reply, isGroup }) {
    if (!isGroup) return reply('♟️ Chess must be played in a group!')

    // .chess start bot
    if (args[0]?.toLowerCase() === 'start' && args[1]?.toLowerCase() === 'bot') {
      if (chessGames.has(jid)) return reply('❌ A chess game is already active here.')
      const game = {
        board: initBoard(),
        white: senderJid,
        black: 'bot',
        turn: 'w',
        ep: null,
        castling: { wK: true, wQ: true, bK: true, bQ: true },
        lastMove: null,
        pendingSelect: null,
        status: 'active',
      }
      chessGames.set(jid, game)
      await sock.sendMessage(jid, { text: `♟️ *Chess vs Bot*\n\n@${sender} is ⬜ White, Bot is ⬛ Black.`, mentions: [senderJid] })
      return sendBoardWithButtons(sock, jid, game)
    }

    // .chess @user
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
                      (msg.message?.extendedTextMessage?.contextInfo?.quotedParticipant
                        ? [msg.message.extendedTextMessage.contextInfo.quotedParticipant]
                        : [])
    if (!mentioned.length) return reply('Usage:\n• .chess @user — challenge someone\n• .chess start bot — play vs bot')
    const opponent = mentioned[0]
    if (opponent === senderJid) return reply('❌ You cannot challenge yourself!')
    if (chessGames.has(jid)) return reply('❌ A chess game is already active here. Wait for it to finish.')

    // Store pending challenge
    chessGames.set(jid, {
      status: 'pending',
      challenger: senderJid,
      opponent,
      board: null,
      turn: null,
    })

    await sock.sendMessage(jid, {
      text: `♟️ @${opponent.split('@')[0]}, you've been challenged to Chess by @${sender}!\n\nReply *.accept* to play as ⬛ Black.`,
      mentions: [opponent, senderJid],
    })
  },

  async accept({ sock, msg, jid, senderJid, reply }) {
    const game = chessGames.get(jid)
    if (!game || game.status !== 'pending') return
    if (senderJid !== game.opponent) return
    const newGame = {
      board: initBoard(),
      white: game.challenger,
      black: game.opponent,
      turn: 'w',
      ep: null,
      castling: { wK: true, wQ: true, bK: true, bQ: true },
      lastMove: null,
      pendingSelect: null,
      status: 'active',
    }
    chessGames.set(jid, newGame)
    await sock.sendMessage(jid, {
      text: `♟️ *Chess Game Started!*\n\n⬜ White: @${newGame.white.split('@')[0]}\n⬛ Black: @${newGame.black.split('@')[0]}`,
      mentions: [newGame.white, newGame.black],
    })
    await sendBoardWithButtons(sock, jid, newGame)
  },

  // Button handler (called from index.js)
  async handleButton(sock, msg, buttonId) {
    const jid = msg.key.remoteJid
    const senderJid = msg.key.participant || msg.key.remoteJid
    const game = chessGames.get(jid)

    if (buttonId.startsWith('chess_close_')) {
      if (game) chessGames.delete(jid)
      return sock.sendMessage(jid, { text: '✅ Chess game closed.' })
    }

    if (buttonId.startsWith('chess_rematch_')) {
      if (!game) return
      // Swap colors
      const newGame = {
        board: initBoard(),
        white: game.black === 'bot' ? game.white : game.black,
        black: game.black === 'bot' ? 'bot' : game.white,
        turn: 'w',
        ep: null,
        castling: { wK: true, wQ: true, bK: true, bQ: true },
        lastMove: null,
        pendingSelect: null,
        status: 'active',
      }
      chessGames.set(jid, newGame)
      return sendBoardWithButtons(sock, jid, newGame)
    }

    if (buttonId.startsWith('chess_resign_')) {
      if (!game || game.status !== 'active') return
      const isWhite = senderJid === game.white
      const isBlack = senderJid === game.black
      if (!isWhite && !isBlack) return
      const winner = isWhite ? (game.black === 'bot' ? '🤖 Bot' : `@${game.black.split('@')[0]}`) : `@${game.white.split('@')[0]}`
      const loser = isWhite ? `@${game.white.split('@')[0]}` : `@${game.black.split('@')[0]}`
      const mentions = [game.white, ...(game.black !== 'bot' ? [game.black] : [])]
      chessGames.delete(jid)
      return sendEndButtons(sock, jid, `🏳️ ${loser} resigned!\n\n🏆 *${winner} wins!*`, mentions)
    }

    if (buttonId.startsWith('chess_select_piece_')) {
      if (!game || game.status !== 'active') return
      const isPlayerTurn = (game.turn === 'w' && senderJid === game.white) ||
                           (game.turn === 'b' && senderJid === game.black)
      if (!isPlayerTurn) return sock.sendMessage(jid, { text: '⏳ It\'s not your turn!' })

      const legalMoves = getLegalMoves(game.board, game.turn, game.ep, game.castling)
      const movable = [...new Map(legalMoves.map(m => [m.from.toString(), m.from])).values()]

      if (!movable.length) {
        return sock.sendMessage(jid, { text: '❌ No legal moves available.' })
      }

      const rows = movable.map(([r, f]) => {
        const p = game.board[r][f]
        const name = { P:'Pawn', N:'Knight', B:'Bishop', R:'Rook', Q:'Queen', K:'King' }[p.t]
        return {
          title: `${pieceEmoji(p)} ${name} on ${sq(r, f)}`,
          description: '',
          rowId: `select_${r}_${f}`,
        }
      })

      try {
        await sock.sendMessage(jid, {
          text: '♟️ Choose a piece to move:',
          footer: 'Select Piece',
          buttonText: '📋 Pieces',
          sections: [{ title: 'Your Pieces', rows }],
        }, { quoted: msg })
      } catch {
        const list = rows.map(r => `• ${r.title} (${r.rowId})`).join('\n')
        await sock.sendMessage(jid, { text: `♟️ *Select a piece:*\n${list}` })
      }
    }
  },

  // List handler (called from index.js)
  async handleList(sock, msg, rowId) {
    const jid = msg.key.remoteJid
    const senderJid = msg.key.participant || msg.key.remoteJid
    const game = chessGames.get(jid)
    if (!game || game.status !== 'active') return

    const isPlayerTurn = (game.turn === 'w' && senderJid === game.white) ||
                         (game.turn === 'b' && senderJid === game.black)
    if (!isPlayerTurn) return sock.sendMessage(jid, { text: '⏳ It\'s not your turn!' })

    if (rowId.startsWith('select_')) {
      const [, r, f] = rowId.split('_').map((v, i) => i === 0 ? v : Number(v))
      const piece = game.board[r][f]
      if (!piece || piece.c !== game.turn) return

      const legalMoves = getLegalMoves(game.board, game.turn, game.ep, game.castling)
      const pieceMoves = legalMoves.filter(m => m.from[0] === r && m.from[1] === f)

      if (!pieceMoves.length) {
        return sock.sendMessage(jid, { text: '❌ No legal moves for that piece.' })
      }

      const rows = pieceMoves.map(m => ({
        title: `→ ${sq(...m.to)}${m.castle ? ' (castle)' : m.promote ? ' (promote→♕)' : m.ep ? ' (en passant)' : ''}`,
        description: '',
        rowId: `move_${r}_${f}_${m.to[0]}_${m.to[1]}`,
      }))

      const pName = { P:'Pawn', N:'Knight', B:'Bishop', R:'Rook', Q:'Queen', K:'King' }[piece.t]
      try {
        await sock.sendMessage(jid, {
          text: `${pieceEmoji(piece)} ${pName} on ${sq(r, f)} — choose destination:`,
          footer: 'Select Destination',
          buttonText: '📋 Moves',
          sections: [{ title: 'Valid Squares', rows }],
        }, { quoted: msg })
      } catch {
        const list = rows.map(r => `• ${r.title}`).join('\n')
        await sock.sendMessage(jid, { text: `*${pName} moves:*\n${list}` })
      }
      return
    }

    if (rowId.startsWith('move_')) {
      const parts = rowId.split('_')
      const [fr, ff, tr, tf] = [Number(parts[1]), Number(parts[2]), Number(parts[3]), Number(parts[4])]
      const legalMoves = getLegalMoves(game.board, game.turn, game.ep, game.castling)
      const move = legalMoves.find(m =>
        m.from[0] === fr && m.from[1] === ff && m.to[0] === tr && m.to[1] === tf
      )
      if (!move) return sock.sendMessage(jid, { text: '❌ Invalid move.' })

      game.castling = updateCastling(game.castling, move, game.board)
      game.board = applyMove(game.board, move)
      game.ep = move.double ? [tr + (game.turn === 'w' ? 1 : -1), ff] : null
      game.lastMove = move

      const nextTurn = game.turn === 'w' ? 'b' : 'w'
      game.turn = nextTurn

      // Check for game end
      const nextMoves = getLegalMoves(game.board, nextTurn, game.ep, game.castling)
      if (!nextMoves.length) {
        const inCheck = isInCheck(game.board, nextTurn)
        const winner = nextTurn === 'w' ? (game.black === 'bot' ? '🤖 Bot' : `@${game.black.split('@')[0]}`) : `@${game.white.split('@')[0]}`
        const result = inCheck
          ? `♚ *Checkmate!*\n\n🏆 ${winner} wins!`
          : `🤝 *Stalemate!* The game is a draw.`
        const mentions = [game.white, ...(game.black !== 'bot' ? [game.black] : [])]
        chessGames.delete(jid)
        return sendEndButtons(sock, jid, result, mentions)
      }

      if (game.black === 'bot' && nextTurn === 'b') {
        await sendBoardWithButtons(sock, jid, game)
        return doBotMove(sock, jid)
      }
      return sendBoardWithButtons(sock, jid, game)
    }
  },
}
