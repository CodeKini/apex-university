import { NextRequest, NextResponse }         from 'next/server'
import { createServerSupabaseClient }       from '@/lib/supabase/server'
import { z }                                from 'zod'
import { progressLimit, rateLimitResponse } from '@/lib/rateLimit'
import { issueCertificate, isCourseComplete } from '@/lib/certificates/generate'
import { issuePathCertificate, isPathComplete } from '@/lib/certificates/path'
import { awardXP }                          from '@/lib/gamification/xp'

// ─── GET /api/platform/progress?courseId=X ───────────────────
// Returns all lesson_progress rows for the current user in a course.
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const courseId = req.nextUrl.searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

  const { data } = await (supabase as any)
    .from('lesson_progress')
    .select('lesson_id, completed, progress_pct, last_watched')
    .eq('user_id', session.user.id)
    .eq('course_id', courseId)

  // Return as a map keyed by lesson_id for O(1) lookup on the client
  const progressMap: Record<string, { completed: boolean; progress_pct: number; last_watched: string }> = {}
  for (const row of data ?? []) {
    progressMap[row.lesson_id] = {
      completed:    row.completed,
      progress_pct: row.progress_pct,
      last_watched: row.last_watched,
    }
  }

  return NextResponse.json({ progress: progressMap })
}

// ─── POST /api/platform/progress ─────────────────────────────
// Upsert a lesson progress record.
// Security: user can only write their own progress for courses they're enrolled in
// (or free lessons they can access without enrollment).
const ProgressSchema = z.object({
  lesson_id:    z.string().uuid(),
  course_id:    z.string().uuid(),
  workspace_id: z.string().uuid().optional(),
  completed:    z.boolean(),
  progress_pct: z.number().int().min(0).max(100).optional().default(0),
})

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await progressLimit(req, session.user.id)
  if (!rl.ok) return rateLimitResponse(rl, 'Progress update limit reached. Please slow down.')

  const body   = await req.json()
  const parsed = ProgressSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { lesson_id, course_id, workspace_id, completed, progress_pct } = parsed.data

  // Verify access: enrolled OR lesson is free
  const { data: lesson } = await (supabase as any)
    .from('lessons')
    .select('id, is_free')
    .eq('id', lesson_id)
    .single()

  if (!lesson) return NextResponse.json({ error: 'Lesson not found.' }, { status: 404 })

  if (!lesson.is_free) {
    // Must be enrolled
    const q = supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('course_id', course_id)
      .eq('access_status', 'active')

    if (workspace_id) q.eq('workspace_id', workspace_id)
    const { data: enrollment } = await q.maybeSingle()

    if (!enrollment) {
      return NextResponse.json({ error: 'Not enrolled in this course.' }, { status: 403 })
    }
  }

  // Upsert — unique on (user_id, lesson_id)
  const { data, error } = await (supabase as any)
    .from('lesson_progress')
    .upsert(
      {
        user_id:      session.user.id,
        lesson_id,
        course_id,
        workspace_id: workspace_id ?? null,
        completed,
        progress_pct: completed ? 100 : progress_pct,
        last_watched: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Award XP for lesson completion (fire-and-forget)
  if (completed && workspace_id) {
    ;(async () => {
      try {
        await awardXP({ userId: session.user.id, workspaceId: workspace_id, eventType: 'complete_lesson', referenceId: lesson_id })
      } catch {}
    })()
  }

  // Auto-issue certificate when course is 100% complete
  if (completed) {
    const sb = supabase as any
    const allDone = await isCourseComplete(sb, session.user.id, course_id)
    if (allDone) {
      // Fire-and-forget: don't block the response
      ;(async () => {
        try {
          // Fetch everything needed for the certificate
          const [{ data: courseRow }, { data: pu }, { data: ws }, { data: enroll }] = await Promise.all([
            sb.from('courses').select('title, workspace_id, certificates_enabled').eq('id', course_id).single(),
            sb.from('platform_users').select('full_name, email').eq('id', session.user.id).single(),
            workspace_id
              ? sb.from('workspaces').select('name').eq('id', workspace_id).single()
              : Promise.resolve({ data: null }),
            sb.from('enrollments').select('id')
              .eq('user_id', session.user.id).eq('course_id', course_id)
              .eq('access_status', 'active').maybeSingle(),
          ])

          if (!courseRow?.certificates_enabled) return

          const wsId = workspace_id ?? courseRow?.workspace_id
          let wsName = ws?.name
          if (!wsName && wsId) {
            const { data: wsFresh } = await sb.from('workspaces').select('name').eq('id', wsId).single()
            wsName = wsFresh?.name
          }

          await issueCertificate({
            userId:        session.user.id,
            courseId:      course_id,
            workspaceId:   wsId,
            enrollmentId:  enroll?.id ?? null,
            studentName:   pu?.full_name || pu?.email || 'Student',
            courseTitle:   courseRow.title,
            workspaceName: wsName ?? 'Apex University',
          })
          if (wsId) {
            await awardXP({ userId: session.user.id, workspaceId: wsId, eventType: 'complete_course', referenceId: course_id })
            await awardXP({ userId: session.user.id, workspaceId: wsId, eventType: 'earn_certificate', referenceId: course_id })
          }
        } catch (e) {
          console.error('[Certificate] Auto-issue failed:', e)
        }

        // Check if any learning paths are now complete
        try {
          let wsId = workspace_id
          if (!wsId) {
            const { data: cr } = await sb.from('courses').select('workspace_id').eq('id', course_id).single()
            wsId = cr?.workspace_id
          }
          if (!wsId) return

          const { data: pathEnrollments } = await sb
            .from('learning_path_enrollments')
            .select('path_id, learning_paths(id, workspace_id, title, certificates_enabled)')
            .eq('user_id', session.user.id)
            .eq('workspace_id', wsId)
            .is('completed_at', null)

          for (const pe of pathEnrollments ?? []) {
            const lp = (pe as any).learning_paths
            if (!lp?.certificates_enabled) continue
            const done = await isPathComplete(sb, session.user.id, lp.id)
            if (!done) continue

            const [{ data: pu }, { data: ws }] = await Promise.all([
              sb.from('platform_users').select('full_name, email').eq('id', session.user.id).single(),
              sb.from('workspaces').select('name').eq('id', lp.workspace_id).single(),
            ])
            await issuePathCertificate({
              userId:        session.user.id,
              pathId:        lp.id,
              workspaceId:   lp.workspace_id,
              studentName:   pu?.full_name || pu?.email || 'Student',
              pathTitle:     lp.title,
              workspaceName: ws?.name ?? 'Apex University',
            })
            await awardXP({ userId: session.user.id, workspaceId: lp.workspace_id, eventType: 'complete_path', referenceId: lp.id })
          }
        } catch (e) {
          console.error('[PathCertificate] Auto-issue failed:', e)
        }
      })()
    }
  }

  return NextResponse.json({ progress: data })
}
