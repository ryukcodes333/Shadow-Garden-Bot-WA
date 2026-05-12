-- Run this in your Supabase SQL Editor

-- Ensure banned column exists on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT FALSE;

-- Create suspensions table
CREATE TABLE IF NOT EXISTS suspensions (
  phone           TEXT PRIMARY KEY,
  suspended_until TIMESTAMPTZ NOT NULL,
  reason          TEXT        DEFAULT 'No reason given',
  suspended_by    TEXT        DEFAULT 'staff',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS suspensions_phone_idx ON suspensions (phone);
