// GET /api/health/stripe — platform_admin only
// Validates Stripe credentials and detects test-vs-live key mode.

import { NextResponse }         from 'next/server'
import { requirePlatformAdmin } from '@/lib/admin/guard'

function envCheck(key: string, placeholder?: string): 'ok' | 'missing' | 'placeholder' {
  const val = process.env[key]
  if (!val) return 'missing'
  if (placeholder && val.includes(placeholder)) return 'placeholder'
  return 'ok'
}

export async function GET() {
  const { error } = await requirePlatformAdmin()
  if (error) return error

  const secretKey     = process.env.STRIPE_SECRET_KEY ?? ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  const keyStatus     = envCheck('STRIPE_SECRET_KEY', 'sk_test_your')
  const webhookStatus = envCheck('STRIPE_WEBHOOK_SECRET', 'whsec_your')

  const isTestMode = secretKey.startsWith('sk_test_')
  const isLiveMode = secretKey.startsWith('sk_live_')

  // Attempt live ping — list 1 product to verify credentials
  let pingOk: boolean | null = null
  let pingDetail: string | undefined

  if (keyStatus === 'ok' && secretKey) {
    try {
      const res = await fetch('https://api.stripe.com/v1/products?limit=1', {
        headers: { Authorization: `Bearer ${secretKey}` },
      })
      pingOk     = res.ok
      pingDetail = res.ok ? undefined : `HTTP ${res.status}`
    } catch (e: any) {
      pingOk     = false
      pingDetail = e.message
    }
  }

  const ok = keyStatus === 'ok' && webhookStatus === 'ok' && pingOk !== false
  return NextResponse.json(
    {
      ok,
      checks: {
        STRIPE_SECRET_KEY:     keyStatus,
        STRIPE_WEBHOOK_SECRET: webhookStatus,
        keyMode:  isLiveMode ? 'live' : isTestMode ? 'test' : 'unknown',
        apiPing:  pingOk,
        apiPingDetail: pingDetail,
        pricingConfigured: {
          STRIPE_PRICE_STARTER_MONTHLY: envCheck('STRIPE_PRICE_STARTER_MONTHLY'),
          STRIPE_PRICE_GROWTH_MONTHLY:  envCheck('STRIPE_PRICE_GROWTH_MONTHLY'),
          STRIPE_PRICE_PRO_MONTHLY:     envCheck('STRIPE_PRICE_PRO_MONTHLY'),
        },
      },
    },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
