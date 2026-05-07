# Shadow Garden Bot — Render Deployment Guide

A WhatsApp bot for browsing and collecting anime cards with commands for searching, spawning, and managing card collections.

---

## Quick Deploy to Render

1. Upload this project to a GitHub repository
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo — Render will detect `render.yaml` automatically
4. Click **Apply** to create the service
5. Set the **required environment variables** (see table below)
6. Click **Deploy**

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_KEY` | ✅ | Your Supabase anon/public key |
| `SHOOB_API_URL` | ✅ | URL of your Shadow Cards web app (e.g. `https://shadow-cards.onrender.com`) |
| `PHONE_NUMBER` | ✅ | Your WhatsApp number with country code — no `+`, no spaces (e.g. `27821234567`) |
| `OWNER_LID` | ✅ | Your WhatsApp LID — shown in logs when bot first connects |
| `SESSION_SECRET` | Optional | Random secret string for session security |
| `BOT_NAME` | Optional | Bot display name (default: `Alpha`) |
| `BOT_PREFIX` | Optional | Command prefix (default: `.`) |

---

## First-Time Setup

### 1. Set Up the Database (Supabase)

1. Go to [supabase.com](https://supabase.com) → create a free project
2. Open **SQL Editor** in your project dashboard
3. Copy and paste the entire contents of `setup.sql` → click **Run**
4. Copy your **Project URL** and **anon key** from Settings → API

### 2. Deploy to Render

1. Push this repo to GitHub
2. On Render: New → Web Service → connect your repo
3. Set all environment variables listed above
4. Deploy — the service will start

### 3. Pair Your WhatsApp

1. Set `PHONE_NUMBER` in Render environment variables (your WhatsApp number)
2. After deploying, open the **Logs** tab in Render
3. You'll see a pairing code like: `XXXX-YYYY-ZZZZ`
4. On your phone: WhatsApp → ⋮ → Linked Devices → Link a Device → Link with phone number
5. Enter the pairing code
6. Tap **CONFIRM** on the notification — bot goes online!

> **Note:** The session is preserved in `auth_info_10000/` — it survives restarts automatically. To re-pair, delete that folder and redeploy.

---

## Card Commands

| Command | Description |
|---|---|
| `.spawnc` | Spawn a random card (staff only) |
| `.get <card_id>` | Claim the currently spawned card |
| `.ci <name> [tier]` | Look up card info by name (and optional tier) |
| `.card <index>` | View a specific card from your collection |
| `.coll` | View your full card collection |
| `.ss <series>` | Browse all available cards from a series |
| `.cards` | Show card database stats |
| `.deck` | Detailed view of your deck |
| `.cardlb` | Card collection leaderboard |
| `.dc <number>` | Discard a card from your collection |

### Spawn Message Format

```
✨ A card has spawned!

*🎴 Name:* Kakashi Hatake
*📚 Series:* Naruto
*⭐ Tier:* T4
*🏷️ Price:* $50,000
*🆔 Card ID:* 5f3a1b2c...
*#️⃣ Issues:* 3

> Use .get `5f3a1b2c...` to *claim* this card!
```

### Series Search Format (`.ss`)

```
╭─❖ 「 📚 𝗔𝗩𝗔𝗜𝗟𝗔𝗕𝗟𝗘 𝗖𝗔𝗥𝗗𝗦 𝗙𝗥𝗢𝗠 𝗡𝗔𝗥𝗨𝗧𝗢 📚 」 ❖─╮

✦ 『 Kakashi Hatake 』
> 🏷️ 𝗧𝗶𝗲𝗿: T4

✦ 『 Naruto Uzumaki 』
> 🏷️ 𝗧𝗶𝗲𝗿: T3

╰────────────────────╯
```

---

## Tier System

| Tier | Rarity | Price |
|---|---|---|
| T1 | Common | $17,500 |
| T2 | Uncommon | $27,500 |
| T3 | Rare | $37,500 |
| T4 | Epic | $50,000 |
| T5 | Legendary | $62,500 |
| T6 | Mythic | $72,500 |
| TS | Shadow | $90,000 |

---

## Troubleshooting

- **Bot not connecting** — Check `PHONE_NUMBER` is set correctly (digits only, country code first)
- **Cards not loading** — Check `SHOOB_API_URL` points to your running Shadow Cards web app
- **Database errors** — Make sure you ran the full `setup.sql` in Supabase SQL Editor
- **Re-pairing needed** — Delete the `auth_info_10000/` folder from Render's file system and redeploy

---

## Requirements

- Node.js 18+
- Supabase account (free tier works)
- Render account (free tier works)
- Shadow Cards web app running (for card data)
