// GET /api/student/gamification/me?workspaceId=

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getLevelInfo }               from '@/lib/gamification/xp'

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const [{ data: uxp }, { data: settings }, { data: allBadges }, { data: earnedBadges }] =
    await Promise.all([
      supabase.from('user_xp')
        .select('total_xp, current_level, current_streak_days, longest_streak_days, last_activity_date')
        .eq('workspace_id', workspaceId).eq('user_id', session.user.id).maybeSingle(),
      supabase.from('xp_settings')
        .select('enabled').eq('workspace_id', workspaceId).maybeSingle(),
      supabase.from('badges')
        .select('id, key, name, description, icon, sort_order')
        .eq('workspace_id', workspaceId).eq('is_enabled', true)
        .order('sort_order'),
      supabase.from('user_badges')
        .select('badge_id, awarded_at')
        .eq('workspace_id', workspaceId).eq('user_id', session.user.id),
    ])

  const totalXp   = uxp?.total_xp ?? 0
  const levelInfo = getLevelInfo(totalXp)
  const awardedMap = new Map((earnedBadges ?? []).map((b: any) => [b.badge_id, b.awarded_at]))

  const badges = (allBadges ?? []).map((b: any) => ({
    ...b,
    earned:     awardedMap.has(b.id),
    awarded_at: awardedMap.get(b.id) ?? null,
  }))

  return NextResponse.json({
    enabled: settings?.enabled ?? true,
    xp: {
      total:        totalXp,
      ...levelInfo,
    },
    streak: {
      current: uxp?.current_streak_days ?? 0,
      longest: uxp?.longest_streak_days ?? 0,
      last_activity_date: uxp?.last_activity_date ?? null,
    },
    badges,
  })
}
