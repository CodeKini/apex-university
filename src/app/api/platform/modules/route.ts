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

// GET /api/platform/modules?courseId=...
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const courseId = req.nextUrl.searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

  const course = await assertCourseAccess(supabase, courseId, session.user.id)
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data } = await (supabase as any)
    .from('modules')
    .select('*, lessons(*)')
    .eq('course_id', courseId)
    .order('position')

  const modules = (data ?? []).map((m: any) => ({
    ...m,
    lessons: (m.lessons ?? []).sort((a: any, b: any) => a.position - b.position),
  }))
  return NextResponse.json({ modules })
}

// POST /api/platform/modules
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const schema = z.object({
    course_id:   z.string().uuid(),
    title:       z.string().min(1).max(200),
    description: z.string().optional().default(''),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const course = await assertCourseAccess(supabase, parsed.data.course_id, session.user.id)
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Next position
  const { count } = await (supabase as any)
    .from('modules').select('*', { count: 'exact', head: true }).eq('course_id', course.id)

  const { data: module, error } = await (supabase as any)
    .from('modules')
    .insert({
      course_id:    course.id,
      workspace_id: course.workspace_id,
      title:        parsed.data.title,
      description:  parsed.data.description || null,
      position:     (count ?? 0) + 1,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ module }, { status: 201 })
}

// PATCH /api/platform/modules
// Handles two actions via `action` field:
//   "update"  — edit title/description of a single module
//   "reorder" — bulk position update [{id, position}]
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.action === 'reorder') {
    const schema = z.object({
      course_id: z.string().uuid(),
      items:     z.array(z.object({ id: z.string().uuid(), position: z.number() })),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

    const course = await assertCourseAccess(supabase, parsed.data.course_id, session.user.id)
    if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await Promise.all(
      parsed.data.items.map(({ id, position }) =>
        (supabase as any).from('modules').update({ position }).eq('id', id).eq('course_id', course.id)
      )
    )
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'update') {
    const schema = z.object({
      id:                    z.string().uuid(),
      course_id:             z.string().uuid(),
      title:                 z.string().min(1).max(200).optional(),
      description:           z.string().nullable().optional(),
      drip_unlock_type:      z.enum(['immediate','days_after_enrollment','specific_date','after_module']).optional(),
      drip_delay_days:       z.number().int().min(0).optional(),
      drip_unlock_date:      z.string().nullable().optional(),
      drip_unlock_module_id: z.string().uuid().nullable().optional(),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

    const course = await assertCourseAccess(supabase, parsed.data.course_id, session.user.id)
    if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { id, course_id: _, action: __, ...fields } = body
    const { data, error } = await (supabase as any)
      .from('modules').update(fields).eq('id', id).eq('course_id', course.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ module: data })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// DELETE /api/platform/modules?id=...&courseId=...
export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id       = req.nextUrl.searchParams.get('id')
  const courseId = req.nextUrl.searchParams.get('courseId')
  if (!id || !courseId) return NextResponse.json({ error: 'id and courseId required' }, { status: 400 })

  const course = await assertCourseAccess(supabase, courseId, session.user.id)
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase.from('modules').delete().eq('id', id).eq('course_id', course.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
