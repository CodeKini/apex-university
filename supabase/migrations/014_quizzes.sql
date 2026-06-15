-- 014_quizzes.sql
-- Quiz system: quizzes per lesson, questions/options, student attempts + graded answers

-- ── Core tables ─────────────────────────────────────────────────────────

CREATE TABLE quizzes (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id       UUID        NOT NULL UNIQUE REFERENCES lessons(id)    ON DELETE CASCADE,
  workspace_id    UUID        NOT NULL REFERENCES workspaces(id)        ON DELETE CASCADE,
  course_id       UUID        NOT NULL REFERENCES courses(id)           ON DELETE CASCADE,
  pass_score      INT         NOT NULL DEFAULT 70   CHECK (pass_score BETWEEN 0 AND 100),
  max_attempts    INT         NOT NULL DEFAULT 0,   -- 0 = unlimited
  reveal_answers  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quiz_questions (
  id              UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id         UUID  NOT NULL REFERENCES quizzes(id)    ON DELETE CASCADE,
  workspace_id    UUID  NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  question_type   TEXT  NOT NULL
    CHECK (question_type IN ('multiple_choice','multiple_select','true_false','short_answer')),
  question_text   TEXT  NOT NULL,
  explanation     TEXT,        -- shown if reveal_answers after submission
  points          INT   NOT NULL DEFAULT 1 CHECK (points >= 0),
  position        INT   NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quiz_options (
  id            UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id   UUID    NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  quiz_id       UUID    NOT NULL REFERENCES quizzes(id)        ON DELETE CASCADE,
  option_text   TEXT    NOT NULL,
  is_correct    BOOLEAN NOT NULL DEFAULT FALSE,
  position      INT     NOT NULL DEFAULT 1
);

CREATE TABLE quiz_attempts (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id        UUID        NOT NULL REFERENCES quizzes(id)       ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  lesson_id      UUID        NOT NULL REFERENCES lessons(id)        ON DELETE CASCADE,
  course_id      UUID        NOT NULL REFERENCES courses(id)        ON DELETE CASCADE,
  workspace_id   UUID        NOT NULL REFERENCES workspaces(id)     ON DELETE CASCADE,
  attempt_number INT         NOT NULL DEFAULT 1,
  score          INT         NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  passed         BOOLEAN     NOT NULL DEFAULT FALSE,
  submitted_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT quiz_attempts_unique_attempt UNIQUE (quiz_id, user_id, attempt_number)
);

CREATE TABLE quiz_answers (
  id                   UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id           UUID    NOT NULL REFERENCES quiz_attempts(id)    ON DELETE CASCADE,
  question_id          UUID    NOT NULL REFERENCES quiz_questions(id)   ON DELETE CASCADE,
  selected_option_ids  UUID[]  NOT NULL DEFAULT '{}',
  text_answer          TEXT,
  is_correct           BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX quiz_questions_quiz_id_idx   ON quiz_questions(quiz_id);
CREATE INDEX quiz_options_question_id_idx ON quiz_options(question_id);
CREATE INDEX quiz_options_quiz_id_idx     ON quiz_options(quiz_id);
CREATE INDEX quiz_attempts_user_quiz_idx  ON quiz_attempts(user_id, quiz_id);
CREATE INDEX quiz_attempts_workspace_idx  ON quiz_attempts(workspace_id);
CREATE INDEX quiz_answers_attempt_idx     ON quiz_answers(attempt_id);

-- ── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE quizzes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_options     ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers     ENABLE ROW LEVEL SECURITY;

-- Helper: is the caller a workspace manager (owner or admin)?
-- Used for creator access across quiz tables.

-- quizzes: managers full access, enrolled students read
CREATE POLICY "quizzes_manager_all" ON quizzes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = quizzes.workspace_id
      AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin')
  ));

CREATE POLICY "quizzes_platform_admin" ON quizzes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin'
  ));

CREATE POLICY "quizzes_enrolled_read" ON quizzes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.course_id = quizzes.course_id AND e.user_id = auth.uid() AND e.access_status = 'active'
  ));

-- quiz_questions: same pattern
CREATE POLICY "quiz_questions_manager_all" ON quiz_questions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = quiz_questions.workspace_id
      AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin')
  ));

CREATE POLICY "quiz_questions_platform_admin" ON quiz_questions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin'
  ));

CREATE POLICY "quiz_questions_enrolled_read" ON quiz_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM quizzes q JOIN enrollments e ON e.course_id = q.course_id
    WHERE q.id = quiz_questions.quiz_id AND e.user_id = auth.uid() AND e.access_status = 'active'
  ));

-- quiz_options: students can read (is_correct is masked in API layer, not here)
CREATE POLICY "quiz_options_manager_all" ON quiz_options FOR ALL
  USING (EXISTS (
    SELECT 1 FROM quiz_questions qq JOIN workspace_members wm ON wm.workspace_id = qq.workspace_id
    WHERE qq.id = quiz_options.question_id AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin')
  ));

CREATE POLICY "quiz_options_platform_admin" ON quiz_options FOR ALL
  USING (EXISTS (
    SELECT 1 FROM platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin'
  ));

CREATE POLICY "quiz_options_enrolled_read" ON quiz_options FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM quizzes q JOIN enrollments e ON e.course_id = q.course_id
    WHERE q.id = quiz_options.quiz_id AND e.user_id = auth.uid() AND e.access_status = 'active'
  ));

-- quiz_attempts: own user + workspace managers
CREATE POLICY "quiz_attempts_own" ON quiz_attempts FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "quiz_attempts_manager_read" ON quiz_attempts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = quiz_attempts.workspace_id
      AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin')
  ));

CREATE POLICY "quiz_attempts_platform_admin" ON quiz_attempts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin'
  ));

-- quiz_answers: own attempt only + managers via join
CREATE POLICY "quiz_answers_own" ON quiz_answers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM quiz_attempts qa WHERE qa.id = quiz_answers.attempt_id AND qa.user_id = auth.uid()
  ));

CREATE POLICY "quiz_answers_manager_read" ON quiz_answers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM quiz_attempts qa
    JOIN workspace_members wm ON wm.workspace_id = qa.workspace_id
    WHERE qa.id = quiz_answers.attempt_id AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin')
  ));

CREATE POLICY "quiz_answers_platform_admin" ON quiz_answers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM platform_users pu WHERE pu.id = auth.uid() AND pu.platform_role = 'platform_admin'
  ));
