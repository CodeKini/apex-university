// GET  /api/platform/gamification/settings?workspaceId=
// PATCH /api/platform/gamification/settings

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceRoleClient }    from '@/lib/supabase/server'
import { ensureWorkspaceBadges }      from '@/lib/gamification/xp'
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

  // Seed default badges if not yet done
  const svc = createServiceRoleClient() as any
  await ensureWorkspaceBadges(svc, workspaceId)

  const [{ data: settings }, { data: badges }] = await Promise.all([
    supabase.from('xp_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    supabase.from('badges').select('*').eq('workspace_id', workspaceId).order('sort_order'),
  ])

  return NextResponse.json({ settings, badges })
}

const SettingsSchema = z.object({
  workspaceId:        z.string().uuid(),
  enabled:            z.boolean().optional(),
  xp_complete_lesson: z.number().int().min(0).optional(),
  xp_pass_quiz:       z.number().int().min(0).optional(),
  xp_complete_course: z.number().int().min(0).optional(),
  xp_earn_certificate:z.number().int().min(0).optional(),
  xp_complete_path:   z.number().int().min(0).optional(),
  xp_community_post:  z.number().int().min(0).optional(),
  xp_receive_reaction:z.number().int().min(0).optional(),
  xp_refer_purchase:  z.number().int().min(0).optional(),
  xp_daily_streak:    z.number().int().min(0).optional(),
  ev_complete_lesson: z.boolean().optional(),
  ev_pass_quiz:       z.boolean().optional(),
  ev_complete_course: z.boolean().optional(),
  ev_earn_certificate:z.boolean().optional(),
  ev_complete_path:   z.boolean().optional(),
  ev_community_post:  z.boolean().optional(),
  ev_receive_reaction:z.boolean().optional(),
  ev_refer_purchase:  z.boolean().optional(),
  ev_daily_streak:    z.boolean().optional(),
  // badge toggles: { badge_id: boolean }
  badge_toggles:      z.record(z.boolean()).optional(),
})

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = SettingsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { workspaceId, badge_toggles, ...rest } = parsed.data

  if (!(await requireAdmin(supabase, workspaceId, session.user.id)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceRoleClient() as any

  // Upsert settings
  const { data: settings, error } = await svc.from('xp_settings').upsert(
    { workspace_id: workspaceId, ...rest, updated_at: new Date().toISOString() },
    { onConflict: 'workspace_id' }
  ).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Apply badge toggles
  if (badge_toggles && Object.keys(badge_toggles).length) {
    for (const [badgeId, isEnabled] of Object.entries(badge_toggles)) {
      await svc.from('badges')
        .update({ is_enabled: isEnabled })
        .eq('id', badgeId)
        .eq('workspace_id', workspaceId)
    }
  }

  return NextResponse.json({ settings })
}
