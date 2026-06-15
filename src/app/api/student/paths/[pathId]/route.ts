// GET /api/student/paths/[pathId] — path detail with per-course lock/progress status

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: { pathId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: path } = await supabase
    .from('learning_paths')
    .select(`
      id, workspace_id, title, slug, description, thumbnail_url,
      difficulty, estimated_hours, status, certificates_enabled,
      courses:learning_path_courses(
        id, position,
        course:courses(id, title, slug, thumbnail_url, status)
      )
    `)
    .eq('id', params.pathId)
    .eq('status', 'published')
    .maybeSingle()

  if (!path) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Must be a workspace member
  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', path.workspace_id).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  path.courses.sort((a: any, b: any) => a.position - b.position)
  const courseIds = path.courses.map((pc: any) => pc.course.id)

  const [{ data: progressRows }, { data: lessonCounts }, { data: enrollment }, { data: pathCert }] = await Promise.all([
    supabase.from('lesson_progress')
      .select('course_id, lesson_id, completed')
      .eq('user_id', session.user.id)
      .in('course_id', courseIds)
      .eq('completed', true),
    supabase.from('lessons')
      .select('course_id, id')
      .in('course_id', courseIds),
    supabase.from('learning_path_enrollments')
      .select('enrolled_at, completed_at').eq('path_id', params.pathId).eq('user_id', session.user.id).maybeSingle(),
    supabase.from('path_certificates')
      .select('verification_code, storage_url, issued_at').eq('path_id', params.pathId).eq('user_id', session.user.id).maybeSingle(),
  ])

  // Build per-course progress map
  const completedByCourse: Record<string, Set<string>> = {}
  const totalByCourse:     Record<string, number>       = {}
  for (const row of progressRows ?? []) {
    if (!completedByCourse[row.course_id]) completedByCourse[row.course_id] = new Set()
    completedByCourse[row.course_id].add(row.lesson_id)
  }
  for (const lesson of lessonCounts ?? []) {
    totalByCourse[lesson.course_id] = (totalByCourse[lesson.course_id] ?? 0) + 1
  }

  const isCourseComplete = (courseId: string) => {
    const total     = totalByCourse[courseId] ?? 0
    const completed = completedByCourse[courseId]?.size ?? 0
    return total > 0 && completed >= total
  }

  const coursesWithStatus = path.courses.map((pc: any, idx: number) => {
    const cId     = pc.course.id
    const total   = totalByCourse[cId] ?? 0
    const done    = completedByCourse[cId]?.size ?? 0
    const complete = isCourseComplete(cId)
    // Locked if any prior course is not complete
    const locked  = idx > 0 && !isCourseComplete(path.courses[idx - 1].course.id)
    return {
      ...pc,
      progress: { completed: done, total, complete },
      locked,
    }
  })

  return NextResponse.json({
    path: { ...path, courses: coursesWithStatus },
    enrollment: enrollment ?? null,
    certificate: pathCert ?? null,
  })
}
