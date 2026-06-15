// GET /api/health/storage — platform_admin only
// Verifies required Supabase Storage buckets exist.

import { NextResponse }            from 'next/server'
import { requirePlatformAdmin }    from '@/lib/admin/guard'
import { createServiceRoleClient } from '@/lib/supabase/server'

const REQUIRED_BUCKETS = [
  { id: 'certificates',  public: true,  description: 'PDF certificate storage' },
  { id: 'course-assets', public: false, description: 'Course media uploads'    },
]

export async function GET() {
  const { error } = await requirePlatformAdmin()
  if (error) return error

  const supabase = createServiceRoleClient() as any
  const checks: Array<{
    bucket: string
    description: string
    exists: boolean
    publicMatch: boolean | null
    error?: string
  }> = []

  let { data: buckets, error: listErr } = await supabase.storage.listBuckets()

  if (listErr) {
    return NextResponse.json(
      { ok: false, error: listErr.message, checks: [] },
      { status: 503 },
    )
  }

  const bucketMap = new Map<string, any>((buckets ?? []).map((b: any) => [b.id, b]))

  for (const req of REQUIRED_BUCKETS) {
    const found = bucketMap.get(req.id)
    checks.push({
      bucket:      req.id,
      description: req.description,
      exists:      !!found,
      publicMatch: found ? found.public === req.public : null,
    })
  }

  const allOk = checks.every((c) => c.exists && c.publicMatch !== false)
  return NextResponse.json(
    { ok: allOk, checks },
    { status: allOk ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
