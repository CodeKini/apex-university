-- ────────────────────────────────────────────────────────────────────────────
-- 010_email_events.sql
-- Audit log for all transactional emails sent through the platform.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  recipient_email text        NOT NULL,
  recipient_name  text,
  template        text        NOT NULL,  -- e.g. 'creator_welcome', 'paid_receipt'
  resend_id       text,                  -- ID returned by Resend API
  status          text        NOT NULL DEFAULT 'sent', -- 'sent' | 'failed'
  error           text,                  -- error message when status='failed'
  metadata        jsonb       DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_events_workspace_idx  ON public.email_events(workspace_id);
CREATE INDEX email_events_template_idx   ON public.email_events(template);
CREATE INDEX email_events_recipient_idx  ON public.email_events(recipient_email);
CREATE INDEX email_events_created_at_idx ON public.email_events(created_at DESC);

-- RLS: platform admins can read all; workspace owners/admins can read their own
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_events_platform_admin_all"
  ON public.email_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE id = auth.uid() AND platform_role = 'platform_admin'
    )
  );

CREATE POLICY "email_events_workspace_owner_read"
  ON public.email_events FOR SELECT
  USING (
    workspace_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = email_events.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );
