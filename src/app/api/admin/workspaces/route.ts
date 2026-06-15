// GET  /api/admin/workspaces?search=&status=&page=
// PATCH /api/admin/workspaces  { workspaceId, action: 'suspend'|'reactivate' }

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin, auditLog } from '@/lib/admin/guard'

const PAGE_SIZE = 25

export async function GET(req: NextRequest) {
  const { supabase, error, session } = await requirePlatformAdmin()
  if (error) return error

  const { searchParams } = req.nextUrl
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? 'all'
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1'))

  let q = supabase
    .from('workspaces')
    .select(`
      id, name, slug, plan_name, plan_status, seats_used, storage_used_bytes,
      created_at, suspended_at, trial_ends_at,
      owner:platform_users!workspaces_owner_id_fkey ( id, email, full_name )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (search) q = q.or(`name.ilike.%${search}%,slug.ilike.%${search}%`)
  if (status !== 'all') q = q.eq('plan_status', status)

  // Fetch course count per workspace in parallel
  const [{ data, count, error: qErr }, { data: courseCounts }] = await Promise.all([
    q,
    supabase.from('courses').select('workspace_id'),
  ])

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  // Build course count map
  const courseMap: Record<string, number> = {}
  for (const c of courseCounts ?? []) {
    courseMap[c.workspace_id] = (courseMap[c.workspace_id] ?? 0) + 1
  }

  const workspaces = (data ?? []).map((w: any) => ({
    ...w,
    course_count: courseMap[w.id] ?? 0,
  }))

  return NextResponse.json({ workspaces, total: count ?? 0, page, has_more: (count ?? 0) > page * PAGE_SIZE })
}

export async function PATCH(req: NextRequest) {
  const { supabase, error, session } = await requirePlatformAdmin()
  if (error) return error

  const { workspaceId, action } = await req.json().catch(() => ({}))
  if (!workspaceId || !['suspend', 'reactivate'].includes(action))
    return NextResponse.json({ error: 'workspaceId and action (suspend|reactivate) required' }, { status: 422 })

  const update = action === 'suspend'
    ? { suspended_at: new Date().toISOString(), suspended_by: session!.user.id }
    : { suspended_at: null, suspended_by: null }

  const { error: upErr } = await supabase.from('workspaces').update(update).eq('id', workspaceId)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  await auditLog({
    adminId: session!.user.id, action, targetType: 'workspace', targetId: workspaceId,
  })

  return NextResponse.json({ ok: true })
}
