// GET /api/admin/emails?template=&status=&page=

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin }      from '@/lib/admin/guard'

const PAGE_SIZE = 25

export async function GET(req: NextRequest) {
  const { supabase, error } = await requirePlatformAdmin()
  if (error) return error

  const { searchParams } = req.nextUrl
  const template = searchParams.get('template') ?? ''
  const status   = searchParams.get('status')   ?? 'all'
  const search   = searchParams.get('search')   ?? ''
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'))

  let q = supabase
    .from('email_events')
    .select(`
      id, recipient_email, recipient_name, template, resend_id,
      status, error, created_at,
      workspace:workspaces!email_events_workspace_id_fkey ( id, name, slug )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (template)        q = q.eq('template', template)
  if (status !== 'all') q = q.eq('status', status)
  if (search)          q = q.ilike('recipient_email', `%${search}%`)

  const { data, count, error: qErr } = await q
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  return NextResponse.json({ events: data ?? [], total: count ?? 0, page, has_more: (count ?? 0) > page * PAGE_SIZE })
}
