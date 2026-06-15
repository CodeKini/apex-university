import { NextRequest, NextResponse }        from 'next/server'
import { createServerSupabaseClient }      from '@/lib/supabase/server'
import { stripe, PLANS, getPlanByName }    from '@/lib/stripe'
import { z }                               from 'zod'
import { checkoutLimit, rateLimitResponse } from '@/lib/rateLimit'

const Schema = z.object({
  workspaceId: z.string().uuid(),
  planName:    z.enum(['starter', 'growth', 'pro']),
})

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkoutLimit(req, session.user.id)
  if (!rl.ok) return rateLimitResponse(rl, 'Too many checkout attempts. Please wait a minute.')

  const body   = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { workspaceId, planName } = parsed.data

  // Assert ownership — only workspace owner can subscribe
  const { data: wm } = await (supabase as any)
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', session.user.id)
    .in('role', ['owner'])
    .single()
  if (!wm) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const plan = getPlanByName(planName)
  if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  if (!plan.priceId) return NextResponse.json({ error: 'Plan price not configured' }, { status: 500 })

  // Fetch workspace for existing stripe_customer_id
  const { data: workspace } = await (supabase as any)
    .from('workspaces')
    .select('id, name, slug, stripe_customer_id, stripe_subscription_id, plan_status, trial_ends_at')
    .eq('id', workspaceId)
    .single()
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  // If already subscribed (active/trialing with a subscription), send to billing portal
  if (workspace.stripe_subscription_id && ['active', 'trialing'].includes(workspace.plan_status)) {
    const portal = await stripe.billingPortal.sessions.create({
      customer:   workspace.stripe_customer_id!,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/platform/workspaces/${workspaceId}/billing`,
    })
    return NextResponse.json({ url: portal.url })
  }

  // Get or create Stripe customer
  let customerId = workspace.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    session.user.email!,
      name:     workspace.name,
      metadata: {
        supabase_user_id: session.user.id,
        workspace_id:     workspaceId,
        workspace_slug:   workspace.slug,
      },
    })
    customerId = customer.id

    // Persist customer ID immediately so we can look it up in the webhook
    await (supabase as any)
      .from('workspaces')
      .update({ stripe_customer_id: customerId })
      .eq('id', workspaceId)
  }

  // Determine if trial applies:
  // Give 14-day trial only if they've never subscribed before (no prior subscription ID).
  const isFirstSubscription = !workspace.stripe_subscription_id

  const checkoutSession = await stripe.checkout.sessions.create({
    customer:             customerId,
    mode:                 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: plan.priceId, quantity: 1 }],
    subscription_data: {
      ...(isFirstSubscription ? { trial_period_days: 14 } : {}),
      metadata: {
        workspace_id: workspaceId,
        plan_name:    planName,
      },
    },
    metadata: {
      type:         'subscription',
      workspace_id: workspaceId,
      plan_name:    planName,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/platform/workspaces/${workspaceId}/billing?success=1`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/platform/workspaces/${workspaceId}/billing?canceled=1`,
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
