import { NextRequest, NextResponse } from 'next/server'
import { cookies }                   from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'

const UpdateSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  tagline:     z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  logo_url:    z.string().url().optional().or(z.literal('')),
  settings: z.object({
    accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    favicon_url:  z.string().url().optional().or(z.literal('')),
    custom_css:   z.string().max(5000).optional(),
  }).optional(),
})

async function assertAccess(supabase: any, workspaceId: string, userId: string) {
  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return true

  const { data: wm } = await (supabase as any)
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .in('role', ['owner', 'admin'])
    .single()
  return !!wm
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ok = await assertAccess(supabase, params.workspaceId, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: workspace, error } = await (supabase as any)
    .from('workspaces')
    .select('id, name, slug, tagline, description, logo_url, cover_url, plan_status, settings')
    .eq('id', params.workspaceId)
    .single()

  if (error || !workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ workspace })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ok = await assertAccess(supabase, params.workspaceId, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { name, tagline, description, logo_url, settings } = parsed.data

  // Merge settings JSONB with existing
  let mergedSettings = settings
  if (settings) {
    const { data: current } = await (supabase as any)
      .from('workspaces').select('settings').eq('id', params.workspaceId).single()
    mergedSettings = { ...(current?.settings ?? {}), ...settings }
  }

  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (name        !== undefined) update.name        = name
  if (tagline     !== undefined) update.tagline     = tagline
  if (description !== undefined) update.description = description
  if (logo_url    !== undefined) update.logo_url    = logo_url
  if (mergedSettings)            update.settings    = mergedSettings

  const { data: workspace, error } = await (supabase as any)
    .from('workspaces')
    .update(update)
    .eq('id', params.workspaceId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ workspace })
}
