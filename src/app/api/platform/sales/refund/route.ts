// POST /api/platform/sales/refund
// Issues a Stripe refund for a course purchase, updates the purchase record,
// revokes enrollment, and sends a refund confirmation email to the student.
//
// Body: { workspaceId, purchaseId }
//
// Security:
// - Only workspace owner/admin or platform_admin may refund
// - Purchase must belong to the workspace (prevents cross-workspace attacks)
// - Amount is read from DB, never trusted from client
// - Idempotent: already-refunded purchases return 409

import { NextRequest, NextResponse }      from 'next/server'
import { createServerSupabaseClient }    from '@/lib/supabase/server'
import { stripe }                        from '@/lib/stripe'
import { sendEmail }                     from '@/lib/email/send'
import { refundConfirmation }            from '@/lib/email/templates'
import { z }                             from 'zod'
import { refundLimit, rateLimitResponse } from '@/lib/rateLimit'

const Schema = z.object({
  workspaceId: z.string().uuid(),
  purchaseId:  z.string().uuid(),
})

async function assertCanManage(supabase: any, workspaceId: string, userId: string): Promise<boolean> {
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', userId).maybeSingle()
  if (pu?.platform_role === 'platform_admin') return true

  const { data: wm } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', userId)
    .in('role', ['owner', 'admin']).maybeSingle()
  return !!wm
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json().catch(() => ({}))
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { workspaceId, purchaseId } = parsed.data

  const ok = await assertCanManage(supabase, workspaceId, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rl = await refundLimit(req, workspaceId)
  if (!rl.ok) return rateLimitResponse(rl, 'Refund limit reached for this workspace. Try again later.')

  // Load purchase — verify it belongs to this workspace
  const { data: purchase } = await supabase
    .from('purchases')
    .select('id, user_id, course_id, amount_cents, currency, status, stripe_payment_intent, workspace_id')
    .eq('id', purchaseId)
    .eq('workspace_id', workspaceId) // workspace isolation enforced here
    .maybeSingle()

  if (!purchase)  return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
  if (purchase.status === 'refunded')
    return NextResponse.json({ error: 'This purchase has already been refunded' }, { status: 409 })
  if (purchase.status !== 'completed')
    return NextResponse.json({ error: 'Only completed purchases can be refunded' }, { status: 422 })
  if (!purchase.stripe_payment_intent)
    return NextResponse.json({ error: 'No Stripe payment intent on record for this purchase' }, { status: 422 })

  // Issue Stripe refund
  let stripeRefund: import('stripe').Stripe.Refund
  try {
    stripeRefund = await stripe.refunds.create({
      payment_intent: purchase.stripe_payment_intent,
    })
  } catch (err: any) {
    console.error('[Refund] Stripe error:', err.message)
    return NextResponse.json({ error: err.message ?? 'Stripe refund failed' }, { status: 502 })
  }

  if (stripeRefund.status !== 'succeeded' && stripeRefund.status !== 'pending') {
    return NextResponse.json({ error: `Stripe refund status: ${stripeRefund.status}` }, { status: 502 })
  }

  // Mark purchase refunded
  await supabase
    .from('purchases')
    .update({ status: 'refunded', updated_at: new Date().toISOString() })
    .eq('id', purchaseId)

  // Revoke enrollment (soft delete — sets access_status = 'revoked')
  await supabase
    .from('enrollments')
    .update({ access_status: 'revoked' })
    .eq('user_id', purchase.user_id)
    .eq('course_id', purchase.course_id)
    .eq('workspace_id', workspaceId)

  // Reject any pending commission
  await supabase
    .from('instructor_commissions')
    .update({
      status:           'rejected',
      rejection_reason: 'Purchase refunded',
      rejected_at:      new Date().toISOString(),
    })
    .eq('purchase_id', purchaseId)
    .eq('status',      'pending')

  // Refund confirmation email — non-blocking
  try {
    const { data: ws } = await supabase
      .from('workspaces').select('name, slug').eq('id', workspaceId).maybeSingle()
    const { data: buyer } = await supabase
      .from('workspace_members').select('email, full_name')
      .eq('workspace_id', workspaceId).eq('user_id', purchase.user_id).maybeSingle()
    const { data: course } = purchase.course_id
      ? await supabase.from('courses').select('title').eq('id', purchase.course_id).maybeSingle()
      : { data: null }

    if (buyer?.email) {
      const tpl = refundConfirmation({
        name:        buyer.full_name ?? '',
        courseTitle: course?.title ?? 'your course',
        amountCents: purchase.amount_cents,
        currency:    purchase.currency,
        purchaseId,
      })
      sendEmail({
        to: buyer.email, toName: buyer.full_name ?? undefined,
        subject: tpl.subject, html: tpl.html,
        template: 'refund_confirmation', workspaceId,
        metadata: { purchase_id: purchaseId },
      }).catch(() => {})
    }
  } catch {}

  return NextResponse.json({
    ok:           true,
    refundId:     stripeRefund.id,
    refundStatus: stripeRefund.status,
  })
}
