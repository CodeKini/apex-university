// GET  /api/platform/domains?workspaceId=
// POST /api/platform/domains

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceRoleClient }    from '@/lib/supabase/server'
import { canUseCustomDomain }         from '@/lib/plans'
import { z }                          from 'zod'

async function requireAdmin(supabase: any, workspaceId: string, userId: string) {
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return true
  const { data: wm } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', userId)
    .in('role', ['owner', 'admin']).maybeSingle()
  return !!wm
}

export async function GET(req: NextRequest) {
  const supabase    = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  if (!(await requireAdmin(supabase, workspaceId, session.user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: ws } = await supabase
    .from('workspaces').select('plan_name').eq('id', workspaceId).single()

  const { data: domains } = await supabase
    .from('workspace_domains')
    .select('id, domain, verified, status, is_primary, verified_at, failed_at, txt_verification_key, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    domains: domains ?? [],
    plan_name: ws?.plan_name ?? 'starter',
    can_use_custom_domain: canUseCustomDomain(ws?.plan_name),
  })
}

const AddDomainSchema = z.object({
  workspaceId: z.string().uuid(),
  domain:      z.string()
    .min(3).max(253)
    .regex(/^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)+$/i,
      'Invalid domain format (e.g. academy.example.com)'),
})

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = AddDomainSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { workspaceId, domain } = parsed.data
  const domainLower = domain.toLowerCase()

  if (!(await requireAdmin(supabase, workspaceId, session.user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Plan gate: Growth+ only
  const { data: ws } = await supabase
    .from('workspaces').select('plan_name').eq('id', workspaceId).single()
  if (!canUseCustomDomain(ws?.plan_name)) {
    return NextResponse.json(
      { error: 'Custom domains require the Growth or Pro plan. Upgrade to continue.' },
      { status: 402 }
    )
  }

  // Check domain not already taken by another workspace
  const svc = createServiceRoleClient() as any
  const { data: existing } = await svc
    .from('workspace_domains')
    .select('id, workspace_id')
    .eq('domain', domainLower)
    .maybeSingle()

  if (existing && existing.workspace_id !== workspaceId) {
    return NextResponse.json(
      { error: 'This domain is already registered to another workspace.' },
      { status: 409 }
    )
  }
  if (existing && existing.workspace_id === workspaceId) {
    return NextResponse.json({ error: 'Domain already added.' }, { status: 409 })
  }

  const { data: domainRow, error } = await svc
    .from('workspace_domains')
    .insert({
      workspace_id: workspaceId,
      domain:       domainLower,
      status:       'pending',
      verified:     false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ domain: domainRow }, { status: 201 })
}
