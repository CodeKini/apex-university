// GET /api/platform/paths/[pathId]/analytics — enrollment + completion stats

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function requireManager(supabase: any, pathId: string, userId: string) {
  const { data: path } = await supabase.from('learning_paths').select('workspace_id, title').eq('id', pathId).maybeSingle()
  if (!path) return null
  const { data: wm } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', path.workspace_id).eq('user_id', userId).maybeSingle()
  return wm && ['owner','admin'].includes(wm.role) ? path : null
}

export async function GET(_req: NextRequest, { params }: { params: { pathId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pathMeta = await requireManager(supabase, params.pathId, session.user.id)
  if (!pathMeta) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [
    { count: totalEnrolled },
    { count: totalCompleted },
    { data: enrollments },
    { data: pathCourses },
  ] = await Promise.all([
    supabase.from('learning_path_enrollments').select('id', { count: 'exact', head: true }).eq('path_id', params.pathId),
    supabase.from('learning_path_enrollments').select('id', { count: 'exact', head: true }).eq('path_id', params.pathId).not('completed_at', 'is', null),
    supabase.from('learning_path_enrollments')
      .select('user_id, enrolled_at, completed_at, user:platform_users!user_id(full_name, email)')
      .eq('path_id', params.pathId)
      .order('enrolled_at', { ascending: false })
      .limit(100),
    supabase.from('learning_path_courses').select('course_id, position, course:courses(id,title)').eq('path_id', params.pathId).order('position'),
  ])

  // Per-student course progress
  const studentIds = (enrollments ?? []).map((e: any) => e.user_id)
  let studentProgress: Record<string, Record<string, boolean>> = {}

  if (studentIds.length > 0 && pathCourses?.length) {
    const { data: progressRows } = await supabase
      .from('lesson_progress')
      .select('user_id, course_id, completed')
      .in('user_id', studentIds)
      .in('course_id', pathCourses.map((pc: any) => pc.course_id))
      .eq('completed', true)

    for (const row of progressRows ?? []) {
      if (!studentProgress[row.user_id]) studentProgress[row.user_id] = {}
      studentProgress[row.user_id][row.course_id] = true
    }
  }

  const enrichedEnrollments = (enrollments ?? []).map((e: any) => {
    const completed = (pathCourses ?? []).filter((pc: any) => studentProgress[e.user_id]?.[pc.course_id]).length
    return {
      ...e,
      courses_completed: completed,
      courses_total: (pathCourses ?? []).length,
    }
  })

  return NextResponse.json({
    total_enrolled:  totalEnrolled  ?? 0,
    total_completed: totalCompleted ?? 0,
    completion_rate: totalEnrolled ? Math.round(((totalCompleted ?? 0) / totalEnrolled) * 100) : 0,
    enrollments:     enrichedEnrollments,
    path_courses:    pathCourses ?? [],
  })
}
