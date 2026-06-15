// Server-only coupon validation library.
// All validation happens server-side — clients never receive raw coupon rows.

export interface CouponValidationResult {
  valid:          boolean
  error?:         string
  couponId?:      string
  code?:          string
  discountType?:  'percent' | 'fixed'
  discountValue?: number
  originalCents?: number
  discountCents?: number
  finalCents?:    number
}

export async function validateCoupon(
  supabase:    any,
  code:        string,
  workspaceId: string,
  courseId:    string,
  userId:      string,
  priceCents:  number,
): Promise<CouponValidationResult> {
  const upperCode = code.trim().toUpperCase()

  // Fetch coupon
  const { data: coupon } = await supabase
    .from('coupons')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('code', upperCode)
    .maybeSingle()

  if (!coupon) return { valid: false, error: 'Coupon code not found.' }
  if (!coupon.is_active) return { valid: false, error: 'This coupon is no longer active.' }

  const now = new Date()
  if (coupon.starts_at && new Date(coupon.starts_at) > now)
    return { valid: false, error: 'This coupon is not yet valid.' }
  if (coupon.expires_at && new Date(coupon.expires_at) < now)
    return { valid: false, error: 'This coupon has expired.' }

  if (coupon.max_redemptions !== null && coupon.redemption_count >= coupon.max_redemptions)
    return { valid: false, error: 'This coupon has reached its maximum redemptions.' }

  // Course applicability
  if (coupon.applies_to === 'specific') {
    const ids: string[] = coupon.course_ids ?? []
    if (!ids.includes(courseId))
      return { valid: false, error: 'This coupon does not apply to this course.' }
  }

  // Per-user limit
  if (coupon.per_user_limit > 0) {
    const { count } = await supabase
      .from('coupon_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId)
    if ((count ?? 0) >= coupon.per_user_limit)
      return { valid: false, error: 'You have already used this coupon the maximum number of times.' }
  }

  // Calculate discount
  let discountCents: number
  if (coupon.discount_type === 'percent') {
    discountCents = Math.round(priceCents * (Number(coupon.discount_value) / 100))
  } else {
    discountCents = Math.round(Number(coupon.discount_value) * 100)
  }
  discountCents = Math.min(discountCents, priceCents) // never exceed price

  const finalCents = Math.max(0, priceCents - discountCents)

  return {
    valid:         true,
    couponId:      coupon.id,
    code:          upperCode,
    discountType:  coupon.discount_type,
    discountValue: Number(coupon.discount_value),
    originalCents: priceCents,
    discountCents,
    finalCents,
  }
}
