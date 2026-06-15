// Server-only. Never import on the client.
// All limit checks query Supabase directly and return structured results
// so callers can build clear 402 responses.

export type PlanTier = 'trial' | 'starter' | 'growth' | 'pro'

export interface PlanLimits {
  maxCourses:      number   // -1 = unlimited
  maxStudents:     number   // -1 = unlimited
  maxStorageBytes: number   // -1 = unlimited
}

const GB = 1024 * 1024 * 1024

const LIMITS: Record<string, PlanLimits> = {
  trial:   { maxCourses: 5,   maxStudents: 100,    maxStorageBytes: 5  * GB },
  starter: { maxCourses: 5,   maxStudents: 100,    maxStorageBytes: 5  * GB },
  growth:  { maxCourses: 25,  maxStudents: 5_000,  maxStorageBytes: 50 * GB },
  pro:     { maxCourses: -1,  maxStudents: -1,      maxStorageBytes: 250 * GB },
}

export function getPlanLimits(planName: string | null | undefined): PlanLimits {
  return LIMITS[planName ?? 'trial'] ?? LIMITS.trial
}

// Growth+ can add custom domains.
export function canUseCustomDomain(planName: string | null | undefined): boolean {
  return ['growth', 'pro'].includes(planName ?? '')
}

// Pro only: remove Apex branding, white-label emails/certs/login pages.
export function isWhiteLabelPlan(planName: string | null | undefined): boolean {
  return planName === 'pro'
}

// ── Usage snapshot ─────────────────────────────────────────────────────────────
// Returns raw counts from the DB for a workspace.

export interface WorkspaceUsage {
  courseCount:   number
  studentCount:  number
  storageBytes:  number
  plan:          string
  limits:        PlanLimits
}

export async function getWorkspaceUsage(
  supabase: any,
  workspaceId: string,
): Promise<WorkspaceUsage> {
  const { data: ws } = await supabase
    .from('workspaces')
    .select('plan_name, seats_used, storage_used_bytes')
    .eq('id', workspaceId)
    .single()

  const plan         = ws?.plan_name ?? 'trial'
  const studentCount = ws?.seats_used ?? 0
  const storageBytes = ws?.storage_used_bytes ?? 0

  const { count: courseCount } = await supabase
    .from('courses')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  return {
    courseCount:  courseCount ?? 0,
    studentCount,
    storageBytes,
    plan,
    limits: getPlanLimits(plan),
  }
}

// ── Limit check helpers ────────────────────────────────────────────────────────

export interface LimitCheck {
  ok:      boolean
  message: string
}

export async function checkCourseLimit(
  supabase: any,
  workspaceId: string,
  isPlatformAdmin = false,
): Promise<LimitCheck> {
  if (isPlatformAdmin) return { ok: true, message: '' }

  const usage = await getWorkspaceUsage(supabase, workspaceId)
  const { maxCourses } = usage.limits

  if (maxCourses === -1) return { ok: true, message: '' }
  if (usage.courseCount < maxCourses) return { ok: true, message: '' }

  const nextPlan = usage.plan === 'starter' ? 'Growth' : 'Pro'
  return {
    ok:      false,
    message: `Course limit reached (${usage.courseCount}/${maxCourses}). Upgrade to ${nextPlan} to add more courses.`,
  }
}

export async function checkStudentLimit(
  supabase: any,
  workspaceId: string,
  isPlatformAdmin = false,
): Promise<LimitCheck> {
  if (isPlatformAdmin) return { ok: true, message: '' }

  const usage = await getWorkspaceUsage(supabase, workspaceId)
  const { maxStudents } = usage.limits

  if (maxStudents === -1) return { ok: true, message: '' }
  if (usage.studentCount < maxStudents) return { ok: true, message: '' }

  const nextPlan = usage.plan === 'starter' ? 'Growth' : 'Pro'
  return {
    ok:      false,
    message: `Student limit reached (${usage.studentCount}/${maxStudents}). Upgrade to ${nextPlan} to enroll more students.`,
  }
}

export async function checkStorageLimit(
  supabase: any,
  workspaceId: string,
  incomingBytes: number,
  isPlatformAdmin = false,
): Promise<LimitCheck> {
  if (isPlatformAdmin) return { ok: true, message: '' }

  const usage = await getWorkspaceUsage(supabase, workspaceId)
  const { maxStorageBytes } = usage.limits

  if (maxStorageBytes === -1) return { ok: true, message: '' }
  if (usage.storageBytes + incomingBytes <= maxStorageBytes) return { ok: true, message: '' }

  const usedGB  = (usage.storageBytes / GB).toFixed(1)
  const limitGB = (maxStorageBytes   / GB).toFixed(0)
  const nextPlan = usage.plan === 'starter' ? 'Growth' : 'Pro'
  return {
    ok:      false,
    message: `Storage limit reached (${usedGB} GB / ${limitGB} GB). Upgrade to ${nextPlan} or delete files to free space.`,
  }
}
