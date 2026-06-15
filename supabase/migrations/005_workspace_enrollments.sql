-- ============================================================
-- MIGRATION 005: Workspace-Scoped Enrollments + Progress
-- Run after 004_workspace_courses_rls.sql
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Enrollment upgrades
-- ─────────────────────────────────────────────

-- access_status enum
do $$ begin
  create type public.enrollment_access_status as enum ('active', 'expired', 'revoked');
exception when duplicate_object then null;
end $$;

-- enrollment_source enum
do $$ begin
  create type public.enrollment_source as enum ('free', 'manual', 'stripe');
exception when duplicate_object then null;
end $$;

alter table public.enrollments
  add column if not exists workspace_id   uuid references public.workspaces(id) on delete cascade,
  add column if not exists access_status  public.enrollment_access_status not null default 'active',
  add column if not exists expires_at     timestamptz,
  add column if not exists source         public.enrollment_source not null default 'free';

-- Drop old unique(user_id, course_id) — replace with workspace-aware constraint
-- Old constraint name may vary; drop both possibilities
alter table public.enrollments
  drop constraint if exists enrollments_user_id_course_id_key;

-- New: unique per (user_id, course_id, workspace_id)
-- workspace_id can be NULL for legacy enrollments — use a partial unique index
create unique index if not exists enrollments_workspace_unique_idx
  on public.enrollments(user_id, course_id, workspace_id)
  where workspace_id is not null;

-- Keep legacy global unique for old rows (workspace_id IS NULL)
create unique index if not exists enrollments_legacy_unique_idx
  on public.enrollments(user_id, course_id)
  where workspace_id is null;

create index if not exists enrollments_workspace_idx      on public.enrollments(workspace_id);
create index if not exists enrollments_workspace_user_idx on public.enrollments(workspace_id, user_id);

-- ─────────────────────────────────────────────
-- 2. Lesson progress upgrades
-- ─────────────────────────────────────────────

alter table public.lesson_progress
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

create index if not exists lesson_progress_workspace_idx
  on public.lesson_progress(workspace_id, user_id);

-- ─────────────────────────────────────────────
-- 3. RLS: enrollments
-- ─────────────────────────────────────────────

alter table public.enrollments enable row level security;

-- Students can read their own enrollments
create policy "enrollments: user reads own"
  on public.enrollments for select
  using (user_id = auth.uid());

-- Workspace admins can read all enrollments in their workspace
create policy "enrollments: workspace admin reads all"
  on public.enrollments for select
  using (
    workspace_id is not null
    and (is_workspace_admin(workspace_id) or is_platform_admin())
  );

-- Students can enroll themselves (API does business-logic checks before insert)
create policy "enrollments: user can self-enroll"
  on public.enrollments for insert
  with check (user_id = auth.uid());

-- Workspace admins can manually enroll students
create policy "enrollments: workspace admin can enroll"
  on public.enrollments for insert
  with check (
    workspace_id is not null
    and (is_workspace_admin(workspace_id) or is_platform_admin())
  );

-- Workspace admins can revoke/update enrollments
create policy "enrollments: workspace admin update"
  on public.enrollments for update
  using (
    workspace_id is not null
    and (is_workspace_admin(workspace_id) or is_platform_admin())
  );

-- ─────────────────────────────────────────────
-- 4. RLS: lesson_progress
-- ─────────────────────────────────────────────

alter table public.lesson_progress enable row level security;

-- Students read and write their own progress
create policy "lesson_progress: user reads own"
  on public.lesson_progress for select
  using (user_id = auth.uid());

create policy "lesson_progress: user upserts own"
  on public.lesson_progress for insert
  with check (user_id = auth.uid());

create policy "lesson_progress: user updates own"
  on public.lesson_progress for update
  using (user_id = auth.uid());

-- Workspace admins can read all progress
create policy "lesson_progress: workspace admin reads all"
  on public.lesson_progress for select
  using (
    workspace_id is not null
    and (is_workspace_admin(workspace_id) or is_platform_admin())
  );
