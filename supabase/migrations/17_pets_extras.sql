-- Add size, health certificate, and personality traits to pets
ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS size TEXT CHECK (size IN ('small', 'medium', 'large', 'extra_large')),
  ADD COLUMN IF NOT EXISTS health_certificate_url TEXT,
  ADD COLUMN IF NOT EXISTS traits TEXT[] DEFAULT '{}';
