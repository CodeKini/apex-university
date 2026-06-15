// POST /api/community/reactions — toggle reaction (add if absent, remove if present)

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'
import { awardXP }                    from '@/lib/gamification/xp'

const Schema = z.object({
  workspace_id: z.string().uuid(),
  target_type:  z.enum(['post', 'comment']),
  target_id:    z.string().uuid(),
  emoji:        z.enum(['👍', '❤️', '😂', '😮', '🔥']),
})

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { workspace_id, target_type, target_id, emoji } = parsed.data

  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspace_id).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Check if reaction already exists
  const { data: existing } = await supabase
    .from('community_reactions')
    .select('id')
    .eq('target_type', target_type)
    .eq('target_id', target_id)
    .eq('user_id', session.user.id)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existing) {
    await supabase.from('community_reactions').delete().eq('id', existing.id)
    return NextResponse.json({ action: 'removed' })
  }

  await supabase.from('community_reactions').insert({
    workspace_id,
    target_type,
    target_id,
    user_id: session.user.id,
    emoji,
  })

  // Award XP to the content author (fire-and-forget)
  ;(async () => {
    try {
      const table  = target_type === 'post' ? 'community_posts' : 'community_comments'
      const { data: content } = await supabase
        .from(table).select('author_id').eq('id', target_id).maybeSingle()
      if (content?.author_id && content.author_id !== session.user.id) {
        await awardXP({ userId: content.author_id, workspaceId: workspace_id, eventType: 'receive_reaction', referenceId: `${target_id}:${session.user.id}:${emoji}` })
      }
    } catch {}
  })()

  return NextResponse.json({ action: 'added' }, { status: 201 })
}
