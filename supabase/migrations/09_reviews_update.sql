-- Run this in Supabase SQL Editor to enable seller replies on reviews
-- This is an additive migration — safe to run on existing data

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS seller_reply TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS seller_reply_at TIMESTAMPTZ;

-- Allow sellers to update only their own review replies
DROP POLICY IF EXISTS "reviews_seller_reply" ON reviews;
CREATE POLICY "reviews_seller_reply" ON reviews FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Allow admin deletion of reviews (for moderation)
DROP POLICY IF EXISTS "reviews_admin_delete" ON reviews;
CREATE POLICY "reviews_admin_delete" ON reviews FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );
