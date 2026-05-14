const db = require("../database");
const cardIndex = require("./card.json");
const { getOrEnrichSeries, getCachedSeries, fetchCardMedia } = require("./groqVision");

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

const SEEALL_PAGE_SIZE = 25;

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

function getRandomCardByTier(tier) {
  const localTier = FILTER_TIER_TO_LOCAL[tier];
  const pool = localTier ? cardIndex.filter((c) => String(c.tier) === localTier) : cardIndex;
  if (!pool.length) return null;
  const raw = pool[Math.floor(Math.random() * pool.length)];
  const id = extractCardId(raw.url);
  const cachedSeries = getCachedSeries(id);
  return {
    id,
    name: raw.title,
    title: raw.title,
    series: cachedSeries || "—",
    tier: LOCAL_TIER_TO_LABEL[String(raw.tier)] || String(raw.tier),
    imageUrl: raw.url,
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

async function sendCardMedia(sock, jid, imageUrl, caption, quotedMsg) {
  const media = await fetchCardMedia(imageUrl).catch(() => null);
  if (!media) {
    await sock.sendMessage(jid, { text: caption }, quotedMsg ? { quoted: quotedMsg } : {});
    return;
  }
  if (media.isGif) {
    await sock.sendMessage(
      jid,
      { video: media.buffer, gifPlayback: true, caption },
      quotedMsg ? { quoted: quotedMsg } : {}
    );
  } else {
    await sock.sendMessage(
      jid,
      { image: media.buffer, caption },
      quotedMsg ? { quoted: quotedMsg } : {}
    );
  }
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
        `✨ *A card has spawned!*\n\n` +
        `*🎴 Name:* ${card.name}\n` +
        `*📚 Series:* ${card.series}\n` +
        `*⭐ Tier:* ${card.tier} — ${TIER_NAMES[card.tier] || card.tier}\n` +
        `*🏷️ Price:* $${price.toLocaleString()}\n` +
        `*🆔 Card ID:* ${card.id}\n` +
        `*#️⃣ Issues:* ${issues}\n\n` +
        `> Use *.get* \`${card.id}\` to *claim* this card!`;
      pendingCards[jid] = { card, expiresAt: Date.now() + 120000 };
      setTimeout(() => {
        if (pendingCards[jid]?.card?.id === card.id) delete pendingCards[jid];
      }, 120000);
      try {
        await sendCardMedia(sock, jid, card.imageUrl, caption, msg);
      } catch {
        await sock.sendMessage(jid, { text: caption });
      }
      getOrEnrichSeries(card.id, card.imageUrl).then((series) => {
        if (series && series !== "—" && pendingCards[jid]?.card?.id === card.id) {
          pendingCards[jid].card.series = series;
        }
      }).catch(() => {});
    } catch (err) {
      await reply(`❌ Failed to spawn: ${err.message}`);
    }
  },

  async spawncard(ctx) {
    return module.exports.spawnc(ctx);
  },

  async get({ sock, jid, msg, reply, react, sender, args }) {
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
      .getOrCreateShoobCard(card.id, card.name, card.tier, card.series, card.imageUrl || null, TIER_PRICES[card.tier] || 0)
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
    let nameQuery, tierFilter;
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
      const cachedSeries = getCachedSeries(cardId);
      const seriesLine = cachedSeries ? `*📚 Series:* ${cachedSeries}\n` : "";
      const caption =
        `*🃏 Card Info*\n\n` +
        `*🎴 Name:* ${card.title}\n` +
        seriesLine +
        `*⭐ Tier:* ${tier} — ${TIER_NAMES[tier] || tier}\n` +
        `*💰 Price:* $${price.toLocaleString()}\n` +
        `*🆔 Card ID:* \`${cardId}\`` +
        (matches.length > 1
          ? `\n\n_Found ${matches.length} matches. Showing first._\n_Try *.ci ${nameQuery} ${tier}* to filter by tier._`
          : "");
      try {
        await sendCardMedia(sock, jid, card.url, caption, msg);
      } catch {
        await reply(caption);
      }
      if (!cachedSeries) {
        getOrEnrichSeries(cardId, card.url).catch(() => {});
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
        await sendCardMedia(sock, jid, imageUrl, caption, msg);
      } else {
        await reply(caption);
      }
    } catch {
      await reply(caption);
    }
  },

  async seeall({ reply, react, args }) {
    const validTiers = ["T1", "T2", "T3", "T4", "T5", "T6", "TS"];
    const firstArg = (args[0] || "").toUpperCase();

    if (!firstArg || !validTiers.includes(firstArg)) {
      return reply(
        `📋 *SEE ALL CARDS*\n\n` +
          `Usage: *.seeall <tier> [page]*\n\n` +
          `Example: *.seeall T3*\n` +
          `Example: *.seeall T1 2*\n\n` +
          `Tiers: ${validTiers.join(" | ")}\n\n` +
          `${validTiers.map((t) => {
            const local = FILTER_TIER_TO_LOCAL[t];
            const count = cardIndex.filter((c) => String(c.tier) === local).length;
            return `${TIERS[t]} ${t} (${count})`;
          }).join("  ")}`
      );
    }

    await react("⏳");
    const tier = firstArg;
    const page = Math.max(1, parseInt(args[1]) || 1);
    const localTier = FILTER_TIER_TO_LOCAL[tier];
    const pool = cardIndex.filter((c) => String(c.tier) === localTier);

    if (!pool.length) return reply(`❌ No cards found for tier *${tier}*.`);

    const totalPages = Math.ceil(pool.length / SEEALL_PAGE_SIZE);
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * SEEALL_PAGE_SIZE;
    const slice = pool.slice(start, start + SEEALL_PAGE_SIZE);

    const tierEmoji = TIERS[tier] || "🎴";
    const boldTier = toBold(tier);
    const lines = slice
      .map((c, i) => `${start + i + 1}. *${c.title}*`)
      .join("\n");

    await reply(
      `${tierEmoji} *${boldTier} — ${TIER_NAMES[tier]} Cards*\n` +
        `📦 Total: ${pool.length} | Page ${safePage}/${totalPages}\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `${lines}\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        (safePage < totalPages
          ? `_Next page: *.seeall ${tier} ${safePage + 1}*_\n`
          : `_Last page reached._\n`) +
        `_Search a card: *.ci <name>*_`
    );
  },

  async ss({ reply, react, args }) {
    if (!args.length) return reply("⚠️ Usage: *.ss <card name>*\n\nExample: *.ss Naruto*\n\n_Searches card names in the local index._");
    await react("⏳");
    const nameQuery = args.join(" ").trim();
    try {
      const matches = findCardsByName(nameQuery, null);
      if (!matches.length) {
        return reply(`❌ No cards found matching: *${nameQuery}*`);
      }
      const boldQuery = toBold(nameQuery.toUpperCase());
      const cardLines = matches
        .slice(0, 30)
        .map((c) => {
          const tier = LOCAL_TIER_TO_LABEL[String(c.tier)] || String(c.tier);
          const cached = getCachedSeries(extractCardId(c.url));
          const seriesTag = cached ? ` · ${cached}` : "";
          return `\n✦ 『 ${c.title} 』\n> 🏷️ 𝗧𝗶𝗲𝗿: ${tier}${seriesTag}`;
        })
        .join("\n");
      const more = matches.length > 30 ? `\n\n_...and ${matches.length - 30} more cards._` : "";
      await reply(
        `╭─❖ 「 📚 𝗖𝗔𝗥𝗗𝗦 𝗠𝗔𝗧𝗖𝗛𝗜𝗡𝗚 ${boldQuery} 📚 」 ❖─╮` +
          cardLines +
          more +
          `\n╰────────────────────╯`
      );
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
      const stats = getCardStats();
      const byTier = stats.byTier || {};
      await reply(
        `🎴 *CARD DATABASE*\n\n` +
          `📦 *Total:* ${stats.total.toLocaleString()}\n` +
          `📊 *Indexed:* ${stats.indexedCount.toLocaleString()}\n\n` +
          `━━━━━━━━━━━━━━━\n\n` +
          Object.entries(byTier)
            .map(([t, c]) => `${TIERS[t] || "🎴"} ${t} — ${TIER_NAMES[t] || t}: ${Number(c).toLocaleString()} cards`)
            .join("\n") +
          `\n\n━━━━━━━━━━━━━━━\n\n` +
          `_Search: *.ci <name>* | Browse: *.seeall <tier>*_`
      );
    } catch (err) {
      await reply(`❌ Error: ${err.message}`);
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
