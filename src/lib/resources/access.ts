// Server-only. Checks whether a user can access a given resource.
import { getMembershipAccess } from '@/lib/memberships/access'

export type ResourceAccessGrant =
  | { granted: true;  via: string }
  | { granted: false; reason: string }

export async function checkResourceAccess(
  supabase:    any,
  userId:      string,
  resourceId:  string,
  workspaceId: string,
): Promise<ResourceAccessGrant> {
  const { data: resource } = await supabase
    .from('workspace_resources')
    .select('id, access_type, course_ids, path_ids, is_active')
    .eq('id', resourceId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!resource || !resource.is_active) {
    return { granted: false, reason: 'Resource not found or inactive' }
  }

  // Workspace admins always have access
  const { data: wm } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', userId)
    .in('role', ['owner','admin']).maybeSingle()
  if (wm) return { granted: true, via: 'admin' }

  // Platform admin
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', userId).maybeSingle()
  if (pu?.platform_role === 'platform_admin') return { granted: true, via: 'platform_admin' }

  if (resource.access_type === 'free') {
    return { granted: true, via: 'free' }
  }

  if (resource.access_type === 'membership') {
    const access = await getMembershipAccess(supabase, userId, workspaceId)
    if (access.resourceAccess) return { granted: true, via: 'membership' }
    return { granted: false, reason: 'Requires an active membership' }
  }

  if (resource.access_type === 'paid_course') {
    // Any paid enrollment in the workspace
    const { data: enr } = await supabase
      .from('enrollments')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('access_status', 'active')
      .limit(1)
    if (enr && enr.length > 0) return { granted: true, via: 'paid_course' }
    return { granted: false, reason: 'Requires a course purchase' }
  }

  if (resource.access_type === 'specific_courses') {
    const courseIds: string[] = resource.course_ids ?? []
    if (courseIds.length > 0) {
      const { data: enr } = await supabase
        .from('enrollments')
        .select('id')
        .eq('user_id', userId)
        .eq('access_status', 'active')
        .in('course_id', courseIds)
        .limit(1)
      if (enr && enr.length > 0) return { granted: true, via: 'specific_courses' }
    }
    return { granted: false, reason: 'Requires enrollment in a specific course' }
  }

  if (resource.access_type === 'specific_paths') {
    const pathIds: string[] = resource.path_ids ?? []
    if (pathIds.length > 0) {
      const { data: pe } = await supabase
        .from('learning_path_enrollments')
        .select('id')
        .eq('user_id', userId)
        .in('path_id', pathIds)
        .limit(1)
      if (pe && pe.length > 0) return { granted: true, via: 'specific_paths' }
    }
    return { granted: false, reason: 'Requires enrollment in a specific learning path' }
  }

  return { granted: false, reason: 'Access not granted' }
}
