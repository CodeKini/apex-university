// GET /api/platform/usage?workspaceId=X
// Returns current usage counts + plan limits for the billing UI.

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getWorkspaceUsage }          from '@/lib/plans'

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  // Only owner/admin/platform_admin can see usage
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', session.user.id).maybeSingle()
  const isPlatformAdmin = pu?.platform_role === 'platform_admin'

  if (!isPlatformAdmin) {
    const { data: wm } = await supabase
      .from('workspace_members').select('role')
      .eq('workspace_id', workspaceId).eq('user_id', session.user.id).maybeSingle()
    if (!['owner', 'admin'].includes(wm?.role ?? ''))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const usage = await getWorkspaceUsage(supabase, workspaceId)
  return NextResponse.json({ usage })
}
