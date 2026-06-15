// GET /api/health/database — platform_admin only
// Checks Supabase connectivity and that critical tables exist.

import { NextResponse }              from 'next/server'
import { requirePlatformAdmin }      from '@/lib/admin/guard'
import { createServiceRoleClient }   from '@/lib/supabase/server'

export async function GET() {
  const { error } = await requirePlatformAdmin()
  if (error) return error

  const supabase = createServiceRoleClient() as any
  const checks: Record<string, { ok: boolean; detail?: string }> = {}

  // Basic connectivity
  try {
    const { error: pingErr } = await supabase
      .from('workspaces').select('id', { count: 'exact', head: true })
    checks.connectivity = pingErr
      ? { ok: false, detail: pingErr.message }
      : { ok: true }
  } catch (e: any) {
    checks.connectivity = { ok: false, detail: String(e.message) }
  }

  // Critical tables
  const tables = [
    'platform_users', 'workspaces', 'workspace_members',
    'courses', 'enrollments', 'purchases',
    'certificates', 'quizzes', 'email_events',
  ]
  for (const table of tables) {
    try {
      const { error: tErr } = await supabase
        .from(table).select('id', { count: 'exact', head: true })
      checks[`table:${table}`] = tErr
        ? { ok: false, detail: tErr.message }
        : { ok: true }
    } catch (e: any) {
      checks[`table:${table}`] = { ok: false, detail: String(e.message) }
    }
  }

  const allOk = Object.values(checks).every((c) => c.ok)
  return NextResponse.json(
    { ok: allOk, checks },
    { status: allOk ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
