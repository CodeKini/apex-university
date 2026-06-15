import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCourseDripStatuses }      from '@/lib/drip/unlock'

// GET /api/student/courses/[courseId]/drip-status
// Returns map of lessonId → {locked, reason, unlocksAt} for sidebar display
export async function GET(
  req: NextRequest,
  { params }: { params: { courseId: string } },
) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ statuses: {} })

  // Admins/creators get no drip locks
  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', session.user.id).single()
  if (pu?.platform_role === 'platform_admin') return NextResponse.json({ statuses: {} })

  const { data: course } = await (supabase as any)
    .from('courses').select('workspace_id').eq('id', params.courseId).single()
  if (course?.workspace_id) {
    const { data: wm } = await (supabase as any)
      .from('workspace_members').select('role')
      .eq('workspace_id', course.workspace_id)
      .eq('user_id', session.user.id)
      .in('role', ['owner', 'admin']).single()
    if (wm) return NextResponse.json({ statuses: {} })
  }

  const statuses = await getCourseDripStatuses(supabase as any, session.user.id, params.courseId)

  // Serialize unlocksAt to ISO strings
  const serialized: Record<string, { locked: boolean; reason: string; unlocksAt: string | null }> = {}
  for (const [id, s] of Object.entries(statuses)) {
    serialized[id] = { locked: s.locked, reason: s.reason, unlocksAt: s.unlocksAt?.toISOString() ?? null }
  }

  return NextResponse.json({ statuses: serialized })
}
