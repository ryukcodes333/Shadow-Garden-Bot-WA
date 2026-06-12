'use strict'
// ╔══════════════════════════════════════════════╗
// ║        ♟️  CHESS  —  commands/chess.js        ║
// ╚══════════════════════════════════════════════╝
// Full legal-move chess with dark image board + reply-based text moves.
// Players type moves like "e2 e4" to play.

const FILES = ['a','b','c','d','e','f','g','h']
const BACK  = ['R','N','B','Q','K','B','N','R']

const PIECE_UNICODE = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟',
}

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
function pieceEmoji(p) { return PIECE_UNICODE[p.c + p.t] || '?' }

// ── Canvas board image generator ─────────────────────────────────────────────

function drawChessBoard(board) {
  try {
    const { createCanvas } = require('canvas')
    const CELL   = 72
    const MARGIN = 32
    const SIZE   = CELL * 8 + MARGIN * 2

    const canvas = createCanvas(SIZE, SIZE)
    const ctx    = canvas.getContext('2d')

    ctx.fillStyle = '#0d0d14'
    ctx.fillRect(0, 0, SIZE, SIZE)

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#c8a06a' : '#5c3317'
        ctx.fillRect(MARGIN + c * CELL, MARGIN + r * CELL, CELL, CELL)
      }
    }

    ctx.fillStyle = '#d4af7a'
    ctx.font = 'bold 15px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let c = 0; c < 8; c++) {
      const x = MARGIN + c * CELL + CELL / 2
      ctx.fillText(FILES[c], x, MARGIN / 2)
      ctx.fillText(FILES[c], x, SIZE - MARGIN / 2)
    }
    for (let r = 0; r < 8; r++) {
      const y = MARGIN + r * CELL + CELL / 2
      ctx.fillText(String(8 - r), MARGIN / 2, y)
      ctx.fillText(String(8 - r), SIZE - MARGIN / 2, y)
    }

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c]
        if (!piece) continue
        const cx = MARGIN + c * CELL + CELL / 2
        const cy = MARGIN + r * CELL + CELL / 2
        const radius = CELL * 0.36
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.5)'
        ctx.shadowBlur = 6
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 3
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        if (piece.c === 'w') {
          ctx.fillStyle = '#fffde7'
          ctx.strokeStyle = '#5d4037'
        } else {
          ctx.fillStyle = '#1a1a2e'
          ctx.strokeStyle = '#b0bec5'
        }
        ctx.lineWidth = 2.5
        ctx.fill()
        ctx.stroke()
        ctx.restore()
        ctx.font = `bold ${Math.round(CELL * 0.4)}px Arial`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = piece.c === 'w' ? '#3e2723' : '#eceff1'
        ctx.fillText(piece.t === 'N' ? 'N' : piece.t, cx, cy + 1)
      }
    }

    return canvas.toBuffer('image/png')
  } catch {
    return null
  }
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
    const dir    = p.c === 'w' ? -1 : 1
    const startR = p.c === 'w' ? 6 : 1
    const promoR = p.c === 'w' ? 0 : 7
    const nr = r + dir
    if (nr >= 0 && nr <= 7) {
      if (!board[nr][f]) {
        moves.push({ from: [r, f], to: [nr, f], promote: nr === promoR })
        if (r === startR && !board[r + 2 * dir][f])
          moves.push({ from: [r, f], to: [r + 2 * dir, f], double: true })
      }
      for (const df of [-1, 1]) {
        const tf = f + df
        if (tf < 0 || tf > 7) continue
        if (board[nr][tf] && board[nr][tf].c !== p.c)
          moves.push({ from: [r, f], to: [nr, tf], promote: nr === promoR })
        if (ep && ep[0] === nr && ep[1] === tf)
          moves.push({ from: [r, f], to: [nr, tf], ep: true })
      }
    }
  } else if (p.t === 'N') {
    for (const [dr, df] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
      addIfValid(r + dr, f + df)
  } else if (p.t === 'B') {
    for (const [dr,df] of [[-1,-1],[-1,1],[1,-1],[1,1]]) slide(dr, df)
  } else if (p.t === 'R') {
    for (const [dr,df] of [[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, df)
  } else if (p.t === 'Q') {
    for (const [dr,df] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, df)
  } else if (p.t === 'K') {
    for (const [dr,df] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
      addIfValid(r + dr, f + df)
    const rank = p.c === 'w' ? 7 : 0
    if (r === rank && f === 4) {
      if (castling[p.c+'K'] && !board[rank][5] && !board[rank][6] && board[rank][7]?.t==='R' && board[rank][7]?.c===p.c)
        moves.push({ from: [r,f], to: [rank,6], castle: 'K' })
      if (castling[p.c+'Q'] && !board[rank][3] && !board[rank][2] && !board[rank][1] && board[rank][0]?.t==='R' && board[rank][0]?.c===p.c)
        moves.push({ from: [r,f], to: [rank,2], castle: 'Q' })
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
  for (let pr = 0; pr < 8; pr++)
    for (let pf = 0; pf < 8; pf++) {
      if (board[pr][pf]?.c !== byColor) continue
      const moves = pseudoMoves(board, pr, pf, null, { wK:false, wQ:false, bK:false, bQ:false })
      if (moves.some(m => m.to[0] === r && m.to[1] === f)) return true
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
  if (move.castle === 'K') { nb[tr][5] = nb[tr][7]; nb[tr][7] = null }
  else if (move.castle === 'Q') { nb[tr][3] = nb[tr][0]; nb[tr][0] = null }
  if (move.ep) nb[fr][tf] = null
  if (move.promote) nb[tr][tf] = { t: 'Q', c: piece.c }
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
  if (p.t === 'K') { c[p.c+'K'] = false; c[p.c+'Q'] = false }
  if (p.t === 'R') {
    if (fr===7 && ff===0) c.wQ = false
    if (fr===7 && ff===7) c.wK = false
    if (fr===0 && ff===0) c.bQ = false
    if (fr===0 && ff===7) c.bK = false
  }
  return c
}

// ── Display helpers ──────────────────────────────────────────────────────────

function boardCaption(game) {
  const { turn, lastMove, white, black } = game
  const inCheck  = isInCheck(game.board, turn)
  const turnLabel = (turn === 'w' ? white : black) === 'bot'
    ? '🤖 Bot'
    : `@${(turn === 'w' ? white : black).split('@')[0]}`
  let text = `♟️ *CHESS*\n\n`
  text += `⬜ White: @${white.split('@')[0]}\n`
  text += `⬛ Black: ${black === 'bot' ? '🤖 Bot' : '@' + black.split('@')[0]}\n`
  text += `\n⚡ *Turn:* ${turnLabel} (${turn === 'w' ? '⬜' : '⬛'})`
  if (lastMove) text += `\n📌 Last: ${sq(...lastMove.from)} → ${sq(...lastMove.to)}`
  if (inCheck)  text += `\n\n⚠️ *CHECK!*`
  return text
}

// ── Send helpers ─────────────────────────────────────────────────────────────

async function sendBoard(sock, jid, game, quotedMsg) {
  game._jid = jid
  const mentions   = [game.white, ...(game.black !== 'bot' ? [game.black] : [])]
  const caption    = boardCaption(game)
  const imgBuf     = drawChessBoard(game.board)
  const turnPlayer = game.turn === 'w' ? game.white : game.black
  const turnTag    = turnPlayer === 'bot' ? '🤖 Bot' : `@${turnPlayer.split('@')[0]}`
  const hint       = `\n\n_${turnTag}'s turn — type your move (e.g. *e2 e4*)_\n_Type *.resign* to resign_`
  const fullCaption = caption + hint
  const opts = quotedMsg ? { quoted: quotedMsg } : {}

  if (imgBuf) {
    await sock.sendMessage(jid, { image: imgBuf, caption: fullCaption, mentions }, opts)
  } else {
    let boardText = '```\n  a b c d e f g h\n'
    for (let r = 0; r < 8; r++) {
      boardText += `${8-r} `
      for (let f = 0; f < 8; f++) {
        const p = game.board[r][f]
        boardText += p ? pieceEmoji(p) : (r + f) % 2 === 0 ? '□' : '■'
        boardText += ' '
      }
      boardText += `${8-r}\n`
    }
    boardText += '  a b c d e f g h\n```'
    await sock.sendMessage(jid, { text: boardText + fullCaption, mentions }, opts)
  }
}

async function sendEnd(sock, jid, text, mentions) {
  await sock.sendMessage(jid, {
    text: text + '\n\n_Type *.chess @user* or *.chess start bot* to start a new game_',
    mentions: mentions || [],
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
    const result  = inCheck ? '🤖 Bot is in *checkmate*! ⬜ White wins!' : '🤝 *Stalemate!* Draw.'
    chessGames.delete(jid)
    return sendEnd(sock, jid, result, [game.white])
  }
  const move = moves[Math.floor(Math.random() * moves.length)]
  game.castling = updateCastling(game.castling, move, game.board)
  game.board    = applyMove(game.board, move)
  game.ep       = move.double ? [move.from[0] + (game.board[move.to[0]][move.to[1]]?.c === 'w' ? -1 : 1), move.from[1]] : null
  game.lastMove = move
  game.turn     = 'w'
  game.pendingSelect = null

  const legalForWhite = getLegalMoves(game.board, 'w', game.ep, game.castling)
  if (!legalForWhite.length) {
    const inCheck = isInCheck(game.board, 'w')
    const result  = inCheck
      ? `🤖 Bot played ${sq(...move.from)}→${sq(...move.to)}\n\n♚ *Checkmate!* ⬛ Black (Bot) wins!`
      : `🤖 Bot played ${sq(...move.from)}→${sq(...move.to)}\n\n🤝 *Stalemate!* Draw.`
    chessGames.delete(jid)
    return sendEnd(sock, jid, result, [game.white])
  }
  await sendBoard(sock, jid, game)
}

// ── Command exports ─────────────────────────────────────────────────────────

module.exports = {
  chessGames,

  async chess({ sock, msg, jid, senderJid, sender, args, reply, isGroup }) {
    if (!isGroup) return reply('♟️ Chess must be played in a group!')

    if (args[0]?.toLowerCase() === 'start' && args[1]?.toLowerCase() === 'bot') {
      if (chessGames.has(jid)) return reply('❌ A chess game is already active here.')
      const game = {
        board: initBoard(), white: senderJid, black: 'bot',
        turn: 'w', ep: null,
        castling: { wK:true, wQ:true, bK:true, bQ:true },
        lastMove: null, pendingSelect: null, status: 'active',
        _jid: jid,
      }
      chessGames.set(jid, game)
      await sock.sendMessage(jid, { text: `♟️ *Chess vs Bot*\n\n@${sender} is ⬜ White.\nBot is ⬛ Black.\n\n_Type your moves like: e2 e4_`, mentions: [senderJid] })
      return sendBoard(sock, jid, game)
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
                      (msg.message?.extendedTextMessage?.contextInfo?.quotedParticipant
                        ? [msg.message.extendedTextMessage.contextInfo.quotedParticipant] : [])
    if (!mentioned.length) return reply('Usage:\n• .chess @user — challenge someone\n• .chess start bot — play vs bot')
    const opponent = mentioned[0]
    if (opponent === senderJid) return reply('❌ You cannot challenge yourself!')
    if (chessGames.has(jid)) return reply('❌ A chess game is already active here.')

    chessGames.set(jid, { status: 'pending', challenger: senderJid, opponent, board: null, turn: null, _jid: jid })
    await sock.sendMessage(jid, {
      text: `♟️ @${opponent.split('@')[0]}, you've been challenged to Chess by @${sender}!\n\nReply *.accept* to play as ⬛ Black.`,
      mentions: [opponent, senderJid],
    })
  },

  async endchess({ sock, msg, jid, senderJid, reply, isOwner }) {
    const game = chessGames.get(jid)
    if (!game) return reply('❌ No active chess game here.')
    const isPlayer = senderJid === game.challenger || senderJid === game.opponent ||
                     senderJid === game.white || senderJid === game.black
    if (!isPlayer && !isOwner) return reply('⚠️ Only a player or admin can end the game.')
    chessGames.delete(jid)
    return reply('✅ Chess game ended.')
  },

  async accept({ sock, msg, jid, senderJid }) {
    const game = chessGames.get(jid)
    if (!game || game.status !== 'pending') return
    if (senderJid !== game.opponent) return
    const ng = {
      board: initBoard(), white: game.challenger, black: game.opponent,
      turn: 'w', ep: null,
      castling: { wK:true, wQ:true, bK:true, bQ:true },
      lastMove: null, pendingSelect: null, status: 'active',
      _jid: jid,
    }
    chessGames.set(jid, ng)
    await sock.sendMessage(jid, {
      text: `♟️ *Chess Game Started!*\n\n⬜ White: @${ng.white.split('@')[0]}\n⬛ Black: @${ng.black.split('@')[0]}\n\n_Type your moves like: e2 e4_`,
      mentions: [ng.white, ng.black],
    })
    await sendBoard(sock, jid, ng)
  },

  // ── Text move handler — players type e.g. "e2 e4" or "resign" ────────────
  async handleMove(sock, jid, senderJid, moveText) {
    const game = chessGames.get(jid)
    if (!game || game.status !== 'active') return false

    const isPlayerTurn = (game.turn === 'w' && senderJid === game.white) ||
                         (game.turn === 'b' && senderJid === game.black)
    if (!isPlayerTurn) return false

    const clean = moveText.toLowerCase().trim()

    // ── Resign ───────────────────────────────────────────────────────────────
    if (clean === 'resign') {
      const isWhite  = senderJid === game.white
      const winner   = isWhite
        ? (game.black === 'bot' ? '🤖 Bot' : `@${game.black.split('@')[0]}`)
        : `@${game.white.split('@')[0]}`
      const loser    = isWhite ? `@${game.white.split('@')[0]}` : `@${game.black.split('@')[0]}`
      const mentions = [game.white, ...(game.black !== 'bot' ? [game.black] : [])]
      chessGames.delete(jid)
      await sendEnd(sock, jid, `🏳️ ${loser} resigned!\n\n🏆 *${winner} wins!*`, mentions)
      return true
    }

    // ── Parse move: "e2 e4", "e2e4", "e2-e4" ───────────────────────────────
    const normalized = clean.replace(/[-\s]+/g, ' ').trim()
    const match = normalized.match(/^([a-h][1-8])\s?([a-h][1-8])$/)
    if (!match) return false

    const fromSq = match[1], toSq = match[2]
    const fromF  = FILES.indexOf(fromSq[0])
    const fromR  = 8 - parseInt(fromSq[1])
    const toF    = FILES.indexOf(toSq[0])
    const toR    = 8 - parseInt(toSq[1])

    const legalMoves = getLegalMoves(game.board, game.turn, game.ep, game.castling)
    const move = legalMoves.find(m => m.from[0]===fromR && m.from[1]===fromF && m.to[0]===toR && m.to[1]===toF)

    if (!move) {
      await sock.sendMessage(jid, { text: `❌ *${fromSq} → ${toSq}* is not a legal move. Try again.` })
      return true
    }

    // ── Execute move ─────────────────────────────────────────────────────────
    game.castling     = updateCastling(game.castling, move, game.board)
    game.board        = applyMove(game.board, move)
    game.ep           = move.double ? [fromR + (game.turn === 'w' ? 1 : -1), fromF] : null
    game.lastMove     = move
    const nextTurn    = game.turn === 'w' ? 'b' : 'w'
    game.turn         = nextTurn
    game.pendingSelect = null

    const nextMoves = getLegalMoves(game.board, nextTurn, game.ep, game.castling)
    if (!nextMoves.length) {
      const inCheck  = isInCheck(game.board, nextTurn)
      const winner   = nextTurn === 'w'
        ? (game.black === 'bot' ? '🤖 Bot' : `@${game.black.split('@')[0]}`)
        : `@${game.white.split('@')[0]}`
      const result   = inCheck ? `♚ *Checkmate!*\n\n🏆 ${winner} wins!` : `🤝 *Stalemate!* Draw.`
      const mentions = [game.white, ...(game.black !== 'bot' ? [game.black] : [])]
      chessGames.delete(jid)
      await sendEnd(sock, jid, result, mentions)
      return true
    }

    if (game.black === 'bot' && nextTurn === 'b') {
      await sendBoard(sock, jid, game)
      await doBotMove(sock, jid)
      return true
    }
    await sendBoard(sock, jid, game)
    return true
  },
}
