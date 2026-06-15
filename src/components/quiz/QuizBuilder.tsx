'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Trash2, ChevronDown, ChevronUp,
  Save, Loader2, HelpCircle, CheckSquare, ToggleLeft, AlignLeft,
  AlertCircle,
} from 'lucide-react'
import type { QuestionType } from '@/types/quiz'

// ── helpers ──────────────────────────────────────────────────────────────

const TYPE_META: Record<QuestionType, { label: string; icon: React.ElementType; desc: string }> = {
  multiple_choice:  { label: 'Multiple Choice',  icon: HelpCircle,   desc: 'One correct answer' },
  multiple_select:  { label: 'Multiple Select',  icon: CheckSquare,  desc: 'One or more correct' },
  true_false:       { label: 'True / False',     icon: ToggleLeft,   desc: 'Two options' },
  short_answer:     { label: 'Short Answer',     icon: AlignLeft,    desc: 'Text (placeholder)' },
}

function typeBadge(t: QuestionType) {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-navy-700 text-slate-300">
      {TYPE_META[t].label}
    </span>
  )
}

interface OptionDraft {
  id?:         string
  option_text: string
  is_correct:  boolean
  position:    number
}

interface QuestionDraft {
  id?:           string
  question_type: QuestionType
  question_text: string
  explanation:   string
  points:        number
  options:       OptionDraft[]
}

function emptyOptions(type: QuestionType): OptionDraft[] {
  if (type === 'true_false') {
    return [
      { option_text: 'True',  is_correct: true,  position: 1 },
      { option_text: 'False', is_correct: false, position: 2 },
    ]
  }
  if (type === 'multiple_choice' || type === 'multiple_select') {
    return [
      { option_text: '', is_correct: false, position: 1 },
      { option_text: '', is_correct: false, position: 2 },
    ]
  }
  return []
}

function newQuestion(): QuestionDraft {
  const type: QuestionType = 'multiple_choice'
  return { question_type: type, question_text: '', explanation: '', points: 1, options: emptyOptions(type) }
}

// ── QuestionForm ─────────────────────────────────────────────────────────

function QuestionForm({
  draft, onChange, onSave, onCancel, saving,
}: {
  draft:    QuestionDraft
  onChange: (d: QuestionDraft) => void
  onSave:   () => void
  onCancel: () => void
  saving:   boolean
}) {
  const set = (k: keyof QuestionDraft, v: any) => onChange({ ...draft, [k]: v })

  const setType = (t: QuestionType) => {
    onChange({ ...draft, question_type: t, options: emptyOptions(t) })
  }

  const setOption = (i: number, text: string) => {
    const opts = draft.options.map((o, idx) => idx === i ? { ...o, option_text: text } : o)
    set('options', opts)
  }

  const toggleCorrectMC = (i: number) => {
    const opts = draft.options.map((o, idx) => ({ ...o, is_correct: idx === i }))
    set('options', opts)
  }

  const toggleCorrectMS = (i: number) => {
    const opts = draft.options.map((o, idx) => idx === i ? { ...o, is_correct: !o.is_correct } : o)
    set('options', opts)
  }

  const addOption = () => {
    set('options', [...draft.options, { option_text: '', is_correct: false, position: draft.options.length + 1 }])
  }

  const removeOption = (i: number) => {
    if (draft.options.length <= 2) return
    set('options', draft.options.filter((_, idx) => idx !== i).map((o, idx) => ({ ...o, position: idx + 1 })))
  }

  const isCompletable =
    draft.question_text.trim().length > 0 &&
    (draft.question_type === 'short_answer' ||
      (draft.options.length >= 2 && draft.options.every((o) => o.option_text.trim()) &&
        draft.options.some((o) => o.is_correct)))

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div>
        <label className="label">Question Type</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(TYPE_META) as QuestionType[]).map((t) => {
            const m = TYPE_META[t]
            return (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                  draft.question_type === t
                    ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                    : 'border-navy-700 text-slate-400 hover:border-navy-500'
                }`}>
                <span className="font-medium">{m.label}</span>
                <span className="block text-xs opacity-60">{m.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Question text */}
      <div>
        <label className="label">Question *</label>
        <textarea
          rows={2}
          className="input-field resize-none"
          placeholder="Enter your question…"
          value={draft.question_text}
          onChange={(e) => set('question_text', e.target.value)}
        />
      </div>

      {/* Options */}
      {draft.question_type !== 'short_answer' && (
        <div>
          <label className="label">
            {draft.question_type === 'multiple_choice' && 'Options — select the one correct answer'}
            {draft.question_type === 'multiple_select' && 'Options — check all correct answers'}
            {draft.question_type === 'true_false' && 'Which is correct?'}
          </label>
          <div className="space-y-2">
            {draft.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                {draft.question_type === 'multiple_choice' || draft.question_type === 'true_false' ? (
                  <input type="radio" name={`correct-${i}`} checked={opt.is_correct}
                    onChange={() => draft.question_type !== 'true_false' && toggleCorrectMC(i)}
                    onClick={() => draft.question_type === 'true_false' && toggleCorrectMC(i)}
                    className="w-4 h-4 accent-gold-500 shrink-0" />
                ) : (
                  <input type="checkbox" checked={opt.is_correct}
                    onChange={() => toggleCorrectMS(i)}
                    className="w-4 h-4 accent-gold-500 shrink-0" />
                )}
                {draft.question_type === 'true_false' ? (
                  <span className="text-slate-300 text-sm flex-1">{opt.option_text}</span>
                ) : (
                  <input
                    className="input-field flex-1 py-1.5 text-sm"
                    placeholder={`Option ${i + 1}`}
                    value={opt.option_text}
                    onChange={(e) => setOption(i, e.target.value)}
                  />
                )}
                {draft.question_type !== 'true_false' && draft.options.length > 2 && (
                  <button onClick={() => removeOption(i)} className="text-slate-600 hover:text-red-400 shrink-0">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {draft.question_type !== 'true_false' && (
            <button onClick={addOption}
              className="mt-2 text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
              <Plus size={12} /> Add option
            </button>
          )}
        </div>
      )}

      {draft.question_type === 'short_answer' && (
        <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
          <AlertCircle size={12} />
          Short answer is a placeholder — students type a response but it is always marked incorrect automatically.
          Use it for reflection prompts where completion, not correctness, matters.
        </p>
      )}

      {/* Explanation */}
      <div>
        <label className="label">Explanation <span className="text-slate-500 font-normal">(optional — shown after submission if &quot;Reveal answers&quot; is on)</span></label>
        <textarea rows={2} className="input-field resize-none text-sm"
          placeholder="Explain the correct answer…"
          value={draft.explanation}
          onChange={(e) => set('explanation', e.target.value)}
        />
      </div>

      {/* Points */}
      <div className="flex items-center gap-3">
        <label className="label mb-0">Points</label>
        <input type="number" min="0" className="input-field w-20 py-1.5 text-sm"
          value={draft.points} onChange={(e) => set('points', parseInt(e.target.value) || 1)} />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button onClick={onSave} disabled={saving || !isCompletable}
          className="btn-primary text-sm flex items-center gap-1.5 py-1.5 px-4">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {saving ? 'Saving…' : 'Save Question'}
        </button>
        <button onClick={onCancel} className="btn-ghost text-sm py-1.5 px-4">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main QuizBuilder ──────────────────────────────────────────────────────

interface Props {
  lessonId:   string
  courseId:   string
  workspaceId: string
}

export default function QuizBuilder({ lessonId, courseId, workspaceId }: Props) {
  const [quiz,           setQuiz]           = useState<any>(null)
  const [loading,        setLoading]        = useState(true)
  const [creating,       setCreating]       = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [expandedId,     setExpandedId]     = useState<string | 'new' | null>(null)
  const [questionDraft,  setQuestionDraft]  = useState<QuestionDraft>(newQuestion())
  const [savingQ,        setSavingQ]        = useState(false)
  const [settings, setSettings] = useState({ pass_score: 70, max_attempts: 0, reveal_answers: false })

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/platform/quizzes?lessonId=${lessonId}`)
    const data = await res.json()
    if (data.quiz) {
      setQuiz(data.quiz)
      setSettings({
        pass_score:     data.quiz.pass_score,
        max_attempts:   data.quiz.max_attempts,
        reveal_answers: data.quiz.reveal_answers,
      })
    }
    setLoading(false)
  }, [lessonId])

  useEffect(() => { load() }, [load])

  async function createQuiz() {
    setCreating(true)
    const res = await fetch('/api/platform/quizzes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson_id: lessonId, ...settings }),
    })
    const data = await res.json()
    if (res.ok) setQuiz(data.quiz)
    setCreating(false)
  }

  async function deleteQuiz() {
    if (!confirm('Delete this quiz and all student attempts? This cannot be undone.')) return
    await fetch(`/api/platform/quizzes/${quiz.id}`, { method: 'DELETE' })
    setQuiz(null)
    setExpandedId(null)
  }

  async function saveSettings() {
    setSavingSettings(true)
    await fetch(`/api/platform/quizzes/${quiz.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSavingSettings(false)
  }

  async function saveQuestion() {
    if (!quiz) return
    setSavingQ(true)
    const draft = questionDraft
    const opts  = draft.options.map((o, i) => ({ ...o, position: i + 1 }))
    const body  = { ...draft, options: opts, explanation: draft.explanation || null }

    let res: Response
    if (draft.id) {
      res = await fetch(`/api/platform/quizzes/${quiz.id}/questions/${draft.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    } else {
      res = await fetch(`/api/platform/quizzes/${quiz.id}/questions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    }
    const data = await res.json()
    setSavingQ(false)

    if (res.ok) {
      const updated = draft.id
        ? { ...quiz, questions: quiz.questions.map((q: any) => q.id === draft.id ? data.question : q) }
        : { ...quiz, questions: [...quiz.questions, data.question] }
      setQuiz(updated)
      setExpandedId(null)
      setQuestionDraft(newQuestion())
    }
  }

  async function deleteQuestion(qId: string) {
    if (!confirm('Delete this question?')) return
    await fetch(`/api/platform/quizzes/${quiz.id}/questions/${qId}`, { method: 'DELETE' })
    setQuiz({ ...quiz, questions: quiz.questions.filter((q: any) => q.id !== qId) })
    if (expandedId === qId) setExpandedId(null)
  }

  function startEdit(q: any) {
    setQuestionDraft({
      id:            q.id,
      question_type: q.question_type,
      question_text: q.question_text,
      explanation:   q.explanation ?? '',
      points:        q.points,
      options:       q.options ?? emptyOptions(q.question_type),
    })
    setExpandedId(q.id)
  }

  function startNew() {
    setQuestionDraft(newQuestion())
    setExpandedId('new')
  }

  if (loading) return (
    <section className="card p-6">
      <div className="text-slate-500 text-sm">Loading quiz…</div>
    </section>
  )

  if (!quiz) return (
    <section className="card p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-white">Quiz</h2>
        <p className="text-slate-400 text-sm mt-0.5">
          Add a quiz to this lesson. Set Completion Method to &quot;Quiz Passed&quot; above to require passing.
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Pass score (%)</label>
          <input type="number" min="0" max="100" className="input-field"
            value={settings.pass_score} onChange={(e) => setSettings(s => ({ ...s, pass_score: parseInt(e.target.value) || 70 }))} />
        </div>
        <div>
          <label className="label">Max attempts <span className="text-slate-500 font-normal">(0 = unlimited)</span></label>
          <input type="number" min="0" className="input-field"
            value={settings.max_attempts} onChange={(e) => setSettings(s => ({ ...s, max_attempts: parseInt(e.target.value) || 0 }))} />
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={settings.reveal_answers}
              onChange={(e) => setSettings(s => ({ ...s, reveal_answers: e.target.checked }))}
              className="w-4 h-4 accent-yellow-400" />
            <span className="text-slate-300 text-sm">Reveal answers after submission</span>
          </label>
        </div>
      </div>
      <button onClick={createQuiz} disabled={creating} className="btn-primary flex items-center gap-2 text-sm">
        {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        {creating ? 'Creating…' : 'Add Quiz to This Lesson'}
      </button>
    </section>
  )

  return (
    <section className="card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-white">Quiz</h2>
        <div className="flex items-center gap-2">
          <a href={`/api/platform/quizzes/${quiz.id}/results`} target="_blank"
            className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2">
            View results ↗
          </a>
          <button onClick={deleteQuiz} className="text-xs text-red-500 hover:text-red-400">
            Delete quiz
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Pass score (%)</label>
          <input type="number" min="0" max="100" className="input-field"
            value={settings.pass_score} onChange={(e) => setSettings(s => ({ ...s, pass_score: parseInt(e.target.value) || 70 }))} />
        </div>
        <div>
          <label className="label">Max attempts <span className="text-slate-500 font-normal">(0 = unlimited)</span></label>
          <input type="number" min="0" className="input-field"
            value={settings.max_attempts} onChange={(e) => setSettings(s => ({ ...s, max_attempts: parseInt(e.target.value) || 0 }))} />
        </div>
        <div>
          <label className="label">Options</label>
          <label className="flex items-center gap-2 cursor-pointer h-10">
            <input type="checkbox" checked={settings.reveal_answers}
              onChange={(e) => setSettings(s => ({ ...s, reveal_answers: e.target.checked }))}
              className="w-4 h-4 accent-yellow-400" />
            <span className="text-slate-300 text-sm">Reveal answers</span>
          </label>
        </div>
      </div>
      <button onClick={saveSettings} disabled={savingSettings}
        className="btn-ghost text-sm flex items-center gap-1.5 py-1.5">
        {savingSettings ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
        Save settings
      </button>

      <hr className="border-navy-700" />

      {/* Questions list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-sm font-medium">{quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}</span>
        </div>

        {quiz.questions.map((q: any, idx: number) => (
          <div key={q.id} className="border border-navy-700 rounded-xl overflow-hidden">
            {/* Question header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-navy-800/30">
              <span className="text-slate-500 text-xs w-6 text-right">{idx + 1}.</span>
              <span className="flex-1 text-slate-200 text-sm truncate">{q.question_text || '(empty)'}</span>
              {typeBadge(q.question_type)}
              <span className="text-xs text-slate-500">{q.points}pt</span>
              <button onClick={() => expandedId === q.id ? setExpandedId(null) : startEdit(q)}
                className="text-slate-500 hover:text-slate-300">
                {expandedId === q.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              <button onClick={() => deleteQuestion(q.id)}
                className="text-slate-600 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>

            {/* Inline editor */}
            {expandedId === q.id && (
              <div className="px-4 py-4 border-t border-navy-700 bg-navy-900/40">
                <QuestionForm
                  draft={questionDraft}
                  onChange={setQuestionDraft}
                  onSave={saveQuestion}
                  onCancel={() => setExpandedId(null)}
                  saving={savingQ}
                />
              </div>
            )}
          </div>
        ))}

        {/* New question form */}
        {expandedId === 'new' ? (
          <div className="border border-navy-700 border-dashed rounded-xl px-4 py-4">
            <h3 className="text-sm font-medium text-white mb-4">New Question</h3>
            <QuestionForm
              draft={questionDraft}
              onChange={setQuestionDraft}
              onSave={saveQuestion}
              onCancel={() => setExpandedId(null)}
              saving={savingQ}
            />
          </div>
        ) : (
          <button onClick={startNew}
            className="w-full flex items-center justify-center gap-2 py-3 border border-navy-700 border-dashed rounded-xl text-slate-500 hover:text-slate-300 hover:border-navy-500 text-sm transition-colors">
            <Plus size={14} /> Add Question
          </button>
        )}
      </div>
    </section>
  )
}
