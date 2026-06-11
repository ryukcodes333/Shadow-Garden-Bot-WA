'use strict'
// ╔══════════════════════════════════════════════╗
// ║        ♟️  CHESS  —  commands/chess.js        ║
// ╚══════════════════════════════════════════════╝
// Full legal-move chess with image board + interactive quick-reply buttons.
// Uses @dark-yasiya/baileys interactiveButtons for the chess grid UI.
// Game state stored in chessGames Map keyed by chatJid.

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

    ctx.fillStyle = '#1e1e2e'
    ctx.fillRect(0, 0, SIZE, SIZE)

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#f0d9b5' : '#b58863'
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

// ── Build the 8×8 grid of quick-reply buttons ─────────────────────────────

function buildBoardButtons(game) {
  const jid = game._jid
  const legalMoves = game.pendingSelect
    ? getLegalMoves(game.board, game.turn, game.ep, game.castling)
        .filter(m => m.from[0] === game.pendingSelect[0] && m.from[1] === game.pendingSelect[1])
    : null
  const validDests = legalMoves
    ? new Set(legalMoves.map(m => `${m.to[0]}_${m.to[1]}`))
    : null

  const buttons = []
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = game.board[r][f]
      let label

      if (game.pendingSelect) {
        const [sr, sf] = game.pendingSelect
        if (r === sr && f === sf) {
          label = `[${p ? pieceEmoji(p) : '·'}]`
        } else if (validDests && validDests.has(`${r}_${f}`)) {
          label = p ? `×${pieceEmoji(p)}` : '●'
        } else {
          label = p ? pieceEmoji(p) : (r + f) % 2 === 0 ? '·' : '·'
        }
      } else {
        label = p ? pieceEmoji(p) : (r + f) % 2 === 0 ? '·' : '·'
      }

      buttons.push({
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: label,
          id: `chess_sq_${r}_${f}_${jid}`
        })
      })
    }
  }
  buttons.push({
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({
      display_text: '🏳️ Resign',
      id: `chess_resign_${jid}`
    })
  })
  return buttons
}

// ── Send helpers ─────────────────────────────────────────────────────────────

async function sendBoardWithButtons(sock, jid, game, quoted) {
  game._jid = jid
  const mentions = [game.white, ...(game.black !== 'bot' ? [game.black] : [])]
  const caption  = boardCaption(game)
  const imgBuf   = drawChessBoard(game.board)
  const interactiveButtons = buildBoardButtons(game)

  const turnName = (game.turn === 'w' ? game.white : game.black) === 'bot'
    ? '🤖 Bot'
    : `@${(game.turn === 'w' ? game.white : game.black).split('@')[0]}`
  const footer = game.pendingSelect
    ? `${sq(...game.pendingSelect)} selected — tap a highlighted square to move`
    : `${turnName}'s turn — tap a piece to select it`

  try {
    if (imgBuf) {
      await sock.sendMessage(jid, {
        image: imgBuf,
        caption,
        title: '♟️ CHESS',
        footer,
        interactiveButtons,
        mentions,
      }, quoted ? { quoted } : undefined)
    } else {
      await sock.sendMessage(jid, {
        text: caption,
        title: '♟️ CHESS',
        footer,
        interactiveButtons,
        mentions,
      }, quoted ? { quoted } : undefined)
    }
  } catch {
    // Fallback to text board
    let board = '```\n  a b c d e f g h\n'
    for (let r = 0; r < 8; r++) {
      board += `${8-r} `
      for (let f = 0; f < 8; f++) {
        const p = game.board[r][f]
        board += p ? pieceEmoji(p) : (r + f) % 2 === 0 ? '□' : '■'
        board += ' '
      }
      board += `${8-r}\n`
    }
    board += '  a b c d e f g h\n```'
    await sock.sendMessage(jid, { text: caption + '\n\n' + board + '\n\n_Tap a piece or type the square (e.g. e2)_', mentions })
  }
}

async function sendEndButtons(sock, jid, text, mentions, jidKey) {
  const key = jidKey || jid
  try {
    await sock.sendMessage(jid, {
      text,
      title: '♟️ Game Over',
      footer: 'Chess — what next?',
      interactiveButtons: [
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: '🔄 Rematch', id: `chess_rematch_${key}` })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({ display_text: '❌ Close', id: `chess_close_${key}` })
        },
      ],
      mentions: mentions || [],
    })
  } catch {
    await sock.sendMessage(jid, { text, mentions: mentions || [] })
  }
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
    return sendEndButtons(sock, jid, result, [game.white], jid)
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
    return sendEndButtons(sock, jid, result, [game.white], jid)
  }
  await sendBoardWithButtons(sock, jid, game)
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
      await sock.sendMessage(jid, { text: `♟️ *Chess vs Bot*\n\n@${sender} is ⬜ White.\nBot is ⬛ Black.`, mentions: [senderJid] })
      return sendBoardWithButtons(sock, jid, game)
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
      text: `♟️ *Chess Game Started!*\n\n⬜ White: @${ng.white.split('@')[0]}\n⬛ Black: @${ng.black.split('@')[0]}`,
      mentions: [ng.white, ng.black],
    })
    await sendBoardWithButtons(sock, jid, ng)
  },

  // ── Button handler (chess_sq_, chess_resign_, chess_rematch_, chess_close_) ──

  async handleButton(sock, msg, buttonId) {
    const jid       = msg.key.remoteJid
    const senderJid = msg.key.participant || msg.key.remoteJid
    const game      = chessGames.get(jid)

    // ── Close ───────────────────────────────────────────────────────────────
    if (buttonId.startsWith('chess_close_')) {
      if (game) chessGames.delete(jid)
      return sock.sendMessage(jid, { text: '✅ Chess game closed.' })
    }

    // ── Rematch ─────────────────────────────────────────────────────────────
    if (buttonId.startsWith('chess_rematch_')) {
      if (!game) return
      const ng = {
        board: initBoard(),
        white: game.black === 'bot' ? game.white : game.black,
        black: game.black === 'bot' ? 'bot' : game.white,
        turn: 'w', ep: null,
        castling: { wK:true, wQ:true, bK:true, bQ:true },
        lastMove: null, pendingSelect: null, status: 'active',
        _jid: jid,
      }
      chessGames.set(jid, ng)
      return sendBoardWithButtons(sock, jid, ng)
    }

    // ── Resign ──────────────────────────────────────────────────────────────
    if (buttonId.startsWith('chess_resign_')) {
      if (!game || game.status !== 'active') return
      const isWhite = senderJid === game.white
      const isBlack = senderJid === game.black
      if (!isWhite && !isBlack) return
      const winner  = isWhite ? (game.black === 'bot' ? '🤖 Bot' : `@${game.black.split('@')[0]}`) : `@${game.white.split('@')[0]}`
      const loser   = isWhite ? `@${game.white.split('@')[0]}` : `@${game.black.split('@')[0]}`
      const mentions = [game.white, ...(game.black !== 'bot' ? [game.black] : [])]
      chessGames.delete(jid)
      return sendEndButtons(sock, jid, `🏳️ ${loser} resigned!\n\n🏆 *${winner} wins!*`, mentions, jid)
    }

    // ── Square tap (chess_sq_R_F_jid) ───────────────────────────────────────
    if (buttonId.startsWith('chess_sq_')) {
      if (!game || game.status !== 'active') return

      // Extract row/file — id format: chess_sq_R_F_<jid>
      const withoutPrefix = buttonId.slice('chess_sq_'.length)
      const parts = withoutPrefix.split('_')
      const r = parseInt(parts[0])
      const f = parseInt(parts[1])
      if (isNaN(r) || isNaN(f)) return

      const isPlayerTurn = (game.turn === 'w' && senderJid === game.white) ||
                           (game.turn === 'b' && senderJid === game.black)
      if (!isPlayerTurn) {
        return sock.sendMessage(jid, { text: `⏳ It's not your turn!` })
      }

      // ── Case 1: A piece is already selected → try to move to this square ──
      if (game.pendingSelect) {
        const [sr, sf] = game.pendingSelect
        const legalMoves = getLegalMoves(game.board, game.turn, game.ep, game.castling)
        const move = legalMoves.find(m => m.from[0]===sr && m.from[1]===sf && m.to[0]===r && m.to[1]===f)

        if (move) {
          // Execute the move
          game.castling = updateCastling(game.castling, move, game.board)
          game.board    = applyMove(game.board, move)
          game.ep       = move.double ? [r + (game.turn === 'w' ? 1 : -1), sf] : null
          game.lastMove = move
          const nextTurn = game.turn === 'w' ? 'b' : 'w'
          game.turn = nextTurn
          game.pendingSelect = null

          const nextMoves = getLegalMoves(game.board, nextTurn, game.ep, game.castling)
          if (!nextMoves.length) {
            const inCheck = isInCheck(game.board, nextTurn)
            const winner  = nextTurn === 'w'
              ? (game.black === 'bot' ? '🤖 Bot' : `@${game.black.split('@')[0]}`)
              : `@${game.white.split('@')[0]}`
            const result  = inCheck ? `♚ *Checkmate!*\n\n🏆 ${winner} wins!` : `🤝 *Stalemate!* Draw.`
            const mentions = [game.white, ...(game.black !== 'bot' ? [game.black] : [])]
            chessGames.delete(jid)
            return sendEndButtons(sock, jid, result, mentions, jid)
          }

          if (game.black === 'bot' && nextTurn === 'b') {
            await sendBoardWithButtons(sock, jid, game)
            return doBotMove(sock, jid)
          }
          return sendBoardWithButtons(sock, jid, game)
        }

        // Tapped an invalid dest — if they tapped their own piece, re-select it
        const tappedPiece = game.board[r][f]
        if (tappedPiece && tappedPiece.c === game.turn) {
          game.pendingSelect = [r, f]
          return sendBoardWithButtons(sock, jid, game)
        }

        // Not a valid move, not their piece — deselect and show board
        game.pendingSelect = null
        await sock.sendMessage(jid, { text: `❌ *${sq(sr, sf)} → ${sq(r, f)}* is not a legal move. Tap a piece to try again.` })
        return sendBoardWithButtons(sock, jid, game)
      }

      // ── Case 2: No piece selected → select this square ─────────────────────
      const piece = game.board[r][f]
      if (!piece) {
        return sock.sendMessage(jid, { text: `⬜ ${sq(r, f)} is empty. Tap one of your pieces.` })
      }
      if (piece.c !== game.turn) {
        return sock.sendMessage(jid, { text: `❌ That's your opponent's piece on ${sq(r, f)}.` })
      }

      const legalMoves = getLegalMoves(game.board, game.turn, game.ep, game.castling)
      const pieceMoves = legalMoves.filter(m => m.from[0] === r && m.from[1] === f)
      if (!pieceMoves.length) {
        return sock.sendMessage(jid, { text: `⚠️ ${pieceEmoji(piece)} on ${sq(r, f)} has no legal moves!` })
      }

      game.pendingSelect = [r, f]
      return sendBoardWithButtons(sock, jid, game)
    }
  },

  // ── Legacy list handler (kept for backward compat) ──────────────────────────
  async handleList(sock, msg, rowId) {
    const jid       = msg.key.remoteJid
    const senderJid = msg.key.participant || msg.key.remoteJid
    const game      = chessGames.get(jid)
    if (!game || game.status !== 'active') return

    const isPlayerTurn = (game.turn === 'w' && senderJid === game.white) ||
                         (game.turn === 'b' && senderJid === game.black)
    if (!isPlayerTurn) return sock.sendMessage(jid, { text: '⏳ It\'s not your turn!' })

    if (rowId.startsWith('move_')) {
      const parts = rowId.split('_')
      const [fr, ff, tr, tf] = [Number(parts[1]), Number(parts[2]), Number(parts[3]), Number(parts[4])]
      const legalMoves = getLegalMoves(game.board, game.turn, game.ep, game.castling)
      const move = legalMoves.find(m => m.from[0]===fr && m.from[1]===ff && m.to[0]===tr && m.to[1]===tf)
      if (!move) return sock.sendMessage(jid, { text: '❌ Invalid move.' })

      game.castling = updateCastling(game.castling, move, game.board)
      game.board    = applyMove(game.board, move)
      game.ep       = move.double ? [tr + (game.turn === 'w' ? 1 : -1), ff] : null
      game.lastMove = move
      game.pendingSelect = null
      const nextTurn = game.turn === 'w' ? 'b' : 'w'
      game.turn = nextTurn

      const nextMoves = getLegalMoves(game.board, nextTurn, game.ep, game.castling)
      if (!nextMoves.length) {
        const inCheck = isInCheck(game.board, nextTurn)
        const winner  = nextTurn === 'w' ? (game.black === 'bot' ? '🤖 Bot' : `@${game.black.split('@')[0]}`) : `@${game.white.split('@')[0]}`
        const result  = inCheck ? `♚ *Checkmate!*\n\n🏆 ${winner} wins!` : `🤝 *Stalemate!* Draw.`
        const mentions = [game.white, ...(game.black !== 'bot' ? [game.black] : [])]
        chessGames.delete(jid)
        return sendEndButtons(sock, jid, result, mentions, jid)
      }

      if (game.black === 'bot' && nextTurn === 'b') {
        await sendBoardWithButtons(sock, jid, game)
        return doBotMove(sock, jid)
      }
      return sendBoardWithButtons(sock, jid, game)
    }
  },
}
