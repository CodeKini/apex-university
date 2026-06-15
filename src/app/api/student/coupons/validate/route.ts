// POST /api/student/coupons/validate — validate a coupon code before checkout
// Returns discounted price preview. Does NOT redeem the coupon.

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { validateCoupon }             from '@/lib/coupons/validate'
import { z }                          from 'zod'

const Schema = z.object({
  code:        z.string().min(1).max(50),
  courseId:    z.string().uuid(),
  workspaceId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { code, courseId, workspaceId } = parsed.data

  // Fetch course price
  const { data: course } = await supabase
    .from('courses').select('price, is_free, workspace_id, status').eq('id', courseId).maybeSingle()

  if (!course || course.workspace_id !== workspaceId)
    return NextResponse.json({ error: 'Course not found.' }, { status: 404 })
  if (course.status !== 'published')
    return NextResponse.json({ error: 'Course not available.' }, { status: 400 })
  if (course.is_free || !course.price || course.price === 0)
    return NextResponse.json({ error: 'Course is free — no coupon needed.' }, { status: 400 })

  const priceCents = Math.round(course.price * 100)

  const result = await validateCoupon(supabase, code, workspaceId, courseId, session.user.id, priceCents)

  if (!result.valid) return NextResponse.json({ error: result.error }, { status: 422 })

  return NextResponse.json({
    valid:         true,
    code:          result.code,
    discountType:  result.discountType,
    discountValue: result.discountValue,
    originalCents: result.originalCents,
    discountCents: result.discountCents,
    finalCents:    result.finalCents,
  })
}
