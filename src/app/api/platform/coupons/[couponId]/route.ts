// GET    /api/platform/coupons/[couponId] — get coupon detail
// PATCH  /api/platform/coupons/[couponId] — update coupon
// DELETE /api/platform/coupons/[couponId] — archive (deactivate) coupon

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'

const UpdateSchema = z.object({
  code:            z.string().min(1).max(50).transform((s) => s.trim().toUpperCase()).optional(),
  discount_type:   z.enum(['percent','fixed']).optional(),
  discount_value:  z.number().positive().optional(),
  applies_to:      z.enum(['all','specific']).optional(),
  course_ids:      z.array(z.string().uuid()).nullable().optional(),
  max_redemptions: z.number().int().positive().nullable().optional(),
  per_user_limit:  z.number().int().min(1).optional(),
  starts_at:       z.string().datetime().nullable().optional(),
  expires_at:      z.string().datetime().nullable().optional(),
  is_active:       z.boolean().optional(),
})

async function requireManagerForCoupon(supabase: any, couponId: string, userId: string) {
  const { data: coupon } = await supabase
    .from('coupons').select('workspace_id').eq('id', couponId).maybeSingle()
  if (!coupon) return null
  const { data: wm } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', coupon.workspace_id).eq('user_id', userId).maybeSingle()
  return wm && ['owner','admin'].includes(wm.role) ? coupon : null
}

export async function GET(_req: NextRequest, { params }: { params: { couponId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const meta = await requireManagerForCoupon(supabase, params.couponId, session.user.id)
  if (!meta) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('coupons')
    .select(`
      *,
      redemptions:coupon_redemptions(
        id, user_id, discount_applied_cents, original_cents, final_cents, redeemed_at,
        user:platform_users!user_id(full_name, email)
      )
    `)
    .eq('id', params.couponId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ coupon: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { couponId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const meta = await requireManagerForCoupon(supabase, params.couponId, session.user.id)
  if (!meta) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  if (parsed.data.discount_type === 'percent' && (parsed.data.discount_value ?? 0) > 100)
    return NextResponse.json({ error: 'Percent discount cannot exceed 100.' }, { status: 422 })

  const { data, error } = await supabase
    .from('coupons')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.couponId)
    .select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'A coupon with this code already exists.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ coupon: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { couponId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const meta = await requireManagerForCoupon(supabase, params.couponId, session.user.id)
  if (!meta) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Soft-delete: deactivate rather than destroy (preserves redemption history)
  const { error } = await supabase
    .from('coupons')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', params.couponId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
