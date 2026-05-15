-- Shadow Garden Bot - Setup v3
-- Run this in your Supabase SQL Editor AFTER the original setup.sql
-- Adds group feature toggles, win rate, RPG XP, and pokemon fix columns

-- ── GROUP FEATURE TOGGLES + WIN RATE ──────────────────────────────────────────

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS gamble_enabled  BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pokemon_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS cards_enabled   BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS gamble_win_rate INTEGER DEFAULT 50;

-- ── RPG XP (separate from normal XP) ──────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS rpg_xp    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rpg_level INTEGER DEFAULT 1;

-- ── POKEMON SAVE FIX - ensure all needed columns exist ────────────────────────

ALTER TABLE user_pokemon
  ADD COLUMN IF NOT EXISTS pokemon_id  INTEGER,
  ADD COLUMN IF NOT EXISTS name        TEXT,
  ADD COLUMN IF NOT EXISTS types       JSONB    DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS level       INTEGER  DEFAULT 1,
  ADD COLUMN IF NOT EXISTS xp          INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moves       JSONB    DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS abilities   JSONB    DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ball        TEXT     DEFAULT 'pokeball',
  ADD COLUMN IF NOT EXISTS slot        INTEGER  DEFAULT 1,
  ADD COLUMN IF NOT EXISTS in_party    BOOLEAN  DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS base_xp     INTEGER  DEFAULT 50,
  ADD COLUMN IF NOT EXISTS height      TEXT,
  ADD COLUMN IF NOT EXISTS weight      TEXT,
  ADD COLUMN IF NOT EXISTS location    TEXT;

-- ── DECK SETTINGS (for .sdbg deck background) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS deck_settings (
  phone  TEXT PRIMARY KEY,
  bg_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── SHOP LISTINGS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shop_listings (
  id           SERIAL PRIMARY KEY,
  phone        TEXT NOT NULL,
  user_card_id INTEGER REFERENCES user_cards(id) ON DELETE CASCADE,
  price        INTEGER DEFAULT 0,
  listed_at    TIMESTAMPTZ DEFAULT now()
);

-- ── USER DECK SLOTS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_deck (
  id           SERIAL PRIMARY KEY,
  phone        TEXT NOT NULL,
  slot         INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 6),
  user_card_id INTEGER REFERENCES user_cards(id) ON DELETE SET NULL,
  UNIQUE (phone, slot)
);

-- ── CARDS TABLE - add external_id if missing ──────────────────────────────────

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE;

-- Fix tier constraint to include TZ and TS
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_tier_check;
ALTER TABLE cards
  ADD CONSTRAINT cards_tier_check
  CHECK (tier IN ('T1','T2','T3','T4','T5','T6','TS','TZ'));

-- ── PROFILE COLUMNS (if not already added) ────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_frame INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS profile_pp    TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS profile_bg    TEXT    DEFAULT NULL;

-- ── RPG CLASS COLUMNS ─────────────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS class_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS skill_xp   TEXT DEFAULT '{}';

-- Done! Run this once then restart your bot.
