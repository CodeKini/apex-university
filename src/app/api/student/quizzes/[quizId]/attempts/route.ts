// GET  /api/student/quizzes/[quizId]/attempts  — student's own attempt history
// POST /api/student/quizzes/[quizId]/attempts  — submit quiz answers (server-graded)
//
// SECURITY: Score is NEVER computed client-side.
// The client sends only answer choices. This route grades everything on the server.

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { quizLimit, rateLimitResponse } from '@/lib/rateLimit'
import { z }                          from 'zod'
import { awardXP }                    from '@/lib/gamification/xp'

export async function GET(req: NextRequest, { params }: { params: { quizId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: attempts } = await supabase
    .from('quiz_attempts')
    .select('id, attempt_number, score, passed, submitted_at')
    .eq('quiz_id', params.quizId)
    .eq('user_id', session.user.id)
    .order('attempt_number', { ascending: false })

  return NextResponse.json({ attempts: attempts ?? [] })
}

const AnswerSchema = z.object({
  question_id:         z.string().uuid(),
  selected_option_ids: z.array(z.string().uuid()).default([]),
  text_answer:         z.string().optional(),
})

const SubmitSchema = z.object({
  answers: z.array(AnswerSchema).min(1),
})

export async function POST(req: NextRequest, { params }: { params: { quizId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await quizLimit(req, session.user.id)
  if (!rl.ok) return rateLimitResponse(rl, 'Too many quiz submissions. Please wait before trying again.')

  // Load quiz
  const { data: quiz } = await supabase.from('quizzes')
    .select('*').eq('id', params.quizId).single()
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })

  // Verify enrollment
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('course_id', quiz.course_id)
    .eq('access_status', 'active')
    .maybeSingle()
  if (!enrollment) return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 })

  // Check attempt count
  const { count: existingCount } = await supabase
    .from('quiz_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('quiz_id', params.quizId)
    .eq('user_id', session.user.id)

  if (quiz.max_attempts > 0 && (existingCount ?? 0) >= quiz.max_attempts) {
    return NextResponse.json(
      { error: `Maximum attempts (${quiz.max_attempts}) reached` },
      { status: 409 }
    )
  }

  const body   = await req.json()
  const parsed = SubmitSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  // ── Server-side grading ──────────────────────────────────────────────
  // Load all questions for this quiz
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id, question_type, points')
    .eq('quiz_id', params.quizId)

  // Load all correct options
  const { data: correctOptions } = await supabase
    .from('quiz_options')
    .select('id, question_id')
    .eq('quiz_id', params.quizId)
    .eq('is_correct', true)

  // Build lookup: question_id → Set of correct option IDs
  const correctMap: Record<string, Set<string>> = {}
  for (const opt of correctOptions ?? []) {
    if (!correctMap[opt.question_id]) correctMap[opt.question_id] = new Set()
    correctMap[opt.question_id].add(opt.id)
  }

  const questionMap: Record<string, any> = {}
  for (const q of questions ?? []) questionMap[q.id] = q

  let earnedPoints = 0
  let totalPoints  = 0

  const gradedAnswers = parsed.data.answers.map((ans) => {
    const question = questionMap[ans.question_id]
    if (!question) return null

    totalPoints += question.points

    let is_correct = false

    if (question.question_type === 'short_answer') {
      // Short answer is a placeholder — always graded manually (incorrect)
      is_correct = false
    } else {
      const correctIds  = correctMap[ans.question_id] ?? new Set()
      const selectedSet = new Set(ans.selected_option_ids)

      if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
        // Exactly the one correct option selected
        is_correct = selectedSet.size === 1 &&
          [...selectedSet].every((id) => correctIds.has(id)) &&
          correctIds.size === 1
      } else if (question.question_type === 'multiple_select') {
        // Must select ALL correct options and NO incorrect ones
        const correctSize = correctIds.size
        const selectedSize = selectedSet.size
        is_correct =
          correctSize === selectedSize &&
          [...selectedSet].every((id) => correctIds.has(id))
      }
    }

    if (is_correct) earnedPoints += question.points

    return {
      question_id:          ans.question_id,
      selected_option_ids:  ans.selected_option_ids,
      text_answer:          ans.text_answer ?? null,
      is_correct,
    }
  }).filter(Boolean)

  const score  = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
  const passed = score >= quiz.pass_score

  // Insert attempt
  const attemptNumber = (existingCount ?? 0) + 1
  const { data: attempt, error: aErr } = await supabase
    .from('quiz_attempts')
    .insert({
      quiz_id:        params.quizId,
      user_id:        session.user.id,
      lesson_id:      quiz.lesson_id,
      course_id:      quiz.course_id,
      workspace_id:   quiz.workspace_id,
      attempt_number: attemptNumber,
      score,
      passed,
    }).select().single()

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })

  // Insert answers
  await supabase.from('quiz_answers').insert(
    gradedAnswers.map((a: any) => ({ ...a, attempt_id: attempt.id }))
  )

  // Award XP for first-pass quiz (fire-and-forget)
  if (passed && quiz.workspace_id) {
    ;(async () => {
      try {
        await awardXP({ userId: session.user.id, workspaceId: quiz.workspace_id, eventType: 'pass_quiz', referenceId: params.quizId })
      } catch {}
    })()
  }

  // If passed + lesson completion_method = 'quiz_passed' → mark lesson complete
  if (passed) {
    const { data: lesson } = await supabase
      .from('lessons').select('completion_method').eq('id', quiz.lesson_id).single()

    if (lesson?.completion_method === 'quiz_passed') {
      // Use the progress API logic inline (we have service context already)
      await supabase.from('lesson_progress').upsert({
        user_id:      session.user.id,
        lesson_id:    quiz.lesson_id,
        course_id:    quiz.course_id,
        workspace_id: quiz.workspace_id,
        completed:    true,
        progress_pct: 100,
        last_watched: new Date().toISOString(),
      }, { onConflict: 'user_id,lesson_id' })

      // Trigger certificate issuance (fire-and-forget)
      ;(async () => {
        try {
          const { issueCertificate, isCourseComplete } = await import('@/lib/certificates/generate')
          const allDone = await isCourseComplete(supabase, session.user.id, quiz.course_id)
          if (allDone) {
            const [{ data: courseRow }, { data: pu }, { data: ws }] = await Promise.all([
              supabase.from('courses').select('title, workspace_id, certificates_enabled').eq('id', quiz.course_id).single(),
              supabase.from('platform_users').select('full_name, email').eq('id', session.user.id).single(),
              supabase.from('workspaces').select('name').eq('id', quiz.workspace_id).single(),
            ])
            if (courseRow?.certificates_enabled) {
              await issueCertificate({
                userId:        session.user.id,
                courseId:      quiz.course_id,
                workspaceId:   quiz.workspace_id,
                enrollmentId:  enrollment.id,
                studentName:   pu?.full_name || pu?.email || 'Student',
                courseTitle:   courseRow.title,
                workspaceName: ws?.name ?? 'Apex University',
              })
            }
          }
        } catch (e) {
          console.error('[Quiz] Certificate issuance failed:', e)
        }
      })()
    }
  }

  // Build result — include correct_option_ids + explanation only if reveal_answers
  const answerResults = gradedAnswers.map((a: any) => {
    const result: any = {
      question_id:          a.question_id,
      is_correct:           a.is_correct,
      selected_option_ids:  a.selected_option_ids,
    }
    if (quiz.reveal_answers) {
      result.correct_option_ids = [...(correctMap[a.question_id] ?? [])]
    }
    return result
  })

  // If reveal_answers, fetch explanations
  if (quiz.reveal_answers) {
    const { data: explanations } = await supabase
      .from('quiz_questions')
      .select('id, explanation')
      .in('id', gradedAnswers.map((a: any) => a.question_id))

    const expMap: Record<string, string | null> = {}
    for (const e of explanations ?? []) expMap[e.id] = e.explanation

    for (const r of answerResults) r.explanation = expMap[r.question_id] ?? null
  }

  return NextResponse.json({
    attempt_id:     attempt.id,
    attempt_number: attemptNumber,
    score,
    passed,
    answers:        answerResults,
  })
}
