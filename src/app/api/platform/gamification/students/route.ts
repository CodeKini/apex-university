// GET /api/platform/gamification/students?workspaceId=&limit=50

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp          = req.nextUrl.searchParams
  const workspaceId = sp.get('workspaceId')
  const limit       = Math.min(parseInt(sp.get('limit') ?? '50'), 200)

  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', session.user.id).single()
  const isPlatformAdmin = pu?.platform_role === 'platform_admin'

  if (!isPlatformAdmin) {
    const { data: wm } = await supabase
      .from('workspace_members').select('role')
      .eq('workspace_id', workspaceId).eq('user_id', session.user.id)
      .in('role', ['owner', 'admin']).maybeSingle()
    if (!wm) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: rows, error } = await supabase
    .from('user_xp')
    .select(`
      user_id, total_xp, current_level, current_streak_days, longest_streak_days, last_activity_date,
      user:platform_users!user_id(full_name, email, avatar_url)
    `)
    .eq('workspace_id', workspaceId)
    .order('total_xp', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = (rows ?? []).map((r: any) => r.user_id)
  const { data: badgeRows } = userIds.length
    ? await supabase
        .from('user_badges')
        .select('user_id, badge:badges!badge_id(name, icon)')
        .eq('workspace_id', workspaceId)
        .in('user_id', userIds)
    : { data: [] }

  const badgeMap: Record<string, any[]> = {}
  for (const b of badgeRows ?? []) {
    if (!badgeMap[b.user_id]) badgeMap[b.user_id] = []
    badgeMap[b.user_id].push(b.badge)
  }

  const students = (rows ?? []).map((r: any, i: number) => ({
    rank:             i + 1,
    user_id:          r.user_id,
    full_name:        (r.user as any)?.full_name ?? 'Student',
    email:            (r.user as any)?.email ?? '',
    avatar_url:       (r.user as any)?.avatar_url ?? null,
    total_xp:         r.total_xp,
    level:            r.current_level,
    streak:           r.current_streak_days,
    longest_streak:   r.longest_streak_days,
    last_active:      r.last_activity_date,
    badges:           badgeMap[r.user_id] ?? [],
  }))

  return NextResponse.json({ students })
}
