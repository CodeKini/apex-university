-- ============================================================
-- MIGRATION 001: Course & Lesson Builder
-- Run this in Supabase SQL Editor AFTER the original schema.sql
-- ============================================================

-- 1. Add instructor role to profiles
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'instructor', 'admin', 'moderator'));

-- 2. Add new columns to courses
alter table public.courses
  add column if not exists instructor_id    uuid references public.profiles(id) on delete set null,
  add column if not exists status           text not null default 'draft'
    check (status in ('draft', 'review', 'published', 'rejected', 'archived')),
  add column if not exists review_notes     text,         -- admin feedback on rejection
  add column if not exists requirements     text[],       -- prerequisites text
  add column if not exists category         text,
  add column if not exists language         text not null default 'en',
  add column if not exists is_free          boolean not null default false,
  add column if not exists submitted_at     timestamptz,  -- when sent for review
  add column if not exists published_at     timestamptz;

-- Migrate existing is_published → status
update public.courses set status = 'published' where is_published = true;
update public.courses set status = 'draft'     where is_published = false;

-- 3. Add new columns to lessons
alter table public.lessons
  add column if not exists content_type      text not null default 'video'
    check (content_type in ('video','canva','google_embed','text','file','quiz','exam','live')),
  add column if not exists video_source      text
    check (video_source in ('storage','youtube','vimeo','loom','wistia')),
  add column if not exists embed_url         text,
  add column if not exists embed_type        text
    check (embed_type in ('canva','google_doc','google_sheet','google_slide')),
  add column if not exists rich_text         text,
  add column if not exists live_url          text,
  add column if not exists live_scheduled_at timestamptz,
  add column if not exists drip_delay_days   int not null default 0,
  add column if not exists completion_method text not null default 'manual_mark'
    check (completion_method in ('video_watched','quiz_passed','manual_mark')),
  add column if not exists is_published      boolean not null default true;

-- 4. Lesson resources (downloadable files per lesson)
create table if not exists public.lesson_resources (
  id          uuid primary key default uuid_generate_v4(),
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  title       text not null,
  file_path   text not null,   -- Supabase Storage path
  file_size   bigint,
  mime_type   text,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

-- 5. Categories
create table if not exists public.categories (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  parent_id   uuid references public.categories(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Seed base categories
insert into public.categories (name, slug) values
  ('Business',          'business'),
  ('Finance & Wealth',  'finance-wealth'),
  ('Marketing',         'marketing'),
  ('Technology & AI',   'technology-ai'),
  ('Personal Development', 'personal-development'),
  ('Sales',             'sales'),
  ('Entrepreneurship',  'entrepreneurship'),
  ('Health & Wellness', 'health-wellness')
on conflict (slug) do nothing;

-- 6. Add category_id FK to courses
alter table public.courses
  add column if not exists category_id uuid references public.categories(id) on delete set null;

-- 7. Add modules.is_published
alter table public.modules
  add column if not exists is_published boolean not null default true;

-- 8. Indexes
create index if not exists courses_instructor_id_idx on public.courses(instructor_id);
create index if not exists courses_status_idx        on public.courses(status);
create index if not exists lesson_resources_lesson_id_idx on public.lesson_resources(lesson_id);

-- 9. updated_at trigger for lessons
drop trigger if exists lessons_updated_at on public.lessons;
create trigger lessons_updated_at before update on public.lessons
  for each row execute procedure public.set_updated_at();

-- Add updated_at to lessons if missing
alter table public.lessons
  add column if not exists updated_at timestamptz not null default now();
