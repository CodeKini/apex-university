// GET /api/platform/certificates?workspaceId=&courseId=&page=
// Creator/admin view of certificates issued within a workspace.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const PAGE_SIZE = 25

async function assertCanManage(supabase: any, session: any, workspaceId: string) {
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', session.user.id).single()
  if (pu?.platform_role === 'platform_admin') return true

  const { data: wm } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', session.user.id)
    .in('role', ['owner', 'admin']).single()
  return !!wm
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId') ?? ''
  const courseId    = req.nextUrl.searchParams.get('courseId')    ?? ''
  const page        = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1'))

  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const ok = await assertCanManage(supabase, session, workspaceId)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let q = supabase
    .from('certificates')
    .select('id, student_name, course_title, workspace_name, issued_at, verification_code, storage_url, course_id, user_id', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .order('issued_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (courseId) q = q.eq('course_id', courseId)

  const { data, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ certificates: data ?? [], total: count ?? 0, page, has_more: (count ?? 0) > page * PAGE_SIZE })
}
