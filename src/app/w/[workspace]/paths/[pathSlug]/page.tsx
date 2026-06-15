'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter }             from 'next/navigation'
import Link                                 from 'next/link'
import { useWorkspace }                     from '@/lib/workspace/context'
import {
  GitBranch, BookOpen, Lock, CheckCircle2, ChevronRight,
  Award, Loader2, Clock,
} from 'lucide-react'

export default function PathDetailPage() {
  const params       = useParams()
  const router       = useRouter()
  const { workspace } = useWorkspace()
  const workSlug     = params.workspace  as string
  const pathSlug     = params.pathSlug   as string

  const [data,     setData]     = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [enrolling, setEnrolling] = useState(false)

  const fetchData = useCallback(async () => {
    if (!workspace?.id) return
    // Find path by slug first
    const listRes  = await fetch(`/api/student/paths?workspaceId=${workspace.id}`)
    const listData = await listRes.json()
    const pathMeta = (listData.paths ?? []).find((p: any) => p.slug === pathSlug)
    if (!pathMeta) { router.push(`/w/${workSlug}/paths`); return }

    const detailRes  = await fetch(`/api/student/paths/${pathMeta.id}`)
    const detailData = await detailRes.json()
    if (!detailRes.ok) { router.push(`/w/${workSlug}/paths`); return }
    setData(detailData)
    setLoading(false)
  }, [workspace?.id, pathSlug, workSlug, router])

  useEffect(() => { fetchData() }, [fetchData])

  const enroll = async () => {
    if (!data?.path?.id) return
    setEnrolling(true)
    const res = await fetch(`/api/student/paths/${data.path.id}/enroll`, { method: 'POST' })
    if (res.ok) fetchData()
    setEnrolling(false)
  }

  if (loading || !data) return (
    <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
  )

  const { path, enrollment, certificate } = data
  const enrolled  = !!enrollment
  const completed = !!enrollment?.completed_at

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <Link href={`/w/${workSlug}/paths`} className="text-xs text-slate-500 hover:text-slate-300 mb-3 inline-flex items-center gap-1">
          <GitBranch className="w-3 h-3" /> All Paths
        </Link>
        <h1 className="font-display text-3xl font-bold text-white">{path.title}</h1>
        {path.description && <p className="text-slate-400 mt-3">{path.description}</p>}

        <div className="flex items-center gap-4 mt-4 text-sm text-slate-500 flex-wrap">
          <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" /> {path.courses.length} courses</span>
          {path.estimated_hours && <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {path.estimated_hours}h</span>}
          <span className="capitalize">{path.difficulty}</span>
          {path.certificates_enabled && <span className="flex items-center gap-1 text-gold-400"><Award className="w-4 h-4" /> Certificate on completion</span>}
        </div>
      </div>

      {/* Certificate banner */}
      {certificate && (
        <div className="card border-gold-500/30 bg-gold-500/5 p-4 mb-6 flex items-center gap-4">
          <Award className="w-8 h-8 text-gold-400 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-white text-sm">You've completed this path!</p>
            <p className="text-xs text-slate-400 mt-0.5">Issued {new Date(certificate.issued_at).toLocaleDateString()} · Code: {certificate.verification_code}</p>
          </div>
          {certificate.storage_url && (
            <a href={certificate.storage_url} target="_blank" rel="noreferrer" className="btn-primary text-sm">
              Download PDF
            </a>
          )}
        </div>
      )}

      {/* Enroll CTA */}
      {!enrolled && (
        <div className="card p-5 mb-6 flex items-center justify-between gap-4">
          <p className="text-slate-300 text-sm">Enroll to track your progress through all courses in this path.</p>
          <button onClick={enroll} disabled={enrolling} className="btn-primary flex items-center gap-2 shrink-0">
            {enrolling && <Loader2 className="w-4 h-4 animate-spin" />}
            Enroll
          </button>
        </div>
      )}

      {/* Course sequence */}
      <div className="space-y-3">
        {path.courses.map((pc: any, idx: number) => {
          const { course, progress, locked } = pc
          const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0

          return (
            <div key={pc.id} className={`card p-4 flex items-center gap-4 ${locked ? 'opacity-60' : ''}`}>
              {/* Step number */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold
                ${progress.complete ? 'bg-green-500/20 text-green-400' : locked ? 'bg-navy-800 text-slate-600' : 'bg-gold-500/10 text-gold-400'}`}>
                {progress.complete ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white text-sm">{course.title}</span>
                  {locked && <Lock className="w-3 h-3 text-slate-600" />}
                </div>

                {enrolled && !locked && (
                  <div className="mt-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>{progress.completed}/{progress.total} lessons</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1 bg-navy-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gold-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
                {locked && (
                  <p className="text-xs text-slate-600 mt-0.5">Complete the previous course to unlock</p>
                )}
              </div>

              {!locked && enrolled && (
                <Link
                  href={`/w/${workSlug}/courses/${course.slug}`}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {completed && !certificate && (
        <div className="card p-5 mt-6 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto" />
          <p className="font-semibold text-white">Path Complete!</p>
          {path.certificates_enabled && <p className="text-sm text-slate-400">Your certificate is being generated…</p>}
        </div>
      )}
    </div>
  )
}
