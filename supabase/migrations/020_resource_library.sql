-- ── Resource Library ──────────────────────────────────────────────────────────

-- Private bucket for protected resource files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace-resources',
  'workspace-resources',
  false,   -- PRIVATE: no public URLs
  524288000, -- 500 MB max per file
  ARRAY[
    'application/pdf',
    'application/zip','application/x-zip-compressed',
    'image/jpeg','image/jpg','image/png','image/webp','image/gif',
    'audio/mpeg','audio/mp4','audio/wav','audio/ogg',
    'video/mp4','video/webm',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for private resource bucket:
-- Only workspace owners/admins can upload; no direct student reads (served via signed URL API)
DROP POLICY IF EXISTS "ws_resources_admin_upload" ON storage.objects;
DROP POLICY IF EXISTS "ws_resources_admin_read"   ON storage.objects;
DROP POLICY IF EXISTS "ws_resources_admin_delete" ON storage.objects;

CREATE POLICY "ws_resources_admin_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'workspace-resources'
    AND auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.user_id = auth.uid()
          AND wm.role IN ('owner','admin')
          AND wm.workspace_id::text = split_part(name, '/', 1)
      )
      OR EXISTS (SELECT 1 FROM platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin')
    )
  );

CREATE POLICY "ws_resources_admin_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'workspace-resources'
    AND auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.user_id = auth.uid()
          AND wm.role IN ('owner','admin')
          AND wm.workspace_id::text = split_part(name, '/', 1)
      )
      OR EXISTS (SELECT 1 FROM platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin')
    )
  );

CREATE POLICY "ws_resources_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'workspace-resources'
    AND auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.user_id = auth.uid()
          AND wm.role IN ('owner','admin')
          AND wm.workspace_id::text = split_part(name, '/', 1)
      )
      OR EXISTS (SELECT 1 FROM platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin')
    )
  );

-- ── workspace_resources table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspace_resources (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by    UUID        REFERENCES public.platform_users(id) ON DELETE SET NULL,

  title         TEXT        NOT NULL CHECK (length(title) >= 1 AND length(title) <= 200),
  description   TEXT        DEFAULT NULL,

  resource_type TEXT        NOT NULL CHECK (resource_type IN (
    'pdf','zip','image','audio','video_link','canva_link','google_link','external_url','file'
  )),

  -- For uploaded files (storage bucket path, not public URL)
  storage_path  TEXT        DEFAULT NULL,
  file_name     TEXT        DEFAULT NULL,
  file_size     BIGINT      DEFAULT NULL,

  -- For links / external content
  external_url  TEXT        DEFAULT NULL,

  -- Access control
  access_type   TEXT        NOT NULL DEFAULT 'membership'
    CHECK (access_type IN ('free','paid_course','membership','specific_courses','specific_paths')),
  course_ids    UUID[]      DEFAULT '{}',
  path_ids      UUID[]      DEFAULT '{}',

  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  download_count INT        NOT NULL DEFAULT 0,

  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_resources_workspace ON public.workspace_resources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_resources_active    ON public.workspace_resources(workspace_id, is_active);

-- ── resource_download_events ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resource_download_events (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id  UUID        NOT NULL REFERENCES public.workspace_resources(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.platform_users(id) ON DELETE CASCADE,
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  access_type  TEXT        NOT NULL,  -- how access was granted (free/membership/course/etc.)
  downloaded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resource_downloads_resource ON public.resource_download_events(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_downloads_user     ON public.resource_download_events(user_id);

-- Atomic increment function
CREATE OR REPLACE FUNCTION increment_resource_downloads(resource_id_input UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.workspace_resources
    SET download_count = download_count + 1,
        updated_at     = NOW()
    WHERE id = resource_id_input;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.workspace_resources       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_download_events  ENABLE ROW LEVEL SECURITY;

-- Creators: full access to own workspace resources
CREATE POLICY "resources_admin_all"
  ON public.workspace_resources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_resources.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner','admin')
    )
    OR EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin')
  );

-- Students: can read active resources only (access gating done in API)
CREATE POLICY "resources_student_read_active"
  ON public.workspace_resources FOR SELECT
  USING (is_active = true);

-- Download events: users see own, admins see workspace
CREATE POLICY "resource_downloads_own"
  ON public.resource_download_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "resource_downloads_admin"
  ON public.resource_download_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = resource_download_events.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner','admin')
    )
    OR EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin')
  );

CREATE POLICY "resource_downloads_insert"
  ON public.resource_download_events FOR INSERT
  WITH CHECK (user_id = auth.uid());
