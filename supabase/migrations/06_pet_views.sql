CREATE TABLE IF NOT EXISTS pet_views (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, pet_id)
);

ALTER TABLE pet_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pet_views_own" ON pet_views FOR ALL USING (auth.uid() = user_id);
