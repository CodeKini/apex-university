'use client'

import { useEffect, useState } from 'react'
import { useParams }           from 'next/navigation'
import Link                    from 'next/link'
import { ArrowLeft, CheckCircle2, XCircle, Award } from 'lucide-react'

export default function QuizResultsPage() {
  const { workspaceId, courseId, lessonId } = useParams<{
    workspaceId: string; courseId: string; lessonId: string
  }>()

  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [quizId,  setQuizId]  = useState<string | null>(null)

  useEffect(() => {
    // First get the quiz id for this lesson
    fetch(`/api/platform/quizzes?lessonId=${lessonId}`)
      .then(r => r.json())
      .then(d => {
        if (!d.quiz) { setLoading(false); return }
        setQuizId(d.quiz.id)
        return fetch(`/api/platform/quizzes/${d.quiz.id}/results`)
      })
      .then(r => r?.json())
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [lessonId])

  const back = `/platform/workspaces/${workspaceId}/courses/${courseId}/lessons/${lessonId}`

  if (loading) return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center text-slate-500 text-sm">Loading…</div>
  )

  if (!data?.quiz) return (
    <div className="min-h-screen bg-navy-950 px-8 py-10">
      <Link href={back} className="text-slate-500 hover:text-slate-300 text-sm flex items-center gap-1 mb-6">
        <ArrowLeft size={14} /> Back to Lesson
      </Link>
      <p className="text-slate-400">No quiz found for this lesson.</p>
    </div>
  )

  const { quiz, questions, attempts } = data

  const totalStudents = new Set(attempts.map((r: any) => r.attempt.user_id)).size
  const passing       = attempts.filter((r: any) => r.attempt.passed).length
  const avgScore      = attempts.length
    ? Math.round(attempts.reduce((s: number, r: any) => s + r.attempt.score, 0) / attempts.length)
    : 0

  return (
    <div className="min-h-screen bg-navy-950">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link href={back} className="text-slate-500 hover:text-slate-300 text-sm flex items-center gap-1 mb-6">
          <ArrowLeft size={14} /> Back to Lesson Editor
        </Link>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-gold-400" /> Quiz Results
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Pass score: {quiz.pass_score}% ·
            {quiz.max_attempts > 0 ? ` Max ${quiz.max_attempts} attempt${quiz.max_attempts !== 1 ? 's' : ''}` : ' Unlimited attempts'}
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Attempts',     value: attempts.length },
            { label: 'Unique students', value: totalStudents },
            { label: 'Pass rate',    value: attempts.length ? `${Math.round((passing / attempts.length) * 100)}%` : '—' },
            { label: 'Avg score',    value: attempts.length ? `${avgScore}%` : '—' },
            { label: 'Questions',    value: questions.length },
          ].map(({ label, value }) => (
            <div key={label} className="card p-4">
              <div className="text-xl font-bold text-white">{String(value)}</div>
              <div className="text-xs text-slate-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Attempt list */}
        {attempts.length === 0 ? (
          <div className="card p-12 text-center text-slate-500 text-sm">No attempts yet.</div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-navy-700">
                <tr>
                  <th className="text-left px-5 py-3 text-slate-400 text-xs font-medium uppercase tracking-wide">Student</th>
                  <th className="text-left px-5 py-3 text-slate-400 text-xs font-medium uppercase tracking-wide">Attempt #</th>
                  <th className="text-left px-5 py-3 text-slate-400 text-xs font-medium uppercase tracking-wide">Score</th>
                  <th className="text-left px-5 py-3 text-slate-400 text-xs font-medium uppercase tracking-wide">Result</th>
                  <th className="text-right px-5 py-3 text-slate-400 text-xs font-medium uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800">
                {attempts.map((row: any) => (
                  <tr key={row.attempt.id} className="hover:bg-navy-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-white">{row.student_name}</div>
                      <div className="text-xs text-slate-500">{row.student_email}</div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">#{row.attempt.attempt_number}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.attempt.passed ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ width: `${row.attempt.score}%` }}
                          />
                        </div>
                        <span className="text-white font-medium">{row.attempt.score}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {row.attempt.passed ? (
                        <span className="flex items-center gap-1 text-green-400 text-xs">
                          <CheckCircle2 size={13} /> Passed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 text-xs">
                          <XCircle size={13} /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-400 text-xs">
                      {new Date(row.attempt.submitted_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
