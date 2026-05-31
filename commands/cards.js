const db        = require("../database");
const http      = require("http");
const https     = require("https");

// ─── THREE CARD SOURCES ──────────────────────────────────────────────────────
// 1. Old shoob.gg format: [{title, tier (numeric), url}]
const cardIndex = require("./card.json");
// 2. New shoob.gg format: [{name, tier, url, series}]
let cardIndex2 = [];
try { cardIndex2 = require("./cards_shoob2.json"); } catch {}
// 3. Mazoku.cc format: [{id, name, tier (T1-T6), series, url}]
let cardIndexMazoku = [];
try { cardIndexMazoku = require("./cards_mazoku.json"); } catch {}

// ─── TIERS ───────────────────────────────────────────────────────────────────
const TIER_PRICES = { T1: 17500, T2: 27500, T3: 37500, T4: 50000, T5: 62500, T6: 72500, TS: 90000, TZ: 0 };
const TIER_NAMES  = { T1: "Common", T2: "Uncommon", T3: "Rare", T4: "Epic", T5: "Legendary", T6: "Mythic", TS: "Shadow", TZ: "Void" };
const TIERS       = { T1: "🥉", T2: "🔵", T3: "🟢", T4: "🔴", T5: "🟣", T6: "🟡", TS: "✨", TZ: "🌌" };
const SPAWN_TIERS = ["T1","T1","T1","T1","T2","T2","T2","T3","T3","T4","T4","T5","T6","TS"];
const pendingCards = {};

// Tier mapping for old shoob format (tier is numeric string)
const LOCAL_TIER_TO_LABEL    = { "1": "T1", "2": "T2", "3": "T3", "4": "T4", "5": "T5", "6": "T6", S: "TS" };
const FILTER_TIER_TO_LOCAL   = { T1: "1", T2: "2", T3: "3", T4: "4", T5: "5", T6: "6", TS: "S", TZ: "Z" };

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function normalizeText(v) { return String(v || "").trim().toLowerCase(); }

function toShortId(input) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  let result = "", n = h;
  for (let i = 0; i < 6; i++) { result += chars[n % chars.length]; n = Math.floor(n / chars.length); }
  return result;
}
function extractCardId(url) { return toShortId(String(url || "").trim()); }

// ─── CARD INFO LAYOUT (exact as specified) ────────────────────────────────────
function cardBlock(name, tier, series, owners, cardId, ownersList) {
  const seriesLine = series && series !== "-" ? series : "—";
  const tierLabel  = `${tier} — ${TIER_NAMES[tier] || tier}`;

  let holdersSection;
  if (!ownersList || ownersList.length === 0) {
    holdersSection = `\n> No owners found for this card yet.`;
  } else {
    const romanNumerals = ["Ⅰ","Ⅱ","Ⅲ","Ⅳ","Ⅴ","Ⅵ","Ⅶ","Ⅷ","Ⅸ","Ⅹ"];
    const lines = ownersList.slice(0, 10).map((o, i) =>
      `⟡ 𝗖𝗼𝗽𝘆 ${romanNumerals[i] || (i+1)} | \`${cardId}\`\n   👤 @${o.phone || o}`
    ).join("\n");
    holdersSection = `\n${lines}`;
  }

  return (
    `╭━━━ ✦ 👑 ✦ ━━━╮\n` +
    `     🎴 𝗖𝗔𝗥𝗗 𝗜𝗡𝗙𝗢\n` +
    `╰━━━ ✦ 👑 ✦ ━━━╯\n\n` +
    `👑 𝗡𝗮𝗺𝗲: ${name}\n` +
    `📜 𝗦𝗲𝗿𝗶𝗲𝘀: ${seriesLine}\n` +
    `⭐ 𝗧𝗶𝗲𝗿: ${tierLabel}\n` +
    `👥 𝗢𝘄𝗻𝗲𝗿𝘀: ${owners}\n\n` +
    `╔═════ ✦ ═════╗\n` +
    `       👥 𝗛𝗢𝗟𝗗𝗘𝗥𝗦\n` +
    `╚═════ ✦ ═════╝` +
    holdersSection
  );
}

// ─── SEARCH: OLD SHOOB INDEX ──────────────────────────────────────────────────
function findCardsOld(nameQuery, tierFilter) {
  const q  = normalizeText(nameQuery);
  const lt = tierFilter ? FILTER_TIER_TO_LOCAL[tierFilter] : null;
  if (!q) return [];
  return cardIndex
    .filter(c => {
      if (!normalizeText(c.title).includes(q)) return false;
      if (lt && String(c.tier) !== lt) return false;
      return true;
    })
    .map(c => ({
      name:   c.title,
      tier:   LOCAL_TIER_TO_LABEL[String(c.tier)] || String(c.tier),
      url:    c.url,
      series: "-",
      source: "shoob",
    }))
    .sort((a, b) => {
      const aq = normalizeText(a.name), bq = normalizeText(b.name);
      if (aq === q && bq !== q) return -1;
      if (bq === q && aq !== q) return 1;
      return aq.localeCompare(bq);
    });
}

// ─── SEARCH: NEW SHOOB INDEX ─────────────────────────────────────────────────
function findCardsNew(nameQuery, tierFilter) {
  const q  = normalizeText(nameQuery);
  const lt = tierFilter ? FILTER_TIER_TO_LOCAL[tierFilter] : null;
  if (!q) return [];
  return cardIndex2
    .filter(c => {
      if (!normalizeText(c.name).includes(q)) return false;
      if (lt && String(c.tier) !== lt) return false;
      return true;
    })
    .map(c => ({
      name:   c.name,
      tier:   LOCAL_TIER_TO_LABEL[String(c.tier)] || String(c.tier),
      url:    c.url,
      series: c.series || "-",
      source: "shoob2",
    }))
    .sort((a, b) => {
      const aq = normalizeText(a.name), bq = normalizeText(b.name);
      if (aq === q && bq !== q) return -1;
      if (bq === q && aq !== q) return 1;
      return aq.localeCompare(bq);
    });
}

// ─── SEARCH: MAZOKU INDEX ────────────────────────────────────────────────────
function findCardsMazoku(nameQuery, tierFilter) {
  const q = normalizeText(nameQuery);
  if (!q) return [];
  return cardIndexMazoku
    .filter(c => {
      if (!normalizeText(c.name).includes(q)) return false;
      if (tierFilter && c.tier !== tierFilter) return false;
      return true;
    })
    .map(c => ({
      name:   c.name,
      tier:   c.tier,
      url:    c.url,
      series: c.series || "-",
      source: "mazoku",
    }))
    .sort((a, b) => {
      const aq = normalizeText(a.name), bq = normalizeText(b.name);
      if (aq === q && bq !== q) return -1;
      if (bq === q && aq !== q) return 1;
      return aq.localeCompare(bq);
    });
}

// ─── MERGE ALL SOURCES — NO DEDUP (same name can exist in multiple sources) ──
function findCardsAll(nameQuery, tierFilter) {
  const old    = findCardsOld(nameQuery, tierFilter);
  const newer  = findCardsNew(nameQuery, tierFilter);
  const mazoku = findCardsMazoku(nameQuery, tierFilter);
  // interleave by relevance: exact matches first across all sources
  const all = [...old, ...newer, ...mazoku];
  const q   = normalizeText(nameQuery);
  return all.sort((a, b) => {
    const aq = normalizeText(a.name), bq = normalizeText(b.name);
    const aExact = aq === q, bExact = bq === q;
    if (aExact && !bExact) return -1;
    if (bExact && !aExact) return 1;
    const aStart = aq.startsWith(q), bStart = bq.startsWith(q);
    if (aStart && !bStart) return -1;
    if (bStart && !aStart) return 1;
    return aq.localeCompare(bq);
  });
}

// ─── SERIES SEARCH (all sources with series info) ────────────────────────────
function findCardsBySeries(seriesQuery, tierFilter) {
  const q = normalizeText(seriesQuery);
  if (!q) return [];

  const fromNew = cardIndex2
    .filter(c => {
      if (!normalizeText(c.series).includes(q)) return false;
      if (tierFilter && LOCAL_TIER_TO_LABEL[String(c.tier)] !== tierFilter) return false;
      return true;
    })
    .map(c => ({
      name:   c.name,
      tier:   LOCAL_TIER_TO_LABEL[String(c.tier)] || String(c.tier),
      url:    c.url,
      series: c.series || "-",
    }));

  const fromMazoku = cardIndexMazoku
    .filter(c => {
      if (!normalizeText(c.series).includes(q)) return false;
      if (tierFilter && c.tier !== tierFilter) return false;
      return true;
    })
    .map(c => ({
      name:   c.name,
      tier:   c.tier,
      url:    c.url,
      series: c.series || "-",
    }));

  return [...fromNew, ...fromMazoku]
    .sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name)));
}

// ─── RANDOM CARD ─────────────────────────────────────────────────────────────
function getRandomCardByTier(tier) {
  const lt   = tier ? FILTER_TIER_TO_LOCAL[tier] : null;
  const pool1 = lt ? cardIndex.filter(c => String(c.tier) === lt) : cardIndex;
  const pool2 = lt ? cardIndex2.filter(c => String(c.tier) === lt) : cardIndex2;
  const pool3 = tier ? cardIndexMazoku.filter(c => c.tier === tier) : cardIndexMazoku;
  const pool  = [
    ...pool1.map(c => ({ name: c.title, tier: LOCAL_TIER_TO_LABEL[String(c.tier)] || String(c.tier), url: c.url, series: "-" })),
    ...pool2.map(c => ({ name: c.name,  tier: LOCAL_TIER_TO_LABEL[String(c.tier)] || String(c.tier), url: c.url, series: c.series || "-" })),
    ...pool3.map(c => ({ name: c.name,  tier: c.tier, url: c.url, series: c.series || "-" })),
  ];
  if (!pool.length) return null;
  const raw = pool[Math.floor(Math.random() * pool.length)];
  return {
    id:       extractCardId(raw.url),
    name:     raw.name,
    title:    raw.name,
    series:   raw.series,
    tier:     raw.tier,
    imageUrl: raw.url,
    _rawUrl:  raw.url,
  };
}

function getCardStats() {
  const byTier = {};
  const count  = (t) => { byTier[t] = (byTier[t] || 0) + 1; };
  for (const c of cardIndex)        count(LOCAL_TIER_TO_LABEL[String(c.tier)] || String(c.tier));
  for (const c of cardIndex2)       count(LOCAL_TIER_TO_LABEL[String(c.tier)] || String(c.tier));
  for (const c of cardIndexMazoku)  count(c.tier);
  const total = cardIndex.length + cardIndex2.length + cardIndexMazoku.length;
  return { total, indexedCount: total, byTier };
}

// ─── IMAGE FETCH ─────────────────────────────────────────────────────────────
async function fetchImageBuffer(url) {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
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
  try { ({ createCanvas, loadImage } = require("@napi-rs/canvas")); } catch { return null; }
  const COLS = 3, ROWS = Math.ceil(Math.min(cards.length, 9) / 3);
  const CW = 160, CH = 220, PAD = 8, HEADER = 40;
  const W = COLS * (CW + PAD) + PAD, H = ROWS * (CH + PAD) + PAD + HEADER;
  const canvas = createCanvas(W, H);
  const ctx2   = canvas.getContext("2d");
  ctx2.fillStyle = "#1a1a2e"; ctx2.fillRect(0, 0, W, H);
  ctx2.fillStyle = "#e2b96a"; ctx2.font = "bold 18px sans-serif"; ctx2.textAlign = "center";
  ctx2.fillText("🎴 Your Deck", W / 2, 28);
  const tierColors = { T1:"#a0a0a0", T2:"#3b9ddd", T3:"#2ecc71", T4:"#e74c3c", T5:"#9b59b6", T6:"#f1c40f", TS:"#f39c12", TZ:"#8e44ad" };
  for (let i = 0; i < Math.min(cards.length, 9); i++) {
    const uc = cards[i]; const c = uc.cards || uc;
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = PAD + col * (CW + PAD), y = HEADER + PAD + row * (CH + PAD);
    const tier = c?.tier || "?";
    ctx2.fillStyle = "#16213e"; ctx2.strokeStyle = tierColors[tier] || "#555"; ctx2.lineWidth = 3;
    ctx2.beginPath(); ctx2.roundRect(x, y, CW, CH, 8); ctx2.fill(); ctx2.stroke();
    const imgUrl = c?.image_url || null;
    if (imgUrl) {
      try {
        const buf = await fetchImageBuffer(imgUrl);
        if (buf) { const img = await loadImage(buf); ctx2.save(); ctx2.beginPath(); ctx2.roundRect(x+4, y+4, CW-8, CH-52, 6); ctx2.clip(); ctx2.drawImage(img, x+4, y+4, CW-8, CH-52); ctx2.restore(); }
      } catch {}
    }
    ctx2.fillStyle = "rgba(0,0,0,0.7)"; ctx2.fillRect(x+2, y+CH-50, CW-4, 48);
    ctx2.fillStyle = "#ffffff"; ctx2.font = "bold 11px sans-serif"; ctx2.textAlign = "center";
    const name = (c?.name || "Unknown").length > 14 ? (c?.name || "Unknown").slice(0, 12) + "…" : (c?.name || "Unknown");
    ctx2.fillText(name, x + CW/2, y + CH - 34);
    ctx2.fillStyle = tierColors[tier] || "#aaa"; ctx2.font = "10px sans-serif"; ctx2.fillText(tier, x + CW/2, y + CH - 20);
    ctx2.fillStyle = "#aaa"; ctx2.font = "9px sans-serif"; ctx2.fillText(`#${i+1}`, x + CW/2, y + CH - 6);
  }
  return canvas.toBuffer("image/jpeg", { quality: 85 });
}

// ─── COMMANDS ─────────────────────────────────────────────────────────────────
module.exports = {
  async spawnc({ sock, jid, msg, reply, react, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply("⚠️ Only staff can spawn cards.");
    await react("⏳");
    try {
      const tier = SPAWN_TIERS[Math.floor(Math.random() * SPAWN_TIERS.length)];
      let card = getRandomCardByTier(tier);
      if (!card) card = getRandomCardByTier(null);
      if (!card) return reply("❌ No cards found in card indexes.");
      const owners = await db.getCardOwners(card.id).catch(() => []);
      const caption =
        `✨ *A card has spawned!*\n\n` +
        cardBlock(card.name, card.tier, card.series, owners.length, card.id, owners) +
        `\n\n> Use *.get* \`${card.id}\` to *claim* this card!`;
      pendingCards[jid] = { card, expiresAt: Date.now() + 120000 };
      setTimeout(() => { if (pendingCards[jid]?.card?.id === card.id) delete pendingCards[jid]; }, 120000);
      try {
        if (card.imageUrl) { await sock.sendMessage(jid, { image: { url: card.imageUrl }, caption }, { quoted: msg }); }
        else               { await sock.sendMessage(jid, { text: caption }, { quoted: msg }); }
      } catch { await sock.sendMessage(jid, { text: caption }); }
    } catch (err) { await reply(`❌ Failed to spawn: ${err.message}`); }
  },
  async spawncard(ctx) { return module.exports.spawnc(ctx); },

  async get({ sock, jid, msg, reply, react, sender, args }) {
    const pending = pendingCards[jid];
    if (!pending || Date.now() > pending.expiresAt) return reply("❌ No card spawned right now! Wait for one to appear.");
    const cardIdArg = args[0];
    if (cardIdArg && pending.card.id !== cardIdArg) return reply(`❌ Wrong card ID! Current card is \`${pending.card.id}\``);
    await react("⏳");
    const { card } = pending;
    delete pendingCards[jid];
    const rawUrl = card._rawUrl || card.imageUrl || card.id;
    const localCard = await db.getOrCreateShoobCard(rawUrl, card.name, card.tier, card.series, card.imageUrl || null, TIER_PRICES[card.tier] || 0).catch(() => null);
    if (!localCard) return reply("❌ Failed to save card. Check your database setup.");
    await db.addUserCard(sender, localCard.id);
    const owners = await db.getCardOwners(card.id).catch(() => []);
    await reply(cardBlock(card.name, card.tier, card.series, owners.length, card.id, owners) + `\n\n✅ *CLAIMED!* Added to your collection.\n_Use *.coll* to view it._`);
  },

  // ─── .ci — card info ─────────────────────────────────────────────────────
  async ci({ sock, jid, msg, reply, react, args }) {
    if (!args.length) return reply(`Usage: *.ci <name> [tier]*`);
    await react("⏳");
    const validTiers = ["T1","T2","T3","T4","T5","T6","TS","TZ"];
    let rawArgs = [...args];

    const lastArg = rawArgs[rawArgs.length - 1]?.toUpperCase();
    let nameQuery, tierFilter;
    if (validTiers.includes(lastArg)) { nameQuery = rawArgs.slice(0, -1).join(" ").trim(); tierFilter = lastArg; }
    else { nameQuery = rawArgs.join(" ").trim(); tierFilter = null; }
    if (!nameQuery) return reply("⚠️ Please provide a card name.");

    try {
      const matches = findCardsAll(nameQuery, tierFilter);
      if (!matches.length) return reply(`❌ No card found: *${nameQuery}*${tierFilter ? ` (${tierFilter})` : ""}`);

      // Show each match — send image of first, then list all
      const first   = matches[0];
      const cardId  = extractCardId(first.url);
      const owners  = await db.getCardOwners(cardId).catch(() => []);
      const caption = cardBlock(first.name, first.tier, first.series, owners.length, cardId, owners) +
        (matches.length > 1
          ? `\n\n📋 *${matches.length} results:*\n` +
            matches.map((m, i) => {
              const src = m.source === "mazoku" ? " _(mazoku)_" : "";
              return `${i + 1}. ${TIERS[m.tier] || "🎴"} *${m.name}* (${m.tier})${src}`;
            }).join("\n")
          : "");

      try {
        if (first.url) { await sock.sendMessage(jid, { image: { url: first.url }, caption }, { quoted: msg }); }
        else { await reply(caption); }
      } catch { await reply(caption); }
    } catch (err) { await reply(`❌ Error: ${err.message}`); }
  },

  // ─── .ss — search cards by name ──────────────────────────────────────────
  async ss({ reply, react, args }) {
    if (!args.length) return reply("⚠️ Usage: *.ss <card name>*");
    await react("⏳");
    const nameQuery = args.join(" ").trim();
    try {
      const matches = findCardsAll(nameQuery, null);
      if (!matches.length) return reply(`❌ No cards found: *${nameQuery}*`);

      const cardLines = matches.map((c, i) => {
        const s   = c.series && c.series !== "-" ? ` — _${c.series}_` : "";
        const src = c.source === "mazoku" ? " _(mazoku)_" : "";
        return `${i + 1}. ${TIERS[c.tier] || "🎴"} *${c.name}* (${c.tier})${s}${src}`;
      }).join("\n");

      const header = `*🎴 "${nameQuery}" — ${matches.length} result(s)*\n\n`;
      const full   = header + cardLines;
      const MAX    = 4000;
      if (full.length <= MAX) { await reply(full); return; }
      const chunks = [];
      let cur = header.trimEnd();
      for (const line of cardLines.split("\n")) {
        if ((cur + "\n" + line).length > MAX) { chunks.push(cur); cur = "_(continued...)_"; }
        cur += "\n" + line;
      }
      chunks.push(cur);
      for (const chunk of chunks) await reply(chunk);
    } catch (err) { await reply(`❌ Error: ${err.message}`); }
  },

  // ─── .fs — series search (exact layout as specified) ─────────────────────
  async fs({ sock, jid, msg, reply, react, args }) {
    if (!args.length) return reply(`Usage: *.fs <series name> [tier]*`);
    await react("⏳");
    const validTiers = ["T1","T2","T3","T4","T5","T6","TS","TZ"];
    let rawArgs = [...args];
    const lastArg = rawArgs[rawArgs.length - 1]?.toUpperCase();
    let seriesQuery, tierFilter;
    if (validTiers.includes(lastArg)) { seriesQuery = rawArgs.slice(0, -1).join(" ").trim(); tierFilter = lastArg; }
    else { seriesQuery = rawArgs.join(" ").trim(); tierFilter = null; }
    if (!seriesQuery) return reply("⚠️ Provide a series name.");
    try {
      const matches = findCardsBySeries(seriesQuery, tierFilter);
      if (!matches.length) return reply(`❌ No cards found in series: *${seriesQuery}*`);

      // Count by tier
      const tierCounts = {};
      for (const c of matches) { tierCounts[c.tier] = (tierCounts[c.tier] || 0) + 1; }
      const tierLines = Object.entries(tierCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([t, cnt]) => `${t} = ${cnt}`)
        .join("\n");

      const cardLines = matches.map(c => `[${c.tier}] ${c.name}`).join("\n");

      const seriesName = matches[0]?.series || seriesQuery;
      const text =
        `∘₊✧──────✧₊∘\n` +
        `🔎 𝗦𝗘𝗥𝗜𝗘𝗦 𝗦𝗘𝗔𝗥𝗖𝗛\n` +
        `∘₊✧──────✧₊∘\n\n` +
        `📚 𝗡𝗮𝗺𝗲: ${seriesName}\n` +
        `🎴 𝗧𝗼𝘁𝗮𝗹 𝗖𝗮𝗿𝗱𝘀: ${matches.length}\n\n` +
        `✨ 𝗧𝗶𝗲𝗿𝘀:\n${tierLines}\n\n` +
        `∘₊✧──────✧₊∘\n` +
        `📜 𝗖𝗔𝗥𝗗𝗦\n` +
        `∘₊✧──────✧₊∘\n\n` +
        cardLines +
        `\n\n∘₊✧──────✧₊∘\n` +
        `💡 Use .ci {card name} {tier} to view a card from this series\n` +
        `∘₊✧──────✧₊∘`;

      // Send image of first card then the text list
      const first = matches[0];
      if (first.url) {
        try { await sock.sendMessage(jid, { image: { url: first.url }, caption: `📚 ${seriesName}` }, { quoted: msg }); } catch {}
      }

      const MAX = 4000;
      if (text.length <= MAX) { await reply(text); return; }
      const chunks = [];
      let cur = "";
      for (const line of text.split("\n")) {
        if ((cur + "\n" + line).length > MAX) { chunks.push(cur); cur = ""; }
        cur += (cur ? "\n" : "") + line;
      }
      if (cur) chunks.push(cur);
      for (const chunk of chunks) await reply(chunk);
    } catch (err) { await reply(`❌ Error: ${err.message}`); }
  },

  // ─── .card — view a card in your collection ──────────────────────────────
  async card({ sock, jid, msg, reply, react, sender, args }) {
    await react("⏳");
    const index = parseInt(args[0]);
    if (!index || index < 1) return reply("⚠️ Usage: *.card <number>*");
    const cards = await db.getUserCards(sender);
    if (!cards.length) return reply("📭 Your collection is empty.");
    if (index > cards.length) return reply(`❌ You only have *${cards.length}* card(s).`);
    const uc      = cards[index - 1];
    const cardData = uc.cards || uc;
    const tier     = cardData?.tier || "?";
    const name     = cardData?.name || "Unknown";
    const series   = cardData?.series || "-";
    const imageUrl = cardData?.image_url || null;
    const cardId   = extractCardId(imageUrl || name);
    const owners   = await db.getCardOwners(cardId).catch(() => []);
    const caption  = cardBlock(name, tier, series, owners.length, cardId, owners);
    try {
      if (imageUrl) { await sock.sendMessage(jid, { image: { url: imageUrl }, caption }, { quoted: msg }); }
      else { await reply(caption); }
    } catch { await reply(caption); }
  },

  // ─── .coll ────────────────────────────────────────────────────────────────
  async coll({ reply, sender, msg }) {
    const mentioned   = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const targetPhone = mentioned.length ? mentioned[0].split("@")[0].split(":")[0] : sender;
    const cards = await db.getUserCards(targetPhone);
    if (!cards.length) return reply(`*🃏 Card Collection*\n\n_No cards yet._`);
    const lines = cards.map((uc, i) => {
      const cardData = uc.card_id || uc;
      const tier = cardData?.tier || "?";
      const name = cardData?.name || "Unknown";
      return `${i + 1}. ${TIERS[tier] || "🎴"} *${name}* _(${tier})_`;
    }).join("\n");
    await reply(`*🃏 Card Collection* — ${cards.length} card(s)\n\n${lines}`);
  },
  async collection(ctx) { return module.exports.coll(ctx); },

  // ─── .deck ────────────────────────────────────────────────────────────────
  async deck({ sock, jid, msg, reply, sender }) {
    const cards = await db.getUserCards(sender);
    if (!cards.length) return reply("📭 Your deck is empty. Claim cards when they spawn!");
    const deckSlice  = cards.slice(0, 9);
    const deckExtIds = deckSlice.map(uc => { const c = uc.card_id || uc; return c?.external_id || c?.id || "?"; });
    let ownerCounts = {};
    try { ownerCounts = await db.getOwnerCountsBatch(deckExtIds); } catch {}
    const cardLines = deckSlice.map((uc, i) => {
      const c      = uc.card_id || uc;
      const tier   = c?.tier || "?";
      const name   = c?.name || "Unknown";
      const owners = ownerCounts[deckExtIds[i]] || 0;
      return `\n🎴 *Name:* ${name}\n⭐ *Tier:* ${tier}\n🔷 *Index:* #${i + 1}\n#️⃣ *Owners:* ${owners}`;
    }).join("\n\n");
    const ZWLTR  = '\u200e'.repeat(800);
    const caption =
      `*🎴 Your Deck 🎴*${ZWLTR}` +
      cardLines +
      (cards.length > 9 ? `\n\n_...and ${cards.length - 9} more. Use *.coll* for full list._` : "");
    let deckImage = null;
    try { deckImage = await _buildDeckImage(deckSlice); } catch {}
    try {
      if (deckImage) { await sock.sendMessage(jid, { image: deckImage, caption }, { quoted: msg }); }
      else           { await reply(caption); }
    } catch { await reply(caption); }
  },
  async cd(ctx) { return module.exports.deck(ctx); },

  // ─── .cards — stats ───────────────────────────────────────────────────────
  async cards({ reply }) {
    try {
      const stats  = getCardStats();
      const byTier = stats.byTier || {};
      await reply(
        `🎴 *CARD DATABASE*\n\n` +
        `📦 *Total:* ${stats.total.toLocaleString()}\n` +
        `   _(Shoob Classic + Shoob Extended + Mazoku)_\n\n` +
        Object.entries(byTier).sort().map(([t, c]) => `${TIERS[t] || "🎴"} ${t}: ${Number(c).toLocaleString()}`).join("\n")
      );
    } catch (err) { await reply(`❌ Error: ${err.message}`); }
  },

  async cardlb({ reply }) {
    try {
      const users = await db.getLeaderboard(10);
      const lines = await Promise.all(
        users.slice(0, 5).map(async (u, i) => {
          const count = await db.getUserCardCount(u.phone);
          return `${i + 1}. ${u.name || u.phone} — ${count} cards`;
        })
      );
      await reply(`🎴 *CARD LEADERBOARD*\n\n${lines.join("\n")}`);
    } catch (err) { await reply(`❌ Error: ${err.message}`); }
  },

  async tc({ reply, msg }) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentioned.length) return reply("⚠️ Usage: *.tc @user <card_number>*");
    const target = mentioned[0].split("@")[0];
    await reply(`📤 *TRADE*\n\nTrade requests coming soon! Coordinate manually with @${target}. 🖤`);
  },

  async dc({ reply, sender, args }) {
    const index = parseInt(args[0]);
    if (!index || index < 1) return reply("⚠️ Usage: *.dc <card_number>*");
    const cards = await db.getUserCards(sender);
    if (index > cards.length) return reply(`❌ You only have ${cards.length} card(s).`);
    const uc = cards[index - 1];
    const cardData = uc.card_id || uc;
    await db.deleteUserCardById(uc.id);
    await reply(
      `🗑️ *CARD DISCARDED*\n\n` +
      `${TIERS[cardData?.tier] || "🎴"} *${cardData?.name || "Unknown"}* (${cardData?.tier || "?"})\n\n` +
      `_Returned to the void._ 🖤`
    );
  },

  async stardust({ reply }) { await reply(`✨ *STARDUST*\n\n_Coming soon…_ 🖤`); },
};
