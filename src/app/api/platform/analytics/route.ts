import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { WorkspaceAnalytics }    from '@/types/analytics'

async function assertAccess(supabase: any, workspaceId: string, userId: string) {
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return true

  const { data: wm } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .in('role', ['owner', 'admin'])
    .single()
  return !!wm
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const ok = await assertAccess(supabase, workspaceId, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // ── Parallel data fetches ──────────────────────────────────────────────────
  const [
    enrollmentsRes,
    activeCoursesRes,
    revenueRes,
    recentEnrollmentsRes,
    recentActivityRes,
    publishedCoursesRes,
  ] = await Promise.all([

    // All active enrollments for unique-student count + enrollments-this-week
    supabase
      .from('enrollments')
      .select('user_id, created_at')
      .eq('workspace_id', workspaceId)
      .eq('access_status', 'active'),

    // Published course count
    supabase
      .from('courses')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'published'),

    // Total revenue from completed purchases in this workspace
    supabase
      .from('purchases')
      .select('amount_cents')
      .eq('workspace_id', workspaceId)
      .eq('status', 'completed'),

    // Recent enrollments — join workspace_members for student name/email/avatar
    supabase
      .from('enrollments')
      .select(`
        id, created_at, source,
        workspace_members!inner ( user_id, full_name, email, avatar_url ),
        courses ( id, title, slug, price, is_free )
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10),

    // Recent lesson_progress — join workspace_members for student name, lessons for title
    supabase
      .from('lesson_progress')
      .select(`
        lesson_id, last_watched, completed, progress_pct, user_id,
        lessons (
          id, title,
          courses ( id, title, slug )
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('last_watched', { ascending: false })
      .limit(20),

    // Published courses with nested lesson counts
    supabase
      .from('courses')
      .select(`
        id, title, slug,
        modules ( lessons ( id ) )
      `)
      .eq('workspace_id', workspaceId)
      .eq('status', 'published'),
  ])

  const enrollments      = enrollmentsRes.data       ?? []
  const activeCourses    = activeCoursesRes.count     ?? 0
  const purchases        = revenueRes.data            ?? []
  const recentEnrolls    = recentEnrollmentsRes.data  ?? []
  const rawActivity      = recentActivityRes.data     ?? []
  const publishedCourses = publishedCoursesRes.data   ?? []

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalStudents       = new Set(enrollments.map((e: any) => e.user_id)).size
  const enrollmentsThisWeek = enrollments.filter((e: any) => e.created_at >= oneWeekAgo).length
  // amount_cents stored as integer cents → convert to dollars
  const totalRevenue = purchases.reduce((sum: number, p: any) => sum + (p.amount_cents ?? 0), 0) / 100

  // ── Resolve student names for recent activity ──────────────────────────────
  // lesson_progress doesn't carry a direct workspace_members join (no FK).
  // Collect the unique user_ids from recent activity and batch-fetch members.
  const activityUserIds = [...new Set(rawActivity.map((r: any) => r.user_id))] as string[]
  let memberMap: Record<string, { full_name: string | null; email: string }> = {}

  if (activityUserIds.length > 0) {
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, full_name, email')
      .eq('workspace_id', workspaceId)
      .in('user_id', activityUserIds)
    for (const m of members ?? []) {
      memberMap[m.user_id] = { full_name: m.full_name, email: m.email }
    }
  }

  // Deduplicate activity: one entry per (user_id, lesson_id), take most recent
  const seen = new Set<string>()
  const recentActivity = rawActivity
    .filter((r: any) => {
      const key = `${r.user_id}:${r.lesson_id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 10)
    .map((r: any) => ({ ...r, updated_at: r.last_watched }))

  // ── Course completion stats (one query per course, batched in parallel) ───
  const courseLessonCount: Record<string, number> = {}
  for (const c of publishedCourses as any[]) {
    courseLessonCount[c.id] = (c.modules ?? []).flatMap((m: any) => m.lessons ?? []).length
  }

  const courseIds = publishedCourses.map((c: any) => c.id)

  // Fetch all enrollment user_ids per course and lesson completion counts in two
  // workspace-wide queries instead of N per-course queries.
  const [enrollmentsByCourseFetch, completionsFetch] = await Promise.all([
    supabase
      .from('enrollments')
      .select('course_id, user_id')
      .eq('workspace_id', workspaceId)
      .in('course_id', courseIds),

    supabase
      .from('lesson_progress')
      .select('course_id, user_id, completed')
      .eq('workspace_id', workspaceId)
      .eq('completed', true)
      .in('course_id', courseIds),
  ])

  // Build maps: course_id → Set<user_id>
  const enrolledUsers: Record<string, Set<string>> = {}
  for (const e of enrollmentsByCourseFetch.data ?? []) {
    if (!enrolledUsers[e.course_id]) enrolledUsers[e.course_id] = new Set()
    enrolledUsers[e.course_id].add(e.user_id)
  }

  // Build map: course_id → { user_id → completedLessonCount }
  const completedPerUser: Record<string, Record<string, number>> = {}
  for (const p of completionsFetch.data ?? []) {
    if (!completedPerUser[p.course_id]) completedPerUser[p.course_id] = {}
    completedPerUser[p.course_id][p.user_id] = (completedPerUser[p.course_id][p.user_id] ?? 0) + 1
  }

  const courseCompletions = publishedCourses.map((c: any) => {
    const totalLessons  = courseLessonCount[c.id] ?? 0
    const enrolled      = enrolledUsers[c.id] ?? new Set()
    const enrolledCount = enrolled.size
    const perUser       = completedPerUser[c.id] ?? {}

    const completedCount = enrolledCount === 0 || totalLessons === 0
      ? 0
      : [...enrolled].filter((uid) => (perUser[uid] ?? 0) >= totalLessons).length

    const completionRate = enrolledCount > 0
      ? Math.round((completedCount / enrolledCount) * 100)
      : 0

    return {
      course_id:       c.id,
      title:           c.title,
      slug:            c.slug,
      enrolled_count:  enrolledCount,
      completed_count: completedCount,
      completion_rate: completionRate,
      total_lessons:   totalLessons,
    }
  })

  // ── Shape response ─────────────────────────────────────────────────────────
  const analytics: WorkspaceAnalytics = {
    stats: { totalStudents, totalRevenue, activeCourses, enrollmentsThisWeek },

    recentEnrollments: recentEnrolls.map((e: any) => {
      const member = e.workspace_members ?? {}
      return {
        id:         e.id,
        created_at: e.created_at,
        source:     e.source,
        student: {
          id:         member.user_id    ?? '',
          full_name:  member.full_name  ?? null,
          email:      member.email      ?? '',
          avatar_url: member.avatar_url ?? null,
        },
        course: {
          id:      e.courses?.id      ?? '',
          title:   e.courses?.title   ?? '',
          slug:    e.courses?.slug    ?? '',
          price:   e.courses?.price   ?? 0,
          is_free: e.courses?.is_free ?? false,
        },
      }
    }),

    recentActivity: recentActivity.map((p: any) => ({
      lesson_id:    p.lesson_id,
      updated_at:   p.updated_at,
      completed:    p.completed,
      progress_pct: p.progress_pct ?? 0,
      student: {
        id:        p.user_id,
        full_name: memberMap[p.user_id]?.full_name ?? null,
      },
      lesson: {
        id:    p.lessons?.id    ?? '',
        title: p.lessons?.title ?? '',
      },
      course: {
        id:    p.lessons?.courses?.id    ?? '',
        title: p.lessons?.courses?.title ?? '',
        slug:  p.lessons?.courses?.slug  ?? '',
      },
    })),

    courseCompletions,
  }

  return NextResponse.json(analytics)
}
