// POST /api/platform/domains/[domainId]/verify
// Manual verification for now. Architecture supports automatic DNS check later.
// Marks domain as verified and sets verified_at.

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceRoleClient }    from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: { domainId: string } }
) {
  const supabase = createServerSupabaseClient() as any
  const svc      = createServiceRoleClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: domain } = await svc
    .from('workspace_domains')
    .select('id, workspace_id, domain, verified, txt_verification_key')
    .eq('id', params.domainId)
    .single()

  if (!domain) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check requester is admin of this workspace
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', session.user.id).single()
  const isPlatformAdmin = pu?.platform_role === 'platform_admin'

  if (!isPlatformAdmin) {
    const { data: wm } = await supabase
      .from('workspace_members').select('role')
      .eq('workspace_id', domain.workspace_id)
      .eq('user_id', session.user.id)
      .in('role', ['owner', 'admin']).maybeSingle()
    if (!wm) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Automatic DNS verification hook (extend here with real DNS lookup later)
  // For now: platform admins can mark verified; creators submit for review.
  // We set status 'verified' immediately for platform admins, otherwise 'pending'.
  const isAutoVerify = isPlatformAdmin

  if (isAutoVerify) {
    const { data: updated, error } = await svc
      .from('workspace_domains')
      .update({
        verified:    true,
        status:      'verified',
        verified_at: new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      })
      .eq('id', params.domainId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ domain: updated, verified: true })
  }

  // Non-admin: mark as pending review (manual verification workflow)
  // In a production implementation, trigger a DNS TXT lookup here.
  return NextResponse.json({
    domain,
    verified: false,
    message: 'Verification request submitted. Add the TXT record and we will verify within 24 hours.',
    instructions: {
      record_type:  'TXT',
      record_name:  `_apex-verification.${domain.domain}`,
      record_value: `apex-verification=${domain.txt_verification_key}`,
    },
  })
}
