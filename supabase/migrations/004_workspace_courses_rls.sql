-- ============================================================
-- MIGRATION 004 (RLS): Workspace-Scoped Course Policies
-- Run immediately after 004_workspace_courses.sql
-- ============================================================
-- Strategy:
--   • Existing policies (from 001_rls.sql) cover legacy courses
--     where workspace_id IS NULL — those are untouched.
--   • New policies below cover workspace_id IS NOT NULL rows.
--   • Creators manage courses in their own workspaces.
--   • Platform admins bypass all restrictions.
--   • Published workspace courses are publicly readable.
-- ============================================================

-- ─────────────────────────────────────────────
-- COURSES
-- ─────────────────────────────────────────────

-- Workspace owners/admins can read, create, update, delete their courses
create policy "courses: workspace creator full access"
  on public.courses for all
  using (
    workspace_id is not null
    and (
      is_workspace_admin(workspace_id)
      or is_platform_admin()
    )
  )
  with check (
    workspace_id is not null
    and (
      is_workspace_admin(workspace_id)
      or is_platform_admin()
    )
  );

-- Anyone can read published workspace courses
create policy "courses: published workspace courses public"
  on public.courses for select
  using (
    workspace_id is not null
    and status = 'published'
  );

-- ─────────────────────────────────────────────
-- MODULES
-- ─────────────────────────────────────────────

create policy "modules: workspace creator full access"
  on public.modules for all
  using (
    workspace_id is not null
    and (
      is_workspace_admin(workspace_id)
      or is_platform_admin()
    )
  )
  with check (
    workspace_id is not null
    and (
      is_workspace_admin(workspace_id)
      or is_platform_admin()
    )
  );

-- Workspace members can read modules of published courses
create policy "modules: members read published"
  on public.modules for select
  using (
    workspace_id is not null
    and exists (
      select 1 from public.courses c
      where c.id = modules.course_id
        and c.status = 'published'
        and c.workspace_id = modules.workspace_id
    )
    and is_workspace_member(workspace_id)
  );

-- ─────────────────────────────────────────────
-- LESSONS
-- ─────────────────────────────────────────────

create policy "lessons: workspace creator full access"
  on public.lessons for all
  using (
    workspace_id is not null
    and (
      is_workspace_admin(workspace_id)
      or is_platform_admin()
    )
  )
  with check (
    workspace_id is not null
    and (
      is_workspace_admin(workspace_id)
      or is_platform_admin()
    )
  );

-- Enrolled workspace members can read lessons of published courses
create policy "lessons: enrolled members read"
  on public.lessons for select
  using (
    workspace_id is not null
    and (
      -- Free / preview lessons are always visible to workspace members
      is_free = true
      -- Enrolled members see all lessons
      or exists (
        select 1 from public.enrollments e
        where e.course_id = lessons.course_id
          and e.user_id   = auth.uid()
      )
    )
    and is_workspace_member(workspace_id)
  );
