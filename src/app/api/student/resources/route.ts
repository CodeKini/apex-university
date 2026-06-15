import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getMembershipAccess }        from '@/lib/memberships/access'

// GET /api/student/resources?workspaceId=...
// Returns active resources the requesting user can access
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const userId = session.user.id

  // Get all active resources
  const { data: resources } = await (supabase as any)
    .from('workspace_resources')
    .select('id, title, description, resource_type, file_name, file_size, external_url, access_type, course_ids, path_ids, download_count, created_at')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (!resources || resources.length === 0) return NextResponse.json({ resources: [] })

  // Admin bypass
  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', userId).maybeSingle()
  const isPlatformAdmin = pu?.platform_role === 'platform_admin'
  const { data: wm } = await (supabase as any)
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', userId).in('role', ['owner','admin']).maybeSingle()
  const isAdmin = isPlatformAdmin || !!wm

  if (isAdmin) {
    return NextResponse.json({ resources: resources.map((r: any) => ({ ...r, accessible: true })) })
  }

  // Gather access context once
  const membershipAccess = await getMembershipAccess(supabase, userId, workspaceId)

  // Active paid enrollments in this workspace
  const { data: enrollments } = await (supabase as any)
    .from('enrollments')
    .select('course_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('access_status', 'active')
  const enrolledCourseIds = new Set((enrollments ?? []).map((e: any) => e.course_id))

  // Learning path enrollments
  const { data: pathEnrolls } = await (supabase as any)
    .from('learning_path_enrollments')
    .select('path_id')
    .eq('user_id', userId)
  const enrolledPathIds = new Set((pathEnrolls ?? []).map((e: any) => e.path_id))

  const result = resources.map((r: any) => {
    let accessible = false
    if (r.access_type === 'free') {
      accessible = true
    } else if (r.access_type === 'membership') {
      accessible = membershipAccess.resourceAccess
    } else if (r.access_type === 'paid_course') {
      accessible = enrolledCourseIds.size > 0
    } else if (r.access_type === 'specific_courses') {
      accessible = (r.course_ids ?? []).some((id: string) => enrolledCourseIds.has(id))
    } else if (r.access_type === 'specific_paths') {
      accessible = (r.path_ids ?? []).some((id: string) => enrolledPathIds.has(id))
    }
    return { ...r, accessible }
  })

  return NextResponse.json({ resources: result })
}
