-- ==============================================================================
-- Gaurxv Verse / Stark Protocol: Auto-Confirm Users & Cloud Sync Enablement
-- ==============================================================================

-- 1. Auto-confirm any existing unconfirmed users in auth.users
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmed_at = COALESCE(confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- 2. Trigger function to auto-confirm new users upon sign up (so no email verification required)
CREATE OR REPLACE FUNCTION public.handle_auto_confirm_stark_user()
RETURNS trigger AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := NOW();
  END IF;
  IF NEW.confirmed_at IS NULL THEN
    NEW.confirmed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_auto_confirm_stark_user ON auth.users;
CREATE TRIGGER tr_auto_confirm_stark_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auto_confirm_stark_user();

-- 3. Ensure user_profiles row is automatically created on user creation
CREATE OR REPLACE FUNCTION public.handle_stark_new_user_profile()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name
  WHERE user_profiles.display_name IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_stark_new_user_profile ON auth.users;
CREATE TRIGGER tr_stark_new_user_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_stark_new_user_profile();
