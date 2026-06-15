// PATCH /api/platform/domains/[domainId]  — set primary
// DELETE /api/platform/domains/[domainId] — remove domain

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceRoleClient }    from '@/lib/supabase/server'

async function getAdminDomain(supabase: any, svc: any, domainId: string, userId: string) {
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', userId).single()
  const isPlatformAdmin = pu?.platform_role === 'platform_admin'

  const { data: domain } = await svc
    .from('workspace_domains')
    .select('id, workspace_id, domain, verified, status, is_primary')
    .eq('id', domainId)
    .single()

  if (!domain) return { domain: null, ok: false }

  if (!isPlatformAdmin) {
    const { data: wm } = await supabase
      .from('workspace_members').select('role')
      .eq('workspace_id', domain.workspace_id)
      .eq('user_id', userId)
      .in('role', ['owner', 'admin']).maybeSingle()
    if (!wm) return { domain: null, ok: false }
  }

  return { domain, ok: true }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { domainId: string } }
) {
  const supabase = createServerSupabaseClient() as any
  const svc      = createServiceRoleClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { domain, ok } = await getAdminDomain(supabase, svc, params.domainId, session.user.id)
  if (!ok || !domain) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 })

  const { is_primary } = (await req.json().catch(() => ({}))) as { is_primary?: boolean }

  // If setting as primary, clear other primary flags for this workspace first
  if (is_primary === true) {
    await svc
      .from('workspace_domains')
      .update({ is_primary: false })
      .eq('workspace_id', domain.workspace_id)
  }

  const { data: updated, error } = await svc
    .from('workspace_domains')
    .update({ is_primary: is_primary ?? domain.is_primary, updated_at: new Date().toISOString() })
    .eq('id', params.domainId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ domain: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { domainId: string } }
) {
  const supabase = createServerSupabaseClient() as any
  const svc      = createServiceRoleClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { domain, ok } = await getAdminDomain(supabase, svc, params.domainId, session.user.id)
  if (!ok || !domain) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 })

  await svc.from('workspace_domains').delete().eq('id', params.domainId)

  return NextResponse.json({ ok: true })
}
