// GET /api/student/paths?workspaceId= — browse published paths

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = new URL(req.url).searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  // Must be a workspace member
  const { data: member } = await supabase
    .from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: paths }, { data: myEnrollments }] = await Promise.all([
    supabase
      .from('learning_paths')
      .select(`
        id, title, slug, description, thumbnail_url, difficulty,
        estimated_hours, status, certificates_enabled,
        courses:learning_path_courses(count)
      `)
      .eq('workspace_id', workspaceId)
      .eq('status', 'published')
      .order('created_at', { ascending: false }),
    supabase
      .from('learning_path_enrollments')
      .select('path_id, enrolled_at, completed_at')
      .eq('workspace_id', workspaceId)
      .eq('user_id', session.user.id),
  ])

  const enrollmentMap: Record<string, any> = {}
  for (const e of myEnrollments ?? []) enrollmentMap[e.path_id] = e

  const result = (paths ?? []).map((p: any) => ({
    ...p,
    enrollment: enrollmentMap[p.id] ?? null,
  }))

  return NextResponse.json({ paths: result })
}
