// PUT    /api/platform/quizzes/[quizId]/questions/[questionId] — replace question + options
// DELETE /api/platform/quizzes/[quizId]/questions/[questionId] — delete question

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'

async function assertAccess(supabase: any, quizId: string, questionId: string, userId: string) {
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
  if (!quiz) return null
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return quiz
  const { data: wm } = await supabase.from('workspace_members').select('role')
    .eq('workspace_id', quiz.workspace_id).eq('user_id', userId).in('role', ['owner', 'admin']).single()
  if (!wm) return null
  // Confirm question belongs to this quiz
  const { data: q } = await supabase.from('quiz_questions').select('id')
    .eq('id', questionId).eq('quiz_id', quizId).single()
  return q ? quiz : null
}

const OptionSchema = z.object({
  option_text: z.string().min(1),
  is_correct:  z.boolean(),
  position:    z.number().int().min(1),
})

const UpdateSchema = z.object({
  question_type: z.enum(['multiple_choice', 'multiple_select', 'true_false', 'short_answer']).optional(),
  question_text: z.string().min(1).optional(),
  explanation:   z.string().nullable().optional(),
  points:        z.number().int().min(0).optional(),
  position:      z.number().int().min(1).optional(),
  options:       z.array(OptionSchema).optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: { quizId: string; questionId: string } },
) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quiz = await assertAccess(supabase, params.quizId, params.questionId, session.user.id)
  if (!quiz) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body   = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { options, ...fields } = parsed.data

  const { data: question, error: qErr } = await supabase
    .from('quiz_questions').update(fields).eq('id', params.questionId).select().single()
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  // Replace options: delete all, re-insert
  let updatedOptions: any[] = []
  if (options !== undefined) {
    await supabase.from('quiz_options').delete().eq('question_id', params.questionId)
    if (options.length > 0) {
      const { data: opts, error: oErr } = await supabase.from('quiz_options').insert(
        options.map((o) => ({
          question_id: params.questionId,
          quiz_id:     params.quizId,
          option_text: o.option_text,
          is_correct:  o.is_correct,
          position:    o.position,
        }))
      ).select()
      if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 })
      updatedOptions = opts ?? []
    }
  } else {
    // Fetch existing options
    const { data: existing } = await supabase.from('quiz_options')
      .select('*').eq('question_id', params.questionId).order('position')
    updatedOptions = existing ?? []
  }

  return NextResponse.json({ question: { ...question, options: updatedOptions } })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { quizId: string; questionId: string } },
) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quiz = await assertAccess(supabase, params.quizId, params.questionId, session.user.id)
  if (!quiz) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase.from('quiz_questions').delete().eq('id', params.questionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
