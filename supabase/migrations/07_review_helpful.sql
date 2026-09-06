-- Review helpful voting
CREATE TABLE IF NOT EXISTS review_helpful_votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

ALTER TABLE review_helpful_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read votes" ON review_helpful_votes FOR SELECT USING (true);
CREATE POLICY "Auth users can vote" ON review_helpful_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own votes" ON review_helpful_votes FOR DELETE USING (auth.uid() = user_id);

-- Add helpful count cache to reviews for fast display
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0;
