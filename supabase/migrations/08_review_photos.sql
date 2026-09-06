-- Add photo attachment support to reviews
-- Run once in Supabase SQL Editor

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';
