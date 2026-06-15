// GET /api/student/gamification/leaderboard?workspaceId=&courseId=&limit=50

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp          = req.nextUrl.searchParams
  const workspaceId = sp.get('workspaceId')
  const courseId    = sp.get('courseId') // optional: course-scoped leaderboard
  const limit       = Math.min(parseInt(sp.get('limit') ?? '50'), 100)

  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  let userIds: string[] | null = null

  if (courseId) {
    // Course leaderboard: only students enrolled in this course
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('user_id')
      .eq('course_id', courseId)
      .eq('workspace_id', workspaceId)
      .eq('access_status', 'active')

    userIds = (enrollments ?? []).map((e: any) => e.user_id)
    if (!userIds?.length) return NextResponse.json({ entries: [], my_rank: null })
  }

  // Build leaderboard query
  let q = supabase
    .from('user_xp')
    .select(`
      user_id, total_xp, current_level, current_streak_days,
      user:platform_users!user_id(full_name, avatar_url)
    `)
    .eq('workspace_id', workspaceId)
    .order('total_xp', { ascending: false })
    .limit(limit)

  if (userIds?.length) q = q.in('user_id', userIds)

  const { data: rows, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Badge counts per user
  const rankedUserIds = (rows ?? []).map((r: any) => r.user_id)
  const { data: badgeRows } = rankedUserIds.length
    ? await supabase
        .from('user_badges')
        .select('user_id')
        .eq('workspace_id', workspaceId)
        .in('user_id', rankedUserIds)
    : { data: [] }

  const badgeCounts: Record<string, number> = {}
  for (const b of badgeRows ?? []) {
    badgeCounts[b.user_id] = (badgeCounts[b.user_id] ?? 0) + 1
  }

  const entries = (rows ?? []).map((r: any, i: number) => ({
    rank:        i + 1,
    user_id:     r.user_id,
    full_name:   (r.user as any)?.full_name ?? 'Student',
    avatar_url:  (r.user as any)?.avatar_url ?? null,
    total_xp:    r.total_xp,
    level:       r.current_level,
    streak:      r.current_streak_days,
    badge_count: badgeCounts[r.user_id] ?? 0,
    is_me:       r.user_id === session.user.id,
  }))

  const myRank = entries.find((e: any) => e.is_me)?.rank ?? null

  return NextResponse.json({ entries, my_rank: myRank })
}
