import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getLessonDripStatus }        from '@/lib/drip/unlock'

// GET /api/student/lessons/[lessonId]/access?courseId=...
export async function GET(
  req: NextRequest,
  { params }: { params: { lessonId: string } },
) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const courseId = req.nextUrl.searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

  // Platform admins and workspace admins can always preview
  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', session.user.id).single()
  if (pu?.platform_role === 'platform_admin') {
    return NextResponse.json({ accessible: true, locked: false, reason: '', unlocksAt: null })
  }

  // Check workspace admin
  const { data: lesson } = await (supabase as any)
    .from('lessons').select('workspace_id').eq('id', params.lessonId).single()
  if (lesson?.workspace_id) {
    const { data: wm } = await (supabase as any)
      .from('workspace_members').select('role')
      .eq('workspace_id', lesson.workspace_id)
      .eq('user_id', session.user.id)
      .in('role', ['owner', 'admin']).single()
    if (wm) return NextResponse.json({ accessible: true, locked: false, reason: '', unlocksAt: null })
  }

  // Check enrollment
  const { data: enrollment } = await (supabase as any)
    .from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .eq('user_id', session.user.id)
    .single()

  if (!enrollment) {
    return NextResponse.json({ accessible: false, locked: false, reason: 'Not enrolled', unlocksAt: null })
  }

  // Compute drip status
  const status = await getLessonDripStatus(supabase as any, session.user.id, params.lessonId)

  return NextResponse.json({
    accessible: !status.locked,
    locked: status.locked,
    reason: status.reason,
    unlocksAt: status.unlocksAt?.toISOString() ?? null,
  })
}
