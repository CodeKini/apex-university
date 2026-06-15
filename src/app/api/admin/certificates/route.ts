// GET /api/admin/certificates?search=&page=
// Platform admin — all certificates cross-workspace.

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin }      from '@/lib/admin/guard'

const PAGE_SIZE = 25

export async function GET(req: NextRequest) {
  const { supabase, error } = await requirePlatformAdmin()
  if (error) return error

  const search = req.nextUrl.searchParams.get('search') ?? ''
  const page   = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1'))

  let q = supabase
    .from('certificates')
    .select('id, student_name, course_title, workspace_name, issued_at, verification_code, storage_url', { count: 'exact' })
    .order('issued_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (search) q = q.or(`student_name.ilike.%${search}%,course_title.ilike.%${search}%`)

  const { data, count, error: qErr } = await q
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  return NextResponse.json({ certificates: data ?? [], total: count ?? 0, page, has_more: (count ?? 0) > page * PAGE_SIZE })
}
