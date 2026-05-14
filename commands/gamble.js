const db = require('../database')
const axios = require('axios')
const fs = require('fs')
const path = require('path')

// ── Win rate ──────────────────────────────────────────────────────────────────
const WIN_RATE_FILE = path.join(__dirname, '..', 'win_rate.json')

function loadWinRate() {
  try {
    if (fs.existsSync(WIN_RATE_FILE)) {
      const d = JSON.parse(fs.readFileSync(WIN_RATE_FILE, 'utf8'))
      return Math.max(0, Math.min(100, d.rate ?? 50))
    }
  } catch {}
  return 50
}

function saveWinRate(rate) {
  fs.writeFileSync(WIN_RATE_FILE, JSON.stringify({ rate }), 'utf8')
  global._gamblingWinRate = rate
}

function getWinRate() {
  if (global._gamblingWinRate == null) global._gamblingWinRate = loadWinRate()
  return global._gamblingWinRate
}

function playerWins(baseOdds = 0.5) {
  const wr = getWinRate() / 100
  const adjusted = Math.min(1, wr * (baseOdds / 0.5))
  return Math.random() < adjusted
}

// ── Media generation ─────────────────────────────────────────────────────────
// Try video first, fall back to image if it fails
async function genVideo(prompt, width = 512, height = 512) {
  const seed = Math.floor(Math.random() * 99999)
  const url  = `https://video.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}&duration=3`
  const res  = await axios.get(url, { responseType: 'arraybuffer', timeout: 90000 })
  return Buffer.from(res.data)
}

async function genImage(prompt, width = 1024, height = 1024, model = 'flux') {
  const seed = Math.floor(Math.random() * 99999)
  const url  = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&model=${model}&seed=${seed}`
  const res  = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 })
  return Buffer.from(res.data)
}

// Send gambling media — tries video first, then image, then text-only
async function sendGamble(sock, jid, msg, videoPrompt, imgPrompt, caption) {
  try {
    const buf = await genVideo(videoPrompt)
    return await sock.sendMessage(jid, { video: buf, caption, gifPlayback: true }, { quoted: msg })
  } catch {}
  try {
    const buf = await genImage(imgPrompt)
    return await sock.sendMessage(jid, { image: buf, caption }, { quoted: msg })
  } catch {}
  return await sock.sendMessage(jid, { text: caption }, { quoted: msg })
}

// ── Card helpers ──────────────────────────────────────────────────────────────
const SUITS = ['♠️', '♥️', '♦️', '♣️']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const RANK_EMOJI = { A:'🅐', '2':'②', '3':'③', '4':'④', '5':'⑤', '6':'⑥', '7':'⑦', '8':'⑧', '9':'⑨', '10':'⑩', J:'🃏', Q:'👸', K:'🤴' }

function makeDeck() {
  const deck = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit })
  return deck.sort(() => Math.random() - 0.5)
}

function cardValue(card) {
  if (['J', 'Q', 'K'].includes(card.rank)) return 10
  if (card.rank === 'A') return 11
  return parseInt(card.rank)
}

function handTotal(cards) {
  let total = cards.reduce((s, c) => s + cardValue(c), 0)
  let aces  = cards.filter(c => c.rank === 'A').length
  while (total > 21 && aces-- > 0) total -= 10
  return total
}

function cardDisplay(c) { return `${RANK_EMOJI[c.rank] || c.rank}${c.suit}` }
function formatHand(cards, hideSecond = false) {
  return cards.map((c, i) => (hideSecond && i === 1) ? '🂠' : cardDisplay(c)).join('  ')
}

// Blackjack card-table image prompt
function bjImagePrompt(playerCards, dealerCards, dealerHidden) {
  const p = playerCards.map(c => `${c.rank} of ${c.suit.replace(/️/g,'')}`).join(', ')
  const d = dealerHidden
    ? `${dealerCards[0].rank} of ${dealerCards[0].suit.replace(/️/g,'')} and face-down card`
    : dealerCards.map(c => `${c.rank} of ${c.suit.replace(/️/g,'')}`).join(', ')
  return `professional casino blackjack table green felt, player hand: ${p}, dealer hand: ${d}, dramatic casino lighting, ultra HD photography, no text`
}

// ── Pending blackjack games (in-memory, keyed by stanzaId) ───────────────────
const pendingBJ = new Map()

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {

  // ────────────────────────────────────────────────────────────────────────────
  // .setwin <0-100>  — owner only
  // ────────────────────────────────────────────────────────────────────────────
  async setwin({ reply, args, isOwner }) {
    if (!isOwner) return reply('⚠️ Owner only.')
    const pct = parseFloat(args[0])
    if (isNaN(pct) || pct < 0 || pct > 100)
      return reply('⚠️ Usage: .setwin <0-100>\n\nExamples: .setwin 50 | .setwin 20 | .setwin 75')
    saveWinRate(pct)
    await reply(
      `⚙️ *GAMBLING WIN RATE UPDATED*\n\n` +
      `🎰 New Win Rate: *${pct}%*\n\n` +
      `${pct === 0   ? '💀 Total loss mode.'
      : pct < 20    ? '📉 Extremely harsh — near total loss.'
      : pct < 40    ? '⚠️ Below average — house heavily favoured.'
      : pct === 50  ? '⚖️ Balanced — standard casino odds.'
      : pct < 70    ? '📈 Player-friendly.'
                    : '🎉 Generous mode — players win often.'}\n\n` +
      `_Applies to: .bet .cf .slots .dice .rps .blackjack .spin .roulette .horse .jackpot .highlow .poker_`
    )
  },

  // ────────────────────────────────────────────────────────────────────────────
  // .bet <amount>
  // ────────────────────────────────────────────────────────────────────────────
  async bet({ reply, sock, jid, msg, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: .bet <amount>')
    if (amount > (u.wallet || 0)) return reply(`❌ Not enough coins! You have *${(u.wallet||0).toLocaleString()} coins*`)

    await reply('🎰 *Placing your bet...*')

    const win  = playerWins(0.5)
    const roll = Math.random()
    const mult = win ? (roll > 0.9 ? 3 : roll > 0.75 ? 2 : 1.5) : 0
    const net  = win ? Math.floor(amount * mult) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet||0) + net })
    await db.logTransaction(sender, win ? 'bet_win' : 'bet_loss', net, amount).catch(() => {})

    const caption = win
      ? `🎲 *WIN!*\n\n💰 *${amount.toLocaleString()} × ${mult}* → +${Math.floor(amount*mult).toLocaleString()} coins\n💵 Balance: *${((u.wallet||0)+net).toLocaleString()} coins*`
      : `🎲 *LOST*\n\n💸 -*${amount.toLocaleString()} coins*\n💵 Balance: *${((u.wallet||0)+net).toLocaleString()} coins*`

    const vPrompt = win
      ? 'casino winner celebration gold coins flying confetti neon lights slot machine animation'
      : 'casino loss dramatic dark lighting poker chips falling neon glow animation'
    const iPrompt = win
      ? 'casino winner gold coins chips stack neon lights dramatic'
      : 'casino loss dramatic dark poker chips scattered'

    await sendGamble(sock, jid, msg, vPrompt, iPrompt, caption)
  },

  // ────────────────────────────────────────────────────────────────────────────
  // .cf heads/tails <amount>
  // ────────────────────────────────────────────────────────────────────────────
  async cf({ reply, sock, jid, msg, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const choice = args[0]?.toLowerCase()
    const amount = parseInt(args[1])
    if (!['heads','tails','h','t'].includes(choice) || !amount || amount <= 0)
      return reply('⚠️ Usage: .cf heads/tails <amount>')
    if (amount > (u.wallet||0)) return reply(`❌ Not enough! You have *${(u.wallet||0).toLocaleString()} coins*`)

    await reply('🪙 *Flipping coin...*')

    const normalised = (choice === 'h' || choice === 'heads') ? 'heads' : 'tails'
    const win  = playerWins(0.5)
    const flip = win ? normalised : (normalised === 'heads' ? 'tails' : 'heads')
    const net  = win ? amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet||0) + net })
    await db.logTransaction(sender, win ? 'cf_win' : 'cf_loss', net, amount).catch(() => {})

    const caption =
      `🪙 *Coin Flip*\n\nYour bet: *${normalised.toUpperCase()}*  |  Result: *${flip.toUpperCase()}*\n\n` +
      `${win ? `✅ *+${amount.toLocaleString()} coins*` : `❌ *-${amount.toLocaleString()} coins*`}\n` +
      `💵 *${((u.wallet||0)+net).toLocaleString()} coins*`

    const vPrompt = 'shiny gold coin flipping tumbling through air slow motion dramatic lighting animation'
    const iPrompt = 'gold coin heads tails shiny macro shot dramatic lighting casino'
    await sendGamble(sock, jid, msg, vPrompt, iPrompt, caption)
  },

  // ────────────────────────────────────────────────────────────────────────────
  // .slots <amount>
  // ────────────────────────────────────────────────────────────────────────────
  async slots({ reply, sock, jid, msg, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0) return reply('⚠️ Usage: .slots <amount>')
    if (amount > (u.wallet||0)) return reply(`❌ Not enough! You have *${(u.wallet||0).toLocaleString()} coins*`)

    await reply('🎰 *Spinning the reels...*')

    const symbols   = ['🍒', '🍋', '🍇', '⭐', '💎', '🔔', '🃏', '🍀', '💰']
    let reels       = [0,1,2].map(() => symbols[Math.floor(Math.random() * symbols.length)])
    let multiplier  = 0
    let label       = 'No Match'
    const forceWin  = playerWins(0.4)
    if (forceWin) {
      const s = symbols[Math.floor(Math.random() * symbols.length)]
      reels   = [s, s, s]
    }
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      if      (reels[0] === '💎') { multiplier = 10; label = '💎 JACKPOT!' }
      else if (reels[0] === '⭐') { multiplier = 5;  label = '⭐ MEGA WIN!' }
      else if (reels[0] === '💰') { multiplier = 8;  label = '💰 GOLD WIN!' }
      else                        { multiplier = 3;  label = '🎉 Three of a Kind!' }
    } else if (reels[0]===reels[1] || reels[1]===reels[2] || reels[0]===reels[2]) {
      if (playerWins(0.5)) { multiplier = 1.5; label = '✨ Two of a Kind!' }
    }

    const net = multiplier > 0 ? Math.floor(amount * multiplier) - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet||0) + net })
    await db.logTransaction(sender, multiplier > 0 ? 'slots_win' : 'slots_loss', net, amount).catch(() => {})

    const caption =
      `🎰 *SLOT MACHINE*\n\n` +
      `┌──────────────────┐\n` +
      `│  ${reels[0]}  │  ${reels[1]}  │  ${reels[2]}  │\n` +
      `└──────────────────┘\n\n` +
      `${multiplier > 0
        ? `🏆 *${label}*\n💰 Won *${Math.floor(amount*multiplier).toLocaleString()} coins* (+${Math.floor(amount*multiplier-amount).toLocaleString()})`
        : `❌ *${label}*\n💸 Lost *${amount.toLocaleString()} coins*`}\n\n` +
      `💵 Balance: *${((u.wallet||0)+net).toLocaleString()} coins*`

    const reelStr = reels.join(' ')
    const vPrompt = multiplier > 0
      ? `slot machine reels spinning fast stop on winning ${reelStr} casino neon glow celebration coins flying animation`
      : `vintage slot machine reels spinning and stopping showing ${reelStr} dark casino animation no win`
    const iPrompt = `realistic casino slot machine close up reels showing ${reelStr} neon casino lights chrome frame ultra HD`

    await sendGamble(sock, jid, msg, vPrompt, iPrompt, caption)
  },
  async sl(ctx) { return module.exports.slots(ctx) },

  // ────────────────────────────────────────────────────────────────────────────
  // .dice <amount> <guess 1-6>
  // ────────────────────────────────────────────────────────────────────────────
  async dice({ reply, sock, jid, msg, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    const guess  = parseInt(args[1])
    if (!amount || !guess || guess < 1 || guess > 6)
      return reply('⚠️ Usage: .dice <amount> <guess 1-6>')
    if (amount > (u.wallet||0)) return reply('❌ Not enough coins!')

    await reply('🎲 *Rolling the dice...*')

    const win  = playerWins(1/6)
    const roll = win ? guess : (() => { let r; do { r = Math.floor(Math.random()*6)+1 } while (r===guess); return r })()
    const net  = (roll === guess) ? amount * 5 - amount : -amount
    await db.updateUser(sender, { wallet: (u.wallet||0) + net })
    await db.logTransaction(sender, roll===guess ? 'dice_win' : 'dice_loss', net, amount).catch(() => {})

    const caption =
      `🎲 *Dice Roll*\n\nYour Guess: *${guess}* | Rolled: *${roll}*\n\n` +
      `${roll===guess ? `🏆 *Correct! +${(amount*5).toLocaleString()} coins (×5)*` : `❌ *Wrong! -${amount.toLocaleString()} coins*`}\n` +
      `💵 *${((u.wallet||0)+net).toLocaleString()} coins*`

    const vPrompt = `casino dice rolling on green felt table spinning tumbling landing on number ${roll} dramatic slow motion animation`
    const iPrompt = `two white casino dice on green felt showing number ${roll} dramatic lighting macro photography`
    await sendGamble(sock, jid, msg, vPrompt, iPrompt, caption)
  },

  // ────────────────────────────────────────────────────────────────────────────
  // .rps <rock/paper/scissors> <amount>
  // ────────────────────────────────────────────────────────────────────────────
  async rps({ reply, sock, jid, msg, sender, user, args }) {
    const u = user || await db.getOrCreateUser(sender)
    const choice = isNaN(parseInt(args[0])) ? args[0]?.toLowerCase() : null
    const amount = parseInt(args[1]) || parseInt(args[0])
    if (!choice || !['rock','paper','scissors','r','p','s'].includes(choice) || !amount || amount <= 0)
      return reply('⚠️ Usage: .rps <rock/paper/scissors> <amount>')
    if (amount > (u.wallet||0)) return reply(`❌ Not enough!`)

    await reply('✊ *Shooting...*')

    const map    = { r:'rock', p:'paper', s:'scissors' }
    const emojis = { rock:'🪨', paper:'📄', scissors:'✂️' }
    const player = map[choice] || choice
    const win    = playerWins(0.45)
    const draw   = !win && Math.random() < 0.1
    const bot    = draw ? player
      : win  ? { rock:'scissors', paper:'rock',     scissors:'paper' }[player]
             : { rock:'paper',    paper:'scissors',  scissors:'rock'  }[player]
    const result = player === bot ? 'draw' : (win ? 'win' : 'lose')
    const net    = result === 'win' ? amount : result === 'draw' ? 0 : -amount
    if (result !== 'draw') await db.updateUser(sender, { wallet: (u.wallet||0) + net })
    await db.logTransaction(sender, `rps_${result}`, net, amount).catch(() => {})

    const caption =
      `🪨📄✂️ *Rock Paper Scissors*\n\nYou: ${emojis[player]} | Bot: ${emojis[bot]}\n\n` +
      `${result==='win' ? `🏆 *WIN! +${amount.toLocaleString()} coins*` : result==='draw' ? `🤝 *Draw — no change*` : `❌ *Lose! -${amount.toLocaleString()} coins*`}\n` +
      `💵 *${((u.wallet||0)+net).toLocaleString()} coins*`

    const vPrompt = `rock paper scissors hand game dramatic reveal animation ${player} vs ${bot} neon glow style`
    const iPrompt = `rock paper scissors hands ${player} vs ${bot} neon glow dramatic poster art`
    await sendGamble(sock, jid, msg, vPrompt, iPrompt, caption)
  },

  // ────────────────────────────────────────────────────────────────────────────
  // .blackjack / .bj <amount>  — Interactive with card images + quote to play
  // ────────────────────────────────────────────────────────────────────────────
  async blackjack({ sock, msg, jid, sender, user, pushName, args }) {
    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg })
    const u = user || await db.getOrCreateUser(sender)
    const amount = parseInt(args[0])
    if (!amount || amount <= 0)
      return reply('⚠️ Usage: .blackjack <amount>\n\nYou\'ll be asked to *hit*, *stand* or *double* — reply by *quoting* the bot\'s deal message.')
    if (amount > (u.wallet||0)) return reply(`❌ Not enough coins! You have *${(u.wallet||0).toLocaleString()} coins*`)

    await db.updateUser(sender, { wallet: (u.wallet||0) - amount })

    const deck   = makeDeck()
    const player = [deck.pop(), deck.pop()]
    const dealer = [deck.pop(), deck.pop()]
    const pTotal = handTotal(player)

    // Instant blackjack (21)
    if (pTotal === 21) {
      const win = Math.floor(amount * 2.5)
      await db.updateUser(sender, { wallet: (u.wallet||0) - amount + win })
      await db.logTransaction(sender, 'bj_blackjack', win - amount, amount).catch(() => {})
      const caption =
        `🃏 *BLACKJACK!* 🎉\n\n` +
        `*Your Hand:* ${formatHand(player)} = *21*\n` +
        `*Dealer:* ${formatHand(dealer)} = *${handTotal(dealer)}*\n\n` +
        `🌟 *BLACKJACK PAYS 2.5×!*\n💰 *+${(win-amount).toLocaleString()} coins*\n` +
        `💵 Balance: *${((u.wallet||0)-amount+win).toLocaleString()} coins*`
      try {
        const buf = await genImage(bjImagePrompt(player, dealer, false))
        return sock.sendMessage(jid, { image: buf, caption }, { quoted: msg })
      } catch { return reply(caption) }
    }

    const caption =
      `🂠 *BLACKJACK*\n\n` +
      `*Dealer Showing:* ${cardDisplay(dealer[0])}  (${cardValue(dealer[0])})\n` +
      `*Your Hand:* ${formatHand(player)} = *${pTotal}*\n` +
      `*Bet:* ${amount.toLocaleString()} coins\n\n` +
      `> 🎮 *Quote this message* with: *hit*, *stand* or *double*`

    let sentMsg
    try {
      const buf = await genImage(bjImagePrompt(player, dealer, true))
      sentMsg = await sock.sendMessage(jid, { image: buf, caption }, { quoted: msg })
    } catch {
      sentMsg = await sock.sendMessage(jid, { text: caption }, { quoted: msg })
    }

    const stanzaId = sentMsg?.key?.id
    if (stanzaId) {
      pendingBJ.set(`${jid}:${stanzaId}`, { deck, player, dealer, amount, bet: amount, sender, jid })
      setTimeout(() => {
        const k = `${jid}:${stanzaId}`
        if (pendingBJ.has(k)) {
          pendingBJ.delete(k)
          db.getOrCreateUser(sender).then(u2 => db.updateUser(sender, { wallet: (u2.wallet||0) + amount })).catch(() => {})
          sock.sendMessage(jid, { text: `⏰ @${sender}'s blackjack game expired — bet refunded.`, mentions: [`${sender}@s.whatsapp.net`] }).catch(() => {})
        }
      }, 5 * 60 * 1000)
    }
  },
  async bj(ctx)     { return module.exports.blackjack(ctx) },
  async casino(ctx) { return module.exports.blackjack(ctx) },

  // Handle quoted blackjack move (called from index.js)
  async handleBlackjackMove({ sock, msg, jid, sender, user, textRaw }) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo
    if (!ctx?.stanzaId) return false
    const game = pendingBJ.get(`${jid}:${ctx.stanzaId}`)
    if (!game || game.sender !== sender) return false

    const move = textRaw.trim().toLowerCase()
    if (!move.startsWith('hit') && !move.startsWith('stand') && !move.startsWith('double')) return false

    const reply = (text) => sock.sendMessage(jid, { text }, { quoted: msg })
    const { deck, player, dealer, amount } = game
    let bet = game.bet

    if (move.startsWith('double')) {
      const fresh = await db.getOrCreateUser(sender)
      if ((fresh.wallet||0) < bet) { await reply('❌ Not enough coins to double down!'); return true }
      await db.updateUser(sender, { wallet: (fresh.wallet||0) - bet })
      bet *= 2; game.bet = bet
      player.push(deck.pop())
    } else if (move.startsWith('hit')) {
      player.push(deck.pop())
    }

    const pTotal = handTotal(player)

    if (pTotal > 21) {
      pendingBJ.delete(`${jid}:${ctx.stanzaId}`)
      await db.logTransaction(sender, 'bj_bust', -bet, amount).catch(() => {})
      const u2  = await db.getOrCreateUser(sender)
      const caption =
        `🃏 *BLACKJACK — BUST!*\n\n*Your Hand:* ${formatHand(player)} = *${pTotal}* 💥\n` +
        `*Dealer:* ${formatHand(dealer)} = *${handTotal(dealer)}*\n\n` +
        `❌ *BUST! Lost ${bet.toLocaleString()} coins*\n💵 Balance: *${(u2.wallet||0).toLocaleString()} coins*`
      try {
        const buf = await genImage(bjImagePrompt(player, dealer, false))
        await sock.sendMessage
