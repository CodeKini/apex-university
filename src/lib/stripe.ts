// SECURITY: This module is server-only. It imports the Stripe secret key
// which must NEVER be sent to the browser.
import Stripe from 'stripe'
import type { Plan } from '@/types/billing'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,
})

export function formatPrice(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

// ── Plan definitions ──────────────────────────────────────────────────────────
// Price IDs are created in your Stripe dashboard → Products.
// Add them to .env.local:
//   STRIPE_PRICE_STARTER_MONTHLY=price_xxx
//   STRIPE_PRICE_GROWTH_MONTHLY=price_xxx
//   STRIPE_PRICE_PRO_MONTHLY=price_xxx

export const PLANS: Plan[] = [
  {
    name:     'starter',
    label:    'Starter',
    price:    29,
    priceId:  process.env.STRIPE_PRICE_STARTER_MONTHLY ?? '',
    features: [
      'Up to 100 students',
      '5 published courses',
      'Basic analytics',
      'Custom branding',
      'Email support',
    ],
  },
  {
    name:        'growth',
    label:       'Growth',
    price:       79,
    priceId:     process.env.STRIPE_PRICE_GROWTH_MONTHLY ?? '',
    highlighted: true,
    features: [
      'Up to 1,000 students',
      'Unlimited courses',
      'Advanced analytics',
      'Custom domain',
      'Priority support',
      'Drip scheduling',
    ],
  },
  {
    name:     'pro',
    label:    'Pro',
    price:    199,
    priceId:  process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
    features: [
      'Unlimited students',
      'Unlimited courses',
      'White-label',
      'API access',
      'Dedicated support',
      'SLA guarantee',
    ],
  },
]

export function getPlanByPriceId(priceId: string): Plan | undefined {
  return PLANS.find((p) => p.priceId === priceId)
}

export function getPlanByName(name: string): Plan | undefined {
  return PLANS.find((p) => p.name === name)
}
