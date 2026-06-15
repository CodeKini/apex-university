// GET  /api/community/posts  — workspace feed / lesson comments / course discussions
// POST /api/community/posts  — create post

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createNotification }         from '@/lib/community/notify'
import { z }                          from 'zod'
import { awardXP }                    from '@/lib/gamification/xp'

const CreateSchema = z.object({
  workspace_id: z.string().uuid(),
  post_type:    z.enum(['post', 'announcement', 'question', 'lesson_comment']).default('post'),
  course_id:    z.string().uuid().optional(),
  lesson_id:    z.string().uuid().optional(),
  title:        z.string().max(200).optional(),
  body:         z.string().min(1).max(10000),
})

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp          = new URL(req.url).searchParams
  const workspaceId = sp.get('workspaceId')
  const postType    = sp.get('type')
  const courseId    = sp.get('courseId')
  const lessonId    = sp.get('lessonId')
  const page        = Math.max(1, parseInt(sp.get('page') ?? '1'))
  const limit       = Math.min(parseInt(sp.get('limit') ?? '20'), 50)
  const offset      = (page - 1) * limit

  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  let q = supabase
    .from('community_posts')
    .select(`
      id, post_type, title, body, is_pinned, is_locked, created_at, updated_at,
      author:platform_users!author_id(id, full_name, email),
      reactions:community_reactions(emoji, user_id),
      comments:community_comments(id)
    `, { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (postType)  q = q.eq('post_type', postType)
  if (courseId)  q = q.eq('course_id', courseId)
  if (lessonId)  q = q.eq('lesson_id', lessonId)

  const { data: posts, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ posts: posts ?? [], total: count ?? 0, page, limit })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { workspace_id, post_type, ...rest } = parsed.data

  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspace_id).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  if (post_type === 'announcement' && !['owner', 'admin'].includes(member.role)) {
    return NextResponse.json({ error: 'Only workspace managers can post announcements' }, { status: 403 })
  }

  const { data: post, error } = await supabase
    .from('community_posts')
    .insert({ workspace_id, post_type, author_id: session.user.id, ...rest })
    .select('*, author:platform_users!author_id(id, full_name, email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Award XP for community post (non-announcement posts only, fire-and-forget)
  if (post_type !== 'announcement') {
    ;(async () => {
      try {
        await awardXP({ userId: session.user.id, workspaceId: workspace_id, eventType: 'community_post' })
      } catch {}
    })()
  }

  // Announce to all workspace members (fire-and-forget, only for announcements)
  if (post_type === 'announcement') {
    ;(async () => {
      const { data: members } = await supabase
        .from('workspace_members').select('user_id').eq('workspace_id', workspace_id)
      for (const m of members ?? []) {
        if (m.user_id === session.user.id) continue
        await createNotification({
          workspaceId: workspace_id,
          userId:      m.user_id,
          type:        'new_announcement',
          title:       rest.title ?? 'New announcement',
          body:        rest.body.slice(0, 120),
          link:        `/w/${workspace_id}/community/post/${post.id}`,
        })
      }
    })()
  }

  return NextResponse.json({ post }, { status: 201 })
}
