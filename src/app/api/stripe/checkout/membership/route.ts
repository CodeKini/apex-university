// POST /api/stripe/checkout/membership — create Stripe subscription checkout for a membership tier

import { NextRequest, NextResponse }        from 'next/server'
import { createServerSupabaseClient }       from '@/lib/supabase/server'
import { stripe }                           from '@/lib/stripe'
import { z }                                from 'zod'
import { checkoutLimit, rateLimitResponse } from '@/lib/rateLimit'

const Schema = z.object({
  tierId:      z.string().uuid(),
  workspaceId: z.string().uuid(),
  interval:    z.enum(['month','year']).default('month'),
})

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkoutLimit(req, session.user.id)
  if (!rl.ok) return rateLimitResponse(rl, 'Too many checkout attempts. Please wait a minute.')

  const body   = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { tierId, workspaceId, interval } = parsed.data

  // Verify membership in workspace
  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch tier
  const { data: tier } = await supabase
    .from('membership_tiers')
    .select('id, name, workspace_id, stripe_monthly_price_id, stripe_yearly_price_id, stripe_product_id, is_active, monthly_price, yearly_price')
    .eq('id', tierId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!tier || !tier.is_active) return NextResponse.json({ error: 'Membership tier not found.' }, { status: 404 })

  const priceId = interval === 'year' ? tier.stripe_yearly_price_id : tier.stripe_monthly_price_id
  if (!priceId) return NextResponse.json({ error: `No ${interval}ly price configured for this tier.` }, { status: 400 })

  // Check for existing active subscription in this workspace
  const { data: existingSub } = await supabase
    .from('member_subscriptions')
    .select('id, stripe_subscription_id, status, tier_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', session.user.id)
    .in('status', ['active','trialing'])
    .maybeSingle()

  if (existingSub) {
    // Send to billing portal to manage existing subscription
    const { data: ws } = await supabase.from('workspaces').select('slug').eq('id', workspaceId).single()
    const portal = await stripe.billingPortal.sessions.create({
      customer:   (await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id)).customer as string,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/w/${ws?.slug}/membership`,
    })
    return NextResponse.json({ url: portal.url, existing: true })
  }

  const { data: ws } = await supabase.from('workspaces').select('name, slug').eq('id', workspaceId).single()
  if (!ws) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 })

  // Get or create Stripe customer for this user
  const { data: pu } = await supabase.from('platform_users').select('full_name, email').eq('id', session.user.id).single()

  // Check if user already has a member_subscription row (any status) to get their stripe_customer_id
  const { data: anySub } = await supabase
    .from('member_subscriptions').select('stripe_customer_id')
    .eq('workspace_id', workspaceId).eq('user_id', session.user.id).maybeSingle()

  let customerId = anySub?.stripe_customer_id ?? null
  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    session.user.email!,
      name:     pu?.full_name ?? undefined,
      metadata: { supabase_user_id: session.user.id, workspace_id: workspaceId },
    })
    customerId = customer.id
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer:             customerId,
    mode:                 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: {
        type:         'membership',
        workspace_id: workspaceId,
        user_id:      session.user.id,
        tier_id:      tierId,
        interval,
      },
    },
    metadata: {
      type:         'membership',
      workspace_id: workspaceId,
      user_id:      session.user.id,
      tier_id:      tierId,
      interval,
    },
    allow_promotion_codes: true,
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/w/${ws.slug}/membership?success=1`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/w/${ws.slug}/membership`,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
