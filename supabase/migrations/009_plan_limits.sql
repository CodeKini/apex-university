-- ────────────────────────────────────────────────────────────────────────────
-- 009_plan_limits.sql
-- Atomic helpers for plan limit enforcement.
-- ────────────────────────────────────────────────────────────────────────────

-- Atomically add bytes to storage_used_bytes (avoids read-modify-write race).
CREATE OR REPLACE FUNCTION public.increment_storage_bytes(
  p_workspace_id uuid,
  p_bytes        bigint
) RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.workspaces
     SET storage_used_bytes = GREATEST(0, storage_used_bytes + p_bytes)
   WHERE id = p_workspace_id;
$$;

-- Expose usage counts for a workspace in a single query (used by billing UI).
CREATE OR REPLACE FUNCTION public.get_workspace_usage(p_workspace_id uuid)
RETURNS TABLE (
  course_count   bigint,
  student_count  bigint,
  storage_bytes  bigint,
  plan_name      text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    (SELECT count(*) FROM public.courses WHERE workspace_id = p_workspace_id)::bigint,
    w.seats_used::bigint,
    w.storage_used_bytes::bigint,
    w.plan_name
  FROM public.workspaces w
  WHERE w.id = p_workspace_id;
$$;
