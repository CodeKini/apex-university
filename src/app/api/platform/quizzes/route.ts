// GET  /api/platform/quizzes?lessonId=   Creator: get quiz + questions + options (with is_correct)
// POST /api/platform/quizzes             Creator: create new quiz for a lesson

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'

async function assertLessonAccess(supabase: any, lessonId: string, userId: string) {
  const { data: lesson } = await supabase
    .from('lessons').select('id, course_id, workspace_id').eq('id', lessonId).single()
  if (!lesson) return null

  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return lesson

  const { data: wm } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', lesson.workspace_id).eq('user_id', userId)
    .in('role', ['owner', 'admin']).single()
  return wm ? lesson : null
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lessonId = req.nextUrl.searchParams.get('lessonId')
  if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 })

  const lesson = await assertLessonAccess(supabase, lessonId, session.user.id)
  if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: quiz } = await supabase
    .from('quizzes').select('*').eq('lesson_id', lessonId).maybeSingle()
  if (!quiz) return NextResponse.json({ quiz: null })

  const { data: questions } = await supabase
    .from('quiz_questions').select('*, options:quiz_options(*)')
    .eq('quiz_id', quiz.id).order('position')

  // Sort options by position
  const qs = (questions ?? []).map((q: any) => ({
    ...q,
    options: (q.options ?? []).sort((a: any, b: any) => a.position - b.position),
  }))

  return NextResponse.json({ quiz: { ...quiz, questions: qs } })
}

const CreateSchema = z.object({
  lesson_id:      z.string().uuid(),
  pass_score:     z.number().int().min(0).max(100).default(70),
  max_attempts:   z.number().int().min(0).default(0),
  reveal_answers: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const lesson = await assertLessonAccess(supabase, parsed.data.lesson_id, session.user.id)
  if (!lesson) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check no existing quiz
  const { data: existing } = await supabase
    .from('quizzes').select('id').eq('lesson_id', parsed.data.lesson_id).maybeSingle()
  if (existing) return NextResponse.json({ error: 'Quiz already exists for this lesson' }, { status: 409 })

  const { data: quiz, error } = await supabase.from('quizzes').insert({
    lesson_id:      parsed.data.lesson_id,
    workspace_id:   lesson.workspace_id,
    course_id:      lesson.course_id,
    pass_score:     parsed.data.pass_score,
    max_attempts:   parsed.data.max_attempts,
    reveal_answers: parsed.data.reveal_answers,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quiz: { ...quiz, questions: [] } }, { status: 201 })
}
