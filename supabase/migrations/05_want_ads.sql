-- Buyer want-ads (reverse-direction matching: buyers post what they want)
-- Run once in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS want_ads (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  buyer_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '',
  species    TEXT,
  breeds     TEXT[] DEFAULT '{}',
  budget_max NUMERIC,
  location   TEXT,
  description TEXT,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE want_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "want_ads_select" ON want_ads FOR SELECT USING (TRUE);
CREATE POLICY "want_ads_insert" ON want_ads FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "want_ads_update" ON want_ads FOR UPDATE USING (auth.uid() = buyer_id);
CREATE POLICY "want_ads_delete" ON want_ads FOR DELETE USING (auth.uid() = buyer_id);
