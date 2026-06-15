// GET /api/health/email — platform_admin only
// Validates Resend API key and (optionally) pings the Resend domains endpoint.

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

  const keyStatus  = envCheck('RESEND_API_KEY', 're_your')
  const fromStatus = envCheck('EMAIL_FROM')
  const apiKey     = process.env.RESEND_API_KEY

  // Only attempt a live ping when the key looks real
  let pingOk: boolean | null = null
  let pingDetail: string | undefined

  if (keyStatus === 'ok' && apiKey) {
    try {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      pingOk     = res.ok
      pingDetail = res.ok ? undefined : `HTTP ${res.status}`
    } catch (e: any) {
      pingOk     = false
      pingDetail = e.message
    }
  }

  const ok = keyStatus === 'ok' && pingOk !== false
  return NextResponse.json(
    {
      ok,
      checks: {
        RESEND_API_KEY: keyStatus,
        EMAIL_FROM:     fromStatus,
        apiPing:        pingOk,
        apiPingDetail:  pingDetail,
      },
    },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
