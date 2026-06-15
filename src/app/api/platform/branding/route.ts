// GET  /api/platform/branding?workspaceId=
// PATCH /api/platform/branding

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceRoleClient }    from '@/lib/supabase/server'
import { isWhiteLabelPlan }           from '@/lib/plans'
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

  const { data: branding } = await supabase
    .from('workspace_branding').select('*').eq('workspace_id', workspaceId).maybeSingle()

  return NextResponse.json({
    branding: branding ?? null,
    plan_name: ws?.plan_name ?? 'starter',
    is_white_label: isWhiteLabelPlan(ws?.plan_name),
    can_hide_apex: isWhiteLabelPlan(ws?.plan_name),
  })
}

const Schema = z.object({
  workspaceId:           z.string().uuid(),
  academy_name:          z.string().max(100).nullable().optional(),
  tagline:               z.string().max(200).nullable().optional(),
  logo_url:              z.string().url().nullable().optional(),
  hero_image_url:        z.string().url().nullable().optional(),
  primary_color:         z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondary_color:       z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accent_color:          z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  footer_text:           z.string().max(500).nullable().optional(),
  social_links:          z.record(z.string().url().or(z.literal(''))).optional(),
  // White-label (plan-gated server-side)
  hide_powered_by_apex:  z.boolean().optional(),
  custom_email_branding: z.boolean().optional(),
  custom_cert_branding:  z.boolean().optional(),
  custom_login_branding: z.boolean().optional(),
  login_bg_url:          z.string().url().nullable().optional(),
  login_welcome_message: z.string().max(300).nullable().optional(),
  email_from_name:       z.string().max(100).nullable().optional(),
})

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { workspaceId, ...rest } = parsed.data

  if (!(await requireAdmin(supabase, workspaceId, session.user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: ws } = await supabase
    .from('workspaces').select('plan_name').eq('id', workspaceId).single()
  const isProPlan = isWhiteLabelPlan(ws?.plan_name)

  // Strip Pro-only fields if not on Pro plan
  const update: Record<string, any> = { ...rest }
  if (!isProPlan) {
    delete update.hide_powered_by_apex
    delete update.custom_email_branding
    delete update.custom_cert_branding
    delete update.custom_login_branding
    delete update.login_bg_url
    delete update.login_welcome_message
    delete update.email_from_name
  }

  const svc = createServiceRoleClient() as any
  const { data, error } = await svc.from('workspace_branding').upsert(
    { workspace_id: workspaceId, ...update, updated_at: new Date().toISOString() },
    { onConflict: 'workspace_id' }
  ).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ branding: data })
}
