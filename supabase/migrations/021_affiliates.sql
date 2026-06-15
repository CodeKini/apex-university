-- ── Affiliate System ──────────────────────────────────────────────────────────

-- Per-workspace affiliate program settings (stored in workspaces.settings OR separate table)
CREATE TABLE IF NOT EXISTS public.affiliate_programs (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id         UUID        NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  is_enabled           BOOLEAN     NOT NULL DEFAULT FALSE,
  commission_pct       NUMERIC(5,2) NOT NULL DEFAULT 20.00 CHECK (commission_pct >= 0 AND commission_pct <= 100),
  cookie_duration_days INT         NOT NULL DEFAULT 30 CHECK (cookie_duration_days >= 1),
  approval_required    BOOLEAN     NOT NULL DEFAULT TRUE,
  payout_notes         TEXT        DEFAULT NULL,  -- e.g. "PayPal only, min $50"
  created_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Affiliates (one per user per workspace)
CREATE TABLE IF NOT EXISTS public.affiliates (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id    UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
  referral_code   TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','suspended')),
  rejection_note  TEXT        DEFAULT NULL,
  applied_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  approved_at     TIMESTAMPTZ DEFAULT NULL,
  total_clicks    INT         NOT NULL DEFAULT 0,
  total_signups   INT         NOT NULL DEFAULT 0,
  total_purchases INT         NOT NULL DEFAULT 0,
  total_earned_cents INT      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (workspace_id, user_id),
  UNIQUE (workspace_id, referral_code)
);

CREATE INDEX IF NOT EXISTS idx_affiliates_workspace ON public.affiliates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code      ON public.affiliates(referral_code);

-- Referral click events
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id  UUID        NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  workspace_id  UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ip_hash       TEXT        DEFAULT NULL,  -- hashed for privacy
  user_agent    TEXT        DEFAULT NULL,
  landing_path  TEXT        DEFAULT NULL,
  clicked_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_affiliate ON public.affiliate_clicks(affiliate_id);

-- Commissions
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id        UUID        NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  workspace_id        UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  purchase_id         UUID        REFERENCES public.purchases(id) ON DELETE SET NULL,
  referred_user_id    UUID        REFERENCES public.platform_users(id) ON DELETE SET NULL,
  source_type         TEXT        NOT NULL DEFAULT 'course'
    CHECK (source_type IN ('course','membership')),
  purchase_amount_cents INT       NOT NULL DEFAULT 0,
  commission_pct      NUMERIC(5,2) NOT NULL,
  commission_cents    INT         NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','paid','rejected')),
  rejection_reason    TEXT        DEFAULT NULL,
  approved_at         TIMESTAMPTZ DEFAULT NULL,
  paid_at             TIMESTAMPTZ DEFAULT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commissions_affiliate  ON public.affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_purchase   ON public.affiliate_commissions(purchase_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status     ON public.affiliate_commissions(status);

-- Payout records (one per batch payment to an affiliate)
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id    UUID        NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  workspace_id    UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  amount_cents    INT         NOT NULL,
  note            TEXT        DEFAULT NULL,
  paid_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate ON public.affiliate_payouts(affiliate_id);

-- Track which user signed up via which affiliate (persisted from cookie at signup)
ALTER TABLE public.platform_users
  ADD COLUMN IF NOT EXISTS referred_by_affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE SET NULL;

-- Atomic counter helpers
CREATE OR REPLACE FUNCTION increment_affiliate_clicks(p_affiliate_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.affiliates SET total_clicks = total_clicks + 1, updated_at = NOW() WHERE id = p_affiliate_id;
$$;

CREATE OR REPLACE FUNCTION increment_affiliate_signups(p_affiliate_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.affiliates SET total_signups = total_signups + 1, updated_at = NOW() WHERE id = p_affiliate_id;
$$;

CREATE OR REPLACE FUNCTION increment_affiliate_purchase(p_affiliate_id UUID, p_commission_cents INT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.affiliates
    SET total_purchases   = total_purchases + 1,
        total_earned_cents = total_earned_cents + p_commission_cents,
        updated_at        = NOW()
    WHERE id = p_affiliate_id;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.affiliate_programs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts     ENABLE ROW LEVEL SECURITY;

-- affiliate_programs: workspace admins manage; public read for enabled check
CREATE POLICY "affiliate_prog_admin"
  ON public.affiliate_programs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = affiliate_programs.workspace_id
        AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin'))
    OR EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin')
  );

CREATE POLICY "affiliate_prog_public_read"
  ON public.affiliate_programs FOR SELECT
  USING (is_enabled = true);

-- affiliates: admins see all in workspace; users see own
CREATE POLICY "affiliates_admin_all"
  ON public.affiliates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = affiliates.workspace_id
        AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin'))
    OR EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin')
  );

CREATE POLICY "affiliates_own"
  ON public.affiliates FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "affiliates_insert_own"
  ON public.affiliates FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- affiliate_clicks: insert from API; admins read
CREATE POLICY "affiliate_clicks_admin_read"
  ON public.affiliate_clicks FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = affiliate_clicks.workspace_id
        AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin'))
  );

CREATE POLICY "affiliate_clicks_insert"
  ON public.affiliate_clicks FOR INSERT WITH CHECK (true);

-- commissions: affiliates see own; admins see all
CREATE POLICY "commissions_admin_all"
  ON public.affiliate_commissions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = affiliate_commissions.workspace_id
        AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin'))
    OR EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin')
  );

CREATE POLICY "commissions_own_read"
  ON public.affiliate_commissions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_commissions.affiliate_id AND a.user_id = auth.uid())
  );

-- payouts: affiliates see own; admins see all
CREATE POLICY "payouts_admin_all"
  ON public.affiliate_payouts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = affiliate_payouts.workspace_id
        AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin'))
    OR EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin')
  );

CREATE POLICY "payouts_own_read"
  ON public.affiliate_payouts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_payouts.affiliate_id AND a.user_id = auth.uid())
  );
