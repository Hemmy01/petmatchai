-- ============================================================
-- Match feedback (interested / not interested) for AI recommendations
-- Run once in Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE ai_matches ADD COLUMN IF NOT EXISTS feedback TEXT CHECK (feedback IN ('interested', 'not_interested'));
ALTER TABLE ai_matches ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ;
