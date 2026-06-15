import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { stripe }                     from '@/lib/stripe'
import { z }                          from 'zod'

async function assertOwner(supabase: any, workspaceId: string, userId: string) {
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return true

  const { data: wm } = await supabase
    .from('workspace_members')
    .select('role').eq('workspace_id', workspaceId).eq('user_id', userId)
    .in('role', ['owner']).single()
  return !!wm
}

// GET /api/platform/billing?workspaceId=xxx
// Returns workspace billing info + recent purchases
export async function GET(req: NextRequest) {
  const supabase    = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const ok = await assertOwner(supabase, workspaceId, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('plan_name, plan_status, trial_ends_at, stripe_customer_id, stripe_subscription_id, stripe_price_id')
    .eq('id', workspaceId)
    .single()

  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Recent course purchases in this workspace (student payments)
  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, amount_cents, currency, status, created_at, courses(title, slug)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ billing: workspace, purchases: purchases ?? [] })
}

// POST /api/platform/billing/portal
// Creates a Stripe billing portal session (manage subscription, update card, etc.)
export async function POST(req: NextRequest) {
  const supabase    = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body        = await req.json().catch(() => ({}))
  const workspaceId = body.workspaceId as string
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const ok = await assertOwner(supabase, workspaceId, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: workspace } = await supabase
    .from('workspaces').select('stripe_customer_id').eq('id', workspaceId).single() as { data: any }

  if (!workspace?.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription yet' }, { status: 400 })
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer:   workspace.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/platform/workspaces/${workspaceId}/billing`,
  })

  return NextResponse.json({ url: portal.url })
}
