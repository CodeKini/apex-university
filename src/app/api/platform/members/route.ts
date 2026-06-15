import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function getCallerRole(
  supabase: any,
  workspaceId: string,
  userId: string,
): Promise<'platform_admin' | 'owner' | 'admin' | 'moderator' | 'member' | null> {
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
function canView(role: string | null) {
  return canManage(role) || role === 'moderator'
}

// ── GET /api/platform/members?workspaceId=X ───────────────────────────────────
// Returns all workspace_members with denormalized enrollment count per member.

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const callerRole = await getCallerRole(supabase, workspaceId, session.user.id)
  if (!canView(callerRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch all members
  const { data: members, error } = await supabase
    .from('workspace_members')
    .select('id, user_id, email, full_name, avatar_url, role, joined_at, last_seen_at')
    .eq('workspace_id', workspaceId)
    .order('joined_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Batch-fetch enrollment counts for all members in this workspace
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('user_id, course_id, access_status')
    .eq('workspace_id', workspaceId)
    .eq('access_status', 'active')

  const enrollCountByUser: Record<string, number> = {}
  for (const e of enrollments ?? []) {
    enrollCountByUser[e.user_id] = (enrollCountByUser[e.user_id] ?? 0) + 1
  }

  const result = (members ?? []).map((m: any) => ({
    ...m,
    enrolled_course_count: enrollCountByUser[m.user_id] ?? 0,
  }))

  return NextResponse.json({ members: result, callerRole })
}
