import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const ResourceSchema = z.object({
  workspace_id:  z.string().uuid(),
  title:         z.string().min(1).max(200),
  description:   z.string().nullable().optional(),
  resource_type: z.enum(['pdf','zip','image','audio','video_link','canva_link','google_link','external_url','file']),
  storage_path:  z.string().nullable().optional(),
  file_name:     z.string().nullable().optional(),
  file_size:     z.number().int().nullable().optional(),
  external_url:  z.string().nullable().optional(),
  access_type:   z.enum(['free','paid_course','membership','specific_courses','specific_paths']),
  course_ids:    z.array(z.string().uuid()).optional(),
  path_ids:      z.array(z.string().uuid()).optional(),
})

async function assertManager(supabase: any, workspaceId: string, userId: string) {
  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return true
  const { data: wm } = await (supabase as any)
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', userId).in('role', ['owner','admin']).single()
  return !!wm
}

// GET /api/platform/resources?workspaceId=...
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const ok = await assertManager(supabase, workspaceId, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await (supabase as any)
    .from('workspace_resources')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resources: data ?? [] })
}

// POST /api/platform/resources
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = ResourceSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const ok = await assertManager(supabase, parsed.data.workspace_id, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await (supabase as any)
    .from('workspace_resources')
    .insert({
      ...parsed.data,
      created_by:  session.user.id,
      course_ids:  parsed.data.course_ids ?? [],
      path_ids:    parsed.data.path_ids ?? [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resource: data }, { status: 201 })
}
