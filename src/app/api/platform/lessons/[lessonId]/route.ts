import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient }  from '@/lib/supabase/server'
import { z }                           from 'zod'

const UpdateSchema = z.object({
  title:             z.string().min(1).max(200).optional(),
  description:       z.string().nullable().optional(),
  content_type:      z.enum(['video','text','file','canva','google_embed','live','link']).optional(),
  position:          z.number().int().min(1).optional(),
  duration_mins:     z.number().int().min(0).optional(),
  is_free:           z.boolean().optional(),
  is_published:      z.boolean().optional(),
  drip_unlock_type:      z.enum(['immediate','days_after_enrollment','specific_date','after_lesson','after_module']).optional(),
  drip_delay_days:       z.number().int().min(0).optional(),
  drip_unlock_date:      z.string().nullable().optional(),
  drip_unlock_lesson_id: z.string().uuid().nullable().optional(),
  drip_unlock_module_id: z.string().uuid().nullable().optional(),
  completion_method: z.enum(['manual_mark','video_watched','quiz_passed']).optional(),
  // Video
  video_url:         z.string().url().nullable().optional(),
  video_source:      z.enum(['youtube','vimeo','loom','wistia','storage']).nullable().optional(),
  // Embed
  embed_url:         z.string().nullable().optional(),
  embed_type:        z.enum(['canva','google_doc','google_sheet','google_slide']).nullable().optional(),
  // Text
  rich_text:         z.string().nullable().optional(),
  // Live
  live_url:          z.string().url().nullable().optional(),
  live_scheduled_at: z.string().nullable().optional(),
})

async function loadLesson(supabase: any, lessonId: string, userId: string) {
  const { data: lesson } = await (supabase as any)
    .from('lessons').select('*').eq('id', lessonId).not('workspace_id','is',null).single()
  if (!lesson) return null

  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return lesson

  const { data: wm } = await (supabase as any)
    .from('workspace_members').select('role')
    .eq('workspace_id', lesson.workspace_id).eq('user_id', userId).in('role',['owner','admin']).single()
  return wm ? lesson : null
}

// GET /api/platform/lessons/[lessonId]
export async function GET(req: NextRequest, { params }: { params: { lessonId: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lesson = await loadLesson(supabase, params.lessonId, session.user.id)
  if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ lesson })
}

// PATCH /api/platform/lessons/[lessonId]
export async function PATCH(req: NextRequest, { params }: { params: { lessonId: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lesson = await loadLesson(supabase, params.lessonId, session.user.id)
  if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body   = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { data: updated, error } = await (supabase as any)
    .from('lessons')
    .update(parsed.data)
    .eq('id', params.lessonId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lesson: updated })
}
