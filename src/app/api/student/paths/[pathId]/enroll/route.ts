// POST /api/student/paths/[pathId]/enroll — enroll student in path

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(_req: NextRequest, { params }: { params: { pathId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: path } = await supabase
    .from('learning_paths').select('id, workspace_id, status').eq('id', params.pathId).maybeSingle()
  if (!path || path.status !== 'published') return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', path.workspace_id).eq('user_id', session.user.id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('learning_path_enrollments')
    .upsert(
      { path_id: params.pathId, user_id: session.user.id, workspace_id: path.workspace_id },
      { onConflict: 'path_id,user_id', ignoreDuplicates: true }
    )
    .select().maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ enrollment: data }, { status: 201 })
}
