// GET /api/platform/quizzes/[quizId]/results
// Creator view: all student attempts with answers, scores, student info.

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const PAGE_SIZE = 50

async function assertCreatorAccess(supabase: any, quizId: string, userId: string) {
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
  if (!quiz) return null
  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return quiz
  const { data: wm } = await supabase.from('workspace_members').select('role')
    .eq('workspace_id', quiz.workspace_id).eq('user_id', userId).in('role', ['owner', 'admin']).single()
  return wm ? quiz : null
}

export async function GET(req: NextRequest, { params }: { params: { quizId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quiz = await assertCreatorAccess(supabase, params.quizId, session.user.id)
  if (!quiz) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1'))

  // Get attempts with student info
  const { data: attempts, count } = await supabase
    .from('quiz_attempts')
    .select('*, student:platform_users!quiz_attempts_user_id_fkey(id, email, full_name)', { count: 'exact' })
    .eq('quiz_id', params.quizId)
    .order('submitted_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (!attempts?.length) {
    return NextResponse.json({ attempts: [], total: count ?? 0, quiz })
  }

  // Batch-fetch answers for these attempts
  const attemptIds = attempts.map((a: any) => a.id)
  const { data: allAnswers } = await supabase
    .from('quiz_answers')
    .select('*')
    .in('attempt_id', attemptIds)

  // Fetch questions (for question text)
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, question_text, points, position')
    .eq('quiz_id', params.quizId)
    .order('position')

  // Fetch correct options
  const { data: correctOptions } = await supabase
    .from('quiz_options')
    .select('id, question_id, option_text')
    .eq('quiz_id', params.quizId)
    .eq('is_correct', true)

  const correctByQuestion: Record<string, string[]> = {}
  for (const opt of correctOptions ?? []) {
    if (!correctByQuestion[opt.question_id]) correctByQuestion[opt.question_id] = []
    correctByQuestion[opt.question_id].push(opt.id)
  }

  const answersByAttempt: Record<string, any[]> = {}
  for (const ans of allAnswers ?? []) {
    if (!answersByAttempt[ans.attempt_id]) answersByAttempt[ans.attempt_id] = []
    answersByAttempt[ans.attempt_id].push({
      question_id:          ans.question_id,
      is_correct:           ans.is_correct,
      selected_option_ids:  ans.selected_option_ids,
      correct_option_ids:   correctByQuestion[ans.question_id] ?? [],
    })
  }

  const rows = attempts.map((a: any) => ({
    attempt:        a,
    student_name:   a.student?.full_name ?? '—',
    student_email:  a.student?.email ?? '—',
    answers:        answersByAttempt[a.id] ?? [],
  }))

  return NextResponse.json({
    quiz,
    questions:  questions ?? [],
    attempts:   rows,
    total:      count ?? 0,
    page,
  })
}
