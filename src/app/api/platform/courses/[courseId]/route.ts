import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient }  from '@/lib/supabase/server'
import { z }                           from 'zod'

const UpdateSchema = z.object({
  title:         z.string().min(3).max(120).optional(),
  slug:          z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
  short_desc:    z.string().max(300).optional(),
  long_desc:     z.string().optional(),
  price:         z.number().min(0).optional(),
  is_free:       z.boolean().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  difficulty:    z.enum(['Beginner','Intermediate','Advanced']).optional(),
  duration_hrs:  z.number().min(0).optional(),
  category:      z.string().max(80).nullable().optional(),
  language:      z.string().max(20).optional(),
  status:               z.enum(['draft','published','archived']).optional(),
  outcomes:             z.array(z.string()).optional(),
  requirements:         z.array(z.string()).optional(),
  certificates_enabled: z.boolean().optional(),
})

// Verify caller can manage this specific course
async function loadCourse(supabase: any, courseId: string, userId: string) {
  const { data: course } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .not('workspace_id', 'is', null)
    .single()
  if (!course) return null

  // Platform admin
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return course

  // Workspace owner/admin
  const { data: wm } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', course.workspace_id)
    .eq('user_id', userId)
    .in('role', ['owner','admin'])
    .single()
  return wm ? course : null
}

// GET /api/platform/courses/[courseId]
// Returns course + all modules + all lessons (for the editor)
export async function GET(req: NextRequest, { params }: { params: { courseId: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await loadCourse(supabase, params.courseId, session.user.id)
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: modules } = await supabase
    .from('modules')
    .select('*, lessons(*)')
    .eq('course_id', course.id)
    .order('position')

  const enriched = (modules ?? []).map((m: any) => ({
    ...m,
    lessons: (m.lessons ?? []).sort((a: any, b: any) => a.position - b.position),
  }))

  return NextResponse.json({ course, modules: enriched })
}

// PATCH /api/platform/courses/[courseId]
export async function PATCH(req: NextRequest, { params }: { params: { courseId: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await loadCourse(supabase, params.courseId, session.user.id)
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body   = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const updates: Record<string, unknown> = { ...parsed.data }

  // Slug uniqueness within workspace
  if (updates.slug && updates.slug !== course.slug) {
    const { data: dup } = await supabase
      .from('courses')
      .select('id')
      .eq('workspace_id', course.workspace_id)
      .eq('slug', updates.slug)
      .neq('id', course.id)
      .maybeSingle()
    if (dup) return NextResponse.json({ error: 'Slug already used in this workspace' }, { status: 409 })
  }

  // Stamp published_at on first publish
  if (updates.status === 'published' && course.status !== 'published') {
    updates.published_at = new Date().toISOString()
    updates.is_published = true
  }
  if (updates.status === 'draft' || updates.status === 'archived') {
    updates.is_published = false
  }

  const { data: updated, error } = await (supabase as any)
    .from('courses')
    .update(updates)
    .eq('id', course.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ course: updated })
}

// DELETE /api/platform/courses/[courseId]
export async function DELETE(req: NextRequest, { params }: { params: { courseId: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const course = await loadCourse(supabase, params.courseId, session.user.id)
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase.from('courses').delete().eq('id', course.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
