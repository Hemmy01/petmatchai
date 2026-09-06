-- ============================================================
-- PetMatchAI — Storage + Verification Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('pet-images',            'pet-images',            true,  10485760,   ARRAY['image/jpeg','image/png','image/webp']),
  ('pet-videos',            'pet-videos',            true,  104857600,  ARRAY['video/mp4','video/webm','video/quicktime']),
  ('verification-photos',   'verification-photos',   true,  10485760,   ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS policies
-- pet-images
CREATE POLICY "Public read pet-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pet-images');

CREATE POLICY "Auth upload pet-images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pet-images' AND auth.role() = 'authenticated');

CREATE POLICY "Auth delete own pet-images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'pet-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- pet-videos
CREATE POLICY "Public read pet-videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pet-videos');

CREATE POLICY "Auth upload pet-videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pet-videos' AND auth.role() = 'authenticated');

-- verification-photos
CREATE POLICY "Public read verification-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'verification-photos');

CREATE POLICY "Auth upload verification-photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'verification-photos' AND auth.role() = 'authenticated');

-- 3. Extend pets table
ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS listing_verified   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_code  TEXT;

-- 4. Pet images table (multiple photos per listing)
CREATE TABLE IF NOT EXISTS pet_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id      UUID REFERENCES pets(id) ON DELETE CASCADE NOT NULL,
  url         TEXT NOT NULL,
  storage_path TEXT,
  is_primary  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pet_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pet images"
  ON pet_images FOR SELECT USING (true);

CREATE POLICY "Sellers can insert own pet images"
  ON pet_images FOR INSERT
  WITH CHECK (pet_id IN (SELECT id FROM pets WHERE seller_id = auth.uid()));

CREATE POLICY "Sellers can delete own pet images"
  ON pet_images FOR DELETE
  USING (pet_id IN (SELECT id FROM pets WHERE seller_id = auth.uid()));

-- 5. Pet videos table
CREATE TABLE IF NOT EXISTS pet_videos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id       UUID REFERENCES pets(id) ON DELETE CASCADE NOT NULL,
  url          TEXT NOT NULL,
  storage_path TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pet_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pet videos"
  ON pet_videos FOR SELECT USING (true);

CREATE POLICY "Sellers can insert own pet videos"
  ON pet_videos FOR INSERT
  WITH CHECK (pet_id IN (SELECT id FROM pets WHERE seller_id = auth.uid()));

-- 6. Verification requests table
CREATE TABLE IF NOT EXISTS verification_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id                  UUID REFERENCES pets(id) ON DELETE CASCADE NOT NULL,
  seller_id               UUID REFERENCES profiles(id) NOT NULL,
  code                    TEXT NOT NULL,
  status                  TEXT DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected')),
  verification_image_url  TEXT,
  admin_note              TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  reviewed_at             TIMESTAMPTZ,
  reviewed_by             UUID REFERENCES profiles(id)
);

ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers see own verifications"
  ON verification_requests FOR SELECT
  USING (
    seller_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator')
  );

CREATE POLICY "Sellers insert own verifications"
  ON verification_requests FOR INSERT
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Admins update verifications"
  ON verification_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrator'));
