// PATCH /api/community/moderation/posts/[postId]
// Moderation actions: pin, unpin, lock, unlock, delete, restore
// Requires workspace owner/admin or platform_admin

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'

const Schema = z.object({
  action: z.enum(['pin', 'unpin', 'lock', 'unlock', 'delete', 'restore']),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { postId: string } },
) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: post } = await supabase
    .from('community_posts').select('workspace_id').eq('id', params.postId).single()
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check platform_admin or workspace manager
  const [{ data: pu }, { data: member }] = await Promise.all([
    supabase.from('platform_users').select('platform_role').eq('id', session.user.id).single(),
    supabase.from('workspace_members').select('role')
      .eq('workspace_id', post.workspace_id).eq('user_id', session.user.id).maybeSingle(),
  ])

  const isPlatformAdmin = pu?.platform_role === 'platform_admin'
  const isManager       = ['owner', 'admin'].includes(member?.role ?? '')

  if (!isPlatformAdmin && !isManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body   = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  switch (parsed.data.action) {
    case 'pin':     updates.is_pinned  = true;  break
    case 'unpin':   updates.is_pinned  = false; break
    case 'lock':    updates.is_locked  = true;  break
    case 'unlock':  updates.is_locked  = false; break
    case 'delete':  updates.is_deleted = true;  break
    case 'restore': updates.is_deleted = false; break
  }

  const { error } = await supabase
    .from('community_posts').update(updates).eq('id', params.postId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, action: parsed.data.action })
}
