// Server-side access-control helpers for workspace routes and API routes.
// Call these at the top of Server Components and API handlers.
// Each throws / redirects on failure so callers can just await them.

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { WorkspaceMember, WorkspaceMemberRole } from '@/types/workspace'

// Returns the current auth session or redirects to /login.
export async function requireSession() {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  return session
}

// Asserts the caller is a platform_user (creator or platform_admin).
// Use on all /platform/* page routes.
export async function requirePlatformUser() {
  const session = await requireSession()
  const supabase = createServerSupabaseClient()
  const { data } = await (supabase as any)
    .from('platform_users')
    .select('id, platform_role')
    .eq('id', session.user.id)
    .single()
  if (!data) redirect('/platform/auth/signup')
  return { session, platformUser: data }
}

// Asserts the caller is a platform_admin.
// Use on /admin/* routes after the multi-tenant pivot.
export async function requirePlatformAdmin() {
  const { session, platformUser } = await requirePlatformUser()
  if (platformUser.platform_role !== 'platform_admin') redirect('/platform/dashboard')
  return { session, platformUser }
}

// Asserts the caller owns the given workspace.
export async function requireWorkspaceOwner(workspaceId: string) {
  const { session } = await requirePlatformUser()
  const supabase = createServerSupabaseClient()
  const { data } = await (supabase as any)
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', session.user.id)
    .single()
  if (!data) redirect('/platform/dashboard')
  return session
}

// Returns the caller's workspace_members row or null if not a member.
export async function getWorkspaceMembership(
  workspaceId: string
): Promise<WorkspaceMember | null> {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data } = await (supabase as any)
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', session.user.id)
    .single()
  return data ?? null
}

// Asserts the caller is a member of the workspace with at least `minRole`.
// Role hierarchy: owner > admin > moderator > member
const ROLE_RANK: Record<WorkspaceMemberRole, number> = {
  owner: 4, admin: 3, moderator: 2, member: 1,
}

export async function requireWorkspaceMember(
  workspaceId: string,
  minRole: WorkspaceMemberRole = 'member'
): Promise<WorkspaceMember> {
  const membership = await getWorkspaceMembership(workspaceId)
  if (!membership || ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
    redirect('/')
  }
  return membership
}
