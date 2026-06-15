-- 017_coupons.sql
-- Coupon codes and promotions for workspace course purchases.

-- ── coupons ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coupons (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id         UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  code                 TEXT NOT NULL CHECK (length(code) >= 1 AND length(code) <= 50),
  discount_type        TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value       NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  -- applies_to: 'all' = all paid courses in workspace, 'specific' = course_ids list
  applies_to           TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all','specific')),
  course_ids           UUID[] DEFAULT NULL,           -- only used when applies_to='specific'
  max_redemptions      INT  DEFAULT NULL CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  per_user_limit       INT  NOT NULL DEFAULT 1 CHECK (per_user_limit >= 1),
  redemption_count     INT  NOT NULL DEFAULT 0,
  starts_at            TIMESTAMPTZ DEFAULT NULL,
  expires_at           TIMESTAMPTZ DEFAULT NULL,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (workspace_id, code)
);

-- ── coupon_redemptions — per-user usage log ───────────────────────────────────

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id    UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  purchase_id  UUID REFERENCES purchases(id) ON DELETE SET NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  discount_applied_cents INT NOT NULL,  -- actual dollar discount given (cents)
  original_cents         INT NOT NULL,
  final_cents            INT NOT NULL,
  redeemed_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── Add coupon columns to purchases ──────────────────────────────────────────

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS coupon_id           UUID REFERENCES coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code         TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS original_amount_cents INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_cents      INT DEFAULT NULL;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_coupons_workspace
  ON coupons(workspace_id, is_active, code);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon
  ON coupon_redemptions(coupon_id, user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_purchase
  ON coupon_redemptions(purchase_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE coupons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- coupons: workspace managers can fully manage
CREATE POLICY "managers can manage coupons"
  ON coupons FOR ALL
  USING (
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = coupons.workspace_id
        AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

-- coupons: authenticated members can read active coupons (needed for validation UX)
-- NOTE: validation API does server-side checks; this just allows the fetch
CREATE POLICY "members can read active coupons"
  ON coupons FOR SELECT
  USING (
    is_active = TRUE AND
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = coupons.workspace_id AND user_id = auth.uid())
  );

-- coupon_redemptions: users see their own
CREATE POLICY "users view own redemptions"
  ON coupon_redemptions FOR SELECT
  USING (user_id = auth.uid());

-- coupon_redemptions: managers see workspace redemptions
CREATE POLICY "managers view workspace redemptions"
  ON coupon_redemptions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = coupon_redemptions.workspace_id
        AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

-- coupon_redemptions: service role inserts
CREATE POLICY "service role inserts redemptions"
  ON coupon_redemptions FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "service role updates redemptions"
  ON coupon_redemptions FOR UPDATE USING (TRUE);

-- ── Helper function for atomic redemption count increment ─────────────────────

CREATE OR REPLACE FUNCTION increment_coupon_redemption(coupon_id_input UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE coupons
  SET redemption_count = redemption_count + 1,
      updated_at       = NOW()
  WHERE id = coupon_id_input;
$$;
