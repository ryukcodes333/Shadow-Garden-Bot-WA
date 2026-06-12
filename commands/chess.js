'use strict'
// ╔══════════════════════════════════════════════╗
// ║  ♟️  CHESS  —  commands/chess.js              ║
// ║  Dark-themed board | text-based moves        ║
// ╚══════════════════════════════════════════════╝

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

// ── Canvas board image (dark brown theme) ───────────────────────────────────

function drawChessBoard(board, lastMove, pendingSelect, legalDests) {
  try {
    const { createCanvas } = require('canvas')
    const CELL   = 72
    const MARGIN = 32
    const SIZE   = CELL * 8 + MARGIN * 2

    const canvas = createCanvas(SIZE, SIZE)
    const ctx    = canvas.getContext('2d')

    // Dark outer background
    ctx.fillStyle = '#12111a'
    ctx.fillRect(0, 0, SIZE, SIZE)

    // Board squares — dark-themed with brown palette
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isLight    = (r + c) % 2 === 0
        const isLastFrom = lastMove && lastMove.from[0] === r && lastMove.from[1] === c
        const isLastTo   = lastMove && lastMove.to[0]   === r && lastMove.to[1]   === c
        const isPending  = pendingSelect && pendingSelect[0] === r && pendingSelect[1] === c
        const isDest     = legalDests && legalDests.has(`${r}_${c}`)

        let color
        if (isPending)         color = '#c8a800'
        else if (isLastTo)     color = isLight ? '#f0e84a' : '#c8b818'
        else if (isLastFrom)   color = isLight ? '#ddd168' : '#b8a230'
        else if (isLight)      color = '#d4a96a'   // warm tan
        else                   color = '#8b4513'   // saddle brown (darker square)

        ctx.fillStyle = color
        ctx.fillRect(MARGIN + c * CELL, MARGIN + r * CELL, CELL, CELL)

        // Legal destination dots
        if (isDest && !isPending) {
          const target = board[r][c]
          if (target) {
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'
            ctx.lineWidth = 4
            ctx.strokeRect(MARGIN + c * CELL + 2, MARGIN + r * CELL + 2, CELL - 4, CELL - 4)
          } else {
            ctx.fillStyle = 'rgba(0,0,0,0.28)'
            ctx.beginPath()
            ctx.arc(MARGIN + c * CELL + CELL / 2, MARGIN + r * CELL + CELL / 2, CELL * 0.2, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
    }

    // Rank / file labels
    ctx.fillStyle = '#c9a87a'
    ctx.font = 'bold 14px Arial'
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

    // Pieces
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c]
        if (!piece) continue
        const cx = MARGIN + c * CELL + CELL / 2
        const cy = MARGIN + r * CELL + CELL / 2
        const radius = CELL * 0.36
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.7)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 3
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        if (piece.c === 'w') {
          ctx.fillStyle = '#fffde7'
          ctx.strokeStyle = '#5d4037'
        } else {
          ctx.fillStyle = '#1a0a00'
          ctx.strokeStyle = '#b0bec5'
        }
        ctx.lineWidth = 2.5
        ctx.fill()
        ctx.stroke()
        ctx.restore()
        ctx.font = `bold ${Math.round(CELL * 0.38)}px Arial`
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

// ── Caption ─────────────────────────────────────────────────────────────────

function boardCaption(game) {
  const { turn, lastMove, white, black } = game
  const inCheck   = isInCheck(game.board, turn)
  const turnPhone = turn === 'w' ? white : black
  const turnLabel = turnPhone === 'bot' ? '🤖 Bot' : `@${turnPhone.split('@')[0].split(':')[0]}`
  let text = `♟️ *CHESS*\n\n`
  text += `⬜ White: @${white.split('@')[0].split(':')[0]}\n`
  text += `⬛ Black: ${black === 'bot' ? '🤖 Bot' : '@' + black.split('@')[0].split(':')[0]}\n`
  text += `\n⚡ *Turn:* ${turnLabel} (${turn === 'w' ? '⬜' : '⬛'})`
  if (lastMove) text += `\n📌 Last: ${sq(...lastMove.from)} → ${sq(...lastMove.to)}`
  if (inCheck)  text += `\n\n⚠️ *CHECK!*`
  text += `\n\n_Type your move (e.g. *e2 e4*) to play_`
  if (game.pendingSelect) {
    text += `\n_Selected: *${sq(...game.pendingSelect)}* — now type destination (e.g. *e4*)_`
  }
  return text
}

// ── Send board (image + caption, no buttons) ─────────────────────────────────

async function sendBoard(sock, jid, game, quoted) {
  const legalDests = game.pendingSelect
    ? new Set(
        getLegalMoves(game.board, game.turn, game.ep, game.castling)
          .filter(m => m.from[0] === game.pendingSelect[0] && m.from[1] === game.pendingSelect[1])
          .map(m => `${m.to[0]}_${m.to[1]}`)
      )
    : null

  const mentions = [game.white, ...(game.black !== 'bot' ? [game.black] : [])]
  const caption  = boardCaption(game)
  const imgBuf   = drawChessBoard(game.board, game.lastMove, game.pendingSelect, legalDests)

  const opts = quoted ? { quoted } : {}
  if (imgBuf) {
    await sock.sendMessage(jid, { image: imgBuf, caption, mentions }, opts)
  } else {
    await sock.sendMessage(jid, { text: caption, mentions }, opts)
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
    return sock.sendMessage(jid, {
      text: result + '\n\n_Type .chess @user to start a new game_',
      mentions: [game.white],
    })
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
    return sock.sendMessage(jid, {
      text: result + '\n\n_Type .chess @user to start a new game_',
      mentions: [game.white],
    })
  }
  await sendBoard(sock, jid, game)
}

// ── Execute a validated move ─────────────────────────────────────────────────

async function executeMove(sock, jid, game, move, msg) {
  game.castling = updateCastling(game.castling, move, game.board)
  game.board    = applyMove(game.board, move)
  game.ep       = move.double ? [move.to[0] + (game.turn === 'w' ? 1 : -1), move.from[1]] : null
  game.lastMove = move
  game.pendingSelect = null
  const nextTurn = game.turn === 'w' ? 'b' : 'w'
  game.turn = nextTurn

  const nextMoves = getLegalMoves(game.board, nextTurn, game.ep, game.castling)
  if (!nextMoves.length) {
    const inCheck = isInCheck(game.board, nextTurn)
    const winner  = nextTurn === 'w'
      ? (game.black === 'bot' ? '🤖 Bot' : `@${game.black.split('@')[0].split(':')[0]}`)
      : `@${game.white.split('@')[0].split(':')[0]}`
    const result  = inCheck ? `♚ *Checkmate!*\n\n🏆 ${winner} wins!` : `🤝 *Stalemate!* Draw.`
    const mentions = [game.white, ...(game.black !== 'bot' ? [game.black] : [])]
    chessGames.delete(jid)
    return sock.sendMessage(jid, {
      text: result + '\n\n_Type .chess @user to start a new game_',
      mentions,
    }, msg ? { quoted: msg } : {})
  }

  if (game.black === 'bot' && nextTurn === 'b') {
    await sendBoard(sock, jid, game, msg)
    return doBotMove(sock, jid)
  }
  return sendBoard(sock, jid, game, msg)
}

// ── Module exports ───────────────────────────────────────────────────────────

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
      }
      chessGames.set(jid, game)
      await sock.sendMessage(jid, {
        text: `♟️ *Chess vs Bot started!*\n\n⬜ White: @${sender}\n⬛ Black: 🤖 Bot\n\n_Type your move (e.g. *e2 e4*) to play_`,
        mentions: [senderJid],
      })
      return sendBoard(sock, jid, game, msg)
    }

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
                      (msg.message?.extendedTextMessage?.contextInfo?.quotedParticipant
                        ? [msg.message.extendedTextMessage.contextInfo.quotedParticipant] : [])
    if (!mentioned.length) return reply(
      '♟️ *Chess*\n\nUsage:\n• *.chess @user* — challenge a player\n• *.chess start bot* — play vs bot\n\n_Moves are made by replying e.g. *e2 e4*_'
    )
    const opponent = mentioned[0]
    if (opponent === senderJid) return reply('❌ You cannot challenge yourself!')
    if (chessGames.has(jid)) return reply('❌ A chess game is already active here.')

    chessGames.set(jid, { status: 'pending', challenger: senderJid, opponent, board: null, turn: null })
    await sock.sendMessage(jid, {
      text: `♟️ @${opponent.split('@')[0].split(':')[0]}, you've been challenged to Chess by @${sender}!\n\nType *accept* to play as ⬛ Black.`,
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
    }
    chessGames.set(jid, ng)
    await sock.sendMessage(jid, {
      text: `♟️ *Chess Game Started!*\n\n⬜ White: @${ng.white.split('@')[0].split(':')[0]}\n⬛ Black: @${ng.black.split('@')[0].split(':')[0]}\n\n_Type moves in chat (e.g. *e2 e4*) to play_`,
      mentions: [ng.white, ng.black],
    })
    await sendBoard(sock, jid, ng)
  },

  // ── Plain-text move handler ────────────────────────────────────────────────
  // Called from index.js whenever any message arrives in a group with an active game.
  // Supports: "e2 e4"  "e2e4"  "e2" (select) then "e4" (move)

  async handleChessText({ sock, msg, jid, senderJid, textRaw }) {
    const game = chessGames.get(jid)
    if (!game || game.status !== 'active') return false

    const isPlayerTurn = (game.turn === 'w' && senderJid === game.white) ||
                         (game.turn === 'b' && senderJid === game.black)

    const moveText = (textRaw || '').trim().toLowerCase()

    // ── Two-square notation: "e2 e4" or "e2e4" ──────────────────────────────
    let fromSqStr, toSqStr
    if (/^[a-h][1-8]\s+[a-h][1-8]$/.test(moveText)) {
      const parts = moveText.split(/\s+/)
      fromSqStr = parts[0]
      toSqStr   = parts[1]
    } else if (/^[a-h][1-8][a-h][1-8]$/.test(moveText)) {
      fromSqStr = moveText.slice(0, 2)
      toSqStr   = moveText.slice(2, 4)
    }

    if (fromSqStr && toSqStr) {
      if (!isPlayerTurn) {
        await sock.sendMessage(jid, { text: `⏳ It's not your turn!` }, { quoted: msg })
        return true
      }
      const ff = FILES.indexOf(fromSqStr[0])
      const fr = 8 - parseInt(fromSqStr[1])
      const tf = FILES.indexOf(toSqStr[0])
      const tr = 8 - parseInt(toSqStr[1])

      const legalMoves = getLegalMoves(game.board, game.turn, game.ep, game.castling)
      const move = legalMoves.find(m => m.from[0]===fr && m.from[1]===ff && m.to[0]===tr && m.to[1]===tf)

      if (!move) {
        await sock.sendMessage(jid, {
          text: `❌ *${fromSqStr} → ${toSqStr}* is not a legal move.\n_Type your move (e.g. *e2 e4*)_`,
        }, { quoted: msg })
        return true
      }

      game.pendingSelect = null
      await executeMove(sock, jid, game, move, msg)
      return true
    }

    // ── Single square: select or move ───────────────────────────────────────
    if (/^[a-h][1-8]$/.test(moveText)) {
      if (!isPlayerTurn) return false  // silently ignore non-player single squares

      const f = FILES.indexOf(moveText[0])
      const r = 8 - parseInt(moveText[1])

      if (game.pendingSelect) {
        const [sr, sf] = game.pendingSelect
        const legalMoves = getLegalMoves(game.board, game.turn, game.ep, game.castling)
        const move = legalMoves.find(m => m.from[0]===sr && m.from[1]===sf && m.to[0]===r && m.to[1]===f)

        if (move) {
          game.pendingSelect = null
          await executeMove(sock, jid, game, move, msg)
          return true
        }

        // Re-select if own piece tapped
        const tapped = game.board[r][f]
        if (tapped && tapped.c === game.turn) {
          const pieceMoves = getLegalMoves(game.board, game.turn, game.ep, game.castling).filter(m => m.from[0]===r && m.from[1]===f)
          if (!pieceMoves.length) {
            await sock.sendMessage(jid, { text: `⚠️ ${pieceEmoji(tapped)} on ${sq(r, f)} has no legal moves!` }, { quoted: msg })
            return true
          }
          game.pendingSelect = [r, f]
          await sendBoard(sock, jid, game, msg)
          return true
        }

        game.pendingSelect = null
        await sock.sendMessage(jid, {
          text: `❌ *${sq(sr, sf)} → ${sq(r, f)}* is not a legal move. Select a piece again.`,
        }, { quoted: msg })
        return true
      }

      // Select a piece
      const piece = game.board[r][f]
      if (!piece) return false
      if (piece.c !== game.turn) return false

      const pieceMoves = getLegalMoves(game.board, game.turn, game.ep, game.castling).filter(m => m.from[0]===r && m.from[1]===f)
      if (!pieceMoves.length) {
        await sock.sendMessage(jid, { text: `⚠️ ${pieceEmoji(piece)} on ${sq(r, f)} has no legal moves!` }, { quoted: msg })
        return true
      }

      game.pendingSelect = [r, f]
      await sendBoard(sock, jid, game, msg)
      return true
    }

    return false
  },

  // ── Resign ────────────────────────────────────────────────────────────────
  async resign({ sock, jid, senderJid, reply }) {
    const game = chessGames.get(jid)
    if (!game || game.status !== 'active') return reply('❌ No active chess game.')
    const isWhite = senderJid === game.white
    const isBlack = senderJid === game.black
    if (!isWhite && !isBlack) return reply('❌ You are not in this game.')
    const winner  = isWhite
      ? (game.black === 'bot' ? '🤖 Bot' : `@${game.black.split('@')[0].split(':')[0]}`)
      : `@${game.white.split('@')[0].split(':')[0]}`
    const loser   = isWhite ? `@${game.white.split('@')[0].split(':')[0]}` : `@${game.black.split('@')[0].split(':')[0]}`
    const mentions = [game.white, ...(game.black !== 'bot' ? [game.black] : [])]
    chessGames.delete(jid)
    await sock.sendMessage(jid, {
      text: `🏳️ ${loser} resigned!\n\n🏆 *${winner} wins!*\n\n_Type .chess @user to start a new game_`,
      mentions,
    })
  },

  // ── Backward-compat stubs (no-op now that buttons are removed) ────────────
  async handleButton() {},
  async handleList()  {},
}
