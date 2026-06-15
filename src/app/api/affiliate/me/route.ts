import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET /api/affiliate/me?workspaceId=...
// Returns the current user's affiliate record + commissions + payouts for this workspace
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const [affRes, progRes] = await Promise.all([
    (supabase as any).from('affiliates').select('*').eq('workspace_id', workspaceId).eq('user_id', session.user.id).maybeSingle(),
    (supabase as any).from('affiliate_programs').select('commission_pct, cookie_duration_days, payout_notes, is_enabled').eq('workspace_id', workspaceId).maybeSingle(),
  ])

  const affiliate = affRes.data
  const program   = progRes.data

  if (!affiliate) return NextResponse.json({ affiliate: null, program })

  const [commsRes, payoutsRes] = await Promise.all([
    (supabase as any).from('affiliate_commissions').select('*').eq('affiliate_id', affiliate.id).order('created_at', { ascending: false }),
    (supabase as any).from('affiliate_payouts').select('*').eq('affiliate_id', affiliate.id).order('paid_at', { ascending: false }),
  ])

  return NextResponse.json({
    affiliate,
    program,
    commissions: commsRes.data ?? [],
    payouts:     payoutsRes.data ?? [],
  })
}
