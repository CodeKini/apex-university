// GET    /api/platform/memberships/[tierId] — tier detail with member list
// PATCH  /api/platform/memberships/[tierId] — update tier
// DELETE /api/platform/memberships/[tierId] — deactivate tier

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { stripe }                     from '@/lib/stripe'
import { z }                          from 'zod'

const UpdateSchema = z.object({
  name:                    z.string().min(1).max(100).optional(),
  description:             z.string().max(1000).optional(),
  benefits:                z.array(z.string()).optional(),
  community_access:        z.boolean().optional(),
  resource_library_access: z.boolean().optional(),
  included_course_ids:     z.array(z.string().uuid()).optional(),
  included_path_ids:       z.array(z.string().uuid()).optional(),
  is_active:               z.boolean().optional(),
})

async function requireManagerForTier(supabase: any, tierId: string, userId: string) {
  const { data: tier } = await supabase
    .from('membership_tiers').select('workspace_id').eq('id', tierId).maybeSingle()
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

  const meta = await requireManagerForTier(supabase, params.tierId, session.user.id)
  if (!meta) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: tier, error } = await supabase
    .from('membership_tiers')
    .select(`
      *,
      subscriptions:member_subscriptions(
        id, user_id, status, interval, current_period_end, created_at,
        user:platform_users!user_id(full_name, email)
      )
    `)
    .eq('id', params.tierId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tier })
}

export async function PATCH(req: NextRequest, { params }: { params: { tierId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const meta = await requireManagerForTier(supabase, params.tierId, session.user.id)
  if (!meta) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  // Sync name/description to Stripe product if name changed
  if (parsed.data.name) {
    const { data: existing } = await supabase
      .from('membership_tiers').select('stripe_product_id').eq('id', params.tierId).single()
    if (existing?.stripe_product_id) {
      try {
        await stripe.products.update(existing.stripe_product_id, {
          name:        parsed.data.name,
          description: parsed.data.description ?? undefined,
        })
      } catch {}
    }
  }

  const { data, error } = await supabase
    .from('membership_tiers')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.tierId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tier: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { tierId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const meta = await requireManagerForTier(supabase, params.tierId, session.user.id)
  if (!meta) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Check for active subscribers
  const { count } = await supabase
    .from('member_subscriptions').select('id', { count: 'exact', head: true })
    .eq('tier_id', params.tierId).in('status', ['active','trialing'])

  if ((count ?? 0) > 0)
    return NextResponse.json({ error: 'Cannot delete a tier with active subscribers. Deactivate it instead.' }, { status: 409 })

  // Deactivate Stripe product
  try {
    const { data: existing } = await supabase
      .from('membership_tiers').select('stripe_product_id').eq('id', params.tierId).single()
    if (existing?.stripe_product_id)
      await stripe.products.update(existing.stripe_product_id, { active: false })
  } catch {}

  const { error } = await supabase
    .from('membership_tiers')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', params.tierId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
