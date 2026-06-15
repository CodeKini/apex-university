// GET  /api/platform/memberships?workspaceId= — list tiers (creator)
// POST /api/platform/memberships              — create tier + Stripe product/prices

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { stripe }                     from '@/lib/stripe'
import { z }                          from 'zod'

const CreateSchema = z.object({
  workspace_id:           z.string().uuid(),
  name:                   z.string().min(1).max(100),
  description:            z.string().max(1000).optional(),
  monthly_price:          z.number().min(0),
  yearly_price:           z.number().min(0).nullable().optional(),
  benefits:               z.array(z.string()).default([]),
  community_access:       z.boolean().default(false),
  resource_library_access:z.boolean().default(false),
  included_course_ids:    z.array(z.string().uuid()).default([]),
  included_path_ids:      z.array(z.string().uuid()).default([]),
  is_active:              z.boolean().default(true),
})

async function requireManager(supabase: any, workspaceId: string, userId: string) {
  const { data } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle()
  return data && ['owner','admin'].includes(data.role)
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = new URL(req.url).searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const ok = await requireManager(supabase, workspaceId, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: tiers, error } = await supabase
    .from('membership_tiers')
    .select(`
      *,
      active_count:member_subscriptions(count)
    `)
    .eq('workspace_id', workspaceId)
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tiers: tiers ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { workspace_id, ...rest } = parsed.data
  const ok = await requireManager(supabase, workspace_id, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: ws } = await supabase.from('workspaces').select('name').eq('id', workspace_id).single()
  const productName  = `${ws?.name ?? 'Workspace'} — ${rest.name}`

  // Create Stripe product + prices
  let stripeProductId:     string | null = null
  let stripeMonthlyPriceId: string | null = null
  let stripeYearlyPriceId:  string | null = null

  try {
    const product = await stripe.products.create({
      name:        productName,
      description: rest.description ?? undefined,
      metadata:    { workspace_id, tier_name: rest.name },
    })
    stripeProductId = product.id

    const monthly = await stripe.prices.create({
      product:    product.id,
      unit_amount: Math.round(rest.monthly_price * 100),
      currency:   'usd',
      recurring:  { interval: 'month' },
      metadata:   { workspace_id, tier_name: rest.name, interval: 'month' },
    })
    stripeMonthlyPriceId = monthly.id

    if (rest.yearly_price != null && rest.yearly_price > 0) {
      const yearly = await stripe.prices.create({
        product:    product.id,
        unit_amount: Math.round(rest.yearly_price * 100),
        currency:   'usd',
        recurring:  { interval: 'year' },
        metadata:   { workspace_id, tier_name: rest.name, interval: 'year' },
      })
      stripeYearlyPriceId = yearly.id
    }
  } catch (stripeErr: any) {
    console.error('[Memberships] Stripe product creation failed:', stripeErr.message)
    // Continue without Stripe IDs — can be set later
  }

  const { data: tier, error } = await supabase
    .from('membership_tiers')
    .insert({
      workspace_id,
      ...rest,
      stripe_product_id:       stripeProductId,
      stripe_monthly_price_id: stripeMonthlyPriceId,
      stripe_yearly_price_id:  stripeYearlyPriceId,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tier }, { status: 201 })
}
