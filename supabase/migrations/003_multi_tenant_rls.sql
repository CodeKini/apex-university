-- ============================================================
-- PHASE 1: MULTI-TENANT RLS POLICIES
-- Run immediately after 003_multi_tenant_core.sql
-- ============================================================

-- ============================================================
-- SECURITY-DEFINER HELPER FUNCTIONS
-- These bypass RLS on the tables they query, preventing infinite
-- recursion when RLS policies call them.
-- ============================================================

-- Is the current user a platform admin?
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.platform_users
    where id = auth.uid() and platform_role = 'platform_admin'
  );
$$;

-- Is the current user any kind of member of the given workspace?
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  );
$$;

-- Is the current user an admin or owner of the given workspace?
create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- Is the current user the owner of the given workspace?
create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.workspaces
    where id = p_workspace_id and owner_id = auth.uid()
  );
$$;

-- Is the current user a creator (any platform_user)?
create or replace function public.is_creator()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.platform_users where id = auth.uid()
  );
$$;

-- ============================================================
-- ENABLE RLS
-- ============================================================

alter table public.platform_users      enable row level security;
alter table public.workspaces          enable row level security;
alter table public.workspace_members   enable row level security;
alter table public.workspace_invites   enable row level security;
alter table public.workspace_domains   enable row level security;

-- ============================================================
-- PLATFORM_USERS POLICIES
-- ============================================================

-- Creators can read their own row; platform admins see all
create policy "platform_users: read own or admin"
  on public.platform_users for select
  using (id = auth.uid() or is_platform_admin());

-- Creators can update their own row (not platform_role)
create policy "platform_users: update own"
  on public.platform_users for update
  using (id = auth.uid())
  with check (id = auth.uid() and platform_role = (
    select platform_role from public.platform_users where id = auth.uid()
  ));

-- Platform admins can update anyone
create policy "platform_users: admin update all"
  on public.platform_users for update
  using (is_platform_admin());

-- Insert is handled by trigger (handle_new_platform_user) or API routes using service role.
-- No direct client INSERT allowed.

-- Platform admins can delete
create policy "platform_users: admin delete"
  on public.platform_users for delete
  using (is_platform_admin());

-- ============================================================
-- WORKSPACES POLICIES
-- ============================================================

-- Owners, members, and platform admins can read a workspace
create policy "workspaces: read if member or admin"
  on public.workspaces for select
  using (
    owner_id = auth.uid()
    or is_workspace_member(id)
    or is_platform_admin()
  );

-- Any creator can create a workspace (they become owner)
create policy "workspaces: creator can insert"
  on public.workspaces for insert
  with check (owner_id = auth.uid() and is_creator());

-- Only the owner or platform admin can update
create policy "workspaces: owner or admin can update"
  on public.workspaces for update
  using (owner_id = auth.uid() or is_platform_admin())
  with check (owner_id = auth.uid() or is_platform_admin());

-- Only platform admins can delete workspaces
create policy "workspaces: platform admin can delete"
  on public.workspaces for delete
  using (is_platform_admin());

-- ============================================================
-- WORKSPACE_MEMBERS POLICIES
-- Note: No helper function call here to avoid recursion —
-- we query auth.uid() directly against the table.
-- ============================================================

-- Members can see other members in their workspace
create policy "workspace_members: read within workspace"
  on public.workspace_members for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid()
    )
    or is_platform_admin()
  );

-- Workspace owners/admins can add members
create policy "workspace_members: admin can insert"
  on public.workspace_members for insert
  with check (
    is_workspace_admin(workspace_id)
    or is_platform_admin()
    -- Allow self-join (accepting an invite): user_id matches caller
    or user_id = auth.uid()
  );

-- Owners/admins can update member roles; members can update own profile fields
create policy "workspace_members: update own or as admin"
  on public.workspace_members for update
  using (
    user_id = auth.uid()
    or is_workspace_admin(workspace_id)
    or is_platform_admin()
  );

-- Owners/admins can remove members; members can leave (delete own row)
create policy "workspace_members: delete own or as admin"
  on public.workspace_members for delete
  using (
    user_id = auth.uid()
    or is_workspace_admin(workspace_id)
    or is_platform_admin()
  );

-- ============================================================
-- WORKSPACE_INVITES POLICIES
-- ============================================================

-- Workspace admins + platform admins can see invites
create policy "workspace_invites: admin can select"
  on public.workspace_invites for select
  using (is_workspace_admin(workspace_id) or is_platform_admin());

-- Workspace admins can create invites
create policy "workspace_invites: admin can insert"
  on public.workspace_invites for insert
  with check (is_workspace_admin(workspace_id) or is_platform_admin());

-- Workspace admins can revoke (delete) invites
create policy "workspace_invites: admin can delete"
  on public.workspace_invites for delete
  using (is_workspace_admin(workspace_id) or is_platform_admin());

-- ============================================================
-- WORKSPACE_DOMAINS POLICIES
-- ============================================================

-- Workspace admins and platform admins can manage domains
create policy "workspace_domains: admin can all"
  on public.workspace_domains for all
  using (is_workspace_admin(workspace_id) or is_platform_admin())
  with check (is_workspace_admin(workspace_id) or is_platform_admin());

-- Members can read their workspace's domain (for display)
create policy "workspace_domains: members can read"
  on public.workspace_domains for select
  using (is_workspace_member(workspace_id) or is_platform_admin());
