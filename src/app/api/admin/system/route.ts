// GET /api/admin/system — env checks, counts, webhook status

import { NextResponse }         from 'next/server'
import { requirePlatformAdmin } from '@/lib/admin/guard'

function envCheck(key: string, placeholder?: string): 'ok' | 'missing' | 'placeholder' {
  const val = process.env[key]
  if (!val) return 'missing'
  if (placeholder && val.includes(placeholder)) return 'placeholder'
  return 'ok'
}

export async function GET() {
  const { supabase, error } = await requirePlatformAdmin()
  if (error) return error

  const [
    { count: workspaces },
    { count: students },
    { count: courses },
    { count: purchases },
    { data: recentErrors },
    { data: storageRows },
  ] = await Promise.all([
    supabase.from('workspaces').select('id', { count: 'exact', head: true }),
    supabase.from('workspace_members').select('id', { count: 'exact', head: true }),
    supabase.from('courses').select('id', { count: 'exact', head: true }),
    supabase.from('purchases').select('id', { count: 'exact', head: true }),
    supabase.from('email_events').select('id, template, error, created_at')
      .eq('status', 'failed').order('created_at', { ascending: false }).limit(5),
    supabase.from('workspaces').select('storage_used_bytes'),
  ])

  const totalStorageBytes = (storageRows ?? []).reduce((s: number, r: any) => s + (r.storage_used_bytes ?? 0), 0)

  const envChecks = {
    NEXT_PUBLIC_SUPABASE_URL:     envCheck('NEXT_PUBLIC_SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY:    envCheck('SUPABASE_SERVICE_ROLE_KEY'),
    STRIPE_SECRET_KEY:            envCheck('STRIPE_SECRET_KEY', 'sk_test_your'),
    STRIPE_WEBHOOK_SECRET:        envCheck('STRIPE_WEBHOOK_SECRET', 'whsec_your'),
    RESEND_API_KEY:               envCheck('RESEND_API_KEY', 're_your'),
    UPSTASH_REDIS_REST_URL:       envCheck('UPSTASH_REDIS_REST_URL', 'your-db'),
    UPSTASH_REDIS_REST_TOKEN:     envCheck('UPSTASH_REDIS_REST_TOKEN'),
    NEXT_PUBLIC_APP_URL:          envCheck('NEXT_PUBLIC_APP_URL'),
  }

  return NextResponse.json({
    db: { workspaces, students, courses, purchases, totalStorageBytes },
    envChecks,
    recentEmailErrors: recentErrors ?? [],
  })
}
