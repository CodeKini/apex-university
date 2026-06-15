// POST /api/platform/quizzes/[quizId]/questions
// Create a new question with its options.

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'

async function assertQuizAccess(supabase: any, quizId: string, userId: string) {
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
  if (!quiz) return null
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return quiz
  const { data: wm } = await supabase.from('workspace_members').select('role')
    .eq('workspace_id', quiz.workspace_id).eq('user_id', userId).in('role', ['owner', 'admin']).single()
  return wm ? quiz : null
}

const OptionSchema = z.object({
  option_text: z.string().min(1),
  is_correct:  z.boolean(),
  position:    z.number().int().min(1),
})

const QuestionSchema = z.object({
  question_type: z.enum(['multiple_choice', 'multiple_select', 'true_false', 'short_answer']),
  question_text: z.string().min(1),
  explanation:   z.string().nullable().optional(),
  points:        z.number().int().min(0).default(1),
  options:       z.array(OptionSchema).default([]),
})

export async function POST(req: NextRequest, { params }: { params: { quizId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quiz = await assertQuizAccess(supabase, params.quizId, session.user.id)
  if (!quiz) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body   = await req.json()
  const parsed = QuestionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  // Next position
  const { count } = await supabase
    .from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', params.quizId)

  const { data: question, error: qErr } = await supabase
    .from('quiz_questions').insert({
      quiz_id:       params.quizId,
      workspace_id:  quiz.workspace_id,
      question_type: parsed.data.question_type,
      question_text: parsed.data.question_text,
      explanation:   parsed.data.explanation ?? null,
      points:        parsed.data.points,
      position:      (count ?? 0) + 1,
    }).select().single()

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  // Insert options (for MC, MS, TF)
  let options: any[] = []
  if (parsed.data.options.length > 0) {
    const { data: opts, error: oErr } = await supabase.from('quiz_options').insert(
      parsed.data.options.map((o) => ({
        question_id:  question.id,
        quiz_id:      params.quizId,
        option_text:  o.option_text,
        is_correct:   o.is_correct,
        position:     o.position,
      }))
    ).select()
    if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 })
    options = opts ?? []
  }

  return NextResponse.json({ question: { ...question, options } }, { status: 201 })
}
