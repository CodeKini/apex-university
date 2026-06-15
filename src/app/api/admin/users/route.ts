// GET  /api/admin/users?search=&page=
// PATCH /api/admin/users  { userId, action: 'suspend'|'reactivate' }

import { NextRequest, NextResponse }          from 'next/server'
import { requirePlatformAdmin, auditLog }     from '@/lib/admin/guard'

const PAGE_SIZE = 25

export async function GET(req: NextRequest) {
  const { supabase, error } = await requirePlatformAdmin()
  if (error) return error

  const search = req.nextUrl.searchParams.get('search') ?? ''
  const page   = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1'))

  let q = supabase
    .from('platform_users')
    .select('id, email, full_name, avatar_url, platform_role, created_at, suspended_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (search) q = q.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)

  const { data, count, error: qErr } = await q
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  // Attach workspace count per user
  const userIds = (data ?? []).map((u: any) => u.id)
  const { data: workspaceCounts } = userIds.length
    ? await supabase.from('workspaces').select('owner_id').in('owner_id', userIds)
    : { data: [] }

  const wsMap: Record<string, number> = {}
  for (const w of workspaceCounts ?? []) wsMap[w.owner_id] = (wsMap[w.owner_id] ?? 0) + 1

  const users = (data ?? []).map((u: any) => ({ ...u, workspace_count: wsMap[u.id] ?? 0 }))

  return NextResponse.json({ users, total: count ?? 0, page, has_more: (count ?? 0) > page * PAGE_SIZE })
}

export async function PATCH(req: NextRequest) {
  const { supabase, error, session } = await requirePlatformAdmin()
  if (error) return error

  const { userId, action } = await req.json().catch(() => ({}))
  if (!userId || !['suspend', 'reactivate'].includes(action))
    return NextResponse.json({ error: 'userId and action required' }, { status: 422 })

  const suspended_at = action === 'suspend' ? new Date().toISOString() : null
  const { error: upErr } = await supabase.from('platform_users').update({ suspended_at }).eq('id', userId)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  await auditLog({ adminId: session!.user.id, action, targetType: 'user', targetId: userId })

  return NextResponse.json({ ok: true })
}
