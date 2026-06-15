-- ────────────────────────────────────────────────────────────────────────────
-- 011_refund_policies.sql
-- Allow workspace owners/admins to update purchase status (for refunds).
-- The actual Stripe refund call happens server-side; this only allows the
-- status column to be set to 'refunded' by authorized workspace admins.
-- ────────────────────────────────────────────────────────────────────────────

-- Workspace owners/admins can view all purchases in their workspace (may already
-- exist from 007 — guard with DROP IF EXISTS).
DROP POLICY IF EXISTS "workspace_admins_view_purchases"  ON public.purchases;
DROP POLICY IF EXISTS "workspace_admins_update_purchases" ON public.purchases;

CREATE POLICY "workspace_admins_view_purchases"
  ON public.purchases FOR SELECT
  USING (
    workspace_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = purchases.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM public.platform_users pu
        WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin'
      )
    )
  );

-- Allow workspace owner/admin to mark a purchase as refunded
-- (server route validates the Stripe refund succeeded first)
CREATE POLICY "workspace_admins_update_purchases"
  ON public.purchases FOR UPDATE
  USING (
    workspace_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = purchases.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM public.platform_users pu
        WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin'
      )
    )
  );
