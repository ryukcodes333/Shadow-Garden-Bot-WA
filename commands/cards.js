const db = require('../database')
const { sendWithImage } = require('../imageHelper')

// ─── Tier configuration ─────────────────────────────────────────────────────
const TIERS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'TS', 'TZ']

const TIER_LABELS = {
  T1: 'Tier 1 - Common',
  T2: 'Tier 2 - Uncommon',
  T3: 'Tier 3 - Rare',
  T4: 'Tier 4 - Epic',
  T5: 'Tier 5 - Legendary',
  T6: 'Tier 6 - Mythic',
  TS: 'Shadow - Shadow Exclusive',
  TZ: 'Zenith - Absolute Pinnacle',
}

const TIER_EMOJIS = {
  T1: '⚪', T2: '🟢', T3: '🔵', T4: '🟣',
  T5: '🟡', T6: '🔴', TS: '🖤', TZ: '💠',
}

// Updated prices (higher)
const TIER_PRICES = {
  T1: 35000,
  T2: 75000,
  T3: 150000,
  T4: 300000,
  T5: 600000,
  T6: 1200000,
  TS: 2500000,
  TZ: 5000000,
}

const TIER_SPAWN_WEIGHTS = { T1: 40, T2: 25, T3: 15, T4: 10, T5: 5, T6: 3, TS: 1.5, TZ: 0.5 }

// ─── Drop rates text ────────────────────────────────────────────────────────
function buildDropRateText() {
  const total = Object.values(TIER_SPAWN_WEIGHTS).reduce((a, b) => a + b, 0)
  return TIERS.map(t => {
    const pct = ((TIER_SPAWN_WEIGHTS[t] / total) * 100).toFixed(1)
    return `${TIER_EMOJIS[t]} *${t}*: ${pct}%`
  }).join('\n')
}

// ─── Weighted random tier pick ───────────────────────────────────────────────
function pickTier() {
  const total  = Object.values(TIER_SPAWN_WEIGHTS).reduce((a, b) => a + b, 0)
  let   rand   = Math.random() * total
  for (const [tier, weight] of Object.entries(TIER_SPAWN_WEIGHTS)) {
    rand -= weight
    if (rand <= 0) return tier
  }
  return 'T1'
}

// ─── DB helpers ──────────────────────────────────────────────────────────────
async function getRandomCardOfTier(tier) {
  const { data } = await db.supabase
    .from('cards')
    .select('*')
    .eq('tier', tier)
    .limit(200)
  if (!data || data.length === 0) return null
  return data[Math.floor(Math.random() * data.length)]
}

async function getRandomCard() {
  const tier = pickTier()
  return getRandomCardOfTier(tier)
}

// ─── Spawn cooldown (in-memory) ──────────────────────────────────────────────
const spawnCooldowns = {}
const SPAWN_CD_MS   = 15 * 60 * 1000

// Active spawned cards per group: jid -> { card, spawnedAt, msgId }
const pendingSpawns = {}
const CARD_WINDOW   = 5 * 60 * 1000

// ─── Trade store (in-memory, resets on restart) ──────────────────────────────
const pendingTrades = {}

// ─── Shop listings (in-memory cache; real source is DB) ─────────────────────
const shopListings = {}

module.exports = {
  // ─── .spawn (owner/staff triggers a card spawn) ──────────────────────────
  async spawn({ sock, jid, msg, reply, sender, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')

    const card = await getRandomCard()
    if (!card) return reply('❌ No cards found in the database. Add cards first with `.addcard`.')

    pendingSpawns[jid] = { card, spawnedAt: Date.now() }
    setTimeout(() => { if (pendingSpawns[jid]?.card?.id === card.id) delete pendingSpawns[jid] }, CARD_WINDOW)

    const caption =
      `🃏 *A CARD HAS APPEARED!*\n\n` +
      `${TIER_EMOJIS[card.tier]} *${card.name}*\n` +
      `📂 *Tier:* ${card.tier} - ${TIER_LABELS[card.tier]}\n` +
      (card.series ? `📚 *Series:* ${card.series}\n` : '') +
      `\n💡 Type *.grab* to claim this card!\n` +
      `_First to grab wins!_ 🖤`

    await sendWithImage(sock, jid, msg, card.image_url, caption, reply)
  },

  // ─── .grab (claim the pending card) ─────────────────────────────────────
  async grab({ sock, jid, msg, reply, sender, pushName }) {
    const spawn = pendingSpawns[jid]
    if (!spawn) return reply('❌ No card available right now. Wait for a card to spawn!')

    if (Date.now() - spawn.spawnedAt > CARD_WINDOW) {
      delete pendingSpawns[jid]
      return reply('⏱️ *Too slow!* The card has expired. Wait for the next one!')
    }

    const { card } = spawn
    delete pendingSpawns[jid]

    const u = await db.getOrCreateUser(sender, pushName)
    await db.addUserCard(sender, card.id, 1)

    const caption =
      `✅ *CARD CLAIMED!*\n\n` +
      `${TIER_EMOJIS[card.tier]} *${card.name}*\n` +
      `📂 *Tier:* ${card.tier} - ${TIER_LABELS[card.tier]}\n` +
      (card.series ? `📚 *Series:* ${card.series}\n` : '') +
      `👤 *Claimed by:* ${u.name || pushName || sender}\n\n` +
      `_The card is now yours!_ 🖤`

    await sendWithImage(sock, jid, msg, card.image_url, caption, reply)
  },

  // ─── .deck (view your card collection) ──────────────────────────────────
  async deck({ reply, sender, user, pushName, args }) {
    const page  = Math.max(1, parseInt(args[0]) || 1)
    const limit = 10
    const cards = await db.getUserCards(sender)

    if (!cards || cards.length === 0) {
      return reply(
        `🃏 *YOUR DECK*\n\n` +
        `📭 No cards yet!\n\n` +
        `Use *.grab* when a card spawns, or buy from the *.shop*\n\n` +
        `_Start building your collection._ 🖤`
      )
    }

    const totalPages = Math.ceil(cards.length / limit)
    const page_      = Math.min(page, totalPages)
    const start      = (page_ - 1) * limit
    const pageCards  = cards.slice(start, start + limit)

    const lines = pageCards.map((uc, i) => {
      const card = uc.cards || uc
      const qty  = uc.quantity || 1
      return `${start + i + 1}. ${TIER_EMOJIS[card.tier] || '🃏'} *${card.name}* [${card.tier}]${qty > 1 ? ` x${qty}` : ''}`
    }).join('\n')

    const u = user || await db.getOrCreateUser(sender)

    reply(
      `🃏 *DECK - ${u.name || pushName || sender}*\n\n` +
      `${lines}\n\n` +
      `📊 Page ${page_}/${totalPages} | Total: ${cards.length} cards\n\n` +
      `Use *.view <name>* to see a card\n` +
      `Use *.deck <page>* to see more\n\n` +
      `_Your shadow collection grows._ 🖤`
    )
  },

  // ─── .view <card name> ───────────────────────────────────────────────────
  async view({ sock, jid, msg, reply, sender, args }) {
    if (!args.length) return reply('⚠️ Usage: .view <card name>')

    const name = args.join(' ').trim()
    const cards = await db.getUserCards(sender)

    const match = (cards || []).find(uc => {
      const card = uc.cards || uc
      return card.name.toLowerCase().includes(name.toLowerCase())
    })

    if (!match) {
      return reply(`❌ *${name}* not found in your deck.\n\nUse *.deck* to see your cards.`)
    }

    const card = match.cards || match
    const qty  = match.quantity || 1

    const caption =
      `🃏 *${card.name}*\n\n` +
      `${TIER_EMOJIS[card.tier]} *Tier:* ${card.tier} - ${TIER_LABELS[card.tier]}\n` +
      (card.series ? `📚 *Series:* ${card.series}\n` : '') +
      `🔢 *Copies:* ${qty}\n` +
      `💰 *Market Value:* $${(TIER_PRICES[card.tier] || 0).toLocaleString()}\n\n` +
      `_${card.lore || 'A card from the shadow garden.'}_ 🖤`

    await sendWithImage(sock, jid, msg, card.image_url, caption, reply)
  },

  // ─── .series <name> — show all cards from a series ───────────────────────
  async series({ sock, jid, msg, reply, args }) {
    if (!args.length) {
      // List all series
      const { data: allCards } = await db.supabase
        .from('cards')
        .select('series')
        .not('series', 'is', null)
        .order('series')
      if (!allCards || allCards.length === 0) return reply('❌ No series found in the database.')
      const unique = [...new Set(allCards.map(c => c.series).filter(Boolean))]
      return reply(
        `📚 *CARD SERIES*\n\n` +
        unique.map((s, i) => `${i + 1}. ${s}`).join('\n') +
        `\n\n_Use .series <name> to see cards in a series._ 🖤`
      )
    }

    const seriesName = args.join(' ').trim()
    const { data: cards } = await db.supabase
      .from('cards')
      .select('*')
      .ilike('series', `%${seriesName}%`)
      .order('tier')

    if (!cards || cards.length === 0) {
      return reply(`❌ No series matching *${seriesName}* found.\n\nUse *.series* to list all series.`)
    }

    // Group by tier
    const byTier = {}
    for (const card of cards) {
      if (!byTier[card.tier]) byTier[card.tier] = []
      byTier[card.tier].push(card)
    }

    const lines = TIERS.filter(t => byTier[t]).map(t =>
      `${TIER_EMOJIS[t]} *${t}*\n` + byTier[t].map(c => `  - ${c.name}`).join('\n')
    ).join('\n\n')

    const seriesDisplayName = cards[0].series || seriesName

    await reply(
      `📚 *SERIES: ${seriesDisplayName}*\n\n` +
      `Total: *${cards.length}* cards\n\n` +
      `${lines}\n\n` +
      `_Collect them all!_ 🖤`
    )
  },

  // ─── .cardinfo <name> — look up any card in the database ────────────────
  async cardinfo({ sock, jid, msg, reply, args }) {
    if (!args.length) return reply('⚠️ Usage: .cardinfo <card name>')

    const name = args.join(' ').trim()
    const { data: results } = await db.supabase
      .from('cards')
      .select('*')
      .ilike('name', `%${name}%`)
      .limit(5)

    if (!results || results.length === 0) {
      return reply(`❌ *${name}* not found in the card database.`)
    }

    const card = results[0]

    const caption =
      `🃏 *CARD INFO - ${card.name}*\n\n` +
      `${TIER_EMOJIS[card.tier]} *Tier:* ${card.tier} - ${TIER_LABELS[card.tier]}\n` +
      (card.series ? `📚 *Series:* ${card.series}\n` : '') +
      `💰 *Buy Price:* $${(TIER_PRICES[card.tier] || 0).toLocaleString()}\n\n` +
      `_${card.lore || 'A card from the shadow garden.'}_ 🖤` +
      (results.length > 1 ? `\n\n_Also found: ${results.slice(1).map(c => c.name).join(', ')}_` : '')

    await sendWithImage(sock, jid, msg, card.image_url, caption, reply)
  },
  async ci(ctx) { return module.exports.cardinfo(ctx) },

  // ─── .sell <card name> — sell a card ────────────────────────────────────
  async sell({ reply, sender, user, args }) {
    if (!args.length) return reply('⚠️ Usage: .sell <card name>')

    const name  = args.join(' ').trim()
    const cards = await db.getUserCards(sender)
    const match = (cards || []).find(uc => {
      const card = uc.cards || uc
      return card.name.toLowerCase().includes(name.toLowerCase())
    })

    if (!match) return reply(`❌ *${name}* not found in your deck.`)

    const card = match.cards || match
    const price = Math.floor((TIER_PRICES[card.tier] || 5000) * 0.5)

    await db.removeUserCard(sender, card.id, 1)
    const u = user || await db.getOrCreateUser(sender)
    await db.updateUser(sender, { wallet: (u.wallet || 0) + price })

    await reply(
      `💸 *CARD SOLD!*\n\n` +
      `${TIER_EMOJIS[card.tier]} *${card.name}* [${card.tier}]\n` +
      `💰 *Sold for:* $${price.toLocaleString()}\n` +
      `_(50% of market value)_\n\n` +
      `💵 *New Balance:* $${((u.wallet || 0) + price).toLocaleString()}\n\n` +
      `_The shadow market thanks you._ 🖤`
    )
  },

  // ─── .buy <tier> — buy a random card of a tier ──────────────────────────
  async buy({ sock, jid, msg, reply, sender, user, args }) {
    if (!args.length) {
      const priceList = TIERS.map(t =>
        `${TIER_EMOJIS[t]} *${t}*: $${TIER_PRICES[t].toLocaleString()}`
      ).join('\n')
      return reply(
        `🛒 *CARD SHOP*\n\n` +
        `${priceList}\n\n` +
        `Usage: *.buy <tier>*\nExample: *.buy T3*\n\n` +
        `_All purchases are random cards of that tier._ 🖤`
      )
    }

    const tier = args[0].toUpperCase()
    if (!TIERS.includes(tier)) {
      return reply(`❌ Invalid tier. Choose from: ${TIERS.join(', ')}`)
    }

    const price = TIER_PRICES[tier]
    const u     = user || await db.getOrCreateUser(sender)

    if ((u.wallet || 0) < price) {
      return reply(
        `❌ *INSUFFICIENT FUNDS*\n\n` +
        `💰 ${tier} costs: $${price.toLocaleString()}\n` +
        `💵 Your balance: $${(u.wallet || 0).toLocaleString()}\n\n` +
        `_You need $${(price - (u.wallet || 0)).toLocaleString()} more._ 🖤`
      )
    }

    const card = await getRandomCardOfTier(tier)
    if (!card) {
      return reply(`❌ No *${tier}* cards are available. Check back later.`)
    }

    await db.updateUser(sender, { wallet: (u.wallet || 0) - price })
    await db.addUserCard(sender, card.id, 1)

    const caption =
      `🛒 *CARD PURCHASED!*\n\n` +
      `${TIER_EMOJIS[card.tier]} *${card.name}*\n` +
      `📂 *Tier:* ${card.tier} - ${TIER_LABELS[card.tier]}\n` +
      (card.series ? `📚 *Series:* ${card.series}\n` : '') +
      `💰 *Cost:* $${price.toLocaleString()}\n` +
      `💵 *Remaining:* $${((u.wallet || 0) - price).toLocaleString()}\n\n` +
      `_The card is now yours._ 🖤`

    await sendWithImage(sock, jid, msg, card.image_url, caption, reply)
  },

  // ─── .trade @user <card name> — initiate a trade ────────────────────────
  async trade({ sock, msg, jid, reply, sender, user, pushName, args }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: .trade @user <card name>')

    const targetJid   = mentioned[0]
    const targetPhone = targetJid.split('@')[0].split(':')[0]
    if (targetPhone === sender) return reply('❌ You cannot trade with yourself.')

    const cardNameArg = args.filter(a => !a.startsWith('@') && !a.includes('@')).join(' ').trim()
    if (!cardNameArg) return reply('⚠️ Specify a card name: .trade @user <card name>')

    const myCards = await db.getUserCards(sender)
    const match   = (myCards || []).find(uc => {
      const card = uc.cards || uc
      return card.name.toLowerCase().includes(cardNameArg.toLowerCase())
    })

    if (!match) return reply(`❌ *${cardNameArg}* not in your deck.`)

    const card      = match.cards || match
    const tradeKey  = `${sender}_${targetPhone}`
    pendingTrades[tradeKey] = { offererPhone: sender, targetPhone, card, expiresAt: Date.now() + 5 * 60000 }

    await sock.sendMessage(jid, {
      text:
        `🤝 *TRADE OFFER*\n\n` +
        `@${sender} is offering:\n` +
        `${TIER_EMOJIS[card.tier]} *${card.name}* [${card.tier}]\n\n` +
        `@${targetPhone}, type *.accept* to accept or *.decline* to decline.\n` +
        `_(Expires in 5 minutes)_ 🖤`,
      mentions: [msg.key.participant || msg.key.remoteJid, targetJid],
    }, { quoted: msg })
  },

  // ─── .accept (accept pending trade) ─────────────────────────────────────
  async accept({ sock, jid, msg, reply, sender }) {
    const tradeKey = Object.keys(pendingTrades).find(k => k.endsWith(`_${sender}`))
    if (!tradeKey) return reply('❌ No pending trade offer for you.')

    const trade = pendingTrades[tradeKey]
    if (Date.now() > trade.expiresAt) {
      delete pendingTrades[tradeKey]
      return reply('⏱️ Trade offer expired.')
    }

    const { offererPhone, card } = trade
    delete pendingTrades[tradeKey]

    await db.removeUserCard(offererPhone, card.id, 1)
    await db.addUserCard(sender, card.id, 1)

    await sock.sendMessage(jid, {
      text:
        `✅ *TRADE COMPLETE!*\n\n` +
        `${TIER_EMOJIS[card.tier]} *${card.name}* [${card.tier}]\n` +
        `📦 Transferred from @${offererPhone} to @${sender}\n\n` +
        `_The shadow exchange is complete._ 🖤`,
      mentions: [`${offererPhone}@s.whatsapp.net`, `${sender}@s.whatsapp.net`],
    }, { quoted: msg })
  },

  // ─── .decline (decline pending trade) ───────────────────────────────────
  async decline({ reply, sender }) {
    const tradeKey = Object.keys(pendingTrades).find(k => k.endsWith(`_${sender}`))
    if (!tradeKey) return reply('❌ No pending trade offer for you.')
    const trade = pendingTrades[tradeKey]
    delete pendingTrades[tradeKey]
    await reply(`❌ Trade declined.\n\n@${trade.offererPhone}'s offer was rejected.`)
  },

  // ─── .cardshop — list cards listed for player-to-player sale ────────────
  async cardshop({ sock, jid, msg, reply, args }) {
    const { data: listings } = await db.supabase
      .from('shop_listings')
      .select('*, user_cards(*, cards(*))')
      .order('listed_at', { ascending: false })
      .limit(20)

    if (!listings || listings.length === 0) {
      return reply('🛒 *CARD MARKET*\n\n_No cards listed for sale._\n\nUse *.listsell <card> <price>* to list yours!')
    }

    const lines = listings.map((l, i) => {
      const card = l.user_cards?.cards
      if (!card) return null
      return `${i + 1}. ${TIER_EMOJIS[card.tier]} *${card.name}* [${card.tier}] - $${l.price.toLocaleString()}`
    }).filter(Boolean).join('\n')

    await reply(`🛒 *CARD MARKET* (${listings.length} listings)\n\n${lines}\n\n_Use .buylisting <#> to buy._ 🖤`)
  },

  // ─── .listsell <card name> <price> — list a card for sale ───────────────
  async listsell({ reply, sender, args }) {
    const price      = parseInt(args[args.length - 1])
    const cardNameArg = args.slice(0, -1).join(' ').trim()

    if (!cardNameArg || !price || price <= 0) {
      return reply('⚠️ Usage: .listsell <card name> <price>\nExample: .listsell Luffy 50000')
    }

    const cards  = await db.getUserCards(sender)
    const match  = (cards || []).find(uc => {
      const card = uc.cards || uc
      return card.name.toLowerCase().includes(cardNameArg.toLowerCase())
    })

    if (!match) return reply(`❌ *${cardNameArg}* not in your deck.`)

    const card = match.cards || match
    const minPrice = Math.floor(TIER_PRICES[card.tier] * 0.1)
    if (price < minPrice) return reply(`❌ Minimum price for ${card.tier} is $${minPrice.toLocaleString()}`)

    await db.supabase.from('shop_listings').insert({ phone: sender, user_card_id: match.id, price })
    await reply(
      `✅ *LISTED FOR SALE*\n\n` +
      `${TIER_EMOJIS[card.tier]} *${card.name}* [${card.tier}]\n` +
      `💰 Price: $${price.toLocaleString()}\n\n` +
      `_Visible in .cardshop._ 🖤`
    )
  },

  // ─── .buylisting <number> — buy from card market ────────────────────────
  async buylisting({ sock, jid, msg, reply, sender, user, args }) {
    const idx = parseInt(args[0]) - 1
    if (isNaN(idx) || idx < 0) return reply('⚠️ Usage: .buylisting <listing number>')

    const { data: listings } = await db.supabase
      .from('shop_listings')
      .select('*, user_cards(*, cards(*))')
      .order('listed_at', { ascending: false })
      .limit(20)

    if (!listings || idx >= listings.length) return reply('❌ Invalid listing number. Use .cardshop to see listings.')

    const listing = listings[idx]
    if (listing.phone === sender) return reply('❌ You cannot buy your own listing.')

    const card = listing.user_cards?.cards
    if (!card) return reply('❌ That listing is no longer valid.')

    const u = user || await db.getOrCreateUser(sender)
    if ((u.wallet || 0) < listing.price) {
      return reply(`❌ Not enough coins! Need $${listing.price.toLocaleString()}, have $${(u.wallet || 0).toLocaleString()}`)
    }

    // Transfer
    const sellerPhone = listing.phone
    const seller      = await db.getOrCreateUser(sellerPhone)

    await db.updateUser(sender, { wallet: (u.wallet || 0) - listing.price })
    await db.updateUser(sellerPhone, { wallet: (seller.wallet || 0) + listing.price })
    await db.removeUserCard(sellerPhone, card.id, 1)
    await db.addUserCard(sender, card.id, 1)
    await db.supabase.from('shop_listings').delete().eq('id', listing.id)

    const caption =
      `✅ *CARD PURCHASED FROM MARKET!*\n\n` +
      `${TIER_EMOJIS[card.tier]} *${card.name}* [${card.tier}]\n` +
      (card.series ? `📚 *Series:* ${card.series}\n` : '') +
      `💰 *Paid:* $${listing.price.toLocaleString()}\n` +
      `💵 *Remaining:* $${((u.wallet || 0) - listing.price).toLocaleString()}\n\n` +
      `_The card is now yours._ 🖤`

    await sendWithImage(sock, jid, msg, card.image_url, caption, reply)
  },

  // ─── .addcard (staff) — add a new card to the database ──────────────────
  async addcard({ sock, msg, jid, reply, sender, isOwner, isMod, isGuardian, args }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')

    const tier       = args[0]?.toUpperCase()
    const nameAndRest = args.slice(1).join(' ')
    const seriesMatch = nameAndRest.match(/--series\s+(.+?)(?:\s+--|$)/i)
    const series     = seriesMatch ? seriesMatch[1].trim() : null
    const name       = nameAndRest.replace(/--series\s+.+/i, '').trim()

    if (!tier || !TIERS.includes(tier) || !name) {
      return reply(
        `⚠️ Usage: .addcard <tier> <name> [--series <series name>]\n\n` +
        `Example: .addcard T3 "Luffy" --series "One Piece"\n\n` +
        `Tiers: ${TIERS.join(', ')}`
      )
    }

    const hasImage = !!(
      msg.message?.imageMessage ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
    )

    if (!hasImage) {
      return reply(
        `📸 *SEND WITH IMAGE*\n\n` +
        `Attach or quote an image along with this command.\n\n` +
        `Example: Send an image + caption:\n` +
        `*.addcard ${tier} ${name}${series ? ` --series ${series}` : ''}*`
      )
    }

    await reply('⏳ Uploading card...')

    const { downloadMediaMessage } = require('@whiskeysockets/baileys')
    const { createClient }         = require('@supabase/supabase-js')
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    )

    let buffer
    try {
      const imgMsg = msg.message?.imageMessage
        ? msg
        : {
            message: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage,
            key: {
              remoteJid: jid,
              id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId,
              participant: msg.message?.extendedTextMessage?.contextInfo?.participant,
            },
          }
      buffer = await downloadMediaMessage(imgMsg, 'buffer', {}, {
        logger: console, reuploadRequest: sock.updateMediaMessage,
      })
    } catch (err) {
      return reply(`❌ Image download failed: ${err.message}`)
    }

    const safeName   = name.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const storagePath = `cards/${tier.toLowerCase()}/${safeName}_${Date.now()}.jpg`

    const { error: uploadErr } = await supabase.storage
      .from('card-images')
      .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: false })

    if (uploadErr) return reply(`❌ Upload failed: ${uploadErr.message}`)

    const { data: { publicUrl } } = supabase.storage.from('card-images').getPublicUrl(storagePath)

    const { data: card, error: insertErr } = await supabase
      .from('cards')
      .insert({ name, tier, series: series || null, image_url: publicUrl })
      .select()
      .single()

    if (insertErr) return reply(`❌ DB insert failed: ${insertErr.message}`)

    await sock.sendMessage(jid, {
      image: buffer,
      caption:
        `✅ *CARD ADDED!*\n\n` +
        `${TIER_EMOJIS[tier]} *${name}*\n` +
        `📂 *Tier:* ${tier} - ${TIER_LABELS[tier]}\n` +
        (series ? `📚 *Series:* ${series}\n` : '') +
        `🆔 *Card ID:* ${card.id}\n\n` +
        `_Now available in spawns and shop._ 🖤`,
    }, { quoted: msg })
  },

  // ─── .sdbg — set deck background image ──────────────────────────────────
  async sdbg({ sock, msg, jid, reply, sender }) {
    const { downloadMediaMessage } = require('@whiskeysockets/baileys')
    const { createClient }         = require('@supabase/supabase-js')
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

    const hasImage = !!(
      msg.message?.imageMessage ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
    )

    if (!hasImage) {
      return reply(
        `🎨 *SET DECK BACKGROUND*\n\n` +
        `Send or quote an image with *.sdbg*\n\n` +
        `This sets the background of your card deck display.\n\n` +
        `_The image will appear behind your cards._ 🖤`
      )
    }

    await reply('⏳ Uploading deck background...')

    let buffer
    try {
      const imgMsg = msg.message?.imageMessage
        ? msg
        : {
            message: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage,
            key: {
              remoteJid: jid,
              id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId,
              participant: msg.message?.extendedTextMessage?.contextInfo?.participant,
            },
          }
      buffer = await downloadMediaMessage(imgMsg, 'buffer', {}, {
        logger: console, reuploadRequest: sock.updateMediaMessage,
      })
    } catch (err) {
      return reply(`❌ Image download failed: ${err.message}`)
    }

    const storagePath = `decks/bg/${sender}.jpg`
    const { error: uploadErr } = await supabase.storage
      .from('card-images')
      .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true })
    if (uploadErr) return reply(`❌ Upload failed: ${uploadErr.message}`)

    const { data: { publicUrl } } = supabase.storage.from('card-images').getPublicUrl(storagePath)

    await supabase.from('deck_settings').upsert({ phone: sender, bg_url: publicUrl, updated_at: new Date().toISOString() })

    await sock.sendMessage(jid, {
      image: buffer,
      caption:
        `✅ *DECK BACKGROUND SET!*\n\n` +
        `Your deck background has been saved.\n\n` +
        `Type *.deck* to see your cards.\n\n` +
        `_Your cards now have a new stage._ 🖤`,
    }, { quoted: msg })
  },

  // ─── .givecard @user <card name> (owner/staff) ──────────────────────────
  async givecard({ sock, msg, jid, reply, sender, isOwner, isMod, isGuardian, args }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
    if (!mentioned.length) return reply('⚠️ Usage: .givecard @user <card name or tier>')

    const targetJid   = mentioned[0]
    const targetPhone = targetJid.split('@')[0].split(':')[0]
    const nameArg     = args.filter(a => !a.includes('@')).join(' ').trim()

    if (!nameArg) return reply('⚠️ Specify a card name or tier.')

    let card
    if (TIERS.includes(nameArg.toUpperCase())) {
      card = await getRandomCardOfTier(nameArg.toUpperCase())
    } else {
      const { data } = await db.supabase.from('cards').select('*').ilike('name', `%${nameArg}%`).limit(1).single()
      card = data
    }

    if (!card) return reply(`❌ Card *${nameArg}* not found.`)

    await db.addUserCard(targetPhone, card.id, 1)

    const caption =
      `🎁 *CARD GIVEN!*\n\n` +
      `${TIER_EMOJIS[card.tier]} *${card.name}* [${card.tier}]\n` +
      (card.series ? `📚 *Series:* ${card.series}\n` : '') +
      `Given to @${targetPhone} by staff.\n\n` +
      `_Shadow garden gifts._ 🖤`

    await sock.sendMessage(jid, {
      text: `🎁 @${targetPhone} received: *${card.name}* [${card.tier}]`,
      mentions: [targetJid],
    }, { quoted: msg })
  },

  // ─── .cardlist (staff) — list all cards in database ─────────────────────
  async cardlist({ reply, isOwner, isMod, isGuardian, args }) {
    if (!isOwner && !isMod && !isGuardian) return reply('⚠️ Staff only.')

    const tier = args[0]?.toUpperCase()
    const filter = tier && TIERS.includes(tier) ? { tier } : {}

    const { data: cards } = await db.supabase
      .from('cards')
      .select('id, name, tier, series')
      .match(filter)
      .order('tier')
      .limit(50)

    if (!cards || cards.length === 0) return reply('❌ No cards found.')

    const lines = cards.map(c =>
      `*${c.id}*. ${TIER_EMOJIS[c.tier]} ${c.name} [${c.tier}]${c.series ? ` - ${c.series}` : ''}`
    ).join('\n')

    await reply(`🃏 *CARD LIST* (${cards.length})\n\n${lines}\n\n_Use .cardlist <tier> to filter._ 🖤`)
  },
  async cl(ctx) { return module.exports.cardlist(ctx) },

  // ─── .cardtop — leaderboard by card count ───────────────────────────────
  async cardtop({ reply }) {
    const { data } = await db.supabase
      .from('user_cards')
      .select('phone, quantity')
      .order('quantity', { ascending: false })
      .limit(10)

    if (!data || data.length === 0) return reply('❌ No card data yet.')

    const grouped = {}
    for (const row of data) {
      grouped[row.phone] = (grouped[row.phone] || 0) + (row.quantity || 1)
    }

    const sorted = Object.entries(grouped)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)

    const medals = ['🥇', '🥈', '🥉']
    const lines  = sorted.map(([phone, count], i) =>
      `${medals[i] || `${i + 1}.`} ${phone.slice(-6)} - *${count} cards*`
    ).join('\n')

    await reply(`🃏 *CARD LEADERBOARD*\n\n${lines}\n\n_Collect more to climb._ 🖤`)
  },
  async ct(ctx) { return module.exports.cardtop(ctx) },

  // ─── .droprates — show card drop rates ──────────────────────────────────
  async droprates({ reply }) {
    await reply(
      `📊 *CARD DROP RATES*\n\n` +
      buildDropRateText() + `\n\n` +
      `_The rarer the tier, the stronger the card._ 🖤`
    )
  },
  async dr(ctx) { return module.exports.droprates(ctx) },
}
