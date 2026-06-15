'use client'

import { useState } from 'react'
import {
  CheckCircle2, XCircle, AlertCircle, Loader2,
  RotateCcw, Award, ChevronRight,
} from 'lucide-react'
import type { StudentQuiz, QuizSubmitResult } from '@/types/quiz'

// ── helpers ────────────────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── QuizPlayer ──────────────────────────────────────────────────────────────

interface Props {
  quiz:          StudentQuiz
  initialAttempts: any[]          // pre-fetched attempts
  courseId:      string
  workspaceId:   string
  onQuizPassed?: () => void       // called when quiz is passed (for quiz_passed completion)
}

type Status = 'idle' | 'taking' | 'submitted'

export default function QuizPlayer({ quiz, initialAttempts, onQuizPassed }: Props) {
  const [status,   setStatus]   = useState<Status>('idle')
  const [attempts, setAttempts] = useState(initialAttempts)
  const [result,   setResult]   = useState<QuizSubmitResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  // answers: questionId → string[] of selected optionIds
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({})

  const bestAttempt   = attempts.reduce<any>((best, a) => (!best || a.score > best.score ? a : best), null)
  const attemptsUsed  = attempts.length
  const attemptsLeft  = quiz.max_attempts > 0 ? quiz.max_attempts - attemptsUsed : Infinity
  const alreadyPassed = attempts.some((a) => a.passed)
  const canRetry      = attemptsLeft > 0 && !alreadyPassed

  function startQuiz() {
    setAnswers({})
    setTextAnswers({})
    setResult(null)
    setError(null)
    setStatus('taking')
  }

  function retry() {
    setAnswers({})
    setTextAnswers({})
    setResult(null)
    setError(null)
    setStatus('taking')
  }

  function selectMC(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: [optionId] }))
  }

  function toggleMS(questionId: string, optionId: string) {
    setAnswers((prev) => {
      const cur = prev[questionId] ?? []
      const next = cur.includes(optionId) ? cur.filter((id) => id !== optionId) : [...cur, optionId]
      return { ...prev, [questionId]: next }
    })
  }

  async function submit() {
    setSubmitting(true)
    setError(null)

    const payload = quiz.questions.map((q) => ({
      question_id:          q.id,
      selected_option_ids:  q.question_type === 'short_answer' ? [] : (answers[q.id] ?? []),
      text_answer:          q.question_type === 'short_answer' ? (textAnswers[q.id] ?? '') : undefined,
    }))

    const res  = await fetch(`/api/student/quizzes/${quiz.id}/attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: payload }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to submit quiz.')
      setSubmitting(false)
      return
    }

    setResult(data as QuizSubmitResult)
    setAttempts((prev) => [...prev, {
      id: data.attempt_id, attempt_number: data.attempt_number,
      score: data.score, passed: data.passed, submitted_at: new Date().toISOString(),
    }])
    setStatus('submitted')
    setSubmitting(false)

    if (data.passed) onQuizPassed?.()
  }

  // ── IDLE view ─────────────────────────────────────────────────────────

  if (status === 'idle') {
    return (
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold-500/10 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-gold-400" />
          </div>
          <div>
            <div className="font-semibold text-white">Lesson Quiz</div>
            <div className="text-xs text-slate-400">
              {quiz.questions.length} questions · Pass score: {quiz.pass_score}%
              {quiz.max_attempts > 0 && ` · ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} left`}
            </div>
          </div>
        </div>

        {alreadyPassed && (
          <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 px-4 py-2.5 rounded-lg border border-green-500/20">
            <CheckCircle2 size={15} /> You passed this quiz!
            {bestAttempt && <span className="ml-auto text-xs text-green-500">Score: {bestAttempt.score}%</span>}
          </div>
        )}

        {bestAttempt && !alreadyPassed && (
          <div className="text-xs text-slate-400">
            Best score: {bestAttempt.score}% · Need {quiz.pass_score}%
          </div>
        )}

        {attemptsLeft === 0 && !alreadyPassed ? (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 px-4 py-2.5 rounded-lg">
            <AlertCircle size={15} /> No attempts remaining.
          </div>
        ) : (
          <button onClick={startQuiz} className="btn-primary text-sm flex items-center gap-2">
            {alreadyPassed ? 'Retake Quiz' : attemptsUsed > 0 ? 'Try Again' : 'Start Quiz'}
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    )
  }

  // ── TAKING view ───────────────────────────────────────────────────────

  if (status === 'taking') {
    const totalQuestions = quiz.questions.length
    const answered = quiz.questions.filter((q) =>
      q.question_type === 'short_answer' ? true : (answers[q.id]?.length ?? 0) > 0
    ).length

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">Quiz</span>
            <span className="text-xs text-slate-400">{answered}/{totalQuestions} answered</span>
          </div>
          <ProgressBar value={answered} max={totalQuestions} />
        </div>

        {/* Questions */}
        {quiz.questions.map((q, qi) => {
          const sel = answers[q.id] ?? []
          return (
            <div key={q.id} className="card p-5 space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-slate-500 text-sm w-6 shrink-0">{qi + 1}.</span>
                <p className="text-slate-200 text-sm leading-relaxed">{q.question_text}</p>
              </div>

              {/* Multiple choice / True-False */}
              {(q.question_type === 'multiple_choice' || q.question_type === 'true_false') && (
                <div className="space-y-2 pl-8">
                  {q.options.map((opt) => (
                    <label key={opt.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        sel.includes(opt.id)
                          ? 'border-gold-500 bg-gold-500/10 text-gold-300'
                          : 'border-navy-700 text-slate-300 hover:border-navy-500'
                      }`}>
                      <input type="radio" className="sr-only"
                        checked={sel.includes(opt.id)} onChange={() => selectMC(q.id, opt.id)} />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        sel.includes(opt.id) ? 'border-gold-500' : 'border-slate-600'
                      }`}>
                        {sel.includes(opt.id) && <div className="w-2 h-2 rounded-full bg-gold-500" />}
                      </div>
                      <span className="text-sm">{opt.option_text}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Multiple select */}
              {q.question_type === 'multiple_select' && (
                <div className="space-y-2 pl-8">
                  <p className="text-xs text-slate-500">Select all that apply.</p>
                  {q.options.map((opt) => (
                    <label key={opt.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        sel.includes(opt.id)
                          ? 'border-gold-500 bg-gold-500/10 text-gold-300'
                          : 'border-navy-700 text-slate-300 hover:border-navy-500'
                      }`}>
                      <input type="checkbox" className="sr-only"
                        checked={sel.includes(opt.id)} onChange={() => toggleMS(q.id, opt.id)} />
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                        sel.includes(opt.id) ? 'border-gold-500 bg-gold-500' : 'border-slate-600'
                      }`}>
                        {sel.includes(opt.id) && <CheckCircle2 size={10} className="text-white" />}
                      </div>
                      <span className="text-sm">{opt.option_text}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Short answer */}
              {q.question_type === 'short_answer' && (
                <div className="pl-8">
                  <textarea
                    rows={3}
                    className="input-field resize-none text-sm w-full"
                    placeholder="Your answer…"
                    value={textAnswers[q.id] ?? ''}
                    onChange={(e) => setTextAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  />
                  <p className="text-xs text-slate-500 mt-1">Reflection question — not auto-graded.</p>
                </div>
              )}
            </div>
          )
        })}

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 px-4 py-3 rounded-lg">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button onClick={() => setStatus('idle')} className="btn-ghost text-sm">
            ← Cancel
          </button>
          <button onClick={submit} disabled={submitting}
            className="btn-primary text-sm flex items-center gap-2">
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : 'Submit Quiz'}
          </button>
        </div>
      </div>
    )
  }

  // ── SUBMITTED view ────────────────────────────────────────────────────

  if (status === 'submitted' && result) {
    const passed = result.passed
    const score  = result.score

    // Build answer map for review
    const resultMap: Record<string, any> = {}
    for (const a of result.answers) resultMap[a.question_id] = a

    return (
      <div className="space-y-5">
        {/* Score card */}
        <div className={`card p-6 text-center border-2 ${passed ? 'border-green-500/40' : 'border-red-500/30'}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            passed ? 'bg-green-500/15' : 'bg-red-500/15'
          }`}>
            {passed
              ? <Award className="w-8 h-8 text-green-400" />
              : <XCircle className="w-8 h-8 text-red-400" />}
          </div>
          <div className="text-3xl font-bold text-white mb-1">{score}%</div>
          <div className={`text-sm font-medium ${passed ? 'text-green-400' : 'text-red-400'}`}>
            {passed ? 'Passed!' : `Not passed — need ${quiz.pass_score}%`}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Attempt #{result.attempt_number}
            {quiz.max_attempts > 0 && ` of ${quiz.max_attempts}`}
          </div>
        </div>

        {/* Answer review (only if reveal_answers) */}
        {quiz.reveal_answers && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Answer Review</h3>
            {quiz.questions.map((q, qi) => {
              const ans = resultMap[q.id]
              if (!ans) return null
              const correct = ans.is_correct

              return (
                <div key={q.id} className={`card p-4 border ${
                  correct ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'
                }`}>
                  <div className="flex items-start gap-2 mb-3">
                    {correct
                      ? <CheckCircle2 size={15} className="text-green-400 shrink-0 mt-0.5" />
                      : <XCircle size={15} className="text-red-400 shrink-0 mt-0.5" />}
                    <p className="text-slate-200 text-sm leading-relaxed">
                      <span className="text-slate-500 mr-1">{qi + 1}.</span>
                      {q.question_text}
                    </p>
                  </div>

                  {q.question_type !== 'short_answer' && (
                    <div className="space-y-1 pl-5">
                      {q.options.map((opt) => {
                        const wasSelected = ans.selected_option_ids?.includes(opt.id)
                        const isCorrect   = ans.correct_option_ids?.includes(opt.id)
                        return (
                          <div key={opt.id} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                            isCorrect ? 'text-green-400' : wasSelected ? 'text-red-400' : 'text-slate-500'
                          }`}>
                            {isCorrect
                              ? <CheckCircle2 size={11} />
                              : wasSelected
                                ? <XCircle size={11} />
                                : <span className="w-3" />}
                            {opt.option_text}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {ans.explanation && (
                    <p className="mt-2 pl-5 text-xs text-slate-400 italic">{ans.explanation}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {canRetry && !passed && (
            <button onClick={retry} className="btn-primary text-sm flex items-center gap-1.5">
              <RotateCcw size={14} /> Retry
              {quiz.max_attempts > 0 && <span className="text-xs opacity-70">({attemptsLeft} left)</span>}
            </button>
          )}
          <button onClick={() => setStatus('idle')} className="btn-ghost text-sm">
            ← Back
          </button>
        </div>
      </div>
    )
  }

  return null
}
