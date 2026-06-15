import { NextRequest, NextResponse }     from 'next/server'
import { createServerSupabaseClient }   from '@/lib/supabase/server'
import { z }                            from 'zod'
import { sendEmail }                    from '@/lib/email/send'
import { freeEnrollmentConfirm, courseAccessGranted } from '@/lib/email/templates'
import { enrollmentLimit, rateLimitResponse } from '@/lib/rateLimit'

// ─── GET /api/platform/enrollments ───────────────────────────
// ?workspaceId=X              → list all enrolled courses for user in workspace
// ?workspaceId=X&courseId=Y   → check if enrolled in one course
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const workspaceId = searchParams.get('workspaceId')
  const courseId    = searchParams.get('courseId')

  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  // ── Single course check ──
  if (courseId) {
    const { data } = await (supabase as any)
      .from('enrollments')
      .select('id, access_status, expires_at')
      .eq('user_id', session.user.id)
      .eq('course_id', courseId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    return NextResponse.json({
      enrolled:      !!data,
      access_status: data?.access_status ?? null,
      expires_at:    data?.expires_at    ?? null,
    })
  }

  // ── All courses for user in workspace ──
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`
      *,
      course:courses (
        id, slug, title, short_desc, thumbnail_url, difficulty, duration_hrs
      )
    `)
    .eq('user_id', session.user.id)
    .eq('workspace_id', workspaceId)
    .eq('access_status', 'active')
    .order('enrolled_at', { ascending: false })

  if (!enrollments) return NextResponse.json({ enrollments: [] })

  // ── Compute progress per course ──
  const courseIds = enrollments.map((e: any) => e.course_id)

  // Total lessons per course
  const { data: lessonCounts } = await (supabase as any)
    .from('lessons')
    .select('course_id')
    .in('course_id', courseIds)

  // Completed lessons per course for this user
  const { data: progressRows } = await (supabase as any)
    .from('lesson_progress')
    .select('course_id, lesson_id, completed, last_watched')
    .eq('user_id', session.user.id)
    .eq('completed', true)
    .in('course_id', courseIds)

  // Last-watched lesson per course (most recent regardless of completed status)
  const { data: lastWatched } = await (supabase as any)
    .from('lesson_progress')
    .select('course_id, lesson_id, last_watched')
    .eq('user_id', session.user.id)
    .in('course_id', courseIds)
    .order('last_watched', { ascending: false })

  // Build lookup maps
  const totalMap: Record<string, number> = {}
  for (const r of lessonCounts ?? []) {
    totalMap[r.course_id] = (totalMap[r.course_id] ?? 0) + 1
  }

  const completedMap: Record<string, number> = {}
  for (const r of progressRows ?? []) {
    completedMap[r.course_id] = (completedMap[r.course_id] ?? 0) + 1
  }

  const lastMap: Record<string, string | null> = {}
  for (const r of lastWatched ?? []) {
    if (!lastMap[r.course_id]) lastMap[r.course_id] = r.lesson_id
  }

  const enriched = enrollments.map((e: any) => {
    const total     = totalMap[e.course_id]     ?? 0
    const completed = completedMap[e.course_id] ?? 0
    return {
      enrollment:        e,
      course:            e.course,
      total_lessons:     total,
      completed_lessons: completed,
      progress_pct:      total > 0 ? Math.round((completed / total) * 100) : 0,
      last_lesson_id:    lastMap[e.course_id] ?? null,
    }
  })

  return NextResponse.json({ enrollments: enriched })
}

// ─── POST /api/platform/enrollments ──────────────────────────
// Two modes:
//   Self-enroll (student): { workspace_id, course_id } — course must be free
//   Manual enroll (admin): { workspace_id, course_id, target_user_id } — any course, any member
const EnrollSchema = z.object({
  workspace_id:   z.string().uuid(),
  course_id:      z.string().uuid(),
  target_user_id: z.string().uuid().optional(), // admin-only: enroll someone else
})

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await enrollmentLimit(req, session.user.id)
  if (!rl.ok) return rateLimitResponse(rl, 'Too many enrollment requests. Please wait a moment.')

  const body   = await req.json()
  const parsed = EnrollSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { workspace_id, course_id, target_user_id } = parsed.data
  const isAdminEnroll = !!target_user_id

  // Determine caller role
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', session.user.id).maybeSingle()
  const isPlatformAdmin = pu?.platform_role === 'platform_admin'

  const { data: callerMembership } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspace_id).eq('user_id', session.user.id).maybeSingle()
  const isWorkspaceAdmin = ['owner', 'admin'].includes(callerMembership?.role ?? '')

  if (isAdminEnroll && !isPlatformAdmin && !isWorkspaceAdmin)
    return NextResponse.json({ error: 'Only workspace admins can manually enroll members.' }, { status: 403 })

  const enrollUserId = isAdminEnroll ? target_user_id! : session.user.id

  // Verify the target is a workspace member
  const { data: targetMembership } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspace_id).eq('user_id', enrollUserId).maybeSingle()

  if (!targetMembership)
    return NextResponse.json({ error: 'Target user is not a member of this workspace.' }, { status: 403 })

  // Verify course exists and is published
  const { data: course } = await supabase
    .from('courses').select('id, title, slug, price, is_free, status, workspace_id')
    .eq('id', course_id).eq('workspace_id', workspace_id).eq('status', 'published').single()

  if (!course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 })

  // Self-enroll: must be free course
  if (!isAdminEnroll && !isPlatformAdmin && !isWorkspaceAdmin) {
    if (!course.is_free && course.price > 0)
      return NextResponse.json({ error: 'This is a paid course. Please purchase it first.' }, { status: 402 })
  }

  // Idempotency check
  const { data: existing } = await supabase
    .from('enrollments').select('id, access_status')
    .eq('user_id', enrollUserId).eq('course_id', course_id).eq('workspace_id', workspace_id).maybeSingle()

  if (existing) {
    // If revoked and admin is re-enrolling, reactivate
    if (existing.access_status !== 'active' && (isAdminEnroll || isPlatformAdmin)) {
      const { data: reactivated } = await supabase
        .from('enrollments').update({ access_status: 'active' })
        .eq('id', existing.id).select().single()
      return NextResponse.json({ enrollment: reactivated, reactivated: true })
    }
    return NextResponse.json({ enrollment: existing, already_enrolled: true })
  }

  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .insert({
      user_id:       enrollUserId,
      course_id,
      workspace_id,
      source:        isAdminEnroll ? 'manual' : 'free',
      access_status: 'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrollment confirmation email — non-blocking
  try {
    const { data: ws } = await supabase
      .from('workspaces').select('name, slug').eq('id', workspace_id).maybeSingle()
    const { data: member } = await supabase
      .from('workspace_members').select('email, full_name')
      .eq('workspace_id', workspace_id).eq('user_id', enrollUserId).maybeSingle()

    if (ws && member?.email) {
      const tpl = isAdminEnroll
        ? courseAccessGranted({
            name: member.full_name ?? '', workspaceName: ws.name, workspaceSlug: ws.slug,
            courseTitle: course.title, courseSlug: course.slug,
          })
        : freeEnrollmentConfirm({
            name: member.full_name ?? '', workspaceName: ws.name, workspaceSlug: ws.slug,
            courseTitle: course.title, courseSlug: course.slug,
          })

      sendEmail({
        to: member.email, toName: member.full_name ?? undefined,
        subject: tpl.subject, html: tpl.html,
        template: isAdminEnroll ? 'course_access_granted' : 'free_enrollment_confirm',
        workspaceId: workspace_id,
        metadata: { course_id, user_id: enrollUserId },
      }).catch(() => {})
    }
  } catch {}

  return NextResponse.json({ enrollment }, { status: 201 })
}

// ─── DELETE /api/platform/enrollments ────────────────────────
// Revoke a student's access to a course (sets access_status = 'revoked').
// Body: { workspace_id, course_id, target_user_id }
const RevokeSchema = z.object({
  workspace_id:   z.string().uuid(),
  course_id:      z.string().uuid(),
  target_user_id: z.string().uuid(),
})

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await enrollmentLimit(req, session.user.id)
  if (!rl.ok) return rateLimitResponse(rl, 'Too many enrollment requests. Please wait a moment.')

  const body   = await req.json().catch(() => ({}))
  const parsed = RevokeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { workspace_id, course_id, target_user_id } = parsed.data

  // Only admins/owners can revoke
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', session.user.id).maybeSingle()
  const isPlatformAdmin = pu?.platform_role === 'platform_admin'

  const { data: callerMembership } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspace_id).eq('user_id', session.user.id).maybeSingle()
  const isWorkspaceAdmin = ['owner', 'admin'].includes(callerMembership?.role ?? '')

  if (!isPlatformAdmin && !isWorkspaceAdmin)
    return NextResponse.json({ error: 'Only workspace admins can revoke access.' }, { status: 403 })

  const { data: enrollment } = await supabase
    .from('enrollments').select('id, access_status')
    .eq('user_id', target_user_id).eq('course_id', course_id).eq('workspace_id', workspace_id).maybeSingle()

  if (!enrollment) return NextResponse.json({ error: 'Enrollment not found.' }, { status: 404 })

  const { error } = await supabase
    .from('enrollments').update({ access_status: 'revoked' }).eq('id', enrollment.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
