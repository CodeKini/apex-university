-- ============================================================
-- APEX UNIVERSITY — ROW LEVEL SECURITY POLICIES
-- Run AFTER schema.sql in the Supabase SQL editor.
-- ============================================================

-- Enable RLS on every table
alter table public.profiles          enable row level security;
alter table public.courses           enable row level security;
alter table public.modules           enable row level security;
alter table public.lessons           enable row level security;
alter table public.enrollments       enable row level security;
alter table public.lesson_progress   enable row level security;
alter table public.purchases         enable row level security;
alter table public.admin_activity_logs enable row level security;

-- ============================================================
-- Helper function: is the current user an admin?
-- SECURITY: uses security definer so RLS can't be bypassed by
-- querying profiles directly in a policy (prevents recursion).
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- PROFILES policies
-- ============================================================
-- Users can read their own profile
create policy "profiles: own read"
  on public.profiles for select
  using (auth.uid() = id);

-- Admins can read all profiles
create policy "profiles: admin read all"
  on public.profiles for select
  using (public.is_admin());

-- Users can update their own profile (except role — handled below)
create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Prevent self-promotion to admin
    and role = (select role from public.profiles where id = auth.uid())
  );

-- SECURITY: only service role (server-side) can insert profiles.
-- The trigger handle_new_user runs as security definer so it bypasses RLS.

-- ============================================================
-- COURSES policies
-- ============================================================
-- Anyone (including anon) can read published courses
create policy "courses: public read published"
  on public.courses for select
  using (is_published = true);

-- Admins can read all courses
create policy "courses: admin read all"
  on public.courses for select
  using (public.is_admin());

-- Only admins can insert/update/delete courses
create policy "courses: admin write"
  on public.courses for insert
  with check (public.is_admin());

create policy "courses: admin update"
  on public.courses for update
  using (public.is_admin());

create policy "courses: admin delete"
  on public.courses for delete
  using (public.is_admin());

-- ============================================================
-- MODULES policies
-- ============================================================
-- Modules are readable if their course is published OR user is admin
create policy "modules: read if course published"
  on public.modules for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.courses
      where id = modules.course_id and is_published = true
    )
  );

create policy "modules: admin write"
  on public.modules for insert
  with check (public.is_admin());

create policy "modules: admin update"
  on public.modules for update
  using (public.is_admin());

create policy "modules: admin delete"
  on public.modules for delete
  using (public.is_admin());

-- ============================================================
-- LESSONS policies
-- ============================================================
-- Lesson is readable if: it's a free preview, user is enrolled, or user is admin
create policy "lessons: read if free or enrolled or admin"
  on public.lessons for select
  using (
    public.is_admin()
    or is_free = true
    or exists (
      select 1 from public.enrollments
      where user_id = auth.uid() and course_id = lessons.course_id
    )
  );

create policy "lessons: admin write"
  on public.lessons for insert
  with check (public.is_admin());

create policy "lessons: admin update"
  on public.lessons for update
  using (public.is_admin());

create policy "lessons: admin delete"
  on public.lessons for delete
  using (public.is_admin());

-- ============================================================
-- ENROLLMENTS policies
-- ============================================================
-- Users see only their own enrollments
create policy "enrollments: own read"
  on public.enrollments for select
  using (auth.uid() = user_id);

-- Admins see all
create policy "enrollments: admin read all"
  on public.enrollments for select
  using (public.is_admin());

-- SECURITY: Enrollments are inserted only by the server-side Stripe webhook
-- using the service role key — NOT by the client.
-- No client insert policy here intentionally.

-- ============================================================
-- LESSON PROGRESS policies
-- ============================================================
create policy "progress: own read"
  on public.lesson_progress for select
  using (auth.uid() = user_id);

create policy "progress: own insert"
  on public.lesson_progress for insert
  with check (
    auth.uid() = user_id
    -- Must be enrolled in this course
    and exists (
      select 1 from public.enrollments
      where user_id = auth.uid() and course_id = lesson_progress.course_id
    )
  );

create policy "progress: own update"
  on public.lesson_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- PURCHASES policies
-- ============================================================
create policy "purchases: own read"
  on public.purchases for select
  using (auth.uid() = user_id);

create policy "purchases: admin read all"
  on public.purchases for select
  using (public.is_admin());

-- Purchases inserted only by server-side webhook (service role)

-- ============================================================
-- ADMIN ACTIVITY LOGS policies
-- ============================================================
create policy "logs: admin read all"
  on public.admin_activity_logs for select
  using (public.is_admin());

create policy "logs: admin insert"
  on public.admin_activity_logs for insert
  with check (public.is_admin());
