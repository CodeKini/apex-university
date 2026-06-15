// GET  /api/community/dm/conversations?workspaceId= — inbox
// POST /api/community/dm/conversations             — create or find existing

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'

const CreateSchema = z.object({
  workspace_id:  z.string().uuid(),
  recipient_id:  z.string().uuid(),
})

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = new URL(req.url).searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: conversations, error } = await supabase
    .from('dm_conversations')
    .select('id, participant_ids, last_message_at, created_at')
    .eq('workspace_id', workspaceId)
    .contains('participant_ids', [session.user.id])
    .order('last_message_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with other participant info
  const enriched = await Promise.all(
    (conversations ?? []).map(async (conv: any) => {
      const otherId = conv.participant_ids.find((id: string) => id !== session.user.id)
      let other: any = null
      if (otherId) {
        const { data } = await supabase
          .from('platform_users').select('id, full_name, email').eq('id', otherId).single()
        other = data
      }
      // Latest message preview
      const { data: latest } = await supabase
        .from('dm_messages').select('body, sender_id, created_at')
        .eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1).single()
      // Unread count
      const { count: unread } = await supabase
        .from('dm_messages').select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .neq('sender_id', session.user.id)
        .is('read_at', null)
      return { ...conv, other, latest, unread: unread ?? 0 }
    })
  )

  return NextResponse.json({ conversations: enriched })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { workspace_id, recipient_id } = parsed.data
  if (recipient_id === session.user.id) {
    return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })
  }

  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspace_id).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Find existing conversation between these two in this workspace
  const { data: existing } = await supabase
    .from('dm_conversations')
    .select('id')
    .eq('workspace_id', workspace_id)
    .contains('participant_ids', [session.user.id, recipient_id])
    .maybeSingle()

  if (existing) return NextResponse.json({ conversationId: existing.id })

  const { data: conv, error } = await supabase
    .from('dm_conversations')
    .insert({
      workspace_id,
      participant_ids: [session.user.id, recipient_id],
    })
    .select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ conversationId: conv.id }, { status: 201 })
}
