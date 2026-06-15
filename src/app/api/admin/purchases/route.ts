// GET /api/admin/purchases?search=&workspace=&status=&page=

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin }      from '@/lib/admin/guard'

const PAGE_SIZE = 25

export async function GET(req: NextRequest) {
  const { supabase, error } = await requirePlatformAdmin()
  if (error) return error

  const { searchParams } = req.nextUrl
  const search      = searchParams.get('search')      ?? ''
  const workspaceId = searchParams.get('workspace')   ?? ''
  const status      = searchParams.get('status')      ?? 'all'
  const page        = Math.max(1, parseInt(searchParams.get('page') ?? '1'))

  let q = supabase
    .from('purchases')
    .select(`
      id, amount_cents, currency, status, stripe_payment_intent_id,
      refunded_at, created_at,
      buyer:platform_users!purchases_user_id_fkey ( id, email, full_name ),
      course:courses!purchases_course_id_fkey ( id, title, slug ),
      workspace:workspaces!purchases_workspace_id_fkey ( id, name, slug )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (status !== 'all')  q = q.eq('status', status)
  if (workspaceId)       q = q.eq('workspace_id', workspaceId)
  if (search)            q = q.or(`stripe_payment_intent_id.ilike.%${search}%`)

  const { data, count, error: qErr } = await q
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  return NextResponse.json({ purchases: data ?? [], total: count ?? 0, page, has_more: (count ?? 0) > page * PAGE_SIZE })
}
