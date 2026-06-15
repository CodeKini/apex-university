-- 018_memberships.sql
-- Workspace membership tiers: recurring subscriptions granting access to
-- courses, learning paths, community, and resource library.

-- ── membership_tiers ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS membership_tiers (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id           UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 100),
  description            TEXT,
  monthly_price          NUMERIC(10,2) NOT NULL CHECK (monthly_price >= 0),
  yearly_price           NUMERIC(10,2)           CHECK (yearly_price IS NULL OR yearly_price >= 0),
  benefits               TEXT[] DEFAULT '{}',
  -- included access flags
  community_access       BOOLEAN NOT NULL DEFAULT FALSE,
  resource_library_access BOOLEAN NOT NULL DEFAULT FALSE,
  -- included courses and paths (NULL = none; override with explicit IDs)
  included_course_ids    UUID[] DEFAULT '{}',
  included_path_ids      UUID[]  DEFAULT '{}',
  -- Stripe price IDs created dynamically when tier is saved
  stripe_monthly_price_id TEXT DEFAULT NULL,
  stripe_yearly_price_id  TEXT DEFAULT NULL,
  stripe_product_id       TEXT DEFAULT NULL,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  position               INT NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at             TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── member_subscriptions ──────────────────────────────────────────────────────
-- One row per student per workspace membership. Updated by Stripe webhooks.

CREATE TABLE IF NOT EXISTS member_subscriptions (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  tier_id                 UUID NOT NULL REFERENCES membership_tiers(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT DEFAULT NULL,
  stripe_subscription_id  TEXT DEFAULT NULL UNIQUE,
  stripe_price_id         TEXT DEFAULT NULL,
  interval                TEXT NOT NULL DEFAULT 'month' CHECK (interval IN ('month','year')),
  status                  TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','trialing','past_due','canceled','incomplete','paused')),
  current_period_start    TIMESTAMPTZ DEFAULT NULL,
  current_period_end      TIMESTAMPTZ DEFAULT NULL,
  canceled_at             TIMESTAMPTZ DEFAULT NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (workspace_id, user_id)  -- one active membership per workspace
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_membership_tiers_workspace
  ON membership_tiers(workspace_id, is_active, position);
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_workspace
  ON member_subscriptions(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_user
  ON member_subscriptions(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_stripe
  ON member_subscriptions(stripe_subscription_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE membership_tiers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_subscriptions  ENABLE ROW LEVEL SECURITY;

-- membership_tiers: anyone in workspace can read active tiers (for the join page)
CREATE POLICY "members read active tiers"
  ON membership_tiers FOR SELECT
  USING (
    is_active = TRUE AND
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = membership_tiers.workspace_id AND user_id = auth.uid())
  );

-- managers read all tiers (including inactive)
CREATE POLICY "managers read all tiers"
  ON membership_tiers FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = membership_tiers.workspace_id
        AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

-- public can read active tiers (so non-logged-in students see the membership page)
CREATE POLICY "public read active tiers"
  ON membership_tiers FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "managers manage tiers"
  ON membership_tiers FOR ALL
  USING (
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = membership_tiers.workspace_id
        AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

-- member_subscriptions: users see own subscription
CREATE POLICY "users view own subscription"
  ON member_subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- managers view all workspace subscriptions
CREATE POLICY "managers view workspace subscriptions"
  ON member_subscriptions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = member_subscriptions.workspace_id
        AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

-- Service role (webhook) inserts/updates
CREATE POLICY "service role manages subscriptions"
  ON member_subscriptions FOR ALL USING (TRUE);
