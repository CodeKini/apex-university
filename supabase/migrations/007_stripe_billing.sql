-- ────────────────────────────────────────────────────────────────────────────
-- 007_stripe_billing.sql
-- The purchases table already exists in the base schema with columns:
--   stripe_session_id, stripe_payment_intent
-- This migration adds the missing columns needed for multi-tenant billing.
-- ────────────────────────────────────────────────────────────────────────────

-- ── workspaces: add stripe_price_id for tracking which plan price is active ──
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- ── purchases: add workspace_id so we can scope purchases per workspace ───────
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Index for workspace-scoped purchase queries
CREATE INDEX IF NOT EXISTS purchases_workspace_idx ON public.purchases(workspace_id);

-- ── RLS on purchases (table exists; just add policies) ───────────────────────
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Drop policies first so this migration is re-runnable
DROP POLICY IF EXISTS "students_view_own_purchases"      ON public.purchases;
DROP POLICY IF EXISTS "workspace_admins_view_purchases"  ON public.purchases;

-- Students can view their own purchases
CREATE POLICY "students_view_own_purchases"
  ON public.purchases FOR SELECT
  USING (user_id = auth.uid());

-- Workspace owners/admins can view all purchases in their workspace
CREATE POLICY "workspace_admins_view_purchases"
  ON public.purchases FOR SELECT
  USING (
    workspace_id IS NOT NULL
    AND is_workspace_admin(workspace_id)
  );
-- Service role bypasses RLS for INSERT/UPDATE (webhook uses createServiceRoleClient)
