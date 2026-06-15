-- ============================================================
-- MIGRATION 001: Updated RLS Policies for Course Builder
-- Run AFTER 001_course_builder.sql
-- ============================================================

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper: check if current user is instructor
create or replace function public.is_instructor()
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('instructor', 'admin')
  );
$$;

-- Helper: check if current user owns this course
create or replace function public.owns_course(course_uuid uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.courses
    where id = course_uuid and instructor_id = auth.uid()
  );
$$;

-- ============================================================
-- PROFILES
-- ============================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own"   on public.profiles;
drop policy if exists "profiles_select_admin"  on public.profiles;
drop policy if exists "profiles_update_own"   on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_select_admin"
  on public.profiles for select
  using (is_admin());

-- Instructors can see profiles of students enrolled in their courses
create policy "profiles_select_instructor"
  on public.profiles for select
  using (
    is_instructor() and exists (
      select 1 from public.enrollments e
      join public.courses c on c.id = e.course_id
      where e.user_id = profiles.id and c.instructor_id = auth.uid()
    )
  );

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- prevent self-promotion to admin/instructor
    and (role = (select role from public.profiles where id = auth.uid()))
  );

create policy "profiles_update_admin"
  on public.profiles for update
  using (is_admin());

-- ============================================================
-- CATEGORIES
-- ============================================================
alter table public.categories enable row level security;

drop policy if exists "categories_select_all" on public.categories;
drop policy if exists "categories_admin"       on public.categories;

create policy "categories_select_all"
  on public.categories for select
  using (true);

create policy "categories_admin"
  on public.categories for all
  using (is_admin());

-- ============================================================
-- COURSES
-- ============================================================
alter table public.courses enable row level security;

drop policy if exists "courses_select_published"   on public.courses;
drop policy if exists "courses_select_own"          on public.courses;
drop policy if exists "courses_select_admin"        on public.courses;
drop policy if exists "courses_insert_instructor"   on public.courses;
drop policy if exists "courses_update_own"          on public.courses;
drop policy if exists "courses_update_admin"        on public.courses;
drop policy if exists "courses_delete_admin"        on public.courses;

-- Anyone can see published courses
create policy "courses_select_published"
  on public.courses for select
  using (status = 'published');

-- Instructors see their own courses (any status)
create policy "courses_select_own"
  on public.courses for select
  using (instructor_id = auth.uid());

-- Admins see all courses
create policy "courses_select_admin"
  on public.courses for select
  using (is_admin());

-- Instructors can create courses (they own them)
create policy "courses_insert_instructor"
  on public.courses for insert
  with check (is_instructor() and instructor_id = auth.uid());

-- Instructors can update their own courses (but not change status to published directly)
create policy "courses_update_own"
  on public.courses for update
  using (instructor_id = auth.uid())
  with check (
    instructor_id = auth.uid()
    -- instructors cannot self-publish; they submit for review
    and status in ('draft', 'review', 'archived')
  );

-- Admins can update any course (including publishing/rejecting)
create policy "courses_update_admin"
  on public.courses for update
  using (is_admin());

create policy "courses_delete_admin"
  on public.courses for delete
  using (is_admin());

-- ============================================================
-- MODULES
-- ============================================================
alter table public.modules enable row level security;

drop policy if exists "modules_select_published" on public.modules;
drop policy if exists "modules_select_own"        on public.modules;
drop policy if exists "modules_select_admin"      on public.modules;
drop policy if exists "modules_write_own"         on public.modules;
drop policy if exists "modules_write_admin"       on public.modules;

create policy "modules_select_published"
  on public.modules for select
  using (
    exists (
      select 1 from public.courses c
      where c.id = modules.course_id and c.status = 'published'
    )
  );

create policy "modules_select_own"
  on public.modules for select
  using (owns_course(course_id));

create policy "modules_select_admin"
  on public.modules for select
  using (is_admin());

create policy "modules_write_own"
  on public.modules for all
  using (owns_course(course_id))
  with check (owns_course(course_id));

create policy "modules_write_admin"
  on public.modules for all
  using (is_admin());

-- ============================================================
-- LESSONS
-- ============================================================
alter table public.lessons enable row level security;

drop policy if exists "lessons_select_free"      on public.lessons;
drop policy if exists "lessons_select_enrolled"  on public.lessons;
drop policy if exists "lessons_select_own"       on public.lessons;
drop policy if exists "lessons_select_admin"     on public.lessons;
drop policy if exists "lessons_write_own"        on public.lessons;
drop policy if exists "lessons_write_admin"      on public.lessons;

-- Anyone can see free preview lessons in published courses
create policy "lessons_select_free"
  on public.lessons for select
  using (
    is_free = true
    and exists (
      select 1 from public.courses c
      where c.id = lessons.course_id and c.status = 'published'
    )
  );

-- Enrolled students can see all lessons in their courses
create policy "lessons_select_enrolled"
  on public.lessons for select
  using (
    exists (
      select 1 from public.enrollments e
      where e.user_id = auth.uid() and e.course_id = lessons.course_id
    )
  );

create policy "lessons_select_own"
  on public.lessons for select
  using (owns_course(course_id));

create policy "lessons_select_admin"
  on public.lessons for select
  using (is_admin());

create policy "lessons_write_own"
  on public.lessons for all
  using (owns_course(course_id))
  with check (owns_course(course_id));

create policy "lessons_write_admin"
  on public.lessons for all
  using (is_admin());

-- ============================================================
-- LESSON RESOURCES
-- ============================================================
alter table public.lesson_resources enable row level security;

create policy "lesson_resources_select_enrolled"
  on public.lesson_resources for select
  using (
    exists (
      select 1 from public.enrollments e
      where e.user_id = auth.uid() and e.course_id = lesson_resources.course_id
    )
  );

create policy "lesson_resources_select_own"
  on public.lesson_resources for select
  using (owns_course(course_id));

create policy "lesson_resources_write_own"
  on public.lesson_resources for all
  using (owns_course(course_id))
  with check (owns_course(course_id));

create policy "lesson_resources_admin"
  on public.lesson_resources for all
  using (is_admin());

-- ============================================================
-- ENROLLMENTS (webhook-only insert via service role)
-- ============================================================
alter table public.enrollments enable row level security;

drop policy if exists "enrollments_select_own"   on public.enrollments;
drop policy if exists "enrollments_select_admin" on public.enrollments;
drop policy if exists "enrollments_select_instructor" on public.enrollments;

create policy "enrollments_select_own"
  on public.enrollments for select
  using (user_id = auth.uid());

create policy "enrollments_select_instructor"
  on public.enrollments for select
  using (owns_course(course_id));

create policy "enrollments_select_admin"
  on public.enrollments for select
  using (is_admin());

-- ============================================================
-- LESSON PROGRESS
-- ============================================================
alter table public.lesson_progress enable row level security;

drop policy if exists "progress_select_own"       on public.lesson_progress;
drop policy if exists "progress_write_own"        on public.lesson_progress;
drop policy if exists "progress_select_instructor" on public.lesson_progress;
drop policy if exists "progress_select_admin"     on public.lesson_progress;

create policy "progress_select_own"
  on public.lesson_progress for select
  using (user_id = auth.uid());

create policy "progress_write_own"
  on public.lesson_progress for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "progress_select_instructor"
  on public.lesson_progress for select
  using (owns_course(course_id));

create policy "progress_select_admin"
  on public.lesson_progress for select
  using (is_admin());

-- ============================================================
-- PURCHASES
-- ============================================================
alter table public.purchases enable row level security;

drop policy if exists "purchases_select_own"          on public.purchases;
drop policy if exists "purchases_select_instructor"   on public.purchases;
drop policy if exists "purchases_select_admin"        on public.purchases;

create policy "purchases_select_own"
  on public.purchases for select
  using (user_id = auth.uid());

create policy "purchases_select_instructor"
  on public.purchases for select
  using (owns_course(course_id));

create policy "purchases_select_admin"
  on public.purchases for select
  using (is_admin());
