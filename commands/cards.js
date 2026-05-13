const db = require("../database");
const http = require("http");
const https = require("https");
const cardIndex = require("./card.json");

function fetchPollinationsImage(prompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&model=flux`;
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: 18000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", () => resolve(null));
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

const TIER_PRICES = {
  T1: 17500,
  T2: 27500,
  T3: 37500,
  T4: 50000,
  T5: 62500,
  T6: 72500,
  TS: 90000,
  TZ: 0,
};

const TIER_NAMES = {
  T1: "Common",
  T2: "Uncommon",
  T3: "Rare",
  T4: "Epic",
  T5: "Legendary",
  T6: "Mythic",
  TS: "Shadow",
  TZ: "Void",
};

const TIERS = {
  T1: "🥉",
  T2: "🔵",
  T3: "🟢",
  T4: "🔴",
  T5: "🟣",
  T6: "🟡",
  TS: "✨",
  TZ: "🌌",
};

const SPAWN_TIERS = ["T1", "T1", "T1", "T1", "T2", "T2", "T2", "T3", "T3", "T4", "T4", "T5", "T6", "TS"];
const pendingCards = {};

const LOCAL_TIER_TO_LABEL = {
  "1": "T1",
  "2": "T2",
  "3": "T3",
  "4": "T4",
  "5": "T5",
  "6": "T6",
  S: "TS",
};

const FILTER_TIER_TO_LOCAL = {
  T1: "1",
  T2: "2",
  T3: "3",
  T4: "4",
  T5: "5",
  T6: "6",
  TS: "S",
  TZ: "Z",
};

function apiGet(path) {
  const base = (process.env.SHOOB_API_URL || "").replace(/\/+$/, "");
  if (!base) {
    return Promise.reject(new Error("SHOOB_API_URL not configured - set it in your Render environment variables"));
  }
  const url = base + path;
  const lib = url.startsWith("https") ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.get(url, { headers: { "User-Agent": "ShadowGardenBot/2.0" }, timeout: 15000 }, (res) => {
      let data = "";
      res.on("data", (d) => {
        data += d;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Bad JSON from API"));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("API timeout"));
    });
  });
}

function toBold(str) {
  return str
    .split("")
    .map((c) => {
      const code = c.codePointAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(code + 0x1d400 - 65);
      if (code >= 97 && code <= 122) return String.fromCodePoint(code + 0x1d41a - 97);
      if (code >= 48 && code <= 57) return String.fromCodePoint(code + 0x1d7ce - 48);
      return c;
    })
    .join("");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function extractCardId(url) {
  const trimmed = String(url || "").trim();
  const match = trimmed.match(/\/([^/]+)$/);
  return match ? match[1] : trimmed;
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

module.exports = {
  async spawnc({ sock, jid, msg, reply, react, isOwner, isMod, isGuardian }) {
    if (!isOwner && !isMod && !isGuardian) return reply("⚠️ Only staff can spawn cards.");
    await react("⏳");
    try {
      const tier = SPAWN_TIERS[Math.floor(Math.random() * SPAWN_TIERS.length)];
      let card = await apiGet(`/api/cards/random?tier=${tier}`).catch(() => null);
      if (!card?.id) card = await apiGet("/api/cards/random").catch(() => null);
      if (!card?.id) return reply("❌ No cards available yet. The index may still be loading - try again in a minute.");
      const price = TIER_PRICES[card.tier] || 0;
      const owners = await db.getCardOwners(card.id).catch(() => []);
      const issues = owners.length;
      const caption =
        `✨ A card has spawned!\n\n` +
        `*🎴 Name:* ${card.name}\n` +
        `*📚 Series:* ${card.series}\n` +
        `*⭐ Tier:* ${card.tier}\n` +
        `*🏷️ Price:* $${price.toLocaleString()}\n` +
        `*🆔 Card ID:* ${card.id}\n` +
        `*#️⃣ Issues:* ${issues}\n\n` +
        `> Use .get \`${card.id}\` to *claim* this card!`;
      pendingCards[jid] = { card, expiresAt: Date.now() + 120000 };
      setTimeout(() => {
        if (pendingCards[jid]?.card?.id === card.id) delete pendingCards[jid];
      }, 120000);
      const imgUrl = card.imageUrl || card.thumbnailUrl;
      try {
        if (imgUrl) {
          await sock.sendMessage(jid, { image: { url: imgUrl }, caption }, { quoted: msg });
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

  async spawncard(ctx) {
    return module.exports.spawnc(ctx);
  },

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
    const localCard = await db
      .getOrCreateShoobCard(card.id, card.name, card.tier, card.series, card.imageUrl || card.thumbnailUrl || null, TIER_PRICES[card.tier] || 0)
      .catch(() => null);
    if (!localCard) return reply("❌ Failed to save card. Check your database setup and try again.");
    await db.addUserCard(sender, localCard.id);
    const tierEmoji = TIERS[card.tier] || "🎴";
    await reply(
      `✅ *CARD CLAIMED!*\n\n` +
        `${tierEmoji} *${card.name}*\n` +
        `📚 Series: ${card.series}\n` +
        `⭐ Tier: ${card.tier} — ${TIER_NAMES[card.tier] || card.tier}\n` +
        `💰 Worth: $${(TIER_PRICES[card.tier] || 0).toLocaleString()}\n\n` +
        `_Added to your collection! Use *.coll* to view it._`
    );
  },

  async ci({ sock, jid, msg, reply, react, args }) {
    if (!args.length) {
      return reply(
        `🃏 *CARD INFO*\n\n` +
          `Usage: *.ci <name> [tier]*\n\n` +
          `Example: *.ci Kakashi T4*\n\n` +
          `Tiers: T1 T2 T3 T4 T5 T6 TS`
      );
    }
    await react("⏳");
    const validTiers = ["T1", "T2", "T3", "T4", "T5", "T6", "TS", "TZ"];
    const lastArg = args[args.length - 1].toUpperCase();
    let nameQuery;
    let tierFilter;
    if (validTiers.includes(lastArg)) {
      nameQuery = args.slice(0, -1).join(" ").trim();
      tierFilter = lastArg;
    } else {
      nameQuery = args.join(" ").trim();
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
      const card = matches[0];
      const tier = LOCAL_TIER_TO_LABEL[String(card.tier)] || String(card.tier);
      const price = TIER_PRICES[tier] || 0;
      const cardId = extractCardId(card.url);
      const caption =
        `*🃏 Card Info*\n\n` +
        `*🎴 Name:* ${card.title}\n` +
        `*⭐ Tier:* ${tier} — ${TIER_NAMES[tier] || tier}\n` +
        `*💰 Price:* $${price.toLocaleString()}\n` +
        `*🆔 Card ID:* \`${cardId}\`` +
        (matches.length > 1 ? `\n\n_Found ${matches.length} matches. Showing first._\n_Try *.ci ${nameQuery} T4* to filter by tier._` : "");
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
    const series = cardData?.series || "—";
    const imageUrl = cardData?.image_url || null;
    const price = cardData?.price || TIER_PRICES[tier] || 0;
    const tierEmoji = TIERS[tier] || "🎴";
    const caption =
      `🃏 *CARD #${index}*\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `${tierEmoji} *${name}*\n` +
      `📚 *Series:* ${series}\n` +
      `⭐ *Tier:* ${tier} — ${TIER_NAMES[tier] || tier}\n` +
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
    if (!args.length) return reply("⚠️ Usage: *.ss <series name>*\n\nExample: *.ss Naruto*");
    await react("⏳");
    const seriesQuery = args.join(" ").trim();
    try {
      const data = await apiGet(`/api/cards?search=${encodeURIComponent(seriesQuery)}&limit=50`);
      if (!data.cards?.length) {
        return reply(`❌ No cards found for: *${seriesQuery}*`);
      }
      const seriesMatch = data.cards.filter((c) => c.series.toLowerCase().includes(seriesQuery.toLowerCase()));
      const displayCards = seriesMatch.length ? seriesMatch : data.cards;
      const actualSeries = displayCards[0].series;
      const boldSeries = toBold(actualSeries.toUpperCase());
      const cardLines = displayCards
        .slice(0, 30)
        .map((c) => `\n✦ 『 ${c.name} 』\n> 🏷️ 𝗧𝗶𝗲𝗿: ${c.tier}`)
        .join("\n");
      const more = displayCards.length > 30 ? `\n\n_...and ${displayCards.length - 30} more cards._` : "";
      await reply(`╭─❖ 「 📚 𝗔𝗩𝗔𝗜𝗟𝗔𝗕𝗟𝗘 𝗖𝗔𝗥𝗗𝗦 𝗙𝗥𝗢𝗠 ${boldSeries} 📚 」 ❖─╮` + cardLines + more + `\n╰────────────────────╯`);
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
    const lines = cards
      .map((uc, i) => {
        const cardData = uc.cards || uc;
        const tier = cardData?.tier || "?";
        const name = cardData?.name || "Unknown";
        return `${i + 1}. ${TIERS[tier] || "🎴"} *${name}* _(${tier})_`;
      })
      .join("\n");
    await reply(`*🃏 Card Collection* — ${cards.length} card(s)\n\n${lines}\n\n_Use *.card <number>* to view a card._`);
  },

  async collection(ctx) {
    return module.exports.coll(ctx);
  },

  async deck({ reply, sender }) {
    const cards = await db.getUserCards(sender);
    if (!cards.length) return reply("📭 Your deck is empty.\n\nClaim cards when they spawn! 🎴");
    const byTier = {};
    for (const uc of cards) {
      const t = (uc.cards || uc)?.tier || "?";
      byTier[t] = (byTier[t] || 0) + 1;
    }
    const tierSummary = Object.entries(byTier)
      .map(([t, c]) => `${TIERS[t] || "🎴"} ${t}: ${c}`)
      .join(" ");
    const list = cards
      .slice(0, 15)
      .map((uc, i) => {
        const c = uc.cards || uc;
        return `${i + 1}. ${TIERS[c?.tier] || "🎴"} *${c?.name || "Unknown"}* _(${c?.tier || "?"})_`;
      })
      .join("\n");
    await reply(
      `🃏 *YOUR DECK*\n\n` +
        `📦 Total: ${cards.length}\n\n` +
        `━━━━━━━━━━━━━━━\n` +
        `*Tiers:* ${tierSummary}\n` +
        `━━━━━━━━━━━━━━━\n\n` +
        `${list}${cards.length > 15 ? `\n\n_...and ${cards.length - 15} more. Use *.coll* for full list._` : ""}`
    );
  },

  async cd(ctx) {
    return module.exports.deck(ctx);
  },

  async cards({ reply }) {
    try {
      const stats = await apiGet("/api/cards/stats");
      const byTier = stats.byTier || {};
      await reply(
        `🎴 *CARD DATABASE*\n\n` +
          `📦 *Total:* ${(stats.total || 0).toLocaleString()}\n` +
          `📊 *Indexed:* ${(stats.indexedCount || 0).toLocaleString()}\n\n` +
          `━━━━━━━━━━━━━━━\n\n` +
          Object.entries(byTier)
            .map(([t, c]) => `${TIERS[t] || "🎴"} ${t}: ${Number(c).toLocaleString()} cards`)
            .join("\n") +
          `\n\n━━━━━━━━━━━━━━━\n\n` +
          `_Search: *.ci <name>* | Series: *.ss <series>*_`
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
          return `${i + 1}. ${u.name || u.phone} — ${count} cards`;
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
        
