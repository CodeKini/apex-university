-- 013_certificates.sql
-- Certificate of completion system

-- Add certificate toggle to courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS certificates_enabled BOOLEAN DEFAULT FALSE;

-- Certificates table
CREATE TABLE IF NOT EXISTS certificates (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id      UUID        NOT NULL REFERENCES workspaces(id)      ON DELETE CASCADE,
  course_id         UUID        NOT NULL REFERENCES courses(id)          ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES platform_users(id)   ON DELETE CASCADE,
  enrollment_id     UUID        REFERENCES enrollments(id)               ON DELETE SET NULL,
  student_name      TEXT        NOT NULL,
  course_title      TEXT        NOT NULL,
  workspace_name    TEXT        NOT NULL,
  issued_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  verification_code TEXT        NOT NULL,
  storage_path      TEXT,
  storage_url       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- One certificate per student per course
  CONSTRAINT certificates_course_user_unique UNIQUE (course_id, user_id),
  CONSTRAINT certificates_verification_code_unique UNIQUE (verification_code)
);

CREATE INDEX IF NOT EXISTS certificates_user_id_idx           ON certificates(user_id);
CREATE INDEX IF NOT EXISTS certificates_workspace_id_idx      ON certificates(workspace_id);
CREATE INDEX IF NOT EXISTS certificates_course_id_idx         ON certificates(course_id);
CREATE INDEX IF NOT EXISTS certificates_verification_code_idx ON certificates(verification_code);

-- ── RLS ────────────────────────────────────────────────────────────────
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Students: only their own certificates
CREATE POLICY "certificates_student_select"
  ON certificates FOR SELECT
  USING (user_id = auth.uid());

-- Workspace owners/admins: all certs in their workspace
CREATE POLICY "certificates_workspace_manager_select"
  ON certificates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = certificates.workspace_id
        AND wm.user_id      = auth.uid()
        AND wm.role         IN ('owner', 'admin')
    )
  );

-- Platform admin: full access
CREATE POLICY "certificates_platform_admin"
  ON certificates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM platform_users pu
      WHERE pu.id = auth.uid()
        AND pu.platform_role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM platform_users pu
      WHERE pu.id = auth.uid()
        AND pu.platform_role = 'platform_admin'
    )
  );

-- ── Storage bucket ─────────────────────────────────────────────────────
-- NOTE: Run this in the Supabase dashboard → Storage → New bucket:
--   Name: certificates
--   Public: true (so PDF URLs work without signed URLs)
--   File size limit: 10MB
--   Allowed MIME types: application/pdf
--
-- Or run via SQL Editor (if storage schema is available):
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificates',
  'certificates',
  true,
  10485760,           -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: allow service role to upload (bypasses RLS)
-- Allow public to read (bucket is public)
CREATE POLICY "certificates_storage_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'certificates');
