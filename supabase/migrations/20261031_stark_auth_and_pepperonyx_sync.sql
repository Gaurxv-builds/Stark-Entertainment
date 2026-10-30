-- ==============================================================================
-- Gaurxv Verse / Stark Protocol: Production Database Migration
-- Supabase PostgreSQL Schema, Admin Mapping & Row Level Security (RLS)
-- Target Identity: gaurxv -> gaurav@pepperonyx.dpdns.org
-- ==============================================================================

-- 1. Ensure public schema tables exist
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  frame_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL DEFAULT 'anime',
  item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'watching',
  progress INT NOT NULL DEFAULT 0,
  max_progress INT,
  score NUMERIC(3, 1),
  last_watched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, media_type, item_id)
);

CREATE TABLE IF NOT EXISTS public.user_reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  book_id TEXT NOT NULL,
  title TEXT NOT NULL,
  cover_url TEXT,
  href TEXT,
  resume_url TEXT,
  label TEXT,
  progress NUMERIC(5, 4) NOT NULL DEFAULT 0.0000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, kind, book_id)
);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'dark',
  audio TEXT NOT NULL DEFAULT 'sub',
  max_quality TEXT,
  preferred_server TEXT,
  auto_next BOOLEAN NOT NULL DEFAULT TRUE,
  auto_skip BOOLEAN NOT NULL DEFAULT FALSE,
  skip_filler BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- 3. Configure RLS Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
CREATE POLICY "Users can view their own profile" ON public.user_profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
CREATE POLICY "Users can insert their own profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile" ON public.user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view their own library entries" ON public.user_library;
CREATE POLICY "Users can view their own library entries" ON public.user_library FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own library entries" ON public.user_library;
CREATE POLICY "Users can insert their own library entries" ON public.user_library FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own library entries" ON public.user_library;
CREATE POLICY "Users can update their own library entries" ON public.user_library FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own library entries" ON public.user_library;
CREATE POLICY "Users can delete their own library entries" ON public.user_library FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own reading progress" ON public.user_reading_progress;
CREATE POLICY "Users can view their own reading progress" ON public.user_reading_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own reading progress" ON public.user_reading_progress;
CREATE POLICY "Users can insert their own reading progress" ON public.user_reading_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own reading progress" ON public.user_reading_progress;
CREATE POLICY "Users can update their own reading progress" ON public.user_reading_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own reading progress" ON public.user_reading_progress;
CREATE POLICY "Users can delete their own reading progress" ON public.user_reading_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;
CREATE POLICY "Users can view their own preferences" ON public.user_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences" ON public.user_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
CREATE POLICY "Users can update their own preferences" ON public.user_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Map administrator account gaurav@pepperonyx.dpdns.org and set is_admin: true
UPDATE auth.users
SET email = 'gaurav@pepperonyx.dpdns.org',
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{is_admin}', 'true'::jsonb),
    raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{is_admin}', 'true'::jsonb)
WHERE email = 'gaurxv@gaurxv.eu.org' OR id = '8ada173c-a3a9-435e-8099-26d869193bf1';
