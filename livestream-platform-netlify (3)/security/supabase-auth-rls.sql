-- ============================================================================
-- FYC Live Ops — Secure Supabase Auth + RLS migration
-- ============================================================================
-- IMPORTANT
-- 1) Provision users in Supabase Authentication first.
-- 2) Map each Auth user UUID to public.sub_accounts.auth_user_id.
-- 3) Test with an authenticated browser session.
-- 4) Only then run the policy replacement section below.
--
-- This migration intentionally removes public anon database access.
-- ============================================================================

BEGIN;

ALTER TABLE public.sub_accounts
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE
  REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.sub_accounts
  ALTER COLUMN pin SET DEFAULT '';

-- In secure Auth mode, PIN switching is redundant and short PIN hashes should
-- not be replicated to authenticated clients.
UPDATE public.sub_accounts SET pin = '';

CREATE OR REPLACE FUNCTION public.fyc_is_member()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sub_accounts
    WHERE auth_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.fyc_has_permission(permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE permission_name
      WHEN 'grade' THEN "canGrade"
      WHEN 'rates' THEN "canManageRates"
      WHEN 'accounts' THEN "canManageAccounts"
      WHEN 'payroll' THEN "canApprovePayroll"
      WHEN 'weights' THEN "canEditWeights"
      ELSE FALSE
    END
    FROM public.sub_accounts
    WHERE auth_user_id = auth.uid()
    LIMIT 1
  ), FALSE);
$$;

REVOKE ALL ON FUNCTION public.fyc_is_member() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fyc_has_permission(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fyc_is_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fyc_has_permission(TEXT) TO authenticated;

ALTER TABLE public.sub_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_rates ENABLE ROW LEVEL SECURITY;

-- Remove legacy open policies.
DROP POLICY IF EXISTS "Allow public anon access for sub_accounts" ON public.sub_accounts;
DROP POLICY IF EXISTS "Allow public anon access for host_assessments" ON public.host_assessments;
DROP POLICY IF EXISTS "Allow public anon access for host_rates" ON public.host_rates;

-- Remove previous secure policies so this migration can be safely re-run.
DROP POLICY IF EXISTS "Team can read own account or admins can read all" ON public.sub_accounts;
DROP POLICY IF EXISTS "Admins can insert accounts" ON public.sub_accounts;
DROP POLICY IF EXISTS "Admins can update accounts" ON public.sub_accounts;
DROP POLICY IF EXISTS "Admins can delete accounts" ON public.sub_accounts;
DROP POLICY IF EXISTS "Members can read assessments" ON public.host_assessments;
DROP POLICY IF EXISTS "Evaluators can insert assessments" ON public.host_assessments;
DROP POLICY IF EXISTS "Evaluators can update assessments" ON public.host_assessments;
DROP POLICY IF EXISTS "Evaluators can delete assessments" ON public.host_assessments;
DROP POLICY IF EXISTS "Members can read host rates" ON public.host_rates;
DROP POLICY IF EXISTS "Rate managers can insert host rates" ON public.host_rates;
DROP POLICY IF EXISTS "Rate managers can update host rates" ON public.host_rates;
DROP POLICY IF EXISTS "Rate managers can delete host rates" ON public.host_rates;

-- Sub-accounts: users can read themselves; account admins can read/manage all.
CREATE POLICY "Team can read own account or admins can read all"
ON public.sub_accounts
FOR SELECT
TO authenticated
USING (
  auth_user_id = auth.uid()
  OR public.fyc_has_permission('accounts')
);

CREATE POLICY "Admins can insert accounts"
ON public.sub_accounts
FOR INSERT
TO authenticated
WITH CHECK (public.fyc_has_permission('accounts'));

CREATE POLICY "Admins can update accounts"
ON public.sub_accounts
FOR UPDATE
TO authenticated
USING (public.fyc_has_permission('accounts'))
WITH CHECK (public.fyc_has_permission('accounts'));

CREATE POLICY "Admins can delete accounts"
ON public.sub_accounts
FOR DELETE
TO authenticated
USING (public.fyc_has_permission('accounts'));

-- Assessments: all team members may read; evaluators may mutate.
CREATE POLICY "Members can read assessments"
ON public.host_assessments
FOR SELECT
TO authenticated
USING (public.fyc_is_member());

CREATE POLICY "Evaluators can insert assessments"
ON public.host_assessments
FOR INSERT
TO authenticated
WITH CHECK (public.fyc_has_permission('grade'));

CREATE POLICY "Evaluators can update assessments"
ON public.host_assessments
FOR UPDATE
TO authenticated
USING (public.fyc_has_permission('grade'))
WITH CHECK (public.fyc_has_permission('grade'));

CREATE POLICY "Evaluators can delete assessments"
ON public.host_assessments
FOR DELETE
TO authenticated
USING (public.fyc_has_permission('grade'));

-- Rate cards: all team members may read; rate managers may mutate.
CREATE POLICY "Members can read host rates"
ON public.host_rates
FOR SELECT
TO authenticated
USING (public.fyc_is_member());

CREATE POLICY "Rate managers can insert host rates"
ON public.host_rates
FOR INSERT
TO authenticated
WITH CHECK (public.fyc_has_permission('rates'));

CREATE POLICY "Rate managers can update host rates"
ON public.host_rates
FOR UPDATE
TO authenticated
USING (public.fyc_has_permission('rates'))
WITH CHECK (public.fyc_has_permission('rates'));

CREATE POLICY "Rate managers can delete host rates"
ON public.host_rates
FOR DELETE
TO authenticated
USING (public.fyc_has_permission('rates'));

COMMIT;

-- ============================================================================
-- Mapping example (replace values):
-- UPDATE public.sub_accounts
-- SET auth_user_id = '00000000-0000-0000-0000-000000000000'
-- WHERE id = 'acc_afiq';
-- ============================================================================
