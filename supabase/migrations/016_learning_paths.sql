-- 016_learning_paths.sql
-- Learning paths: ordered multi-course sequences with path certificates.

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learning_paths (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id         UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title                TEXT NOT NULL CHECK (length(title) > 0),
  slug                 TEXT NOT NULL CHECK (length(slug) > 0),
  description          TEXT,
  thumbnail_url        TEXT,
  difficulty           TEXT NOT NULL DEFAULT 'beginner'
                       CHECK (difficulty IN ('beginner','intermediate','advanced')),
  estimated_hours      INT CHECK (estimated_hours > 0),
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  certificates_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (workspace_id, slug)
);

-- Ordered courses within a path
CREATE TABLE IF NOT EXISTS learning_path_courses (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  path_id      UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  position     INT  NOT NULL DEFAULT 1 CHECK (position >= 1),
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (path_id, course_id)
);

-- Student enrollment in a path (separate from per-course enrollments)
CREATE TABLE IF NOT EXISTS learning_path_enrollments (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  path_id      UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  enrolled_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  UNIQUE (path_id, user_id)
);

-- Path-level certificates (distinct from per-course certificates)
CREATE TABLE IF NOT EXISTS path_certificates (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  path_id           UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  student_name      TEXT NOT NULL,
  path_title        TEXT NOT NULL,
  workspace_name    TEXT NOT NULL,
  issued_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  verification_code TEXT NOT NULL,
  storage_path      TEXT,
  storage_url       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (path_id, user_id),
  UNIQUE (verification_code)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_learning_paths_workspace
  ON learning_paths(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_path_courses_path
  ON learning_path_courses(path_id, position);
CREATE INDEX IF NOT EXISTS idx_learning_path_enrollments_user
  ON learning_path_enrollments(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_path_certificates_user
  ON path_certificates(user_id, workspace_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE learning_paths              ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_path_courses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_path_enrollments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_certificates           ENABLE ROW LEVEL SECURITY;

-- learning_paths
CREATE POLICY "workspace members can view published paths"
  ON learning_paths FOR SELECT
  USING (
    status = 'published' AND
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = learning_paths.workspace_id AND user_id = auth.uid())
  );

CREATE POLICY "managers can view all paths"
  ON learning_paths FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = learning_paths.workspace_id
        AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

CREATE POLICY "managers can create paths"
  ON learning_paths FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = learning_paths.workspace_id
        AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

CREATE POLICY "managers can update paths"
  ON learning_paths FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = learning_paths.workspace_id
        AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

CREATE POLICY "managers can delete paths"
  ON learning_paths FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = learning_paths.workspace_id
        AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

-- learning_path_courses
CREATE POLICY "workspace members can view path courses"
  ON learning_path_courses FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = learning_path_courses.workspace_id AND user_id = auth.uid())
  );

CREATE POLICY "managers can manage path courses"
  ON learning_path_courses FOR ALL
  USING (
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = learning_path_courses.workspace_id
        AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

-- learning_path_enrollments
CREATE POLICY "students view own enrollments"
  ON learning_path_enrollments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "managers view workspace enrollments"
  ON learning_path_enrollments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = learning_path_enrollments.workspace_id
        AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

CREATE POLICY "members can enroll themselves"
  ON learning_path_enrollments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = learning_path_enrollments.workspace_id AND user_id = auth.uid())
  );

CREATE POLICY "service role can update enrollments"
  ON learning_path_enrollments FOR UPDATE
  USING (TRUE);

-- path_certificates
CREATE POLICY "students view own path certs"
  ON path_certificates FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "managers view workspace path certs"
  ON path_certificates FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM workspace_members
      WHERE workspace_id = path_certificates.workspace_id
        AND user_id = auth.uid() AND role IN ('owner','admin'))
  );

CREATE POLICY "service role inserts path certs"
  ON path_certificates FOR INSERT WITH CHECK (TRUE);
