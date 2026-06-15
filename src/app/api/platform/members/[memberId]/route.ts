import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const MANAGEABLE_ROLES = ['owner', 'admin', 'moderator', 'member'] as const
type MemberRole = typeof MANAGEABLE_ROLES[number]

async function getCallerRole(
  supabase: any,
  workspaceId: string,
  userId: string,
): Promise<'platform_admin' | MemberRole | null> {
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', userId).maybeSingle()
  if (pu?.platform_role === 'platform_admin') return 'platform_admin'

  const { data: wm } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()
  return wm?.role ?? null
}

function canManage(role: string | null) {
  return role === 'platform_admin' || role === 'owner' || role === 'admin'
}

// ── PATCH /api/platform/members/[memberId] ────────────────────────────────────
// Change a member's role. Owners cannot have their role changed.

export async function PATCH(
  req: NextRequest,
  { params }: { params: { memberId: string } },
) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { role, workspaceId } = body

  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })
  if (!role || !MANAGEABLE_ROLES.includes(role))
    return NextResponse.json({ error: `role must be one of: ${MANAGEABLE_ROLES.join(', ')}` }, { status: 422 })

  const callerRole = await getCallerRole(supabase, workspaceId, session.user.id)
  if (!canManage(callerRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch target member
  const { data: target } = await supabase
    .from('workspace_members')
    .select('id, user_id, role, workspace_id')
    .eq('id', params.memberId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (target.role === 'owner') return NextResponse.json({ error: 'Cannot change the owner role' }, { status: 403 })
  if (role === 'owner') return NextResponse.json({ error: 'Cannot assign owner role via this endpoint' }, { status: 403 })

  // Admins cannot promote to admin — only owners/platform_admins can
  if (role === 'admin' && callerRole !== 'owner' && callerRole !== 'platform_admin')
    return NextResponse.json({ error: 'Only the workspace owner can assign admin role' }, { status: 403 })

  const { data: updated, error } = await supabase
    .from('workspace_members')
    .update({ role })
    .eq('id', params.memberId)
    .eq('workspace_id', workspaceId)
    .select('id, user_id, email, full_name, role')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: updated })
}

// ── DELETE /api/platform/members/[memberId] ───────────────────────────────────
// Remove a member from the workspace. Owners cannot be removed.

export async function DELETE(
  req: NextRequest,
  { params }: { params: { memberId: string } },
) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const callerRole = await getCallerRole(supabase, workspaceId, session.user.id)
  if (!canManage(callerRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: target } = await supabase
    .from('workspace_members')
    .select('id, user_id, role')
    .eq('id', params.memberId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (target.role === 'owner') return NextResponse.json({ error: 'Cannot remove the workspace owner' }, { status: 403 })

  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('id', params.memberId)
    .eq('workspace_id', workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
