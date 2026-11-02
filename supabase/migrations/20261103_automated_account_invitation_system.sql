-- Migration: Automated Account Request, Telegram Admin Approval & Brevo Email Invitation System
-- Adds invitation lifecycle columns to account_requests and installs complete_user_invitation RPC.

ALTER TABLE public.account_requests 
  ADD COLUMN IF NOT EXISTS request_reference text,
  ADD COLUMN IF NOT EXISTS selected_access_policy text,
  ADD COLUMN IF NOT EXISTS custom_duration_days integer,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS invitation_token text,
  ADD COLUMN IF NOT EXISTS invitation_sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS invitation_accepted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS invitation_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

UPDATE public.account_requests 
SET request_reference = 'REQ-' || UPPER(SUBSTRING(id::text FROM 1 FOR 8)) 
WHERE request_reference IS NULL;

-- 2. Update status constraint to allow full invitation lifecycle
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_requests_status_check') THEN
    ALTER TABLE public.account_requests DROP CONSTRAINT account_requests_status_check;
  END IF;

  ALTER TABLE public.account_requests ADD CONSTRAINT account_requests_status_check 
    CHECK (status IN (
      'pending', 
      'pending_review', 
      'approved_policy_pending', 
      'invite_sent', 
      'invite_accepted', 
      'invitation_expired', 
      'approved', 
      'rejected'
    ));
END $$;

-- 3. RLS Policies: Allow UPDATE and DELETE for account_requests
DROP POLICY IF EXISTS "Public account_requests update" ON public.account_requests;
CREATE POLICY "Public account_requests update" ON public.account_requests FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public account_requests delete" ON public.account_requests;
CREATE POLICY "Public account_requests delete" ON public.account_requests FOR DELETE USING (true);

-- Function: complete_user_invitation
-- Securely activates an invited user with their chosen password, synchronizes auth.users, user_profiles, user_access, and user_settings.
CREATE OR REPLACE FUNCTION public.complete_user_invitation(
  p_token text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_req record;
  v_user_id uuid;
  v_existing_auth_id uuid;
  v_existing_ua_id uuid;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation token is required.');
  END IF;

  IF p_password IS NULL OR length(trim(p_password)) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters.');
  END IF;

  -- 1. Locate valid invitation in account_requests
  SELECT * INTO v_req
  FROM public.account_requests
  WHERE invitation_token = trim(p_token)
    AND status = 'invite_sent'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or already accepted invitation link.');
  END IF;

  IF v_req.invitation_expires_at IS NOT NULL AND v_req.invitation_expires_at < now() THEN
    UPDATE public.account_requests SET status = 'invitation_expired' WHERE id = v_req.id;
    RETURN jsonb_build_object('success', false, 'error', 'This invitation link has expired. Please contact the administrator or request a new invitation.');
  END IF;

  -- 2. Check if auth.users already has an entry for this personal email
  SELECT id INTO v_existing_auth_id
  FROM auth.users
  WHERE lower(email) = lower(v_req.email);

  IF v_existing_auth_id IS NOT NULL THEN
    v_user_id := v_existing_auth_id;
    UPDATE auth.users
    SET encrypted_password = crypt(p_password, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = jsonb_build_object('full_name', v_req.full_name, 'username', v_req.username),
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      lower(v_req.email),
      crypt(p_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_req.full_name, 'username', v_req.username),
      now(),
      now()
    );

    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at,
      email
    ) VALUES (
      gen_random_uuid(),
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', lower(v_req.email), 'full_name', v_req.full_name, 'username', v_req.username),
      'email',
      now(),
      now(),
      now(),
      lower(v_req.email)
    );
  END IF;

  -- 3. Upsert into public.user_profiles
  INSERT INTO public.user_profiles (id, display_name, avatar_url, updated_at)
  VALUES (
    v_user_id,
    COALESCE(v_req.full_name, v_req.username),
    'https://anime-lok-assets.pages.dev/avatars/649.jpg',
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, public.user_profiles.display_name),
    updated_at = now();

  -- 4. Upsert into public.user_access
  SELECT id INTO v_existing_ua_id
  FROM public.user_access
  WHERE lower(email) = lower(v_req.email) OR lower(username) = lower(v_req.username)
  LIMIT 1;

  IF v_existing_ua_id IS NOT NULL THEN
    UPDATE public.user_access
    SET user_id = v_user_id::text,
        username = v_req.username,
        email = lower(v_req.email),
        access_policy = COALESCE(v_req.selected_access_policy, 'trial'),
        is_lifetime = (v_req.selected_access_policy = 'lifetime'),
        is_suspended = false,
        updated_at = now()
    WHERE id = v_existing_ua_id;
  ELSE
    INSERT INTO public.user_access (
      user_id,
      username,
      email,
      access_policy,
      is_lifetime,
      is_suspended,
      trial_started_at,
      trial_expires_at,
      custom_expires_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id::text,
      v_req.username,
      lower(v_req.email),
      COALESCE(v_req.selected_access_policy, 'trial'),
      (v_req.selected_access_policy = 'lifetime'),
      false,
      NULL,
      NULL,
      CASE WHEN v_req.selected_access_policy = 'custom' AND v_req.custom_duration_days > 0 
           THEN (now() + (v_req.custom_duration_days || ' days')::interval)
           ELSE NULL END,
      now(),
      now()
    );
  END IF;

  -- 5. Upsert into public.user_settings
  INSERT INTO public.user_settings (user_id, settings_json, sync_version, updated_at)
  VALUES (v_user_id::text, '{}'::jsonb, 1, now())
  ON CONFLICT (user_id) DO NOTHING;

  -- 6. Mark account_requests as invite_accepted
  UPDATE public.account_requests
  SET status = 'invite_accepted',
      invitation_accepted_at = now(),
      auth_user_id = v_user_id,
      invitation_token = NULL,
      updated_at = now()
  WHERE id = v_req.id;

  RETURN jsonb_build_object(
    'success', true,
    'userId', v_user_id,
    'email', lower(v_req.email),
    'username', v_req.username,
    'fullName', v_req.full_name,
    'accessPolicy', v_req.selected_access_policy
  );
END;
$$;
