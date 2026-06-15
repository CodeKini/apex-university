// GET /api/admin/workspaces/[workspaceId]
// Full workspace detail for the admin workspace detail page.

import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin }      from '@/lib/admin/guard'

export async function GET(
  _req: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const { supabase, error } = await requirePlatformAdmin()
  if (error) return error

  const [
    { data: workspace },
    { data: members },
    { data: courses },
    { data: purchases },
  ] = await Promise.all([
    supabase.from('workspaces')
      .select(`
        id, name, slug, plan_name, plan_status, seats_used, storage_used_bytes,
        created_at, suspended_at, trial_ends_at,
        stripe_customer_id, stripe_subscription_id,
        owner:platform_users!workspaces_owner_id_fkey ( id, email, full_name )
      `)
      .eq('id', params.workspaceId).maybeSingle(),
    supabase.from('workspace_members')
      .select('id, user_id, email, full_name, role, joined_at')
      .eq('workspace_id', params.workspaceId)
      .order('joined_at', { ascending: false }).limit(20),
    supabase.from('courses')
      .select('id, title, slug, status, created_at')
      .eq('workspace_id', params.workspaceId)
      .order('created_at', { ascending: false }),
    supabase.from('purchases')
      .select('id, amount_cents, currency, status, created_at, courses(title)')
      .eq('workspace_id', params.workspaceId)
      .order('created_at', { ascending: false }).limit(20),
  ])

  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ workspace, members: members ?? [], courses: courses ?? [], purchases: purchases ?? [] })
}
