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

// GET /api/platform/commissions?workspaceId=...&status=...
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  const status      = req.nextUrl.searchParams.get('status')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const ok = await assertAdmin(supabase, workspaceId, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let q = (supabase as any)
    .from('affiliate_commissions')
    .select(`*, affiliate:affiliates(id, referral_code, user:platform_users(full_name, email))`)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)

  const { data } = await q
  return NextResponse.json({ commissions: data ?? [] })
}
