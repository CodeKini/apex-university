import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET /api/platform/members/[memberId]/enrollments?workspaceId=X
// Returns all enrollments for a specific member, with course info and progress.
// Requires caller to be owner/admin/moderator/platform_admin.

export async function GET(
  req: NextRequest,
  { params }: { params: { memberId: string } },
) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  // Auth check
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', session.user.id).maybeSingle()
  const isPlatformAdmin = pu?.platform_role === 'platform_admin'

  const { data: callerMember } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', session.user.id).maybeSingle()
  const canView = isPlatformAdmin || ['owner', 'admin', 'moderator'].includes(callerMember?.role ?? '')

  if (!canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Resolve memberId to user_id
  const { data: member } = await supabase
    .from('workspace_members').select('user_id, full_name, email, avatar_url, role')
    .eq('id', params.memberId).eq('workspace_id', workspaceId).maybeSingle()

  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Fetch enrollments with course info
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`
      id, course_id, access_status, source, created_at,
      courses ( id, title, slug, thumbnail_url, difficulty, price, is_free )
    `)
    .eq('user_id', member.user_id)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  const courseIds = (enrollments ?? []).map((e: any) => e.course_id)

  // Batch-fetch progress
  let progressMap: Record<string, { completed: number; total: number; pct: number }> = {}

  if (courseIds.length > 0) {
    const [{ data: lessonCounts }, { data: completedRows }] = await Promise.all([
      supabase.from('lessons').select('course_id').in('course_id', courseIds),
      supabase.from('lesson_progress').select('course_id, completed')
        .eq('user_id', member.user_id).eq('completed', true).in('course_id', courseIds),
    ])

    const totalMap: Record<string, number> = {}
    for (const r of lessonCounts ?? []) totalMap[r.course_id] = (totalMap[r.course_id] ?? 0) + 1

    const completedMap: Record<string, number> = {}
    for (const r of completedRows ?? []) completedMap[r.course_id] = (completedMap[r.course_id] ?? 0) + 1

    for (const id of courseIds) {
      const total = totalMap[id] ?? 0
      const completed = completedMap[id] ?? 0
      progressMap[id] = { completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 }
    }
  }

  const result = (enrollments ?? []).map((e: any) => ({
    ...e,
    progress: progressMap[e.course_id] ?? { completed: 0, total: 0, pct: 0 },
  }))

  return NextResponse.json({ member, enrollments: result })
}
