// GET /api/community/profiles/[userId]?workspaceId= — view profile
// PUT /api/community/profiles/[userId]             — upsert own profile

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'

const UpdateSchema = z.object({
  workspace_id: z.string().uuid(),
  bio:          z.string().max(500).optional(),
  avatar_url:   z.string().url().optional().or(z.literal('')),
  social_links: z.record(z.string().url()).optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = new URL(req.url).searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: user }, { data: profile }, { data: enrollment }] = await Promise.all([
    supabase.from('platform_users').select('id, full_name, email, created_at').eq('id', params.userId).single(),
    supabase.from('student_profiles')
      .select('bio, avatar_url, social_links').eq('workspace_id', workspaceId)
      .eq('user_id', params.userId).maybeSingle(),
    supabase.from('enrollments')
      .select('id, enrolled_at, access_status, course_id', { count: 'exact' })
      .eq('workspace_id', workspaceId).eq('user_id', params.userId).eq('access_status', 'active'),
  ])

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ user, profile: profile ?? {}, enrollmentCount: enrollment?.length ?? 0 })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.id !== params.userId) {
    return NextResponse.json({ error: 'Can only update your own profile' }, { status: 403 })
  }

  const body   = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { workspace_id, ...fields } = parsed.data

  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspace_id).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: profile, error } = await supabase
    .from('student_profiles')
    .upsert(
      { workspace_id, user_id: session.user.id, ...fields, updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id,user_id' },
    )
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile })
}
