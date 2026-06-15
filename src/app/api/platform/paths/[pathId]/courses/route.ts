// GET    — list courses in path (ordered)
// POST   — add course to path
// PUT    — reorder courses
// DELETE — remove course from path

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'

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
    .from('learning_path_courses')
    .select('id, position, course:courses(id, title, slug, thumbnail_url, status)')
    .eq('path_id', params.pathId)
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ courses: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: { pathId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pathMeta = await requireManager(supabase, params.pathId, session.user.id)
  if (!pathMeta) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { course_id } = await req.json()
  if (!course_id) return NextResponse.json({ error: 'course_id required' }, { status: 400 })

  // Get next position
  const { count } = await supabase
    .from('learning_path_courses').select('id', { count: 'exact', head: true }).eq('path_id', params.pathId)

  const { data, error } = await supabase
    .from('learning_path_courses')
    .insert({ path_id: params.pathId, course_id, workspace_id: pathMeta.workspace_id, position: (count ?? 0) + 1 })
    .select('id, position, course:courses(id, title, slug, thumbnail_url, status)')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Course already in this path.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ course: data }, { status: 201 })
}

export async function PUT(req: NextRequest, { params }: { params: { pathId: string } }) {
  // Body: { order: [{ id: string, position: number }] }
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pathMeta = await requireManager(supabase, params.pathId, session.user.id)
  if (!pathMeta) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { order } = await req.json()
  if (!Array.isArray(order)) return NextResponse.json({ error: 'order array required' }, { status: 400 })

  await Promise.all(
    order.map(({ id, position }: { id: string; position: number }) =>
      supabase.from('learning_path_courses').update({ position }).eq('id', id).eq('path_id', params.pathId)
    )
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { pathId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pathMeta = await requireManager(supabase, params.pathId, session.user.id)
  if (!pathMeta) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const courseId = new URL(req.url).searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

  const { error } = await supabase
    .from('learning_path_courses')
    .delete()
    .eq('path_id', params.pathId)
    .eq('course_id', courseId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
