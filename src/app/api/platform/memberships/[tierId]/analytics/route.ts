// GET /api/platform/memberships/[tierId]/analytics — MRR, churn, member list

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function requireManagerForTier(supabase: any, tierId: string, userId: string) {
  const { data: tier } = await supabase
    .from('membership_tiers').select('workspace_id, monthly_price, yearly_price').eq('id', tierId).maybeSingle()
  if (!tier) return null
  const { data: wm } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', tier.workspace_id).eq('user_id', userId).maybeSingle()
  return wm && ['owner','admin'].includes(wm.role) ? tier : null
}

export async function GET(_req: NextRequest, { params }: { params: { tierId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await requireManagerForTier(supabase, params.tierId, session.user.id)
  if (!tier) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: subs } = await supabase
    .from('member_subscriptions')
    .select('id, user_id, status, interval, current_period_end, created_at, canceled_at, user:platform_users!user_id(full_name, email)')
    .eq('tier_id', params.tierId)
    .order('created_at', { ascending: false })

  const allSubs   = subs ?? []
  const active    = allSubs.filter((s: any) => ['active','trialing'].includes(s.status))
  const canceled  = allSubs.filter((s: any) => s.status === 'canceled')
  const pastDue   = allSubs.filter((s: any) => s.status === 'past_due')

  // MRR estimate
  const monthlyPrice = Number(tier.monthly_price ?? 0)
  const yearlyPrice  = Number(tier.yearly_price  ?? monthlyPrice * 10)
  const mrr = active.reduce((sum: number, s: any) => {
    return sum + (s.interval === 'year' ? yearlyPrice / 12 : monthlyPrice)
  }, 0)

  return NextResponse.json({
    active_count:   active.length,
    canceled_count: canceled.length,
    past_due_count: pastDue.length,
    mrr:            Math.round(mrr * 100) / 100,
    subscriptions:  allSubs,
  })
}
