// GET   /api/platform/paths/[pathId] — creator get path
// PATCH /api/platform/paths/[pathId] — update path
// DELETE /api/platform/paths/[pathId] — delete path

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'

const UpdateSchema = z.object({
  title:                z.string().min(1).max(200).optional(),
  slug:                 z.string().max(200).optional(),
  description:          z.string().max(2000).optional(),
  thumbnail_url:        z.string().url().optional().or(z.literal('')),
  difficulty:           z.enum(['beginner','intermediate','advanced']).optional(),
  estimated_hours:      z.number().int().positive().nullable().optional(),
  status:               z.enum(['draft','published']).optional(),
  certificates_enabled: z.boolean().optional(),
})

async function requireManager(supabase: any, pathId: string, userId: string) {
  const { data: path } = await supabase.from('learning_paths').select('workspace_id').eq('id', pathId).maybeSingle()
  if (!path) return null
  const { data: wm } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', path.workspace_id).eq('user_id', userId).maybeSingle()
  return wm && ['owner','admin'].includes(wm.role) ? path : null
}

export async function GET(_req: NextRequest, { params }: { params: { pathId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = await requireManager(supabase, params.pathId, session.user.id)
  if (!path) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('learning_paths')
    .select(`
      *,
      courses:learning_path_courses(
        id, position,
        course:courses(id, title, slug, thumbnail_url, status)
      ),
      enrollments:learning_path_enrollments(count)
    `)
    .eq('id', params.pathId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data?.courses) data.courses.sort((a: any, b: any) => a.position - b.position)
  return NextResponse.json({ path: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { pathId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = await requireManager(supabase, params.pathId, session.user.id)
  if (!path) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { data, error } = await supabase
    .from('learning_paths')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.pathId)
    .select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'A path with this slug already exists.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ path: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { pathId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = await requireManager(supabase, params.pathId, session.user.id)
  if (!path) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('learning_paths').delete().eq('id', params.pathId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
