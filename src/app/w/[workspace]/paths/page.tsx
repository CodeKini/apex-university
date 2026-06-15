'use client'

import { useState, useEffect } from 'react'
import { useParams }           from 'next/navigation'
import Link                    from 'next/link'
import { useWorkspace }        from '@/lib/workspace/context'
import { GitBranch, BookOpen, Clock, CheckCircle2, Loader2 } from 'lucide-react'

const DIFF_BADGE: Record<string, string> = {
  beginner:     'bg-green-500/10 text-green-400',
  intermediate: 'bg-yellow-500/10 text-yellow-400',
  advanced:     'bg-red-500/10 text-red-400',
}

export default function PathsBrowsePage() {
  const params       = useParams()
  const { workspace } = useWorkspace()
  const workSlug     = params.workspace as string
  const [paths,   setPaths]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspace?.id) return
    fetch(`/api/student/paths?workspaceId=${workspace.id}`)
      .then((r) => r.json())
      .then((d) => { setPaths(d.paths ?? []); setLoading(false) })
  }, [workspace?.id])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-white">Learning Paths</h1>
        <p className="text-slate-400 mt-2">Structured sequences of courses to guide your learning journey.</p>
      </div>

      {paths.length === 0 ? (
        <div className="card p-16 text-center space-y-3">
          <GitBranch className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-slate-400">No learning paths available yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {paths.map((p) => {
            const enrolled  = !!p.enrollment
            const completed = !!p.enrollment?.completed_at
            const courseCount = p.courses?.[0]?.count ?? 0
            return (
              <Link
                key={p.id}
                href={`/w/${workSlug}/paths/${p.slug}`}
                className="card p-5 hover:border-gold-500/30 transition-colors group flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gold-500/10 flex items-center justify-center shrink-0">
                      <GitBranch className="w-6 h-6 text-gold-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white group-hover:text-gold-400 transition-colors">{p.title}</h3>
                    {p.description && (
                      <p className="text-sm text-slate-400 mt-0.5 line-clamp-2">{p.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap text-xs">
                  <span className={`px-2 py-0.5 rounded-full capitalize ${DIFF_BADGE[p.difficulty] ?? ''}`}>
                    {p.difficulty}
                  </span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <BookOpen className="w-3 h-3" /> {courseCount} courses
                  </span>
                  {p.estimated_hours && (
                    <span className="flex items-center gap-1 text-slate-500">
                      <Clock className="w-3 h-3" /> {p.estimated_hours}h
                    </span>
                  )}
                  {completed && (
                    <span className="flex items-center gap-1 text-green-400 ml-auto">
                      <CheckCircle2 className="w-3 h-3" /> Completed
                    </span>
                  )}
                  {enrolled && !completed && (
                    <span className="text-gold-400 ml-auto">In progress</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
