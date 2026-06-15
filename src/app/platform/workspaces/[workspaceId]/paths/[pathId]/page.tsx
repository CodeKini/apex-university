'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter }             from 'next/navigation'
import Link                                 from 'next/link'
import {
  ArrowLeft, Loader2, Plus, Trash2, GripVertical, BarChart2,
  BookOpen, Users, CheckCircle2, Save,
} from 'lucide-react'

interface PathCourse {
  id: string
  position: number
  course: { id: string; title: string; slug: string; status: string }
}

interface PathData {
  id: string
  title: string
  slug: string
  description: string | null
  difficulty: string
  estimated_hours: number | null
  status: string
  certificates_enabled: boolean
  courses: PathCourse[]
  enrollments: [{ count: number }]
}

interface AvailableCourse {
  id: string
  title: string
  slug: string
  status: string
}

export default function EditPathPage() {
  const { workspaceId, pathId } = useParams<{ workspaceId: string; pathId: string }>()
  const router = useRouter()
  const [tab, setTab] = useState<'settings' | 'courses' | 'analytics'>('settings')

  const [path,    setPath]    = useState<PathData | null>(null)
  const [loading, setLoading] = useState(true)

  // Settings form
  const [title,               setTitle]               = useState('')
  const [description,         setDescription]         = useState('')
  const [difficulty,          setDifficulty]          = useState('beginner')
  const [estimatedHours,      setEstimatedHours]      = useState('')
  const [status,              setStatus]              = useState('draft')
  const [certificatesEnabled, setCertificatesEnabled] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Courses tab
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([])
  const [addingCourseId,   setAddingCourseId]   = useState('')
  const [addingCourse,     setAddingCourse]      = useState(false)

  // Analytics
  const [analytics, setAnalytics] = useState<any>(null)

  const fetchPath = useCallback(async () => {
    const res = await fetch(`/api/platform/paths/${pathId}`)
    const d   = await res.json()
    if (!res.ok) { router.push(`/platform/workspaces/${workspaceId}/paths`); return }
    setPath(d.path)
    setTitle(d.path.title)
    setDescription(d.path.description ?? '')
    setDifficulty(d.path.difficulty)
    setEstimatedHours(d.path.estimated_hours?.toString() ?? '')
    setStatus(d.path.status)
    setCertificatesEnabled(d.path.certificates_enabled)
    setLoading(false)
  }, [pathId, workspaceId, router])

  useEffect(() => { fetchPath() }, [fetchPath])

  useEffect(() => {
    if (tab === 'courses' && availableCourses.length === 0) {
      fetch(`/api/platform/courses?workspaceId=${workspaceId}`)
        .then((r) => r.json())
        .then((d) => setAvailableCourses(d.courses ?? []))
    }
    if (tab === 'analytics' && !analytics) {
      fetch(`/api/platform/paths/${pathId}/analytics`)
        .then((r) => r.json())
        .then(setAnalytics)
    }
  }, [tab, workspaceId, pathId, availableCourses.length, analytics])

  const saveSettings = async () => {
    setSaving(true); setSaveMsg('')
    const res = await fetch(`/api/platform/paths/${pathId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        difficulty,
        estimated_hours: estimatedHours ? parseInt(estimatedHours) : null,
        status,
        certificates_enabled: certificatesEnabled,
      }),
    })
    const d = await res.json()
    setSaving(false)
    if (res.ok) { setPath((prev) => prev ? { ...prev, ...d.path } : prev); setSaveMsg('Saved!') }
    else setSaveMsg(d.error ?? 'Save failed.')
    setTimeout(() => setSaveMsg(''), 3000)
  }

  const addCourse = async () => {
    if (!addingCourseId) return
    setAddingCourse(true)
    const res = await fetch(`/api/platform/paths/${pathId}/courses`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ course_id: addingCourseId }),
    })
    if (res.ok) { await fetchPath(); setAddingCourseId('') }
    setAddingCourse(false)
  }

  const removeCourse = async (courseId: string) => {
    await fetch(`/api/platform/paths/${pathId}/courses?courseId=${courseId}`, { method: 'DELETE' })
    await fetchPath()
  }

  const deletePath = async () => {
    if (!confirm('Delete this learning path? This cannot be undone.')) return
    await fetch(`/api/platform/paths/${pathId}`, { method: 'DELETE' })
    router.push(`/platform/workspaces/${workspaceId}/paths`)
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
  if (!path)   return null

  const pathCourseIds = new Set(path.courses.map((pc) => pc.course.id))
  const unaddedCourses = availableCourses.filter((c) => !pathCourseIds.has(c.id))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/platform/workspaces/${workspaceId}/paths`} className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-xl font-bold text-white">{path.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{path.enrollments[0]?.count ?? 0} enrolled · {path.status}</p>
        </div>
        <button onClick={deletePath} className="btn-ghost text-red-400 hover:text-red-300 text-sm">Delete</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-navy-800 mb-6 gap-1">
        {(['settings','courses','analytics'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize transition-colors ${
              tab === t ? 'text-gold-400 border-b-2 border-gold-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Settings Tab */}
      {tab === 'settings' && (
        <div className="max-w-xl space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[80px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Difficulty</label>
              <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="label">Estimated Hours</label>
              <input type="number" min={1} className="input" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div className="flex items-center gap-3 py-1">
            <input
              type="checkbox"
              id="certs"
              checked={certificatesEnabled}
              onChange={(e) => setCertificatesEnabled(e.target.checked)}
              className="w-4 h-4 rounded accent-gold-400"
            />
            <label htmlFor="certs" className="text-sm text-slate-300 cursor-pointer">
              Issue path completion certificates
            </label>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={saveSettings} disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
            {saveMsg && <span className="text-sm text-slate-400">{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* Courses Tab */}
      {tab === 'courses' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Courses are completed in order. Students unlock the next course after finishing all lessons in the current one.
          </p>

          {/* Current courses */}
          <div className="space-y-2">
            {path.courses.length === 0 ? (
              <div className="card p-8 text-center text-slate-500 text-sm">No courses in this path yet.</div>
            ) : (
              path.courses.map((pc, idx) => (
                <div key={pc.id} className="card p-3 flex items-center gap-3">
                  <GripVertical className="w-4 h-4 text-slate-600" />
                  <span className="text-slate-500 text-sm w-6 text-center">{idx + 1}</span>
                  <BookOpen className="w-4 h-4 text-slate-500" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-white">{pc.course.title}</span>
                    {pc.course.status !== 'published' && (
                      <span className="ml-2 text-xs text-yellow-400">({pc.course.status})</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeCourse(pc.course.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add course */}
          {unaddedCourses.length > 0 && (
            <div className="flex gap-2">
              <select
                className="input flex-1"
                value={addingCourseId}
                onChange={(e) => setAddingCourseId(e.target.value)}
              >
                <option value="">Select a course to add…</option>
                {unaddedCourses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title} ({c.status})</option>
                ))}
              </select>
              <button
                onClick={addCourse}
                disabled={!addingCourseId || addingCourse}
                className="btn-primary flex items-center gap-1.5"
              >
                {addingCourse ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </button>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {tab === 'analytics' && (
        <div>
          {!analytics ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="card p-4 text-center">
                  <div className="text-2xl font-bold text-white">{analytics.total_enrolled}</div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1"><Users className="w-3 h-3" /> Enrolled</div>
                </div>
                <div className="card p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{analytics.total_completed}</div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" /> Completed</div>
                </div>
                <div className="card p-4 text-center">
                  <div className="text-2xl font-bold text-gold-400">{analytics.completion_rate}%</div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1"><BarChart2 className="w-3 h-3" /> Completion Rate</div>
                </div>
              </div>

              {analytics.enrollments.length > 0 && (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy-800">
                        <th className="text-left px-4 py-3 text-slate-400 font-medium">Student</th>
                        <th className="text-left px-4 py-3 text-slate-400 font-medium">Progress</th>
                        <th className="text-left px-4 py-3 text-slate-400 font-medium">Enrolled</th>
                        <th className="text-left px-4 py-3 text-slate-400 font-medium">Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.enrollments.map((e: any) => (
                        <tr key={e.user_id} className="border-b border-navy-800/50 last:border-0">
                          <td className="px-4 py-3 text-white">{e.user?.full_name ?? e.user?.email}</td>
                          <td className="px-4 py-3 text-slate-400">{e.courses_completed}/{e.courses_total} courses</td>
                          <td className="px-4 py-3 text-slate-400">{new Date(e.enrolled_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            {e.completed_at
                              ? <span className="text-green-400">{new Date(e.completed_at).toLocaleDateString()}</span>
                              : <span className="text-slate-600">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
