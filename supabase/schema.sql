-- ============================================================
-- APEX UNIVERSITY — SUPABASE DATABASE SCHEMA
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- Auto-created when a user signs up via a trigger (see below).
-- ============================================================
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null,
  full_name   text,
  avatar_url  text,
  role        text not null default 'student' check (role in ('student', 'admin')),
  bio         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- COURSES
-- ============================================================
create table public.courses (
  id            uuid primary key default uuid_generate_v4(),
  slug          text not null unique,
  title         text not null,
  short_desc    text not null,
  long_desc     text not null,
  price         numeric(10,2) not null default 0,
  thumbnail_url text,
  difficulty    text not null default 'Beginner' check (difficulty in ('Beginner','Intermediate','Advanced')),
  duration_hrs  numeric(5,1) not null default 0,
  is_published  boolean not null default false,
  outcomes      text[],                     -- array of learning outcome strings
  stripe_price_id text,                     -- Stripe Price ID for this course
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- MODULES (sections within a course)
-- ============================================================
create table public.modules (
  id          uuid primary key default uuid_generate_v4(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  title       text not null,
  description text,
  position    integer not null default 0,   -- display order
  created_at  timestamptz not null default now()
);

-- ============================================================
-- LESSONS (individual videos/readings inside a module)
-- ============================================================
create table public.lessons (
  id            uuid primary key default uuid_generate_v4(),
  module_id     uuid not null references public.modules(id) on delete cascade,
  course_id     uuid not null references public.courses(id) on delete cascade,
  title         text not null,
  description   text,
  video_url     text,                       -- Supabase Storage URL or external
  thumbnail_url text,
  duration_mins integer not null default 0,
  position      integer not null default 0,
  is_free       boolean not null default false, -- preview lesson?
  created_at    timestamptz not null default now()
);

-- ============================================================
-- ENROLLMENTS
-- Created by Stripe webhook after successful payment.
-- ============================================================
create table public.enrollments (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique(user_id, course_id)               -- one enrollment per user/course
);

-- ============================================================
-- LESSON PROGRESS
-- ============================================================
create table public.lesson_progress (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  lesson_id    uuid not null references public.lessons(id) on delete cascade,
  course_id    uuid not null references public.courses(id) on delete cascade,
  completed    boolean not null default false,
  progress_pct integer not null default 0 check (progress_pct between 0 and 100),
  last_watched timestamptz not null default now(),
  unique(user_id, lesson_id)
);

-- ============================================================
-- PURCHASES (payment audit trail)
-- ============================================================
create table public.purchases (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  course_id             uuid not null references public.courses(id) on delete cascade,
  stripe_session_id     text not null unique,
  stripe_payment_intent text,
  amount_cents          integer not null,
  currency              text not null default 'usd',
  status                text not null default 'pending' check (status in ('pending','completed','refunded')),
  purchased_at          timestamptz not null default now()
);

-- ============================================================
-- ADMIN ACTIVITY LOGS
-- ============================================================
create table public.admin_activity_logs (
  id          uuid primary key default uuid_generate_v4(),
  admin_id    uuid not null references public.profiles(id) on delete cascade,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TRIGGER: updated_at timestamps
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger courses_updated_at before update on public.courses
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- INDEXES for performance
-- ============================================================
create index on public.enrollments(user_id);
create index on public.enrollments(course_id);
create index on public.lesson_progress(user_id, course_id);
create index on public.lessons(module_id);
create index on public.modules(course_id);
create index on public.purchases(stripe_session_id);
