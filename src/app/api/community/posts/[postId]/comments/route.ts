// GET  /api/community/posts/[postId]/comments — threaded comments
// POST /api/community/posts/[postId]/comments — add comment / reply

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createNotification }         from '@/lib/community/notify'
import { z }                          from 'zod'

const CreateSchema = z.object({
  body:      z.string().min(1).max(5000),
  parent_id: z.string().uuid().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { postId: string } },
) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: post } = await supabase
    .from('community_posts').select('workspace_id').eq('id', params.postId).single()
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', post.workspace_id).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: comments, error } = await supabase
    .from('community_comments')
    .select(`
      id, body, parent_id, created_at, updated_at,
      author:platform_users!author_id(id, full_name, email),
      reactions:community_reactions(emoji, user_id)
    `)
    .eq('post_id', params.postId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: comments ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { postId: string } },
) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: post } = await supabase
    .from('community_posts')
    .select('workspace_id, author_id, is_locked, is_deleted')
    .eq('id', params.postId).single()
  if (!post || post.is_deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (post.is_locked) return NextResponse.json({ error: 'Post is locked' }, { status: 403 })

  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', post.workspace_id).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { data: comment, error } = await supabase
    .from('community_comments')
    .insert({
      workspace_id: post.workspace_id,
      post_id:      params.postId,
      author_id:    session.user.id,
      body:         parsed.data.body,
      parent_id:    parsed.data.parent_id ?? null,
    })
    .select(`
      id, body, parent_id, created_at,
      author:platform_users!author_id(id, full_name, email)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify post author (if someone else commented)
  ;(async () => {
    const { data: commenter } = await supabase
      .from('platform_users').select('full_name').eq('id', session.user.id).single()
    const name = commenter?.full_name ?? 'Someone'

    if (post.author_id !== session.user.id) {
      await createNotification({
        workspaceId: post.workspace_id,
        userId:      post.author_id,
        type:        'post_comment',
        title:       `${name} commented on your post`,
        body:        parsed.data.body.slice(0, 120),
        link:        `/w/community/post/${params.postId}`,
      })
    }

    // Notify parent comment author (if reply)
    if (parsed.data.parent_id) {
      const { data: parentComment } = await supabase
        .from('community_comments').select('author_id').eq('id', parsed.data.parent_id).single()
      if (parentComment && parentComment.author_id !== session.user.id) {
        await createNotification({
          workspaceId: post.workspace_id,
          userId:      parentComment.author_id,
          type:        'comment_reply',
          title:       `${name} replied to your comment`,
          body:        parsed.data.body.slice(0, 120),
          link:        `/w/community/post/${params.postId}`,
        })
      }
    }
  })()

  return NextResponse.json({ comment }, { status: 201 })
}
