ALTER TABLE ai_matches ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'pending' CHECK (match_status IN ('pending', 'accepted', 'declined'));
