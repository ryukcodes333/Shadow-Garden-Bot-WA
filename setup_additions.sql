-- ============================================================
--   Shadow Garden Bot — Additional Tables (Run AFTER setup.sql)
--   Add these in your Supabase SQL Editor
-- ============================================================

-- User Pokémon table
CREATE TABLE IF NOT EXISTS user_pokemon (
  id          BIGSERIAL PRIMARY KEY,
  phone       TEXT NOT NULL,
  pokemon_id  INTEGER NOT NULL,
  name        TEXT NOT NULL,
  types       JSONB DEFAULT '[]',
  level       INTEGER DEFAULT 1,
  xp          INTEGER DEFAULT 0,
  moves       JSONB DEFAULT '[]',
  abilities   JSONB DEFAULT '[]',
  ball        TEXT DEFAULT 'pokeball',
  slot        INTEGER DEFAULT 1,
  in_party    BOOLEAN DEFAULT TRUE,
  base_xp     INTEGER DEFAULT 50,
  height      TEXT DEFAULT '?',
  weight      TEXT DEFAULT '?',
  location    TEXT DEFAULT 'Unknown',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_pokemon_phone ON user_pokemon(phone);

-- Allow updating pokemon phone (for trades/gifts)
ALTER TABLE user_pokemon ADD COLUMN IF NOT EXISTS phone TEXT;

-- Disabled commands table
CREATE TABLE IF NOT EXISTS disabled_commands (
  id        BIGSERIAL PRIMARY KEY,
  command   TEXT UNIQUE NOT NULL,
  reason    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add pokemon columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS pokemon_badges  INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pokemon_wins    INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pokemon_losses  INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS team            TEXT DEFAULT 'Shadow';

-- Add mention_sticker column (optional - bot uses file-based storage by default)
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS mention_sticker TEXT DEFAULT NULL;
