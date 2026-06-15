-- ────────────────────────────────────────────────────────────────────────────
-- 012_admin_panel.sql
-- Admin audit log + RLS policies for platform_admin access to all tables.
-- ────────────────────────────────────────────────────────────────────────────

-- ── Admin action audit log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid        NOT NULL REFERENCES public.platform_users(id) ON DELETE SET NULL,
  action        text        NOT NULL,  -- e.g. 'suspend_workspace', 'reactivate_workspace'
  target_type   text        NOT NULL,  -- 'workspace' | 'user' | 'purchase'
  target_id     uuid,
  metadata      jsonb       DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_log_admin_idx   ON public.admin_audit_log(admin_id);
CREATE INDEX admin_audit_log_action_idx  ON public.admin_audit_log(action);
CREATE INDEX admin_audit_log_created_idx ON public.admin_audit_log(created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_audit_platform_admin_only"
  ON public.admin_audit_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE id = auth.uid() AND platform_role = 'platform_admin'
    )
  );

-- ── Add suspended flag to workspaces ─────────────────────────────────────────
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS suspended_at  timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by  uuid REFERENCES public.platform_users(id) ON DELETE SET NULL;

-- ── Add suspended flag to platform_users ─────────────────────────────────────
ALTER TABLE public.platform_users
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- ── RLS: platform_admin reads everything ─────────────────────────────────────

-- workspaces
DROP POLICY IF EXISTS "platform_admin_all_workspaces" ON public.workspaces;
CREATE POLICY "platform_admin_all_workspaces"
  ON public.workspaces FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE id = auth.uid() AND platform_role = 'platform_admin'
    )
  );

-- platform_users
DROP POLICY IF EXISTS "platform_admin_all_platform_users" ON public.platform_users;
CREATE POLICY "platform_admin_all_platform_users"
  ON public.platform_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin'
    )
  );

-- purchases
DROP POLICY IF EXISTS "platform_admin_all_purchases" ON public.purchases;
CREATE POLICY "platform_admin_all_purchases"
  ON public.purchases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE id = auth.uid() AND platform_role = 'platform_admin'
    )
  );

-- email_events
DROP POLICY IF EXISTS "email_events_platform_admin_all" ON public.email_events;
CREATE POLICY "email_events_platform_admin_all"
  ON public.email_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE id = auth.uid() AND platform_role = 'platform_admin'
    )
  );

-- enrollments
DROP POLICY IF EXISTS "platform_admin_all_enrollments" ON public.enrollments;
CREATE POLICY "platform_admin_all_enrollments"
  ON public.enrollments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE id = auth.uid() AND platform_role = 'platform_admin'
    )
  );

-- courses
DROP POLICY IF EXISTS "platform_admin_all_courses" ON public.courses;
CREATE POLICY "platform_admin_all_courses"
  ON public.courses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE id = auth.uid() AND platform_role = 'platform_admin'
    )
  );
