-- ============================================================
-- Role-escalation protection (search_path-safe)
-- ============================================================
-- Closes two privilege-escalation vectors:
--   (a) a user updating their own profile row to role='administrator'
--   (b) a crafted signup passing role='administrator' in auth metadata
-- Admin role assignment remains possible only via the service-role key
-- (the admin panel's createAdminClient), which bypasses these as intended.
--
-- IMPORTANT: both functions are SECURITY DEFINER and pin `SET search_path`.
-- GoTrue runs as supabase_auth_admin, whose search_path is `auth` (not public).
-- Without the pin + schema-qualified table names, the signup trigger resolves
-- `profiles` to `auth.profiles`, which doesn't exist → "Database error creating
-- new user". This was the cause of social/email signups failing.
-- Run once in the Supabase SQL editor.

-- 1. Signup trigger: only ever accept 'buyer'/'seller' from user metadata.
--    Anything else (including a forged 'administrator') falls back to 'buyer'.
--    onboarded = true only when a valid role was supplied (email/password signup);
--    OAuth signups have no role → onboarded = false → routed to /auth/select-role.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  requested_role TEXT := NEW.raw_user_meta_data->>'role';
  -- COALESCE guards the NULL case: `NULL IN (...)` is NULL, and `onboarded` is
  -- NOT NULL, so without this an OAuth signup (no role metadata) fails the insert.
  valid_role BOOLEAN := COALESCE(requested_role IN ('buyer', 'seller'), FALSE);
BEGIN
  INSERT INTO public.profiles (id, email, name, role, onboarded)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    CASE WHEN valid_role THEN requested_role ELSE 'buyer' END,
    valid_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. Block a user from promoting THEMSELVES to administrator on update.
--    auth.uid() is the caller; for the service-role client it is NULL, so admin
--    tooling that assigns roles is unaffected. Switching buyer<->seller is allowed.
CREATE OR REPLACE FUNCTION enforce_role_safety()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NEW.role = 'administrator'
     AND auth.uid() = NEW.id THEN
    RAISE EXCEPTION 'You cannot assign yourself the administrator role.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_role ON profiles;
CREATE TRIGGER protect_profile_role
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_role_safety();
