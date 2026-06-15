// GET /api/student/quizzes?lessonId=
// Student view: quiz + questions + options WITHOUT is_correct.
// Only available to enrolled students (or for free lessons).

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lessonId = req.nextUrl.searchParams.get('lessonId')
  if (!lessonId) return NextResponse.json({ error: 'lessonId required' }, { status: 400 })

  // Verify lesson exists
  const { data: lesson } = await supabase
    .from('lessons').select('id, course_id, workspace_id, is_free').eq('id', lessonId).single()
  if (!lesson) return NextResponse.json({ quiz: null })

  // Access: enrolled OR free lesson
  if (!lesson.is_free) {
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id').eq('user_id', session.user.id)
      .eq('course_id', lesson.course_id).eq('access_status', 'active').maybeSingle()
    if (!enrollment) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
  }

  const { data: quiz } = await supabase
    .from('quizzes').select('id, lesson_id, pass_score, max_attempts, reveal_answers')
    .eq('lesson_id', lessonId).maybeSingle()
  if (!quiz) return NextResponse.json({ quiz: null })

  // Questions + options — NEVER include is_correct
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, quiz_id, question_type, question_text, points, position')
    .eq('quiz_id', quiz.id).order('position')

  const questionIds = (questions ?? []).map((q: any) => q.id)
  let optionsByQuestion: Record<string, any[]> = {}

  if (questionIds.length > 0) {
    const { data: options } = await supabase
      .from('quiz_options')
      // Explicitly omit is_correct — security: never expose to student
      .select('id, question_id, option_text, position')
      .in('question_id', questionIds)
      .order('position')

    for (const opt of options ?? []) {
      if (!optionsByQuestion[opt.question_id]) optionsByQuestion[opt.question_id] = []
      optionsByQuestion[opt.question_id].push(opt)
    }
  }

  const qs = (questions ?? []).map((q: any) => ({
    ...q,
    options: optionsByQuestion[q.id] ?? [],
  }))

  return NextResponse.json({ quiz: { ...quiz, questions: qs } })
}
