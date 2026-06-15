import { NextRequest, NextResponse }  from 'next/server'
import { createServiceRoleClient }    from '@/lib/supabase/server'
import { createHash }                 from 'crypto'

// POST /api/affiliate/track
// Called client-side when a page loads with ?ref=CODE already in cookie.
// Records a click event. Uses service role so no auth required.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { referralCode, workspaceId, landingPath } = body

  if (!referralCode || !workspaceId) return NextResponse.json({ ok: false })

  const supabase = createServiceRoleClient() as any

  // Resolve affiliate
  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('id, status')
    .eq('workspace_id', workspaceId)
    .eq('referral_code', referralCode)
    .eq('status', 'approved')
    .maybeSingle()

  if (!affiliate) return NextResponse.json({ ok: false })

  const ip        = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
  const ipHash    = ip ? createHash('sha256').update(ip + (process.env.AFFILIATE_IP_SALT ?? 'salt')).digest('hex').slice(0, 16) : null
  const userAgent = req.headers.get('user-agent')?.slice(0, 200) ?? null

  await supabase.from('affiliate_clicks').insert({
    affiliate_id:  affiliate.id,
    workspace_id:  workspaceId,
    ip_hash:       ipHash,
    user_agent:    userAgent,
    landing_path:  (landingPath ?? '').slice(0, 500),
  })

  await supabase.rpc('increment_affiliate_clicks', { p_affiliate_id: affiliate.id })

  return NextResponse.json({ ok: true })
}
