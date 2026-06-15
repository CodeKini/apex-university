import { NextRequest, NextResponse }         from 'next/server'
import { createServerSupabaseClient }        from '@/lib/supabase/server'
import { stripe }                            from '@/lib/stripe'
import { z }                                 from 'zod'
import { checkoutLimit, rateLimitResponse }  from '@/lib/rateLimit'
import { validateCoupon }                    from '@/lib/coupons/validate'
import { cookies }                           from 'next/headers'

const REFERRAL_COOKIE = 'apex_ref'

const Schema = z.object({
  courseId:    z.string().uuid(),
  workspaceId: z.string().uuid(),
  couponCode:  z.string().max(50).optional(),
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

  const { courseId, workspaceId, couponCode } = parsed.data
  const sb = supabase as any

  // Fetch course — must be published, paid, belong to the workspace
  const { data: course } = await sb
    .from('courses')
    .select('id, title, slug, price, is_free, thumbnail_url, status, workspace_id')
    .eq('id', courseId)
    .single()

  if (!course)                              return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  if (course.workspace_id !== workspaceId)  return NextResponse.json({ error: 'Course not in workspace' }, { status: 400 })
  if (course.status !== 'published')        return NextResponse.json({ error: 'Course not published' }, { status: 400 })
  if (course.is_free || course.price === 0) return NextResponse.json({ error: 'Course is free' }, { status: 400 })

  // Check not already enrolled
  const { data: existing } = await sb
    .from('enrollments')
    .select('id')
    .eq('course_id', courseId)
    .eq('user_id', session.user.id)
    .eq('access_status', 'active')
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'Already enrolled' }, { status: 409 })

  // Fetch workspace slug for redirect
  const { data: workspace } = await sb
    .from('workspaces').select('slug').eq('id', workspaceId).single()
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const originalCents = Math.round(course.price * 100)
  let finalCents      = originalCents
  let couponId: string | null = null
  let validatedCode: string | null = null
  let discountCents = 0

  // Server-side coupon validation — clients cannot influence the final price
  if (couponCode) {
    const result = await validateCoupon(sb, couponCode, workspaceId, courseId, session.user.id, originalCents)
    if (!result.valid) return NextResponse.json({ error: result.error }, { status: 422 })
    finalCents     = result.finalCents!
    couponId       = result.couponId!
    validatedCode  = result.code!
    discountCents  = result.discountCents!
  }

  // Build Stripe line items using the server-computed final price
  const checkoutSession = await stripe.checkout.sessions.create({
    mode:                 'payment',
    payment_method_types: ['card'],
    customer_email:       session.user.email!,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency:     'usd',
          unit_amount:  finalCents,
          product_data: {
            name:        course.title,
            description: couponCode
              ? `Access to ${course.title} (coupon: ${validatedCode})`
              : `Access to ${course.title}`,
            ...(course.thumbnail_url ? { images: [course.thumbnail_url] } : {}),
          },
        },
      },
    ],
    metadata: {
      type:              'course_purchase',
      course_id:         courseId,
      workspace_id:      workspaceId,
      user_id:           session.user.id,
      amount_cents:      String(originalCents),
      final_cents:       String(finalCents),
      discount_cents:    String(discountCents),
      coupon_id:         couponId ?? '',
      coupon_code:       validatedCode ?? '',
      referral_code:     cookies().get(REFERRAL_COOKIE)?.value ?? '',
    },
    payment_intent_data: {
      metadata: {
        course_id:    courseId,
        workspace_id: workspaceId,
        user_id:      session.user.id,
      },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/w/${workspace.slug}/courses/${course.slug}?purchase=success`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/w/${workspace.slug}/courses/${course.slug}`,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
