-- 015_community.sql
-- Community: posts, comments, reactions, DMs, notifications, student profiles

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_posts (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  course_id    UUID REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id    UUID REFERENCES lessons(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  post_type    TEXT NOT NULL DEFAULT 'post'
               CHECK (post_type IN ('post', 'announcement', 'question', 'lesson_comment')),
  title        TEXT,
  body         TEXT NOT NULL CHECK (length(body) > 0),
  is_pinned    BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked    BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS community_comments (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  post_id      UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  parent_id    UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  body         TEXT NOT NULL CHECK (length(body) > 0),
  is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS community_reactions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id    UUID NOT NULL,
  user_id      UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  emoji        TEXT NOT NULL CHECK (emoji IN ('👍','❤️','😂','😮','🔥')),
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (target_type, target_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS dm_conversations (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  participant_ids  UUID[] NOT NULL,
  last_message_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS dm_messages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (length(body) > 0),
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,
  link         TEXT,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS student_profiles (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  bio          TEXT,
  avatar_url   TEXT,
  social_links JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (workspace_id, user_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_community_posts_workspace_type
  ON community_posts(workspace_id, post_type, created_at DESC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_community_posts_lesson
  ON community_posts(lesson_id) WHERE lesson_id IS NOT NULL AND NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_community_posts_course
  ON community_posts(course_id) WHERE course_id IS NOT NULL AND NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_community_comments_post
  ON community_comments(post_id, created_at ASC) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_community_reactions_target
  ON community_reactions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_dm_conversations_participants
  ON dm_conversations USING GIN(participant_ids);
CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation
  ON dm_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(workspace_id, user_id, created_at DESC) WHERE read_at IS NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE community_posts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles    ENABLE ROW LEVEL SECURITY;

-- community_posts
CREATE POLICY "members read posts"
  ON community_posts FOR SELECT
  USING (NOT is_deleted AND EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = community_posts.workspace_id AND user_id = auth.uid()
  ));

CREATE POLICY "members create posts"
  ON community_posts FOR INSERT
  WITH CHECK (author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = community_posts.workspace_id AND user_id = auth.uid()
  ));

CREATE POLICY "authors update own posts"
  ON community_posts FOR UPDATE
  USING (author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = community_posts.workspace_id AND user_id = auth.uid()
  ));

CREATE POLICY "managers update any post"
  ON community_posts FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = community_posts.workspace_id
      AND user_id = auth.uid() AND role IN ('owner','admin')
  ));

-- community_comments
CREATE POLICY "members read comments"
  ON community_comments FOR SELECT
  USING (NOT is_deleted AND EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = community_comments.workspace_id AND user_id = auth.uid()
  ));

CREATE POLICY "members create comments"
  ON community_comments FOR INSERT
  WITH CHECK (author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = community_comments.workspace_id AND user_id = auth.uid()
  ));

CREATE POLICY "authors update own comments"
  ON community_comments FOR UPDATE
  USING (author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = community_comments.workspace_id AND user_id = auth.uid()
  ));

CREATE POLICY "managers update any comment"
  ON community_comments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = community_comments.workspace_id
      AND user_id = auth.uid() AND role IN ('owner','admin')
  ));

-- community_reactions
CREATE POLICY "members view reactions"
  ON community_reactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = community_reactions.workspace_id AND user_id = auth.uid()
  ));

CREATE POLICY "members add reactions"
  ON community_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = community_reactions.workspace_id AND user_id = auth.uid()
  ));

CREATE POLICY "users remove own reactions"
  ON community_reactions FOR DELETE
  USING (user_id = auth.uid());

-- dm_conversations
CREATE POLICY "participants view conversations"
  ON dm_conversations FOR SELECT
  USING (auth.uid() = ANY(participant_ids));

CREATE POLICY "members create conversations"
  ON dm_conversations FOR INSERT
  WITH CHECK (auth.uid() = ANY(participant_ids) AND EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = dm_conversations.workspace_id AND user_id = auth.uid()
  ));

CREATE POLICY "participants update conversation"
  ON dm_conversations FOR UPDATE
  USING (auth.uid() = ANY(participant_ids));

-- dm_messages
CREATE POLICY "participants view messages"
  ON dm_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM dm_conversations
    WHERE id = dm_messages.conversation_id AND auth.uid() = ANY(participant_ids)
  ));

CREATE POLICY "participants send messages"
  ON dm_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM dm_conversations
    WHERE id = dm_messages.conversation_id AND auth.uid() = ANY(participant_ids)
  ));

CREATE POLICY "participants mark read"
  ON dm_messages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM dm_conversations
    WHERE id = dm_messages.conversation_id AND auth.uid() = ANY(participant_ids)
  ));

-- notifications
CREATE POLICY "users view own notifications"
  ON notifications FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "service role inserts notifications"
  ON notifications FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "users mark own read"
  ON notifications FOR UPDATE USING (user_id = auth.uid());

-- student_profiles
CREATE POLICY "members view profiles"
  ON student_profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = student_profiles.workspace_id AND user_id = auth.uid()
  ));

CREATE POLICY "users upsert own profile"
  ON student_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = student_profiles.workspace_id AND user_id = auth.uid()
  ));

CREATE POLICY "users update own profile"
  ON student_profiles FOR UPDATE USING (user_id = auth.uid());
