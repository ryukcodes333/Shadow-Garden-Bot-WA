const db = require("../database");
const http = require("http");
const https = require("https");
const cardIndex = require("./card.json");

function fetchPollinationsImage(prompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&model=flux`;
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: 18000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", () => resolve(null));
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

const TIER_PRICES = { T1: 17500, T2: 27500, T3: 37500, T4: 50000, T5: 62500, T6: 72500, TS: 90000, TZ: 0 };
const TIER_NAMES  = { T1: "Common", T2: "Uncommon", T3: "Rare", T4: "Epic", T5: "Legendary", T6: "Mythic", TS: "Shadow", TZ: "Void" };
const TIERS       = { T1: "🥉", T2: "🔵", T3: "🟢", T4: "🔴", T5: "🟣", T6: "🟡", TS: "✨", TZ: "🌌" };

const SPAWN_TIERS = ["T1","T1","T1","T1","T2","T2","T2","T3","T3","T4","T4","T5","T6","TS"];
const pendingCards = {};

const LOCAL_TIER_TO_LABEL = { "1": "T1", "2": "T2", "3": "T3", "4": "T4", "5": "T5", "6": "T6", S: "TS" };
const FILTER_TIER_TO_LOCAL = { T1: "1", T2: "2", T3: "3", T4: "4", T5: "5", T6: "6", TS: "S", TZ: "Z" };

function toBold(str) {
  return str.split("").map((c) => {
    const code = c.codePointAt(0);
    if (code >= 65 && code <= 90) return String.fromCodePoint(code + 0x1d400 - 65);
    if (code >= 97 && code <= 122) return String.fromCodePoint(code + 0x1d41a - 97);
    if (code >= 48 && code <= 57) return String.fromCodePoint(code + 0x1d7ce - 48);
    return c;
  }).join("");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

// ─── SHORT CARD ID ─────────────────────────────────────────────────────────────
// Generates a deterministic 6-char alphanumeric ID from a URL/string.
// Same input always → same output, so claims always match.
function toShortId(input) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let h = 2166136261; // FNV-1a 32-bit offset basis
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0; // FNV prime, force unsigned 32-bit
  }
  let result = "";
  let n = h;
  for (let i = 0; i < 6; i++) {
    result += chars[n % chars.length];
    n = Math.floor(n / chars.length);
  }
  return result;
}

function extractCardId(url) {
  const trimmed = String(url || "").trim();
  // Return a short 6-char ID derived from the full URL
  return toShortId(trimmed);
}

function findCardsByName(nameQuery, tierFilter) {
  const normalizedQuery = normalizeText(nameQuery);
  const localTier = tierFilter ? FILTER_TIER_TO_LOCAL[tierFilter] : null;
  if (!normalizedQuery) return [];

  const matches = cardIndex.filter((card) => {
    const title = normalizeText(card.title);
    if (!title.includes(normalizedQuery)) return false;
    if (localTier && String(card.tier) !== localTier) return false;
    return true;
  });

  matches.sort((a, b) => {
    const aTitle = normalizeText(a.title);
    const bTitle = normalizeText(b.title);
    const aExact = aTitle === normalizedQuery ? 0 : 1;
    const bExact = bTitle === normalizedQuery ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    const aStarts = aTitle.startsWith(normalizedQuery) ? 0 : 1;
    const bStarts = bTitle.startsWith(normalizedQuery) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return aTitle.localeCompare(bTitle);
  });

  return matches;
}

function getRandomCardByTier(tier) {
  const localTier = FILTER_TIER_TO_LOCAL[tier];
  const pool = localTier ? cardIndex.filter((c) => String(c.tier) === localTier) : cardIndex;
  if (!pool.length) return null;
  const raw = pool[Math.floor(Math.random() * pool.length)];
  return {
    id: extractCardId(raw.url),
    name: raw.title,
    title: raw.title,
    series: "-",
    tier: LOCAL_TIER_TO_LABEL[String(raw.tier)] || String(raw.tier),
    imageUrl: raw.url,
    _rawUrl: raw.url, // keep original for DB lookup
  };
}

function getCardStats() {
  const byTier = {};
  for (const card of cardIndex) {
    const tier = LOCAL_TIER_TO_LABEL[String(card.tier)] || String(card.tier);
    byTier[tier] = (byTier[tier] || 0) + 1;
  }
  return { total: cardIndex.length, indexedCount: cardIndex.length, byTier };
}


const http2  = require("http");
const https2 = require("https");

async function fetchImageBuffer(url) {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https2 : http2;
    const req = client.get(url, { timeout: 12000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end",  () => resolve(Buffer.concat(chunks)));
      res.on("error",() => resolve(null));
    });
    req.on("error",   () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

async function _buildDeckImage(cards) {
  let createCanvas, loadImage;
  try {
    ({ createCanvas, loadImage } = require("@napi-rs/canvas"));
  } catch { return null; }

  const COLS = 3, ROWS = Math.ceil(Math.min(cards.length, 9) / 3);
  const CW = 160, CH = 220, PAD = 8, HEADER = 40;
  const W = COLS * (CW + PAD) + PAD;
  const H = ROWS * (CH + PAD) + PAD + HEADER;
  const canvas = createCanvas(W, H);
  const ctx2   = canvas.getContext("2d");

  // Background
  ctx2.fillStyle = "#1a1a2e";
  ctx2.fillRect(0, 0, W, H);

  // Header
  ctx2.fillStyle = "#e2b96a";
  ctx2.font = "bold 18px sans-serif";
  ctx2.textAlign = "center";
  ctx2.fillText("🎴 Your Deck", W / 2, 28);

  const tierColors = { T1:"#a0a0a0", T2:"#3b9ddd", T3:"#2ecc71", T4:"#e74c3c", T5:"#9b59b6", T6:"#f1c40f", TS:"#f39c12", TZ:"#8e44ad" };

  for (let i = 0; i < Math.min(cards.length, 9); i++) {
    const uc = cards[i];
    const c  = uc.cards || uc;
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = PAD + col * (CW + PAD);
    const y = HEADER + PAD + row * (CH + PAD);
    const tier = c?.tier || "?";
    const borderColor = tierColors[tier] || "#555";

    // Card bg
    ctx2.fillStyle = "#16213e";
    ctx2.strokeStyle = borderColor;
    ctx2.lineWidth = 3;
    ctx2.beginPath();
    ctx2.roundRect(x, y, CW, CH, 8);
    ctx2.fill(); ctx2.stroke();

    // Card image
    const imgUrl = c?.image_url || null;
    if (imgUrl) {
      try {
        const buf = await fetchImageBuffer(imgUrl);
        if (buf) {
          const img = await loadImage(buf);
          ctx2.save();
          ctx2.beginPath();
          ctx2.roundRect(x + 4, y + 4, CW - 8, CH - 52, 6);
          ctx2.clip();
          ctx2.drawImage(img, x + 4, y + 4, CW - 8, CH - 52);
          ctx2.restore();
        }
      } catch {}
    }

    // Card name bar
    ctx2.fillStyle = "rgba(0,0,0,0.7)";
    ctx2.fillRect(x + 2, y + CH - 50, CW - 4, 48);

    ctx2.fillStyle = "#ffffff";
    ctx2.font      = "bold 11px sans-serif";
    ctx2.textAlign = "center";
    const name = (c?.name || "Unknown").length > 14 ? (c?.name || "Unknown").slice(0, 12) + "…" : (c?.name || "Unknown");
    ctx2.fillText(name, x + CW / 2, y + CH - 34);

    ctx2.fillStyle = borderColor;
    ctx2.font      = "10px sans-serif";
    ctx2.fillText(tier, x + CW / 2, y + CH - 20);

    ctx2.fillStyle = "#aaa";
    ctx2.font      = "9px sans-serif";
    ctx2.fillText(`#${i + 1}`, x + CW / 2, y + CH - 6);
  }

  return canvas.toBuffer("image/jpeg", { quality: 85 });
}

module.exports = {
  async spawnc({ sock, jid, msg, reply, react, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply("⚠️ Only staff can spawn cards.");
    await react("⏳");
    try {
      const tier = SPAWN_TIERS[Math.floor(Math.random() * SPAWN_TIERS.length)];
      let card = getRandomCardByTier(tier);
      if (!card) card = getRandomCardByTier(null);
      if (!card) return reply("❌ No cards found in card.json.");
      const price = TIER_PRICES[card.tier] || 0;
      const owners = await db.getCardOwners(card.id).catch(() => []);
      const issues = owners.length;
      const caption =
        `✨ A card has spawned!\n\n` +
        `*🎴 Name:* ${card.name}\n` +
        `*⭐ Tier:* ${card.tier}\n` +
        `*🏷️ Price:* $${price.toLocaleString()}\n` +
        `*🆔 Card ID:* \`${card.id}\`\n` +
        `*#️⃣ Issues:* ${issues}\n\n` +
        `> Use .get \`${card.id}\` to *claim* this card!`;
      pendingCards[jid] = { card, expiresAt: Date.now() + 120000 };
      setTimeout(() => {
        if (pendingCards[jid]?.card?.id === card.id) delete pendingCards[jid];
      }, 120000);
      try {
        if (card.imageUrl) {
          await sock.sendMessage(jid, { image: { url: card.imageUrl }, caption }, { quoted: msg });
        } else {
          await sock.sendMessage(jid, { text: caption }, { quoted: msg });
        }
      } catch {
        await sock.sendMessage(jid, { text: caption });
      }
    } catch (err) {
      await reply(`❌ Failed to spawn: ${err.message}`);
    }
  },

  async spawncard(ctx) { return module.exports.spawnc(ctx); },

  async get({ sock, jid, msg, reply, react, sender, user, args }) {
    const pending = pendingCards[jid];
    if (!pending || Date.now() > pending.expiresAt) {
      return reply("❌ No card spawned right now! Wait for one to appear.");
    }
    const cardIdArg = args[0];
    if (cardIdArg && pending.card.id !== cardIdArg) {
      return reply(`❌ Wrong card ID! Current card is \`${pending.card.id}\``);
    }
    await react("⏳");
    const { card } = pending;
    delete pendingCards[jid];
    // Use the raw URL as the external ID for DB deduplication
    const rawUrl = card._rawUrl || card.imageUrl || card.id;
    const localCard = await db
      .getOrCreateShoobCard(rawUrl, card.name, card.tier, card.series, card.imageUrl || null, TIER_PRICES[card.tier] || 0)
      .catch(() => null);
    if (!localCard) return reply("❌ Failed to save card. Check your database setup and try again.");
    await db.addUserCard(sender, localCard.id);
    const tierEmoji = TIERS[card.tier] || "🎴";
    await reply(
      `✅ *CARD CLAIMED!*\n\n` +
      `${tierEmoji} *${card.name}*\n` +
      `⭐ Tier: ${card.tier} - ${TIER_NAMES[card.tier] || card.tier}\n` +
      `💰 Worth: $${(TIER_PRICES[card.tier] || 0).toLocaleString()}\n` +
      `🆔 ID: \`${card.id}\`\n\n` +
      `_Added to your collection! Use *.coll* to view it._`
    );
  },

  async ci({ sock, jid, msg, reply, react, args }) {
    if (!args.length) {
      return reply(
        `🃏 *CARD INFO*\n\n` +
        `Usage: *.ci <name> [tier]*\n` +
        `Multiple matches: *.ci <name> [tier]|<number>*\n\n` +
        `Examples:\n` +
        `• *.ci Kakashi T4*\n` +
        `• *.ci Chrollo Lucilfer T2|2*  ← 2nd match\n\n` +
        `Tiers: T1 T2 T3 T4 T5 T6 TS`
      );
    }
    await react("⏳");

    const validTiers = ["T1", "T2", "T3", "T4", "T5", "T6", "TS", "TZ"];

    // ── Parse |N selector (e.g. T2|2 or Naruto|3) ─────────────────
    let matchIndex = 0;
    let rawArgs = [...args];
    const lastRaw = rawArgs[rawArgs.length - 1];
    const pipeMatch = lastRaw.match(/^(.*)\|(\d+)$/);
    if (pipeMatch) {
      const cleaned = pipeMatch[1].trim();
      matchIndex = Math.max(0, parseInt(pipeMatch[2]) - 1);
      if (cleaned) {
        rawArgs[rawArgs.length - 1] = cleaned;
      } else {
        rawArgs.pop(); // e.g. user typed "Name T2 |2" - last is "|2"
      }
    }

    // ── Parse optional tier from last arg ─────────────────────────
    const lastArg = rawArgs[rawArgs.length - 1]?.toUpperCase();
    let nameQuery;
    let tierFilter;
    if (validTiers.includes(lastArg)) {
      nameQuery = rawArgs.slice(0, -1).join(" ").trim();
      tierFilter = lastArg;
    } else {
      nameQuery = rawArgs.join(" ").trim();
      tierFilter = null;
    }

    if (!nameQuery) return reply("⚠️ Please provide a card name.\n\nExample: *.ci Kakashi T4*");

    try {
      const matches = findCardsByName(nameQuery, tierFilter);
      if (!matches.length) {
        return reply(
          `❌ *No card found*\n\n` +
          `Name: *${nameQuery}*${tierFilter ? `\nTier: *${tierFilter}*` : ""}\n\n` +
          `_Try a different spelling or check the tier._`
        );
      }

      // Clamp index
      const safeIndex = Math.min(matchIndex, matches.length - 1);
      const card = matches[safeIndex];
      const tier = LOCAL_TIER_TO_LABEL[String(card.tier)] || String(card.tier);
      const price = TIER_PRICES[tier] || 0;
      const cardId = extractCardId(card.url);

      let multiNote = "";
      if (matches.length > 1) {
        multiNote =
          `\n\n_Found ${matches.length} matches. Showing #${safeIndex + 1}._\n` +
          `_Use *.ci ${nameQuery}${tierFilter ? " " + tierFilter : ""}|2* for the 2nd match, |3 for the 3rd, etc._`;
      }

      const caption =
        `*🃏 Card Info*\n\n` +
        `*🎴 Name:* ${card.title}\n` +
        `*⭐ Tier:* ${tier} - ${TIER_NAMES[tier] || tier}\n` +
        `*💰 Price:* $${price.toLocaleString()}\n` +
        `*🆔 Card ID:* \`${cardId}\`` +
        multiNote;

      try {
        if (card.url) {
          await sock.sendMessage(jid, { image: { url: card.url }, caption }, { quoted: msg });
        } else {
          await reply(caption);
        }
      } catch {
        await reply(caption);
      }
    } catch (err) {
      await reply(`❌ Error: ${err.message}`);
    }
  },

  async card({ sock, jid, msg, reply, react, sender, args }) {
    await react("⏳");
    const index = parseInt(args[0]);
    if (!index || index < 1) {
      return reply("⚠️ Usage: *.card <number>*\n\nExample: *.card 3*\n\nView your collection with *.coll*");
    }
    const cards = await db.getUserCards(sender);
    if (!cards.length) return reply("📭 Your collection is empty. Claim cards when they spawn!");
    if (index > cards.length) return reply(`❌ You only have *${cards.length}* card(s). Use *.coll* to view them.`);
    const uc = cards[index - 1];
    const cardData = uc.cards || uc;
    const tier = cardData?.tier || "?";
    const name = cardData?.name || "Unknown";
    const series = cardData?.series || "-";
    const imageUrl = cardData?.image_url || null;
    const price = cardData?.price || TIER_PRICES[tier] || 0;
    const tierEmoji = TIERS[tier] || "🎴";
    const caption =
      `🃏 *CARD #${index}*\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `${tierEmoji} *${name}*\n` +
      `📚 *Series:* ${series}\n` +
      `⭐ *Tier:* ${tier} - ${TIER_NAMES[tier] || tier}\n` +
      `💰 *Price:* $${price.toLocaleString()}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `_Collection entry #${index}._`;
    try {
      if (imageUrl) {
        await sock.sendMessage(jid, { image: { url: imageUrl }, caption }, { quoted: msg });
      } else {
        await reply(caption);
      }
    } catch {
      await reply(caption);
    }
  },

  async ss({ reply, react, args }) {
    if (!args.length) return reply("⚠️ Usage: *.ss <card name>*\n\nExample: *.ss Naruto*\n\n_Searches card names in the local index._");
    await react("⏳");
    const nameQuery = args.join(" ").trim();
    try {
      const matches = findCardsByName(nameQuery, null);
      if (!matches.length) return reply(`❌ No cards found matching: *${nameQuery}*`);
      const boldQuery = toBold(nameQuery.toUpperCase());

      // Batch fetch owner counts for all matched cards
      const externalIds = matches.map(c => extractCardId(c.url));
      let ownerCounts = {};
      try { ownerCounts = await db.getOwnerCountsBatch(externalIds); } catch {}

      const cardLines = matches.map((c, i) => {
        const tier = LOCAL_TIER_TO_LABEL[String(c.tier)] || String(c.tier);
        const extId = externalIds[i];
        const owners = ownerCounts[extId] || 0;
        return `\n*${i + 1}. ${c.title}*\n     *⭐ Tier:* ${tier}\n     *#️⃣ Owners:* ${owners}`;
      }).join("\n");

      const header = `*🎴 Cards Matching "${nameQuery}" Globaly 🎴*`;
      const footer = "";

      // WhatsApp has a ~65535 char limit; split into chunks if needed
      const MAX_LEN = 4000;
      const fullText = header + cardLines + footer;
      if (fullText.length <= MAX_LEN) {
        await reply(fullText);
      } else {
        // Send in pages
        const chunks = [];
        let current = header;
        const lines = cardLines.split("\n");
        for (const line of lines) {
          if ((current + "\n" + line).length > MAX_LEN) {
            chunks.push(current);
            current = "_(continued...)_";
          }
          current += "\n" + line;
        }
        chunks.push(current + footer);
        for (const chunk of chunks) await reply(chunk);
      }
    } catch (err) {
      await reply(`❌ Error: ${err.message}`);
    }
  },

  async coll({ reply, sender, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const targetPhone = mentioned.length ? mentioned[0].split("@")[0] : sender;
    const cards = await db.getUserCards(targetPhone);
    if (!cards.length) {
      return reply(`*🃏 Card Collection*\n\n_No cards yet. Claim some when they spawn!_`);
    }
    const lines = cards.map((uc, i) => {
      const cardData = uc.cards || uc;
      const tier = cardData?.tier || "?";
      const name = cardData?.name || "Unknown";
      return `${i + 1}. ${TIERS[tier] || "🎴"} *${name}* _(${tier})_`;
    }).join("\n");
    await reply(`*🃏 Card Collection* - ${cards.length} card(s)\n\n${lines}\n\n_Use *.card <number>* to view a card._`);
  },

  async collection(ctx) { return module.exports.coll(ctx); },

  async deck({ sock, jid, msg, reply, sender }) {
    const cards = await db.getUserCards(sender);
    if (!cards.length) return reply("📭 Your deck is empty.\n\nClaim cards when they spawn! 🎴");

    // Get owner counts for deck cards
    const deckSlice = cards.slice(0, 9);
    const deckExtIds = deckSlice.map(uc => {
      const c = uc.cards || uc;
      return c?.external_id || c?.id || "?";
    });
    let ownerCounts = {};
    try { ownerCounts = await db.getOwnerCountsBatch(deckExtIds); } catch {}

    const cardLines = deckSlice.map((uc, i) => {
      const c = uc.cards || uc;
      const tier = c?.tier || "?";
      const name = c?.name || "Unknown";
      const extId = deckExtIds[i];
      const owners = ownerCounts[extId] || 0;
      return (
        `\n🎴 *Name:* ${name}\n` +
        `⭐ *Tier:* ${tier} - ${TIER_NAMES[tier] || tier}\n` +
        `🔷 *Index:* #${i + 1}\n` +
        `#️⃣ *Owners:* (${owners})`
      );
    }).join("\n\n");

    const byTier = {};
    for (const uc of cards) {
      const t = (uc.cards || uc)?.tier || "?";
      byTier[t] = (byTier[t] || 0) + 1;
    }
    const tierSummary = Object.entries(byTier).map(([t, c]) => `${TIERS[t] || "🎴"} ${t}: ${c}`).join("  ");
    const ZWLTR = '\u200e'.repeat(800)
    const caption =
      `*🎴 Your Deck 🎴*${ZWLTR}` +
      cardLines +
      (cards.length > 9 ? `\n\n_...and ${cards.length - 9} more. Use *.coll* for full list._` : "");

    // Try to build a grid image of the 9 cards
    let deckImage = null;
    try {
      deckImage = await _buildDeckImage(deckSlice);
    } catch {}

    try {
      if (deckImage) {
        await sock.sendMessage(jid, { image: deckImage, caption }, { quoted: msg });
      } else {
        await reply(caption);
      }
    } catch {
      await reply(caption);
    }
  },

  async cd(ctx) { return module.exports.deck(ctx); },

  async cards({ reply }) {
    try {
      const stats = getCardStats();
      const byTier = stats.byTier || {};
      await reply(
        `🎴 *CARD DATABASE*\n\n` +
        `📦 *Total:* ${stats.total.toLocaleString()}\n` +
        `📊 *Indexed:* ${stats.indexedCount.toLocaleString()}\n\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        Object.entries(byTier).map(([t, c]) => `${TIERS[t] || "🎴"} ${t}: ${Number(c).toLocaleString()} cards`).join("\n") +
        `\n\n━━━━━━━━━━━━━━━\n\n` +
        `_Search: *.ci <name>* | Name search: *.ss <name>*_`
      );
    } catch (err) {
      await reply(`❌ Error fetching stats: ${err.message}`);
    }
  },

  async cardlb({ reply }) {
    try {
      const users = await db.getLeaderboard(10);
      const lines = await Promise.all(
        users.slice(0, 5).map(async (u, i) => {
          const count = await db.getUserCardCount(u.phone);
          return `${i + 1}. ${u.name || u.phone} - ${count} cards`;
        })
      );
      await reply(`🎴 *CARD LEADERBOARD*\n\n${lines.join("\n")}`);
    } catch (err) {
      await reply(`❌ Error: ${err.message}`);
    }
  },

  async tc({ reply, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentioned.length) return reply("⚠️ Usage: *.tc @user <card_number>*");
    const target = mentioned[0].split("@")[0];
    await reply(`📤 *TRADE*\n\nTrade requests coming soon!\n\nCoordinate trades manually with @${target}. 🖤`);
  },

  async dc({ reply, sender, args }) {
    const index = parseInt(args[0]);
    if (!index || index < 1) return reply("⚠️ Usage: *.dc <card_number>*\n\nFind numbers with *.coll*");
    const cards = await db.getUserCards(sender);
    if (index > cards.length) return reply(`❌ You only have ${cards.length} card(s).`);
    const uc = cards[index - 1];
    const cardData = uc.cards || uc;
    await db.deleteUserCardById(uc.id);
    await reply(
      `🗑️ *CARD DISCARDED*\n\n` +
      `${TIERS[cardData?.tier] || "🎴"} *${cardData?.name || "Unknown"}*\n` +
      `⭐ Tier: ${cardData?.tier || "?"}\n\n` +
      `_Returned to the void._ 🖤`
    );
  },

  async stardust({ reply }) {
    await reply(`✨ *STARDUST*\n\n💫 Earn stardust by participating in events.\n\n_Coming soon…_ 🖤`);
  },
};
