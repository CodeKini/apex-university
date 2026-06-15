// GET /api/admin/stats
// Platform-wide dashboard numbers. platform_admin only.

import { NextResponse }          from 'next/server'
import { requirePlatformAdmin }  from '@/lib/admin/guard'

export async function GET() {
  const { supabase, error } = await requirePlatformAdmin()
  if (error) return error

  const [
    { count: totalWorkspaces },
    { count: activeSubscriptions },
    { count: trialingSubscriptions },
    { count: totalStudents },
    { count: totalCourses },
    { data: revenueRows },
    { data: recentSignups },
    { data: recentPurchases },
  ] = await Promise.all([
    supabase.from('workspaces').select('id', { count: 'exact', head: true }),
    supabase.from('workspaces').select('id', { count: 'exact', head: true }).eq('plan_status', 'active'),
    supabase.from('workspaces').select('id', { count: 'exact', head: true }).eq('plan_status', 'trialing'),
    supabase.from('workspace_members').select('id', { count: 'exact', head: true }),
    supabase.from('courses').select('id', { count: 'exact', head: true }),
    supabase.from('purchases').select('amount_cents').eq('status', 'completed'),
    supabase.from('platform_users')
      .select('id, email, full_name, avatar_url, platform_role, created_at')
      .order('created_at', { ascending: false }).limit(10),
    supabase.from('purchases')
      .select('id, amount_cents, currency, status, created_at, courses(title), workspaces(name)')
      .eq('status', 'completed')
      .order('created_at', { ascending: false }).limit(10),
  ])

  const monthlyRevenue = (revenueRows ?? []).reduce((s: number, r: any) => s + (r.amount_cents ?? 0), 0)

  return NextResponse.json({
    totalWorkspaces:       totalWorkspaces ?? 0,
    activeSubscriptions:   activeSubscriptions ?? 0,
    trialingSubscriptions: trialingSubscriptions ?? 0,
    totalStudents:         totalStudents ?? 0,
    totalCourses:          totalCourses ?? 0,
    monthlyRevenueCents:   monthlyRevenue,
    recentSignups:         recentSignups ?? [],
    recentPurchases:       recentPurchases ?? [],
  })
}
