-- Add seller-specific fields to profiles table
-- Run once in Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS license_number TEXT;
