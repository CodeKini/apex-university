// GET /api/student/memberships?workspaceId= — browse available tiers + current subscription

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase      = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = new URL(req.url).searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: tiers }, { data: sub }] = await Promise.all([
    supabase.from('membership_tiers')
      .select('id, name, description, monthly_price, yearly_price, benefits, community_access, resource_library_access, included_course_ids, included_path_ids, is_active, position')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('position'),
    supabase.from('member_subscriptions')
      .select('id, tier_id, status, interval, current_period_end, stripe_subscription_id, tier:membership_tiers(name, monthly_price, yearly_price)')
      .eq('workspace_id', workspaceId)
      .eq('user_id', session.user.id)
      .maybeSingle(),
  ])

  return NextResponse.json({ tiers: tiers ?? [], subscription: sub ?? null })
}
