-- ────────────────────────────────────────────────────────────────────────────
-- 008_analytics_indexes.sql
-- Ensures columns from migrations 005 and 007 exist, then adds indexes.
-- Safe to run even if 005/007 were never applied.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.lesson_progress
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- lesson_progress uses last_watched (not updated_at) for recency ordering
CREATE INDEX IF NOT EXISTS lesson_progress_workspace_watched_idx
  ON public.lesson_progress(workspace_id, last_watched DESC);

CREATE INDEX IF NOT EXISTS lesson_progress_workspace_course_completed_idx
  ON public.lesson_progress(workspace_id, course_id, user_id)
  WHERE completed = true;

CREATE INDEX IF NOT EXISTS enrollments_workspace_course_idx
  ON public.enrollments(workspace_id, course_id);

CREATE INDEX IF NOT EXISTS purchases_workspace_status_idx
  ON public.purchases(workspace_id, status)
  WHERE status = 'completed';
