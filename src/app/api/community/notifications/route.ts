// GET   /api/community/notifications?workspaceId= — unread + recent
// PATCH /api/community/notifications              — mark read

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = new URL(req.url).searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const unreadCount = (notifications ?? []).filter((n: any) => !n.read_at).length
  return NextResponse.json({ notifications: notifications ?? [], unreadCount })
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = z.object({
    ids: z.array(z.string().uuid()).optional(),
    all: z.boolean().optional(),
    workspace_id: z.string().uuid(),
  }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const now  = new Date().toISOString()
  let q = supabase.from('notifications').update({ read_at: now })
    .eq('user_id', session.user.id)
    .eq('workspace_id', parsed.data.workspace_id)
    .is('read_at', null)

  if (parsed.data.ids?.length) q = q.in('id', parsed.data.ids)

  await q
  return NextResponse.json({ ok: true })
}
