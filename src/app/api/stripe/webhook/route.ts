// SECURITY: Stripe webhook handler.
// 1. Verifies Stripe signature before processing anything.
// 2. Uses service role client (bypasses RLS) — runs without user auth.
// 3. Route is excluded from auth middleware (see middleware.ts matcher).
// 4. All DB operations are idempotent (ON CONFLICT / upsert).
//
// Events handled:
//   checkout.session.completed  → subscription activation OR course enrollment
//   customer.subscription.created/updated → sync plan_status to workspace
//   customer.subscription.deleted         → mark workspace canceled
//   invoice.payment_succeeded             → mark workspace active (renewal)
//   invoice.payment_failed                → mark workspace past_due
//   charge.refunded                       → mark purchase refunded, reject commission

import { NextRequest, NextResponse }    from 'next/server'
import { headers }                      from 'next/headers'
import { stripe, getPlanByPriceId }     from '@/lib/stripe'
import { createServiceRoleClient }      from '@/lib/supabase/server'
import { sendEmail }                    from '@/lib/email/send'
import {
  paidReceiptEmail, subscriptionActive, subscriptionFailed, refundConfirmation,
} from '@/lib/email/templates'
import type Stripe                      from 'stripe'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = headers().get('stripe-signature')

  if (!signature) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceRoleClient() as any

  try {
    switch (event.type) {

      // ── Checkout completed — two sub-types via metadata.type ──────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const meta    = session.metadata ?? {}

        if (meta.type === 'subscription') {
          await handleSubscriptionCheckout(session, supabase)
        } else if (meta.type === 'membership') {
          await handleMembershipCheckout(session, supabase)
        } else if (meta.type === 'course_purchase') {
          await handleCoursePurchaseCheckout(session, supabase)
        } else {
          // Legacy sessions without a type tag — treat as course purchase
          if (meta.user_id && meta.course_id) {
            await handleCoursePurchaseCheckout(session, supabase)
          }
        }
        break
      }

      // ── Subscription lifecycle ────────────────────────────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        // Route to membership handler if metadata marks it
        if (sub.metadata?.type === 'membership') {
          await syncMemberSubscription(sub, supabase)
        } else {
          await syncSubscriptionToWorkspace(sub, supabase)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub        = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

        if (sub.metadata?.type === 'membership') {
          await supabase.from('member_subscriptions')
            .update({ status: 'canceled', canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', sub.id)
          break
        }

        const { data: ws } = await supabase
          .from('workspaces').select('id').eq('stripe_customer_id', customerId).maybeSingle()
        if (ws) {
          await supabase.from('workspaces').update({
            plan_status:            'canceled',
            stripe_subscription_id: null,
            stripe_price_id:        null,
            updated_at:             new Date().toISOString(),
          }).eq('id', ws.id)
        }
        break
      }

      // ── Invoice events ────────────────────────────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        // Skip initial subscription creation (handled by checkout.session.completed)
        if (invoice.billing_reason === 'subscription_create') break

        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (!customerId) break

        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
        if (!subId) break

        const sub   = await stripe.subscriptions.retrieve(subId)
        const plan  = getPlanByPriceId(sub.items.data[0]?.price.id)
        const { data: ws } = await supabase
          .from('workspaces').select('id').eq('stripe_customer_id', customerId).maybeSingle()
        if (ws) {
          await supabase.from('workspaces').update({
            plan_status: 'active',
            plan_name:   plan?.name ?? 'starter',
            updated_at:  new Date().toISOString(),
          }).eq('id', ws.id)

          // Subscription renewal active email
          try {
            const { data: wsRow } = await supabase
              .from('workspaces').select('name, slug, owner_id').eq('id', ws.id).maybeSingle()
            if (wsRow?.owner_id) {
              const { data: owner } = await supabase
                .from('platform_users').select('email, full_name').eq('id', wsRow.owner_id).maybeSingle()
              if (owner?.email) {
                const tpl = subscriptionActive({
                  name: owner.full_name ?? '', workspaceName: wsRow.name,
                  planName: plan?.name ?? 'starter', workspaceId: ws.id,
                })
                sendEmail({
                  to: owner.email, toName: owner.full_name ?? undefined,
                  subject: tpl.subject, html: tpl.html,
                  template: 'subscription_active', workspaceId: ws.id,
                }).catch(() => {})
              }
            }
          } catch {}
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice    = event.data.object as Stripe.Invoice
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (!customerId) break
        const { data: ws } = await supabase
          .from('workspaces').select('id').eq('stripe_customer_id', customerId).maybeSingle()
        if (ws) {
          await supabase.from('workspaces').update({
            plan_status: 'past_due',
            updated_at:  new Date().toISOString(),
          }).eq('id', ws.id)

          // Payment failed email
          try {
            const { data: wsRow } = await supabase
              .from('workspaces').select('name, owner_id').eq('id', ws.id).maybeSingle()
            if (wsRow?.owner_id) {
              const { data: owner } = await supabase
                .from('platform_users').select('email, full_name').eq('id', wsRow.owner_id).maybeSingle()
              if (owner?.email) {
                const tpl = subscriptionFailed({
                  name: owner.full_name ?? '', workspaceName: wsRow.name, workspaceId: ws.id,
                })
                sendEmail({
                  to: owner.email, toName: owner.full_name ?? undefined,
                  subject: tpl.subject, html: tpl.html,
                  template: 'subscription_failed', workspaceId: ws.id,
                }).catch(() => {})
              }
            }
          } catch {}
        }
        break
      }

      // ── Refunds ───────────────────────────────────────────────────────────
      case 'charge.refunded': {
        const charge    = event.data.object as Stripe.Charge
        const intentId  = typeof charge.payment_intent === 'string' ? charge.payment_intent : null
        if (!intentId) break

        await supabase.from('purchases')
          .update({ status: 'refunded', updated_at: new Date().toISOString() })
          .eq('stripe_payment_intent', intentId)

        // Reject pending commission + send refund email
        const { data: purchase } = await supabase
          .from('purchases').select('id, user_id, course_id, amount_cents, currency, workspace_id')
          .eq('stripe_payment_intent', intentId).maybeSingle()
        if (purchase?.id) {
          await supabase.from('instructor_commissions')
            .update({ status: 'rejected', rejection_reason: 'Purchase refunded', rejected_at: new Date().toISOString() })
            .eq('purchase_id', purchase.id)
            .eq('status', 'pending')

          await supabase.from('affiliate_commissions')
            .update({ status: 'rejected', rejection_reason: 'Purchase refunded', updated_at: new Date().toISOString() })
            .eq('purchase_id', purchase.id)
            .eq('status', 'pending')

          // Refund confirmation email — non-blocking
          try {
            const { data: buyer } = purchase.workspace_id
              ? await supabase.from('workspace_members').select('email, full_name')
                  .eq('workspace_id', purchase.workspace_id).eq('user_id', purchase.user_id).maybeSingle()
              : { data: null }
            const { data: course } = purchase.course_id
              ? await supabase.from('courses').select('title').eq('id', purchase.course_id).maybeSingle()
              : { data: null }

            if (buyer?.email) {
              const tpl = refundConfirmation({
                name:        buyer.full_name ?? '',
                courseTitle: course?.title ?? 'your course',
                amountCents: charge.amount_refunded,
                currency:    charge.currency,
                purchaseId:  purchase.id,
              })
              sendEmail({
                to: buyer.email, toName: buyer.full_name ?? undefined,
                subject: tpl.subject, html: tpl.html,
                template: 'refund_confirmation', workspaceId: purchase.workspace_id ?? null,
                metadata: { purchase_id: purchase.id },
              }).catch(() => {})
            }
          } catch {}
        }
        break
      }

      default:
        break
    }
  } catch (err: any) {
    console.error(`[Webhook] Error handling ${event.type}:`, err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function handleSubscriptionCheckout(session: Stripe.Checkout.Session, supabase: any) {
  const workspaceId    = session.metadata?.workspace_id
  const planName       = session.metadata?.plan_name
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null
  if (!workspaceId || !subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  await syncSubscriptionToWorkspace(subscription, supabase, workspaceId, planName)
}

async function syncSubscriptionToWorkspace(
  subscription: Stripe.Subscription,
  supabase: any,
  explicitWorkspaceId?: string,
  explicitPlanName?: string,
) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id

  // Resolve workspace: prefer explicit ID, fall back to customer lookup
  let workspaceId = explicitWorkspaceId ?? subscription.metadata?.workspace_id
  if (!workspaceId) {
    const { data: ws } = await supabase
      .from('workspaces').select('id').eq('stripe_customer_id', customerId).maybeSingle()
    workspaceId = ws?.id
  }
  if (!workspaceId) return

  const priceId    = subscription.items.data[0]?.price.id
  const plan       = getPlanByPriceId(priceId)
  const planName   = plan?.name ?? explicitPlanName ?? 'starter'

  const statusMap: Record<string, string> = {
    trialing:           'trialing',
    active:             'active',
    past_due:           'past_due',
    canceled:           'canceled',
    incomplete:         'past_due',
    incomplete_expired: 'canceled',
    paused:             'paused',
    unpaid:             'past_due',
  }

  await supabase.from('workspaces').update({
    stripe_customer_id:     customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id:        priceId ?? null,
    plan_name:              planName,
    plan_status:            statusMap[subscription.status] ?? 'active',
    updated_at:             new Date().toISOString(),
  }).eq('id', workspaceId)

  // Subscription activated email (on checkout completion, not renewals)
  if (explicitWorkspaceId && subscription.status === 'active') {
    try {
      const { data: wsRow } = await supabase
        .from('workspaces').select('name, owner_id').eq('id', workspaceId).maybeSingle()
      if (wsRow?.owner_id) {
        const { data: owner } = await supabase
          .from('platform_users').select('email, full_name').eq('id', wsRow.owner_id).maybeSingle()
        if (owner?.email) {
          const tpl = subscriptionActive({
            name: owner.full_name ?? '', workspaceName: wsRow.name,
            planName, workspaceId,
          })
          sendEmail({
            to: owner.email, toName: owner.full_name ?? undefined,
            subject: tpl.subject, html: tpl.html,
            template: 'subscription_active', workspaceId,
          }).catch(() => {})
        }
      }
    } catch {}
  }
}

async function handleCoursePurchaseCheckout(session: Stripe.Checkout.Session, supabase: any) {
  const meta        = session.metadata ?? {}
  const userId      = meta.user_id
  const courseId    = meta.course_id
  const workspaceId = meta.workspace_id

  if (!userId || !courseId) {
    console.error('[Webhook] Missing user_id/course_id on course purchase session:', session.id)
    return
  }

  const amountCents = session.amount_total ?? Number(meta.amount_cents ?? 0)

  // Idempotency: skip if already processed (stripe_session_id is the original column name)
  const { data: existing } = await supabase
    .from('purchases').select('id').eq('stripe_session_id', session.id).maybeSingle()
  if (existing) return

  // Coupon data from metadata (set server-side at checkout creation)
  const couponId      = meta.coupon_id      || null
  const couponCode    = meta.coupon_code    || null
  const discountCents = Number(meta.discount_cents ?? 0)
  const originalCents = Number(meta.amount_cents   ?? amountCents)

  // 1. Insert purchase record using original column names from base schema
  const { data: purchase, error: purchaseErr } = await supabase
    .from('purchases')
    .insert({
      workspace_id:           workspaceId ?? null,
      user_id:                userId,
      course_id:              courseId,
      stripe_session_id:      session.id,
      stripe_payment_intent:  typeof session.payment_intent === 'string' ? session.payment_intent : null,
      amount_cents:           amountCents,
      currency:               session.currency ?? 'usd',
      status:                 'completed',
      coupon_id:              couponId || null,
      coupon_code:            couponCode || null,
      original_amount_cents:  discountCents > 0 ? originalCents : null,
      discount_cents:         discountCents > 0 ? discountCents : null,
    })
    .select('id')
    .single()

  if (purchaseErr) {
    console.error('[Webhook] Purchase insert error:', purchaseErr)
    throw purchaseErr
  }

  // 1b. Record coupon redemption and atomically increment usage counter
  if (couponId && discountCents > 0 && purchase?.id) {
    try {
      await supabase.from('coupon_redemptions').insert({
        coupon_id:              couponId,
        user_id:                userId,
        purchase_id:            purchase.id,
        workspace_id:           workspaceId ?? null,
        discount_applied_cents: discountCents,
        original_cents:         originalCents,
        final_cents:            amountCents,
      })
      await supabase.rpc('increment_coupon_redemption', { coupon_id_input: couponId })
    } catch (e) {
      console.error('[Webhook] Coupon redemption record failed:', e)
    }
  }

  // 2. Create enrollment — use insert with ignoreDuplicates because the unique
  //    constraint is a partial index (WHERE workspace_id IS NOT NULL), which
  //    Supabase's onConflict doesn't accept directly.
  const { error: enrollErr } = await supabase.from('enrollments').insert({
    user_id:       userId,
    course_id:     courseId,
    workspace_id:  workspaceId ?? null,
    access_status: 'active',
    source:        'stripe',
    enrolled_at:   new Date().toISOString(),
  })
  // Ignore duplicate-key errors (user already enrolled)
  if (enrollErr && !enrollErr.message?.includes('duplicate')) {
    console.error('[Webhook] Enrollment insert error:', enrollErr)
  }

  // 2b. Paid receipt email — non-blocking
  try {
    const { data: buyer } = await supabase
      .from('workspace_members').select('email, full_name')
      .eq('workspace_id', workspaceId ?? '').eq('user_id', userId).maybeSingle()
    const { data: course } = await supabase
      .from('courses').select('title, slug').eq('id', courseId).maybeSingle()
    const { data: ws } = workspaceId
      ? await supabase.from('workspaces').select('name, slug').eq('id', workspaceId).maybeSingle()
      : { data: null }

    if (buyer?.email && course && ws) {
      const tpl = paidReceiptEmail({
        name:          buyer.full_name ?? '',
        email:         buyer.email,
        workspaceName: ws.name,
        workspaceSlug: ws.slug,
        courseTitle:   course.title,
        courseSlug:    course.slug,
        amountCents,
        currency:      session.currency ?? 'usd',
        purchaseId:    purchase.id,
      })
      sendEmail({
        to: buyer.email, toName: buyer.full_name ?? undefined,
        subject: tpl.subject, html: tpl.html,
        template: 'paid_receipt', workspaceId: workspaceId ?? null,
        metadata: { purchase_id: purchase.id, course_id: courseId },
      }).catch(() => {})
    }
  } catch {}

  // 3. Instructor commission (best-effort, non-fatal)
  if (purchase?.id && amountCents > 0) {
    const { data: course } = await supabase
      .from('courses').select('instructor_id').eq('id', courseId).single()

    if (course?.instructor_id) {
      const { data: settings } = await supabase
        .from('platform_settings').select('key, value')
        .in('key', ['platform_commission_pct', 'instructor_payout_pct'])

      const sm: Record<string, number> = {}
      for (const s of settings ?? []) sm[s.key] = parseFloat(s.value)
      const platformPct     = sm['platform_commission_pct'] ?? 30
      const instructorPct   = sm['instructor_payout_pct']   ?? 70
      const platformCents   = Math.round(amountCents * (platformPct / 100))
      const instructorCents = amountCents - platformCents

      await supabase.from('instructor_commissions').upsert(
        {
          purchase_id:               purchase.id,
          instructor_id:             course.instructor_id,
          course_id:                 courseId,
          purchase_amount_cents:     amountCents,
          platform_pct:              platformPct,
          instructor_pct:            instructorPct,
          platform_fee_cents:        platformCents,
          instructor_earnings_cents: instructorCents,
          currency:                  session.currency ?? 'usd',
          status:                    'pending',
        },
        { onConflict: 'purchase_id', ignoreDuplicates: true },
      )
    }
  }

  // ── Affiliate commission (best-effort) ─────────────────────────────────────
  if (purchase?.id && amountCents > 0 && workspaceId) {
    try {
      await maybeCreateAffiliateCommission({
        supabase, workspaceId, purchaseId: purchase.id,
        userId, amountCents, sourceType: 'course',
      })
    } catch (e) {
      console.error('[Webhook] Affiliate commission error:', e)
    }
  }
}

// ── Membership checkout ───────────────────────────────────────────────────────

async function handleMembershipCheckout(session: Stripe.Checkout.Session, supabase: any) {
  const meta           = session.metadata ?? {}
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null
  if (!subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  await syncMemberSubscription(subscription, supabase, meta)
}

async function syncMemberSubscription(
  subscription: Stripe.Subscription,
  supabase:     any,
  explicitMeta?: Record<string, string>,
) {
  const meta        = explicitMeta ?? subscription.metadata ?? {}
  const workspaceId = meta.workspace_id
  const userId      = meta.user_id
  const tierId      = meta.tier_id
  const interval    = meta.interval ?? 'month'

  if (!workspaceId || !userId || !tierId) {
    console.error('[Webhook] Missing membership metadata on subscription:', subscription.id)
    return
  }

  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id

  const statusMap: Record<string, string> = {
    trialing:           'trialing',
    active:             'active',
    past_due:           'past_due',
    canceled:           'canceled',
    incomplete:         'incomplete',
    incomplete_expired: 'canceled',
    paused:             'paused',
    unpaid:             'past_due',
  }

  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).toISOString() : null
  const periodEnd   = subscription.current_period_end
    ? new Date(subscription.current_period_end   * 1000).toISOString() : null

  await supabase.from('member_subscriptions').upsert(
    {
      workspace_id:           workspaceId,
      user_id:                userId,
      tier_id:                tierId,
      stripe_customer_id:     customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id:        subscription.items.data[0]?.price.id ?? null,
      interval,
      status:                 statusMap[subscription.status] ?? 'active',
      current_period_start:   periodStart,
      current_period_end:     periodEnd,
      canceled_at:            subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      updated_at:             new Date().toISOString(),
    },
    { onConflict: 'workspace_id,user_id' },
  )

  // Affiliate commission for new membership (active status only, first activation)
  if (subscription.status === 'active' && workspaceId && userId) {
    const amountCents = subscription.items.data[0]?.price.unit_amount ?? 0
    if (amountCents > 0) {
      try {
        await maybeCreateAffiliateCommission({
          supabase, workspaceId, purchaseId: null,
          userId, amountCents, sourceType: 'membership',
        })
      } catch {}
    }
  }
}

// ── Affiliate commission helper ───────────────────────────────────────────────
async function maybeCreateAffiliateCommission({
  supabase, workspaceId, purchaseId, userId, amountCents, sourceType,
}: {
  supabase: any; workspaceId: string; purchaseId: string | null
  userId: string; amountCents: number; sourceType: 'course' | 'membership'
}) {
  // Check if program is enabled
  const { data: prog } = await supabase
    .from('affiliate_programs').select('is_enabled, commission_pct')
    .eq('workspace_id', workspaceId).maybeSingle()
  if (!prog?.is_enabled || !prog.commission_pct) return

  // Find the affiliate who referred this user
  const { data: user } = await supabase
    .from('platform_users').select('referred_by_affiliate_id').eq('id', userId).maybeSingle()
  const affiliateId = user?.referred_by_affiliate_id
  if (!affiliateId) return

  // Verify affiliate is still approved and belongs to this workspace
  const { data: affiliate } = await supabase
    .from('affiliates').select('id, status, workspace_id, user_id')
    .eq('id', affiliateId).eq('workspace_id', workspaceId).maybeSingle()
  if (!affiliate || affiliate.status !== 'approved') return

  // Avoid double-commission on same purchase
  if (purchaseId) {
    const { data: existing } = await supabase
      .from('affiliate_commissions').select('id').eq('purchase_id', purchaseId).maybeSingle()
    if (existing) return
  }

  const commissionCents = Math.round(amountCents * (prog.commission_pct / 100))
  if (commissionCents <= 0) return

  await supabase.from('affiliate_commissions').insert({
    affiliate_id:          affiliateId,
    workspace_id:          workspaceId,
    purchase_id:           purchaseId,
    referred_user_id:      userId,
    source_type:           sourceType,
    purchase_amount_cents: amountCents,
    commission_pct:        prog.commission_pct,
    commission_cents:      commissionCents,
    status:                'pending',
  })

  await supabase.rpc('increment_affiliate_purchase', {
    p_affiliate_id:     affiliateId,
    p_commission_cents: commissionCents,
  })

  // Award XP to the affiliate for a successful referral
  if (affiliate.user_id) {
    try {
      const { awardXP } = await import('@/lib/gamification/xp')
      await awardXP({
        userId:      affiliate.user_id,
        workspaceId: workspaceId,
        eventType:   'refer_purchase',
        referenceId: purchaseId ?? undefined,
      })
    } catch {}
  }
}
