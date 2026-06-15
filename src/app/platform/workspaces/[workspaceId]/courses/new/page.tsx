'use client'

import { useState }               from 'react'
import { useParams, useRouter }   from 'next/navigation'
import Link                       from 'next/link'
import { ArrowLeft, Loader2 }     from 'lucide-react'

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function NewCoursePage() {
  const params      = useParams()
  const router      = useRouter()
  const workspaceId = params.workspaceId as string

  const [title,   setTitle]   = useState('')
  const [slug,    setSlug]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleTitleBlur = () => {
    if (!slug) setSlug(toSlug(title))
  }

  const slugError = () => {
    if (!slug) return ''
    if (slug.length < 2) return 'Too short'
    if (!/^[a-z0-9-]+$/.test(slug)) return 'Lowercase letters, numbers, and hyphens only'
    return ''
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !slug || slugError()) return
    setError('')
    setLoading(true)

    const res  = await fetch('/api/platform/courses', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ workspace_id: workspaceId, title: title.trim(), slug }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.error?.message ?? data.error ?? 'Something went wrong'); return }
    router.push(`/platform/workspaces/${workspaceId}/courses/${data.course.id}`)
  }

  return (
    <div className="max-w-lg">
      <Link href={`/platform/workspaces/${workspaceId}/courses`}
        className="text-slate-500 text-sm hover:text-slate-300 flex items-center gap-1 mb-6">
        <ArrowLeft className="w-3.5 h-3.5" /> Courses
      </Link>

      <h1 className="font-display text-2xl font-bold text-white mb-1">New Course</h1>
      <p className="text-slate-400 text-sm mb-8">Give your course a name to get started. You can fill in all the details next.</p>

      <form onSubmit={handleCreate} className="card p-6 space-y-5">
        <div>
          <label className="label">Course title *</label>
          <input
            className="input-field"
            placeholder="Introduction to Photography"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            required
          />
        </div>

        <div>
          <label className="label">URL slug *</label>
          <input
            className="input-field font-mono text-sm"
            placeholder="introduction-to-photography"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          />
          {slugError() && <p className="text-red-400 text-xs mt-1">{slugError()}</p>}
          {!slugError() && slug && (
            <p className="text-slate-500 text-xs mt-1">
              yourworkspace.apex-university.com/courses/<span className="text-slate-300">{slug}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={!title.trim() || !slug || !!slugError() || loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : 'Create & edit course →'}
          </button>
          <Link href={`/platform/workspaces/${workspaceId}/courses`} className="btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
