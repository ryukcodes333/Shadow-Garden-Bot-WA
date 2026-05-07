-- ============================================================
--   Shadow Garden Bot — Supabase Database Setup
--   Run this entire file in your Supabase SQL Editor
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id          BIGSERIAL PRIMARY KEY,
  phone       TEXT UNIQUE NOT NULL,
  name        TEXT,
  wallet      BIGINT DEFAULT 0,
  bank        BIGINT DEFAULT 500,
  gems        INTEGER DEFAULT 0,
  xp          BIGINT DEFAULT 0,
  level       INTEGER DEFAULT 1,
  streak      INTEGER DEFAULT 0,
  last_daily  TIMESTAMPTZ,
  banned      BOOLEAN DEFAULT FALSE,
  premium     BOOLEAN DEFAULT FALSE,
  role        TEXT DEFAULT 'member',
  title       TEXT DEFAULT 'Newcomer',
  bio         TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Profile columns (added for profile card system)
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_frame  INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_pp     TEXT    DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_bg     TEXT    DEFAULT NULL;

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id               BIGSERIAL PRIMARY KEY,
  group_id         TEXT UNIQUE NOT NULL,
  name             TEXT,
  antilink         BOOLEAN DEFAULT FALSE,
  antilink_action  TEXT DEFAULT 'warn',
  antispam         BOOLEAN DEFAULT FALSE,
  welcome          BOOLEAN DEFAULT FALSE,
  welcome_msg      TEXT,
  leave            BOOLEAN DEFAULT FALSE,
  leave_msg        TEXT,
  muted            BOOLEAN DEFAULT FALSE,
  pokemon_enabled  BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Warnings table
CREATE TABLE IF NOT EXISTS warnings (
  id          BIGSERIAL PRIMARY KEY,
  user_phone  TEXT NOT NULL,
  group_id    TEXT NOT NULL,
  reason      TEXT,
  by_phone    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- AFK table
CREATE TABLE IF NOT EXISTS afk (
  id        BIGSERIAL PRIMARY KEY,
  phone     TEXT UNIQUE NOT NULL,
  reason    TEXT DEFAULT 'AFK',
  since     TIMESTAMPTZ DEFAULT NOW(),
  mentions  INTEGER DEFAULT 0
);

-- Messages log table (for activity tracking)
CREATE TABLE IF NOT EXISTS messages (
  id          BIGSERIAL PRIMARY KEY,
  user_phone  TEXT NOT NULL,
  group_id    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_user  ON messages(user_phone);
CREATE INDEX IF NOT EXISTS idx_messages_time  ON messages(created_at);

-- Cooldowns table
CREATE TABLE IF NOT EXISTS cooldowns (
  id         BIGSERIAL PRIMARY KEY,
  phone      TEXT NOT NULL,
  command    TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(phone, command)
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id        BIGSERIAL PRIMARY KEY,
  phone     TEXT NOT NULL,
  item      TEXT NOT NULL,
  quantity  INTEGER DEFAULT 1,
  UNIQUE(phone, item)
);

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  tier         TEXT NOT NULL CHECK (tier IN ('T1','T2','T3','T4','T5','T6','TZ')),
  series       TEXT,
  price        INTEGER NOT NULL DEFAULT 100,
  image_url    TEXT,
  rarity       TEXT,
  uploaded_by  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cards_tier   ON cards(tier);
CREATE INDEX IF NOT EXISTS idx_cards_name   ON cards(name);
CREATE INDEX IF NOT EXISTS idx_cards_series ON cards(series);

-- User cards (collection)
CREATE TABLE IF NOT EXISTS user_cards (
  id         BIGSERIAL PRIMARY KEY,
  phone      TEXT NOT NULL,
  card_id    INTEGER REFERENCES cards(id) ON DELETE CASCADE,
  obtained_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_cards_phone ON user_cards(phone);
-- External ID for scraped cards (unique identifier from external source)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_external_id ON cards(external_id) WHERE external_id IS NOT NULL;


-- Pokémon table
CREATE TABLE IF NOT EXISTS user_pokemon (
  id            BIGSERIAL PRIMARY KEY,
  phone         TEXT NOT NULL,
  pokemon_id    INTEGER NOT NULL,
  pokemon_name  TEXT NOT NULL,
  level         INTEGER DEFAULT 5,
  xp            INTEGER DEFAULT 0,
  hp            INTEGER DEFAULT 20,
  max_hp        INTEGER DEFAULT 20,
  attack        INTEGER DEFAULT 10,
  defense       INTEGER DEFAULT 10,
  speed         INTEGER DEFAULT 10,
  in_party      BOOLEAN DEFAULT TRUE,
  wins          INTEGER DEFAULT 0,
  losses        INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_pokemon_phone ON user_pokemon(phone);

-- Games table
CREATE TABLE IF NOT EXISTS games (
  id          BIGSERIAL PRIMARY KEY,
  group_id    TEXT NOT NULL,
  game_type   TEXT NOT NULL,
  players     JSONB,
  state       JSONB,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Summer tokens table
CREATE TABLE IF NOT EXISTS summer_tokens (
  id            BIGSERIAL PRIMARY KEY,
  phone         TEXT UNIQUE NOT NULL,
  tokens        INTEGER DEFAULT 0,
  last_claimed  TIMESTAMPTZ
);

-- Guilds table
CREATE TABLE IF NOT EXISTS guilds (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT UNIQUE NOT NULL,
  leader_phone  TEXT NOT NULL,
  level         INTEGER DEFAULT 1,
  treasury      BIGINT DEFAULT 0,
  gems          INTEGER DEFAULT 0,
  wins          INTEGER DEFAULT 0,
  losses        INTEGER DEFAULT 0,
  member_count  INTEGER DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Guild members table
CREATE TABLE IF NOT EXISTS guild_members (
  id          BIGSERIAL PRIMARY KEY,
  guild_id    INTEGER REFERENCES guilds(id) ON DELETE CASCADE,
  phone       TEXT NOT NULL,
  is_leader   BOOLEAN DEFAULT FALSE,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(phone)
);

-- Blacklisted words
CREATE TABLE IF NOT EXISTS blacklist (
  id         BIGSERIAL PRIMARY KEY,
  group_id   TEXT NOT NULL,
  word       TEXT NOT NULL,
  UNIQUE(group_id, word)
);

-- Disabled commands
CREATE TABLE IF NOT EXISTS disabled_commands (
  id          BIGSERIAL PRIMARY KEY,
  command     TEXT UNIQUE NOT NULL,
  reason      TEXT DEFAULT '',
  disabled_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Storage bucket for card images (required for .addcard images)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-images', 'card-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow all roles (anon, authenticated, public) full access to card-images bucket
-- A single PERMISSIVE FOR ALL policy is simpler and covers the bot's anon key
DO $$
BEGIN
  -- Drop old per-operation policies if they exist, then create one permissive policy
  DROP POLICY IF EXISTS "card_images_select" ON storage.objects;
  DROP POLICY IF EXISTS "card_images_insert" ON storage.objects;
  DROP POLICY IF EXISTS "card_images_update" ON storage.objects;
  DROP POLICY IF EXISTS "card_images_delete" ON storage.objects;
  DROP POLICY IF EXISTS "allow_all_card_images" ON storage.objects;

  CREATE POLICY "allow_all_card_images"
    ON storage.objects AS PERMISSIVE
    FOR ALL TO public
    USING (bucket_id = 'card-images')
    WITH CHECK (bucket_id = 'card-images');
END $$;

-- ============================================================
-- Row Level Security (RLS) — allow anon key full access
-- (For a private bot, service_role key is recommended instead)
-- ============================================================
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups           ENABLE ROW LEVEL SECURITY;
ALTER TABLE warnings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE afk              ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooldowns        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pokemon     ENABLE ROW LEVEL SECURITY;
ALTER TABLE games            ENABLE ROW LEVEL SECURITY;
ALTER TABLE summer_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE guilds           ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist        ENABLE ROW LEVEL SECURITY;
ALTER TABLE disabled_commands ENABLE ROW LEVEL SECURITY;

-- Allow all operations from anon key (bot uses anon key)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','groups','warnings','afk','messages','cooldowns',
    'inventory','cards','user_cards','user_pokemon','games',
    'summer_tokens','guilds','guild_members','blacklist','disabled_commands'
  ]) LOOP
    BEGIN
      EXECUTE format('CREATE POLICY "anon_all_%s" ON %s FOR ALL TO anon USING (true) WITH CHECK (true)', t, t);
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- policy already exists, skip
    END;
  END LOOP;
END $$;
