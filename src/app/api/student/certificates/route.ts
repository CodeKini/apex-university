// GET /api/student/certificates?workspaceId=
// Returns certificates earned by the current student, optionally filtered by workspace.

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId') ?? ''

  let q = supabase
    .from('certificates')
    .select('id, course_title, workspace_name, issued_at, verification_code, storage_url, course_id, workspace_id')
    .eq('user_id', session.user.id)
    .order('issued_at', { ascending: false })

  if (workspaceId) q = q.eq('workspace_id', workspaceId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ certificates: data ?? [] })
}
