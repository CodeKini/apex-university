// Server-only: check if a user's active membership grants access to a resource.
// Always called server-side — students cannot bypass this.

export interface MembershipAccess {
  hasMembership:   boolean
  tierId?:         string
  tierName?:       string
  courseAccess:    boolean   // true = all courses in workspace via membership
  pathAccess:      boolean
  communityAccess: boolean
  resourceAccess:  boolean
  includedCourseIds: string[]
  includedPathIds:   string[]
}

export async function getMembershipAccess(
  supabase:    any,
  userId:      string,
  workspaceId: string,
): Promise<MembershipAccess> {
  const empty: MembershipAccess = {
    hasMembership: false, courseAccess: false, pathAccess: false,
    communityAccess: false, resourceAccess: false,
    includedCourseIds: [], includedPathIds: [],
  }

  const { data: sub } = await supabase
    .from('member_subscriptions')
    .select(`
      status, tier_id,
      tier:membership_tiers(
        id, name, community_access, resource_library_access,
        included_course_ids, included_path_ids
      )
    `)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .in('status', ['active','trialing'])
    .maybeSingle()

  if (!sub || !sub.tier) return empty

  const tier = sub.tier as any
  return {
    hasMembership:     true,
    tierId:            tier.id,
    tierName:          tier.name,
    communityAccess:   tier.community_access,
    resourceAccess:    tier.resource_library_access,
    courseAccess:      (tier.included_course_ids ?? []).length === 0, // empty = all courses
    pathAccess:        (tier.included_path_ids ?? []).length === 0,
    includedCourseIds: tier.included_course_ids ?? [],
    includedPathIds:   tier.included_path_ids   ?? [],
  }
}

export function membershipGrantsCourse(access: MembershipAccess, courseId: string): boolean {
  if (!access.hasMembership) return false
  if (access.courseAccess) return true                          // all courses
  return access.includedCourseIds.includes(courseId)
}

export function membershipGrantsPath(access: MembershipAccess, pathId: string): boolean {
  if (!access.hasMembership) return false
  if (access.pathAccess) return true
  return access.includedPathIds.includes(pathId)
}
