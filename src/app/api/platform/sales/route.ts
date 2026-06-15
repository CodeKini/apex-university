// GET /api/platform/sales?workspaceId=X[&status=completed|refunded|all]
// Returns all course purchases for a workspace with buyer + course details.
// Only workspace owner/admin or platform_admin can access.

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function assertCanManage(supabase: any, workspaceId: string, userId: string): Promise<boolean> {
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', userId).maybeSingle()
  if (pu?.platform_role === 'platform_admin') return true

  const { data: wm } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', userId)
    .in('role', ['owner', 'admin']).maybeSingle()
  return !!wm
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  const status      = req.nextUrl.searchParams.get('status') ?? 'all'
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const ok = await assertCanManage(supabase, workspaceId, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let q = supabase
    .from('purchases')
    .select(`
      id, user_id, amount_cents, currency, status, created_at,
      stripe_payment_intent,
      courses ( id, title, slug ),
      workspace_members!purchases_user_id_fkey ( full_name, email, avatar_url )
    `)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) {
    // Fallback: join may fail if FK alias doesn't exist — do a manual batch lookup
    const { data: purchases, error: e2 } = await supabase
      .from('purchases')
      .select('id, user_id, amount_cents, currency, status, created_at, stripe_payment_intent, courses(id, title, slug)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

    // Batch fetch member info
    const userIds = [...new Set((purchases ?? []).map((p: any) => p.user_id))]
    const { data: members } = userIds.length > 0
      ? await supabase.from('workspace_members').select('user_id, full_name, email, avatar_url')
          .eq('workspace_id', workspaceId).in('user_id', userIds)
      : { data: [] }

    const memberMap: Record<string, any> = {}
    for (const m of members ?? []) memberMap[m.user_id] = m

    const result = (purchases ?? []).map((p: any) => ({
      ...p,
      buyer: memberMap[p.user_id] ?? null,
    }))

    return NextResponse.json({ sales: result })
  }

  const result = (data ?? []).map((p: any) => ({
    ...p,
    buyer: p.workspace_members ?? null,
  }))

  return NextResponse.json({ sales: result })
}
