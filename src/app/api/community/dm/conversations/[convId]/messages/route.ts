// GET  /api/community/dm/conversations/[convId]/messages — message history
// POST /api/community/dm/conversations/[convId]/messages — send message

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createNotification }         from '@/lib/community/notify'
import { z }                          from 'zod'

async function verifyParticipant(supabase: any, convId: string, userId: string) {
  const { data: conv } = await supabase
    .from('dm_conversations')
    .select('id, workspace_id, participant_ids')
    .eq('id', convId).single()
  if (!conv) return null
  if (!conv.participant_ids.includes(userId)) return null
  return conv
}

export async function GET(
  req: NextRequest,
  { params }: { params: { convId: string } },
) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conv = await verifyParticipant(supabase, params.convId, session.user.id)
  if (!conv) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: messages, error } = await supabase
    .from('dm_messages')
    .select('id, body, sender_id, read_at, created_at, sender:platform_users!sender_id(id, full_name, email)')
    .eq('conversation_id', params.convId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark all unread messages from other participant as read
  await supabase
    .from('dm_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', params.convId)
    .neq('sender_id', session.user.id)
    .is('read_at', null)

  return NextResponse.json({ messages: messages ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { convId: string } },
) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conv = await verifyParticipant(supabase, params.convId, session.user.id)
  if (!conv) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await req.json()
  const parsed = z.object({ body: z.string().min(1).max(5000) }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { data: message, error } = await supabase
    .from('dm_messages')
    .insert({
      conversation_id: params.convId,
      workspace_id:    conv.workspace_id,
      sender_id:       session.user.id,
      body:            parsed.data.body,
    })
    .select('id, body, sender_id, created_at, sender:platform_users!sender_id(id, full_name, email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update last_message_at
  await supabase.from('dm_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', params.convId)

  // Notify recipient (fire-and-forget)
  ;(async () => {
    const recipientId = conv.participant_ids.find((id: string) => id !== session.user.id)
    if (!recipientId) return
    const { data: sender } = await supabase
      .from('platform_users').select('full_name').eq('id', session.user.id).single()
    await createNotification({
      workspaceId: conv.workspace_id,
      userId:      recipientId,
      type:        'new_dm',
      title:       `New message from ${sender?.full_name ?? 'Someone'}`,
      body:        parsed.data.body.slice(0, 120),
      link:        `/w/community/messages/${params.convId}`,
    })
  })()

  return NextResponse.json({ message }, { status: 201 })
}
