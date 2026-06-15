-- ============================================================
-- MIGRATION 004: Workspace-Scoped Course Builder
-- Run after 003_multi_tenant_rls.sql
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Add workspace_id to courses / modules / lessons
-- Nullable: existing single-tenant rows keep workspace_id = NULL.
-- All new workspace courses created via /api/platform/courses
-- will have workspace_id set.
-- ─────────────────────────────────────────────

alter table public.courses
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

alter table public.modules
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

alter table public.lessons
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

-- ─────────────────────────────────────────────
-- 2. Fix slug uniqueness
-- Old: globally unique per course
-- New: unique per workspace (so two different workspaces
--      can both have a "getting-started" course)
-- Legacy (workspace_id IS NULL) keeps the old global constraint.
-- ─────────────────────────────────────────────

alter table public.courses drop constraint if exists courses_slug_key;

create unique index if not exists courses_slug_per_workspace_idx
  on public.courses(workspace_id, slug)
  where workspace_id is not null;

create unique index if not exists courses_slug_legacy_idx
  on public.courses(slug)
  where workspace_id is null;

-- ─────────────────────────────────────────────
-- 3. Add "link" content type for lessons
-- External URL — student clicks and is taken to a resource.
-- ─────────────────────────────────────────────

alter table public.lessons
  drop constraint if exists lessons_content_type_check;

alter table public.lessons
  add constraint lessons_content_type_check
  check (content_type in ('video','canva','google_embed','text','file','quiz','exam','live','link'));

-- ─────────────────────────────────────────────
-- 4. Perf indexes
-- ─────────────────────────────────────────────

create index if not exists courses_workspace_idx
  on public.courses(workspace_id);

create index if not exists courses_workspace_status_idx
  on public.courses(workspace_id, status);

create index if not exists modules_workspace_idx
  on public.modules(workspace_id);

create index if not exists lessons_workspace_idx
  on public.lessons(workspace_id);
