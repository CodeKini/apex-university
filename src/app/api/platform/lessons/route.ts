import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient }  from '@/lib/supabase/server'
import { z }                           from 'zod'

async function assertCourseAccess(supabase: any, courseId: string, userId: string) {
  const { data: course } = await (supabase as any)
    .from('courses').select('id, workspace_id').eq('id', courseId).not('workspace_id','is',null).single()
  if (!course) return null

  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return course

  const { data: wm } = await (supabase as any)
    .from('workspace_members').select('role')
    .eq('workspace_id', course.workspace_id).eq('user_id', userId).in('role',['owner','admin']).single()
  return wm ? course : null
}

// GET /api/platform/lessons?courseId=...&moduleId=...
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const courseId = req.nextUrl.searchParams.get('courseId')
  const moduleId = req.nextUrl.searchParams.get('moduleId')
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

  const course = await assertCourseAccess(supabase, courseId, session.user.id)
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let q = supabase.from('lessons').select('*').eq('course_id', courseId).order('position')
  if (moduleId) q = q.eq('module_id', moduleId)

  const { data } = await q
  return NextResponse.json({ lessons: data ?? [] })
}

// POST /api/platform/lessons
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const schema = z.object({
    course_id:    z.string().uuid(),
    module_id:    z.string().uuid(),
    title:        z.string().min(1).max(200),
    content_type: z.enum(['video','text','file','canva','google_embed','live','link']).optional().default('video'),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const course = await assertCourseAccess(supabase, parsed.data.course_id, session.user.id)
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Next position within module
  const { count } = await (supabase as any)
    .from('lessons').select('*', { count: 'exact', head: true }).eq('module_id', parsed.data.module_id)

  const { data: lesson, error } = await (supabase as any)
    .from('lessons')
    .insert({
      course_id:    course.id,
      module_id:    parsed.data.module_id,
      workspace_id: course.workspace_id,
      title:        parsed.data.title,
      content_type: parsed.data.content_type,
      position:     (count ?? 0) + 1,
      duration_mins: 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lesson }, { status: 201 })
}

// PATCH /api/platform/lessons — reorder
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const schema = z.object({
    course_id:  z.string().uuid(),
    module_id:  z.string().uuid(),
    items:      z.array(z.object({ id: z.string().uuid(), position: z.number() })),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const course = await assertCourseAccess(supabase, parsed.data.course_id, session.user.id)
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await Promise.all(
    parsed.data.items.map(({ id, position }) =>
      (supabase as any).from('lessons').update({ position }).eq('id', id).eq('module_id', parsed.data.module_id)
    )
  )
  return NextResponse.json({ ok: true })
}

// DELETE /api/platform/lessons?id=...&courseId=...
export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id       = req.nextUrl.searchParams.get('id')
  const courseId = req.nextUrl.searchParams.get('courseId')
  if (!id || !courseId) return NextResponse.json({ error: 'id and courseId required' }, { status: 400 })

  const course = await assertCourseAccess(supabase, courseId, session.user.id)
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase.from('lessons').delete().eq('id', id).eq('course_id', course.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
