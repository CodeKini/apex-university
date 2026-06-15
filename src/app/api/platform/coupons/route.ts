// GET  /api/platform/coupons?workspaceId= — list coupons with redemption stats
// POST /api/platform/coupons              — create coupon

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'

const CreateSchema = z.object({
  workspace_id:    z.string().uuid(),
  code:            z.string().min(1).max(50).transform((s) => s.trim().toUpperCase()),
  discount_type:   z.enum(['percent','fixed']),
  discount_value:  z.number().positive(),
  applies_to:      z.enum(['all','specific']).default('all'),
  course_ids:      z.array(z.string().uuid()).optional(),
  max_redemptions: z.number().int().positive().nullable().optional(),
  per_user_limit:  z.number().int().min(1).default(1),
  starts_at:       z.string().datetime().nullable().optional(),
  expires_at:      z.string().datetime().nullable().optional(),
  is_active:       z.boolean().default(true),
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

  const { data: coupons, error } = await supabase
    .from('coupons')
    .select(`
      id, code, discount_type, discount_value, applies_to, course_ids,
      max_redemptions, per_user_limit, redemption_count,
      starts_at, expires_at, is_active, created_at, updated_at,
      redemptions:coupon_redemptions(discount_applied_cents)
    `)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Compute revenue saved per coupon
  const enriched = (coupons ?? []).map((c: any) => ({
    ...c,
    revenue_saved_cents: (c.redemptions ?? []).reduce((s: number, r: any) => s + (r.discount_applied_cents ?? 0), 0),
    redemptions:         undefined,
  }))

  return NextResponse.json({ coupons: enriched })
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

  // Validate percent <= 100
  if (rest.discount_type === 'percent' && rest.discount_value > 100)
    return NextResponse.json({ error: 'Percent discount cannot exceed 100.' }, { status: 422 })

  const { data: coupon, error } = await supabase
    .from('coupons')
    .insert({ workspace_id, ...rest })
    .select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'A coupon with this code already exists.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ coupon }, { status: 201 })
}
