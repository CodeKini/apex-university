-- ============================================================
-- MIGRATION 002: RLS for Revenue & Payout tables
-- Run AFTER 002_revenue_payouts.sql
-- Depends on is_admin() and owns_course() from 001_rls.sql
-- ============================================================

-- ============================================================
-- PLATFORM SETTINGS (admin read/write, public read for pct values)
-- ============================================================
alter table public.platform_settings enable row level security;

create policy "platform_settings_select_all"
  on public.platform_settings for select
  using (true);

create policy "platform_settings_admin_write"
  on public.platform_settings for all
  using (is_admin());

-- ============================================================
-- INSTRUCTOR COMMISSIONS
-- Instructors: see only their own
-- Admins: see all
-- Students: no access
-- ============================================================
alter table public.instructor_commissions enable row level security;

create policy "commissions_select_own"
  on public.instructor_commissions for select
  using (instructor_id = auth.uid());

create policy "commissions_select_admin"
  on public.instructor_commissions for all
  using (is_admin());

-- Service role (webhook) handles inserts — no client insert policy needed

-- ============================================================
-- INSTRUCTOR PAYOUTS
-- Instructors: see only their own payouts
-- Admins: full access
-- Students: no access
-- ============================================================
alter table public.instructor_payouts enable row level security;

create policy "payouts_select_own"
  on public.instructor_payouts for select
  using (instructor_id = auth.uid());

create policy "payouts_admin_all"
  on public.instructor_payouts for all
  using (is_admin());
