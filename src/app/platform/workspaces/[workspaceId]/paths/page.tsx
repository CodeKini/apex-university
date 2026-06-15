'use client'

import { useState, useEffect } from 'react'
import { useParams }           from 'next/navigation'
import Link                    from 'next/link'
import { Plus, GitBranch, Users, BookOpen, ChevronRight, Loader2 } from 'lucide-react'

interface PathRow {
  id: string
  title: string
  slug: string
  difficulty: string
  status: string
  estimated_hours: number | null
  courses:     [{ count: number }]
  enrollments: [{ count: number }]
  created_at: string
}

const DIFF_BADGE: Record<string, string> = {
  beginner:     'bg-green-500/10 text-green-400 border-green-500/20',
  intermediate: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  advanced:     'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function PathsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [paths,   setPaths]   = useState<PathRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    fetch(`/api/platform/paths?workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then((d) => { setPaths(d.paths ?? []); setLoading(false) })
      .catch(() => { setError('Failed to load paths.'); setLoading(false) })
  }, [workspaceId])

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Learning Paths</h1>
          <p className="text-slate-400 text-sm mt-1">Create structured multi-course sequences for your students.</p>
        </div>
        <Link href={`/platform/workspaces/${workspaceId}/paths/new`} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Path
        </Link>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {paths.length === 0 ? (
        <div className="card p-16 text-center space-y-3">
          <GitBranch className="w-10 h-10 text-slate-600 mx-auto" />
          <h2 className="font-semibold text-white">No learning paths yet</h2>
          <p className="text-slate-400 text-sm">Guide students through an ordered set of courses.</p>
          <Link href={`/platform/workspaces/${workspaceId}/paths/new`} className="btn-primary inline-flex">
            Create your first path
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {paths.map((p) => (
            <Link
              key={p.id}
              href={`/platform/workspaces/${workspaceId}/paths/${p.id}`}
              className="card p-4 flex items-center gap-4 hover:border-gold-500/30 transition-colors group"
            >
              <GitBranch className="w-8 h-8 text-slate-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white group-hover:text-gold-400 transition-colors">{p.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${DIFF_BADGE[p.difficulty] ?? ''}`}>
                    {p.difficulty}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    p.status === 'published'
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                  }`}>
                    {p.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {p.courses[0]?.count ?? 0} courses</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {p.enrollments[0]?.count ?? 0} enrolled</span>
                  {p.estimated_hours && <span>{p.estimated_hours}h estimated</span>}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
