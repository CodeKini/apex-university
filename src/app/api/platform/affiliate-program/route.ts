import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const Schema = z.object({
  is_enabled:           z.boolean().optional(),
  commission_pct:       z.number().min(0).max(100).optional(),
  cookie_duration_days: z.number().int().min(1).max(365).optional(),
  approval_required:    z.boolean().optional(),
  payout_notes:         z.string().nullable().optional(),
})

async function assertAdmin(supabase: any, workspaceId: string, userId: string) {
  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return true
  const { data: wm } = await (supabase as any)
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', userId).in('role', ['owner','admin']).single()
  return !!wm
}

// GET /api/platform/affiliate-program?workspaceId=...
export async function GET(req: NextRequest) {
  const supabase    = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const ok = await assertAdmin(supabase, workspaceId, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await (supabase as any)
    .from('affiliate_programs').select('*').eq('workspace_id', workspaceId).maybeSingle()

  return NextResponse.json({ program: data ?? null })
}

// PATCH /api/platform/affiliate-program?workspaceId=...  (upsert)
export async function PATCH(req: NextRequest) {
  const supabase    = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const ok = await assertAdmin(supabase, workspaceId, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { data, error } = await (supabase as any)
    .from('affiliate_programs')
    .upsert({ workspace_id: workspaceId, ...parsed.data, updated_at: new Date().toISOString() },
             { onConflict: 'workspace_id' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ program: data })
}
