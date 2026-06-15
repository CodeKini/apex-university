-- ────────────────────────────────────────────────────────────────────────────
-- 006_workspace_branding_storage.sql
-- Supabase Storage bucket + RLS for workspace asset uploads (logos, favicons)
-- Run in Supabase SQL editor (storage schema is already present)
-- ────────────────────────────────────────────────────────────────────────────

-- Create workspace-assets bucket (public reads, authenticated uploads)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace-assets',
  'workspace-assets',
  true,
  5242880, -- 5 MB max
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/x-icon','image/vnd.microsoft.icon']
)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "workspace_assets_public_read"    ON storage.objects;
DROP POLICY IF EXISTS "workspace_assets_creator_upload" ON storage.objects;
DROP POLICY IF EXISTS "workspace_assets_creator_update" ON storage.objects;
DROP POLICY IF EXISTS "workspace_assets_creator_delete" ON storage.objects;

-- Public read access (bucket is public but belt-and-suspenders)
CREATE POLICY "workspace_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workspace-assets');

-- Only authenticated users who are workspace owner/admin can upload
CREATE POLICY "workspace_assets_creator_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'workspace-assets'
    AND auth.role() = 'authenticated'
    AND (
      -- Path must start with the workspace ID they own/admin
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.user_id  = auth.uid()
          AND wm.role     IN ('owner', 'admin')
          AND wm.workspace_id::text = split_part(name, '/', 1)
      )
      OR EXISTS (
        SELECT 1 FROM platform_users pu
        WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin'
      )
    )
  );

-- Allow owners/admins to update (replace) their own files
CREATE POLICY "workspace_assets_creator_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'workspace-assets'
    AND auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.user_id  = auth.uid()
          AND wm.role     IN ('owner', 'admin')
          AND wm.workspace_id::text = split_part(name, '/', 1)
      )
      OR EXISTS (
        SELECT 1 FROM platform_users pu
        WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin'
      )
    )
  );

-- Allow owners/admins to delete their own files
CREATE POLICY "workspace_assets_creator_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'workspace-assets'
    AND auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.user_id  = auth.uid()
          AND wm.role     IN ('owner', 'admin')
          AND wm.workspace_id::text = split_part(name, '/', 1)
      )
      OR EXISTS (
        SELECT 1 FROM platform_users pu
        WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin'
      )
    )
  );
