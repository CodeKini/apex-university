// POST /api/stripe/billing-portal/membership — redirect student to Stripe portal to manage membership

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { stripe }                     from '@/lib/stripe'
import { z }                          from 'zod'

const Schema = z.object({ workspaceId: z.string().uuid() })

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { workspaceId } = parsed.data

  const { data: sub } = await supabase
    .from('member_subscriptions')
    .select('stripe_customer_id, stripe_subscription_id, status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (!sub?.stripe_customer_id)
    return NextResponse.json({ error: 'No active membership found.' }, { status: 404 })

  const { data: ws } = await supabase.from('workspaces').select('slug').eq('id', workspaceId).single()

  const portal = await stripe.billingPortal.sessions.create({
    customer:   sub.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/w/${ws?.slug}/membership`,
  })

  return NextResponse.json({ url: portal.url })
}
