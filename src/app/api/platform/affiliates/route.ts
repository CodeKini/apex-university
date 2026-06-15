import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function assertAdmin(supabase: any, workspaceId: string, userId: string) {
  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return true
  const { data: wm } = await (supabase as any)
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', userId).in('role', ['owner','admin']).single()
  return !!wm
}

// GET /api/platform/affiliates?workspaceId=...
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const ok = await assertAdmin(supabase, workspaceId, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await (supabase as any)
    .from('affiliates')
    .select(`
      *,
      user:platform_users(id, full_name, email)
    `)
    .eq('workspace_id', workspaceId)
    .order('applied_at', { ascending: false })

  return NextResponse.json({ affiliates: data ?? [] })
}
