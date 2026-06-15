-- ── Gamification System ──────────────────────────────────────────────────────

-- Per-workspace XP settings
CREATE TABLE IF NOT EXISTS public.xp_settings (
  workspace_id        UUID    PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  -- XP amounts per event
  xp_complete_lesson  INT NOT NULL DEFAULT 10  CHECK (xp_complete_lesson  >= 0),
  xp_pass_quiz        INT NOT NULL DEFAULT 25  CHECK (xp_pass_quiz        >= 0),
  xp_complete_course  INT NOT NULL DEFAULT 100 CHECK (xp_complete_course  >= 0),
  xp_earn_certificate INT NOT NULL DEFAULT 150 CHECK (xp_earn_certificate >= 0),
  xp_complete_path    INT NOT NULL DEFAULT 200 CHECK (xp_complete_path    >= 0),
  xp_community_post   INT NOT NULL DEFAULT 5   CHECK (xp_community_post   >= 0),
  xp_receive_reaction INT NOT NULL DEFAULT 2   CHECK (xp_receive_reaction >= 0),
  xp_refer_purchase   INT NOT NULL DEFAULT 500 CHECK (xp_refer_purchase   >= 0),
  xp_daily_streak     INT NOT NULL DEFAULT 15  CHECK (xp_daily_streak     >= 0),
  -- Toggle individual events
  ev_complete_lesson  BOOLEAN NOT NULL DEFAULT TRUE,
  ev_pass_quiz        BOOLEAN NOT NULL DEFAULT TRUE,
  ev_complete_course  BOOLEAN NOT NULL DEFAULT TRUE,
  ev_earn_certificate BOOLEAN NOT NULL DEFAULT TRUE,
  ev_complete_path    BOOLEAN NOT NULL DEFAULT TRUE,
  ev_community_post   BOOLEAN NOT NULL DEFAULT TRUE,
  ev_receive_reaction BOOLEAN NOT NULL DEFAULT TRUE,
  ev_refer_purchase   BOOLEAN NOT NULL DEFAULT TRUE,
  ev_daily_streak     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- All XP award events (append-only ledger)
CREATE TABLE IF NOT EXISTS public.xp_ledger (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
  event_type    TEXT        NOT NULL
    CHECK (event_type IN (
      'complete_lesson','pass_quiz','complete_course','earn_certificate',
      'complete_path','community_post','receive_reaction','refer_purchase','daily_streak'
    )),
  xp_awarded    INT         NOT NULL CHECK (xp_awarded > 0),
  reference_id  TEXT        DEFAULT NULL, -- lesson_id, quiz_id, course_id, etc.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_ledger_user      ON public.xp_ledger(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_xp_ledger_event     ON public.xp_ledger(workspace_id, user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_xp_ledger_ref       ON public.xp_ledger(workspace_id, user_id, event_type, reference_id);

-- Aggregated XP + streak per user per workspace (updated by awardXP helper)
CREATE TABLE IF NOT EXISTS public.user_xp (
  workspace_id          UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
  total_xp              INT  NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  current_level         INT  NOT NULL DEFAULT 1 CHECK (current_level >= 1),
  current_streak_days   INT  NOT NULL DEFAULT 0 CHECK (current_streak_days >= 0),
  longest_streak_days   INT  NOT NULL DEFAULT 0 CHECK (longest_streak_days >= 0),
  last_activity_date    DATE DEFAULT NULL,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_xp_leaderboard ON public.user_xp(workspace_id, total_xp DESC);

-- Badge definitions per workspace
CREATE TABLE IF NOT EXISTS public.badges (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID    NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key          TEXT    NOT NULL,   -- stable identifier: 'first_lesson', 'streak_7', etc.
  name         TEXT    NOT NULL,
  description  TEXT    DEFAULT NULL,
  icon         TEXT    DEFAULT '🏅',
  is_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INT     NOT NULL DEFAULT 0,
  UNIQUE (workspace_id, key)
);

CREATE INDEX IF NOT EXISTS idx_badges_workspace ON public.badges(workspace_id);

-- Awarded badges (idempotent via unique constraint)
CREATE TABLE IF NOT EXISTS public.user_badges (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
  badge_id     UUID        NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, badge_id)   -- prevents double-award
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(workspace_id, user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.xp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_ledger   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_xp     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- xp_settings: workspace admins manage; members read
CREATE POLICY "xp_settings_admin"
  ON public.xp_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = xp_settings.workspace_id
        AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin'))
    OR EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin')
  );

CREATE POLICY "xp_settings_member_read"
  ON public.xp_settings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = xp_settings.workspace_id AND wm.user_id = auth.uid())
  );

-- xp_ledger: users read own; admins read all (no direct insert from client — service role only)
CREATE POLICY "xp_ledger_own_read"
  ON public.xp_ledger FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "xp_ledger_admin_read"
  ON public.xp_ledger FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = xp_ledger.workspace_id
        AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin'))
  );

-- user_xp: users read own; workspace members read all (for leaderboard); admins manage
CREATE POLICY "user_xp_own"
  ON public.user_xp FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_xp_member_read"
  ON public.user_xp FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = user_xp.workspace_id AND wm.user_id = auth.uid())
  );

CREATE POLICY "user_xp_admin"
  ON public.user_xp FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = user_xp.workspace_id
        AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin'))
    OR EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin')
  );

-- badges: workspace members read; admins manage
CREATE POLICY "badges_member_read"
  ON public.badges FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = badges.workspace_id AND wm.user_id = auth.uid())
  );

CREATE POLICY "badges_admin"
  ON public.badges FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = badges.workspace_id
        AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin'))
    OR EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin')
  );

-- user_badges: users read own; members read all (for leaderboard/profiles); admins manage
CREATE POLICY "user_badges_own"
  ON public.user_badges FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_badges_member_read"
  ON public.user_badges FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = user_badges.workspace_id AND wm.user_id = auth.uid())
  );

CREATE POLICY "user_badges_admin"
  ON public.user_badges FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = user_badges.workspace_id
        AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin'))
    OR EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin')
  );
