-- ── White Label + Custom Domains ─────────────────────────────────────────────

-- Extend workspace_domains with verification state, primary flag, timestamps
ALTER TABLE public.workspace_domains
  ADD COLUMN IF NOT EXISTS is_primary    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status        TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','failed')),
  ADD COLUMN IF NOT EXISTS verified_at   TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS failed_at     TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Sync existing rows: mark as verified if verified = true
UPDATE public.workspace_domains SET status = 'verified', verified_at = NOW() WHERE verified = TRUE;

-- Extended branding table (beyond what workspace.settings.accent_color holds)
CREATE TABLE IF NOT EXISTS public.workspace_branding (
  workspace_id          UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  -- Visual identity
  academy_name          TEXT DEFAULT NULL,       -- display name override (defaults to workspace.name)
  tagline               TEXT DEFAULT NULL,
  logo_url              TEXT DEFAULT NULL,       -- can differ from workspace.logo_url for Pro overrides
  hero_image_url        TEXT DEFAULT NULL,
  primary_color         TEXT NOT NULL DEFAULT '#1e293b',
  secondary_color       TEXT NOT NULL DEFAULT '#0f172a',
  accent_color          TEXT NOT NULL DEFAULT '#eab308',
  footer_text           TEXT DEFAULT NULL,
  social_links          JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- White label (plan enforcement server-side in API routes)
  hide_powered_by_apex       BOOLEAN NOT NULL DEFAULT FALSE,
  custom_email_branding      BOOLEAN NOT NULL DEFAULT FALSE,
  custom_cert_branding       BOOLEAN NOT NULL DEFAULT FALSE,
  custom_login_branding      BOOLEAN NOT NULL DEFAULT FALSE,
  -- Login page (Pro only)
  login_bg_url               TEXT DEFAULT NULL,
  login_welcome_message      TEXT DEFAULT NULL,
  -- Email customization (Pro only)
  email_from_name            TEXT DEFAULT NULL,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.workspace_branding ENABLE ROW LEVEL SECURITY;

-- Members can read branding (needed to apply CSS vars client-side)
CREATE POLICY "branding_member_read"
  ON public.workspace_branding FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_branding.workspace_id AND wm.user_id = auth.uid())
    -- Also allow anonymous reads for public workspace pages
    OR TRUE
  );

CREATE POLICY "branding_admin_write"
  ON public.workspace_branding FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_branding.workspace_id
        AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin'))
    OR EXISTS (SELECT 1 FROM public.platform_users pu
      WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin')
  );

-- Workspace domain RLS was already set in 003. Add a public read policy for middleware.
-- Wrapped in DO block to avoid error if policy already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'workspace_domains'
      AND policyname = 'domains_public_read'
  ) THEN
    EXECUTE 'CREATE POLICY "domains_public_read"
      ON public.workspace_domains FOR SELECT
      USING (verified = TRUE)';
  END IF;
END $$;
