-- ============================================================
-- PHASE 1: MULTI-TENANT FOUNDATION
-- Run in Supabase SQL Editor after 002_revenue_payouts.sql
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

create type public.workspace_plan_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'paused'
);

create type public.workspace_member_role as enum (
  'owner', 'admin', 'moderator', 'member'
);

create type public.platform_user_role as enum (
  'creator', 'platform_admin'
);

-- ============================================================
-- PLATFORM USERS
-- Creators and platform admins. ID mirrors auth.users.id.
-- Students/workspace members are in workspace_members instead.
-- ============================================================

create table public.platform_users (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text not null,
  full_name          text,
  avatar_url         text,
  platform_role      public.platform_user_role not null default 'creator',
  stripe_customer_id text unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index platform_users_email_idx on public.platform_users(email);
create index platform_users_role_idx  on public.platform_users(platform_role);

-- ============================================================
-- WORKSPACES
-- Each creator owns one or more workspaces (their academy).
-- ============================================================

create table public.workspaces (
  id                    uuid primary key default uuid_generate_v4(),
  slug                  text not null unique,
  name                  text not null,
  tagline               text,
  logo_url              text,
  favicon_url           text,
  cover_url             text,

  -- Ownership
  owner_id              uuid not null references public.platform_users(id) on delete restrict,

  -- Billing / plan
  plan_name             text not null default 'trial',
  plan_status           public.workspace_plan_status not null default 'trialing',
  stripe_customer_id    text,
  stripe_subscription_id text,
  trial_ends_at         timestamptz not null default (now() + interval '14 days'),

  -- Usage counters (updated by triggers or API)
  seats_used            integer not null default 0,
  storage_used_bytes    bigint  not null default 0,

  -- Flexible settings (accent color, login page copy, etc.)
  settings              jsonb not null default '{}',

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index workspaces_owner_idx      on public.workspaces(owner_id);
create index workspaces_slug_idx       on public.workspaces(slug);
create index workspaces_plan_status_idx on public.workspaces(plan_status);

-- ============================================================
-- WORKSPACE MEMBERS
-- Students / community members scoped to one workspace.
-- A single auth.users account can be a member of many workspaces.
-- ============================================================

create table public.workspace_members (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,

  -- Denormalized for fast reads (synced from auth.users on sign-up)
  email        text not null,
  full_name    text,
  avatar_url   text,

  role         public.workspace_member_role not null default 'member',
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz,

  unique (workspace_id, user_id)
);

create index workspace_members_workspace_idx on public.workspace_members(workspace_id);
create index workspace_members_user_idx      on public.workspace_members(user_id);
create index workspace_members_role_idx      on public.workspace_members(workspace_id, role);

-- ============================================================
-- WORKSPACE INVITES
-- Used to invite team members (admins, moderators) into a workspace.
-- Students join via direct enrollment flow instead.
-- ============================================================

create table public.workspace_invites (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invited_by   uuid not null references auth.users(id) on delete cascade,
  email        text not null,
  role         public.workspace_member_role not null default 'member',
  token        text not null unique default encode(gen_random_bytes(32), 'hex'),
  accepted_at  timestamptz,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  created_at   timestamptz not null default now()
);

create index workspace_invites_token_idx      on public.workspace_invites(token);
create index workspace_invites_workspace_idx  on public.workspace_invites(workspace_id);
create index workspace_invites_email_idx      on public.workspace_invites(email);

-- ============================================================
-- WORKSPACE DOMAINS (custom domain support — future)
-- ============================================================

create table public.workspace_domains (
  id                    uuid primary key default uuid_generate_v4(),
  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  domain                text not null unique,
  verified              boolean not null default false,
  ssl_provisioned       boolean not null default false,
  txt_verification_key  text not null default encode(gen_random_bytes(16), 'hex'),
  created_at            timestamptz not null default now()
);

create index workspace_domains_workspace_idx on public.workspace_domains(workspace_id);
create index workspace_domains_domain_idx    on public.workspace_domains(domain);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger platform_users_updated_at
  before update on public.platform_users
  for each row execute function public.handle_updated_at();

create trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.handle_updated_at();

-- ============================================================
-- TRIGGER: Auto-create platform_user on creator signup
-- Fires when Supabase auth creates a new user whose metadata
-- includes { account_type: 'creator' } (set by the platform
-- signup page). Students signing up inside a workspace get
-- added to workspace_members via the API instead.
-- ============================================================

create or replace function public.handle_new_platform_user()
returns trigger language plpgsql security definer as $$
begin
  if (new.raw_user_meta_data ->> 'account_type') = 'creator' then
    insert into public.platform_users (id, email, full_name, avatar_url, platform_role)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      new.raw_user_meta_data ->> 'avatar_url',
      'creator'
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created_platform
  after insert on auth.users
  for each row execute function public.handle_new_platform_user();

-- ============================================================
-- WORKSPACE_ID INTEGRATION STRATEGY (for future migrations)
-- ============================================================
-- When building Phase 2 (courses) and beyond, every new table
-- that belongs to a workspace follows this pattern:
--
--   workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
--
-- Index:
--   CREATE INDEX <table>_workspace_idx ON <table>(workspace_id);
--   CREATE INDEX <table>_workspace_id_idx ON <table>(workspace_id, id);
--
-- RLS:
--   All SELECT/INSERT/UPDATE/DELETE policies check workspace_id
--   against the caller's membership (via is_workspace_member()).
--
-- Application layer:
--   Every server component and API route reads workspace_id from
--   the x-workspace-id request header (set by middleware) and
--   passes it explicitly to every Supabase query as defense-in-depth.
--   Never trust a workspace_id from the client request body.
--
-- Migration path for EXISTING tables (courses, modules, lessons,
-- enrollments, purchases created in 001/002 migrations):
--   Phase 2 migration will:
--   1. Add nullable workspace_id column
--   2. Create a "legacy" default workspace owned by platform_admin
--   3. Back-fill all existing rows to that workspace
--   4. Set NOT NULL constraint
--   This lets existing data survive while the multi-tenant layer
--   wraps around it.
-- ============================================================
