-- Migration: Stark Entertainment Subscription, Access Management & Payment Verification
-- Target: Supabase Postgres (project: tfykttkuoohjyjvrjxop)

CREATE TABLE IF NOT EXISTS public.user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  email TEXT,
  access_policy TEXT NOT NULL DEFAULT 'trial' CHECK (access_policy IN ('trial', 'lifetime', 'custom', 'subscription_required')),
  trial_started_at TIMESTAMPTZ,
  trial_expires_at TIMESTAMPTZ,
  custom_expires_at TIMESTAMPTZ,
  is_lifetime BOOLEAN NOT NULL DEFAULT false,
  is_exempt BOOLEAN NOT NULL DEFAULT false,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended', 'cancelled')),
  plan_name TEXT NOT NULL DEFAULT 'Stark 30-Day Premium',
  amount NUMERIC(10, 2) NOT NULL DEFAULT 29.00,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_reference TEXT NOT NULL,
  user_id TEXT,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 29.00,
  utr_reference TEXT NOT NULL UNIQUE,
  screenshot_url TEXT,
  screenshot_base64 TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user TEXT NOT NULL,
  target_user TEXT,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.account_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_user_access_user_id ON public.user_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_username ON public.user_access(username);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_utr ON public.payment_proofs(utr_reference);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON public.payment_proofs(verification_status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_requests ENABLE ROW LEVEL SECURITY;

-- Permissive RLS policies (allow authenticated & service role, user self-service read)
CREATE POLICY "Public user_access read" ON public.user_access FOR SELECT USING (true);
CREATE POLICY "Public user_access write" ON public.user_access FOR ALL USING (true);

CREATE POLICY "Public subscriptions read" ON public.subscriptions FOR SELECT USING (true);
CREATE POLICY "Public subscriptions write" ON public.subscriptions FOR ALL USING (true);

CREATE POLICY "Public payment_proofs insert" ON public.payment_proofs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public payment_proofs select" ON public.payment_proofs FOR SELECT USING (true);
CREATE POLICY "Public payment_proofs update" ON public.payment_proofs FOR UPDATE USING (true);

CREATE POLICY "Public admin_audit_logs all" ON public.admin_audit_logs FOR ALL USING (true);

CREATE POLICY "Public account_requests insert" ON public.account_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Public account_requests select" ON public.account_requests FOR SELECT USING (true);

-- Seed Administrator Lifetime Access
INSERT INTO public.user_access (user_id, username, email, access_policy, is_lifetime, is_exempt)
VALUES 
  ('8ada173c-a3a9-435e-8099-26d869193bf1', 'gaurxv', 'gaurav@pepperonyx.dpdns.org', 'lifetime', true, true)
ON CONFLICT (user_id) DO UPDATE SET is_lifetime = true, is_exempt = true, access_policy = 'lifetime';
