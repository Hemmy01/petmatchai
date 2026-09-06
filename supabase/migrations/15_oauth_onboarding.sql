-- ============================================================
-- OAuth onboarding: let social-login users pick buyer/seller
-- ============================================================
-- Run once in the Supabase SQL editor.

-- 1. Track whether a user has chosen their role yet.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Existing users already have a role — don't force them through onboarding.
UPDATE profiles SET onboarded = TRUE WHERE onboarded = FALSE;

-- 3. Email/password signups send a role in metadata → onboarded immediately.
--    OAuth signups (Google/Facebook) have no role → onboarded = FALSE so the
--    app routes them to /auth/select-role to choose buyer or seller.
-- NOTE: SET search_path + schema-qualified public.profiles are REQUIRED. GoTrue
-- runs this trigger as supabase_auth_admin (search_path = auth), so an unqualified
-- `profiles` would resolve to auth.profiles and break signup.
-- The definitive version of this function lives in supabase-role-protection.sql.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, onboarded)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer'),
    (NEW.raw_user_meta_data->>'role') IS NOT NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
