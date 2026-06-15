// GET    /api/community/posts/[postId]  — single post with comments
// PATCH  /api/community/posts/[postId]  — edit body/title (own) or mod actions
// DELETE /api/community/posts/[postId]  — soft-delete

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'

const PatchSchema = z.object({
  body:      z.string().min(1).max(10000).optional(),
  title:     z.string().max(200).optional(),
  is_pinned: z.boolean().optional(),
  is_locked: z.boolean().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { postId: string } },
) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: post, error } = await supabase
    .from('community_posts')
    .select(`
      id, post_type, title, body, is_pinned, is_locked, workspace_id, course_id, lesson_id,
      created_at, updated_at,
      author:platform_users!author_id(id, full_name, email),
      reactions:community_reactions(emoji, user_id)
    `)
    .eq('id', params.postId)
    .eq('is_deleted', false)
    .single()

  if (error || !post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify membership
  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', post.workspace_id).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({ post })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { postId: string } },
) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: post } = await supabase
    .from('community_posts').select('author_id, workspace_id, is_deleted')
    .eq('id', params.postId).single()
  if (!post || post.is_deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', post.workspace_id).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isManager = ['owner', 'admin'].includes(member.role)
  const isAuthor  = post.author_id === session.user.id
  if (!isAuthor && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  // pin/lock only for managers
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.body      !== undefined) updates.body      = parsed.data.body
  if (parsed.data.title     !== undefined) updates.title     = parsed.data.title
  if (isManager && parsed.data.is_pinned !== undefined) updates.is_pinned = parsed.data.is_pinned
  if (isManager && parsed.data.is_locked !== undefined) updates.is_locked = parsed.data.is_locked

  const { data: updated, error } = await supabase
    .from('community_posts').update(updates).eq('id', params.postId)
    .select('id, body, title, is_pinned, is_locked, updated_at').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { postId: string } },
) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: post } = await supabase
    .from('community_posts').select('author_id, workspace_id')
    .eq('id', params.postId).single()
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', post.workspace_id).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isManager = ['owner', 'admin'].includes(member.role)
  if (post.author_id !== session.user.id && !isManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await supabase.from('community_posts').update({ is_deleted: true }).eq('id', params.postId)
  return NextResponse.json({ ok: true })
}
