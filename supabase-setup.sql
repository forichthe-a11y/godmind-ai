-- =============================================
-- GodMind AI - Supabase Database Setup
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT DEFAULT '',
  role TEXT DEFAULT 'user',
  plan TEXT DEFAULT 'pro',
  credits INTEGER DEFAULT 9999,
  total_tokens INTEGER DEFAULT 0,
  total_chats INTEGER DEFAULT 0,
  referral_code TEXT DEFAULT '',
  referral_count INTEGER DEFAULT 0,
  god_mode_enabled BOOLEAN DEFAULT false,
  stealth_mode BOOLEAN DEFAULT false,
  parseltongue_on BOOLEAN DEFAULT false,
  active_persona TEXT,
  is_public BOOLEAN DEFAULT false,
  bio TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- 2. Chats table
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New Chat',
  model TEXT DEFAULT 'godmind-v2',
  mode TEXT DEFAULT 'normal',
  god_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT DEFAULT 'godmind-v2',
  tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Default',
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'general',
  content TEXT NOT NULL,
  rating INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);

-- ============ ROW LEVEL SECURITY ============
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by API)
CREATE POLICY "Service role all users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role all chats" ON chats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role all messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role all api_keys" ON api_keys FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role all feedback" ON feedback FOR ALL USING (true) WITH CHECK (true);

-- ============ SEED ADMIN USER ============
-- Change the password below to your desired admin password!
INSERT INTO users (id, email, name, password, role, plan, credits, referral_code, god_mode_enabled, stealth_mode, parseltongue_on, bio)
VALUES (
  'admin-001',
  'admin@godmind.ai',
  'Admin',
  (SELECT encode('GodMode2026!'::bytea, 'base64')),
  'admin',
  'enterprise',
  999999,
  'ADMIN001',
  true,
  true,
  true,
  'GodMind AI Platform Administrator'
)
ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  plan = 'enterprise',
  credits = 999999,
  password = (SELECT encode('GodMode2026!'::bytea, 'base64'));

-- =============================================
-- DONE! Your database is ready!
-- =============================================
