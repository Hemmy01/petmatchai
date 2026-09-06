-- Migration: add notification_prefs JSONB column to profiles
-- Run this in the Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"new_matches":true,"messages":true,"price_changes":true,"new_listings":true,"channel_inapp":true,"channel_email":true,"channel_sms":false}'::jsonb;
