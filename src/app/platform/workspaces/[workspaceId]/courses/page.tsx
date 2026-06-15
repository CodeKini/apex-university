'use client'

import { useState, useEffect }  from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link                     from 'next/link'
import { Plus, BookOpen, Edit2, Trash2, Eye, EyeOff, Archive, RefreshCw } from 'lucide-react'
import Toast                    from '@/components/ui/Toast'
import { formatPrice }          from '@/lib/utils'

const STATUS_TABS = [
  { value: 'all',       label: 'All' },
  { value: 'draft',     label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived',  label: 'Archived' },
]

const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-slate-500/10 text-slate-400',
  published: 'bg-green-500/10 text-green-400',
  archived:  'bg-amber-500/10 text-amber-400',
}

export default function WorkspaceCoursesPage() {
  const params      = useParams()
  const router      = useRouter()
  const workspaceId = params.workspaceId as string

  const [courses,    setCourses]    = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState('all')
  const [toast,      setToast]      = useState<any>(null)

  const load = async (status = tab) => {
    setLoading(true)
    const res  = await fetch(`/api/platform/courses?workspaceId=${workspaceId}&status=${status}`)
    const data = await res.json()
    setCourses(data.courses ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [tab])

  const togglePublish = async (course: any) => {
    const next = course.status === 'published' ? 'draft' : 'published'
    const res  = await fetch(`/api/platform/courses/${course.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: next }),
    })
    if (res.ok) {
      setCourses((prev) => prev.map((c) => c.id === course.id ? { ...c, status: next } : c))
      setToast({ message: next === 'published' ? 'Course published!' : 'Moved to draft.', type: 'success' })
    }
  }

  const archive = async (course: any) => {
    if (!confirm(`Archive "${course.title}"? Students can still access it but it won't appear in the catalog.`)) return
    const res = await fetch(`/api/platform/courses/${course.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: 'archived' }),
    })
    if (res.ok) {
      setCourses((prev) => prev.map((c) => c.id === course.id ? { ...c, status: 'archived' } : c))
      setToast({ message: 'Course archived.', type: 'success' })
    }
  }

  const deleteCourse = async (course: any) => {
    if (!confirm(`Permanently delete "${course.title}"? This cannot be undone.`)) return
    const res = await fetch(`/api/platform/courses/${course.id}`, { method: 'DELETE' })
    if (res.ok) {
      setCourses((prev) => prev.filter((c) => c.id !== course.id))
      setToast({ message: 'Course deleted.', type: 'success' })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Courses</h1>
          <p className="text-slate-400 text-sm mt-1">Build and manage your course catalog.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load()} className="btn-ghost text-sm flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <Link href={`/platform/workspaces/${workspaceId}/courses/new`} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Course
          </Link>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-navy-700 mb-6 overflow-x-auto">
        {STATUS_TABS.map(({ value, label }) => (
          <button key={value} onClick={() => setTab(value)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === value ? 'border-gold-500 text-gold-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500 text-sm">Loading...</div>
      ) : courses.length === 0 ? (
        <EmptyState workspaceId={workspaceId} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy-800/50 border-b border-navy-700">
              <tr>
                <th className="text-left px-5 py-3 text-slate-400 font-medium">Course</th>
                <th className="text-left px-5 py-3 text-slate-400 font-medium hidden sm:table-cell">Price</th>
                <th className="text-left px-5 py-3 text-slate-400 font-medium">Status</th>
                <th className="text-right px-5 py-3 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800">
              {courses.map((c) => (
                <tr key={c.id} className="hover:bg-navy-800/20">
                  <td className="px-5 py-4">
                    <Link href={`/platform/workspaces/${workspaceId}/courses/${c.id}`}
                      className="font-medium text-white hover:text-gold-300">
                      {c.title}
                    </Link>
                    <div className="text-slate-500 text-xs mt-0.5">{c.slug}</div>
                    {c.difficulty && <div className="text-slate-600 text-xs">{c.difficulty} · {c.category || 'No category'}</div>}
                  </td>
                  <td className="px-5 py-4 text-slate-300 hidden sm:table-cell">
                    {c.is_free ? <span className="text-green-400 text-xs">Free</span> : formatPrice(c.price)}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${STATUS_STYLE[c.status] ?? ''}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/w/${c.workspace_slug || c.slug}`} target="_blank"
                        className="btn-ghost p-2 text-slate-400" title="Preview">
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link href={`/platform/workspaces/${workspaceId}/courses/${c.id}`}
                        className="btn-ghost p-2" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <button onClick={() => togglePublish(c)} className="btn-ghost p-2" title={c.status === 'published' ? 'Unpublish' : 'Publish'}>
                        {c.status === 'published'
                          ? <EyeOff className="w-4 h-4 text-amber-400" />
                          : <Eye className="w-4 h-4 text-green-400" />}
                      </button>
                      <button onClick={() => archive(c)} className="btn-ghost p-2 text-amber-400" title="Archive">
                        <Archive className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteCourse(c)} className="btn-ghost p-2 text-red-400" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

function EmptyState({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="card p-16 text-center">
      <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-4" />
      <h2 className="font-semibold text-white mb-2">No courses yet</h2>
      <p className="text-slate-400 text-sm mb-6">Create your first course to get started.</p>
      <Link href={`/platform/workspaces/${workspaceId}/courses/new`} className="btn-primary inline-flex items-center gap-2">
        <Plus className="w-4 h-4" /> Create course
      </Link>
    </div>
  )
}
