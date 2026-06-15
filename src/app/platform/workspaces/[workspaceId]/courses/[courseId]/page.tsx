'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter }              from 'next/navigation'
import Link                                  from 'next/link'
import {
  ArrowLeft, Save, Loader2, Plus, Trash2,
  ChevronDown, ChevronRight, Eye, EyeOff,
  Globe, Lock, Archive, BookOpen, Clock, X,
} from 'lucide-react'
import Toast        from '@/components/ui/Toast'
import SortableList, { DragHandle } from '@/components/course-builder/SortableList'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
type Tab = 'curriculum' | 'details' | 'publish'

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'] as const
const LANGUAGES    = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Japanese', 'Chinese', 'Arabic', 'Hindi']
const CATEGORIES   = ['Business', 'Technology', 'Design', 'Marketing', 'Health & Fitness', 'Finance', 'Personal Development', 'Arts & Crafts', 'Music', 'Photography', 'Cooking', 'Language', 'Sports', 'Other']

const STATUS_COLORS: Record<string, string> = {
  draft:     'text-slate-400 bg-slate-500/10',
  published: 'text-green-400 bg-green-500/10',
  archived:  'text-amber-400 bg-amber-500/10',
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────
export default function CourseEditorPage() {
  const params      = useParams()
  const router      = useRouter()
  const workspaceId = params.workspaceId as string
  const courseId    = params.courseId    as string

  const [tab,      setTab]      = useState<Tab>('curriculum')
  const [course,   setCourse]   = useState<any>(null)
  const [modules,  setModules]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState<any>(null)
  const [certEnabled, setCertEnabled] = useState(false)
  const [certSaving,  setCertSaving]  = useState(false)

  // ── Details form state ──
  const [form, setForm] = useState({
    title: '', slug: '', short_desc: '', long_desc: '',
    price: '0', is_free: false,
    thumbnail_url: '',
    difficulty: 'Beginner', duration_hrs: '0',
    category: '', language: 'English',
    outcomes: [''], requirements: [''],
  })

  // ── Module creation ──
  const [addingModule,    setAddingModule]    = useState(false)
  const [newModuleTitle,  setNewModuleTitle]  = useState('')
  const [moduleLoading,   setModuleLoading]   = useState(false)

  // ── Lesson creation per module ──
  const [addingLessonTo, setAddingLessonTo]  = useState<string | null>(null)
  const [newLessonTitle, setNewLessonTitle]  = useState('')

  // ── Module expansion ──
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // ─────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/platform/courses/${courseId}`)
    if (!res.ok) { router.push(`/platform/workspaces/${workspaceId}/courses`); return }
    const data = await res.json()
    setCourse(data.course)
    setModules(data.modules ?? [])
    setCertEnabled(data.course?.certificates_enabled ?? false)
    const c = data.course
    setForm({
      title:        c.title        ?? '',
      slug:         c.slug         ?? '',
      short_desc:   c.short_desc   ?? '',
      long_desc:    c.long_desc    ?? '',
      price:        String(c.price ?? 0),
      is_free:      c.is_free      ?? false,
      thumbnail_url: c.thumbnail_url ?? '',
      difficulty:   c.difficulty   ?? 'Beginner',
      duration_hrs: String(c.duration_hrs ?? 0),
      category:     c.category     ?? '',
      language:     c.language     ?? 'English',
      outcomes:     c.outcomes?.length ? c.outcomes : [''],
      requirements: c.requirements?.length ? c.requirements : [''],
    })
    setLoading(false)
  }, [courseId, workspaceId, router])

  useEffect(() => { load() }, [load])

  // ─────────────────────────────────────────
  // Save details
  // ─────────────────────────────────────────
  const saveDetails = async () => {
    if (!form.title.trim()) { setToast({ message: 'Title is required.', type: 'error' }); return }
    setSaving(true)
    const res = await fetch(`/api/platform/courses/${courseId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        title:        form.title.trim(),
        slug:         form.slug,
        short_desc:   form.short_desc.trim(),
        long_desc:    form.long_desc.trim(),
        price:        parseFloat(form.price) || 0,
        is_free:      form.is_free,
        thumbnail_url: form.thumbnail_url.trim() || null,
        difficulty:   form.difficulty,
        duration_hrs: parseFloat(form.duration_hrs) || 0,
        category:     form.category || null,
        language:     form.language,
        outcomes:     form.outcomes.filter(Boolean),
        requirements: form.requirements.filter(Boolean),
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setCourse(data.course)
      setToast({ message: 'Saved!', type: 'success' })
    } else {
      setToast({ message: data.error ?? 'Save failed.', type: 'error' })
    }
  }

  // ─────────────────────────────────────────
  // Publish / Status
  // ─────────────────────────────────────────
  const setStatus = async (status: string) => {
    const res = await fetch(`/api/platform/courses/${courseId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const d = await res.json()
      setCourse(d.course)
      setToast({ message: `Course ${status}.`, type: 'success' })
    }
  }

  // ─────────────────────────────────────────
  // Module CRUD
  // ─────────────────────────────────────────
  const createModule = async () => {
    if (!newModuleTitle.trim()) return
    setModuleLoading(true)
    const res  = await fetch('/api/platform/modules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: courseId, title: newModuleTitle.trim() }),
    })
    const data = await res.json()
    setModuleLoading(false)
    if (res.ok) {
      setModules((prev) => [...prev, { ...data.module, lessons: [] }])
      setNewModuleTitle('')
      setAddingModule(false)
      setToast({ message: 'Module added!', type: 'success' })
    }
  }

  const deleteModule = async (moduleId: string) => {
    if (!confirm('Delete this module and all its lessons?')) return
    const res = await fetch(`/api/platform/modules?id=${moduleId}&courseId=${courseId}`, { method: 'DELETE' })
    if (res.ok) setModules((prev) => prev.filter((m) => m.id !== moduleId))
  }

  const reorderModules = async (reordered: any[]) => {
    setModules(reordered)
    await fetch('/api/platform/modules', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reorder',
        course_id: courseId,
        items: reordered.map((m, i) => ({ id: m.id, position: i + 1 })),
      }),
    })
  }

  const updateModuleTitle = async (moduleId: string, title: string) => {
    await fetch('/api/platform/modules', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id: moduleId, course_id: courseId, title }),
    })
    setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, title } : m))
  }

  const updateModuleDrip = async (moduleId: string, drip: Record<string, any>) => {
    await fetch('/api/platform/modules', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id: moduleId, course_id: courseId, ...drip }),
    })
    setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, ...drip } : m))
  }

  // ─────────────────────────────────────────
  // Lesson CRUD
  // ─────────────────────────────────────────
  const createLesson = async (moduleId: string) => {
    if (!newLessonTitle.trim()) return
    const res  = await fetch('/api/platform/lessons', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: courseId, module_id: moduleId, title: newLessonTitle.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      setModules((prev) => prev.map((m) =>
        m.id === moduleId ? { ...m, lessons: [...(m.lessons ?? []), data.lesson] } : m
      ))
      setNewLessonTitle('')
      setAddingLessonTo(null)
    }
  }

  const deleteLesson = async (moduleId: string, lessonId: string) => {
    if (!confirm('Delete this lesson?')) return
    const res = await fetch(`/api/platform/lessons?id=${lessonId}&courseId=${courseId}`, { method: 'DELETE' })
    if (res.ok) {
      setModules((prev) => prev.map((m) =>
        m.id === moduleId ? { ...m, lessons: m.lessons.filter((l: any) => l.id !== lessonId) } : m
      ))
    }
  }

  const reorderLessons = async (moduleId: string, reordered: any[]) => {
    setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, lessons: reordered } : m))
    await fetch('/api/platform/lessons', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_id: courseId,
        module_id: moduleId,
        items: reordered.map((l, i) => ({ id: l.id, position: i + 1 })),
      }),
    })
  }

  // ─────────────────────────────────────────
  // Array field helpers (outcomes / requirements)
  // ─────────────────────────────────────────
  const updateArrayItem = (field: 'outcomes' | 'requirements', index: number, value: string) => {
    setForm((f) => {
      const arr = [...f[field]]
      arr[index] = value
      return { ...f, [field]: arr }
    })
  }
  const addArrayItem = (field: 'outcomes' | 'requirements') => {
    setForm((f) => ({ ...f, [field]: [...f[field], ''] }))
  }
  const removeArrayItem = (field: 'outcomes' | 'requirements', index: number) => {
    setForm((f) => {
      const arr = f[field].filter((_, i) => i !== index)
      return { ...f, [field]: arr.length ? arr : [''] }
    })
  }

  // ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        Loading course...
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href={`/platform/workspaces/${workspaceId}/courses`}
            className="text-slate-500 text-sm hover:text-slate-300 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Courses
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-bold text-white">{course?.title}</h1>
            <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${STATUS_COLORS[course?.status] ?? ''}`}>
              {course?.status}
            </span>
          </div>
        </div>

        {tab === 'details' && (
          <button onClick={saveDetails} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save</>}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-navy-700 mb-6">
        {(['curriculum', 'details', 'publish'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-gold-500 text-gold-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          CURRICULUM TAB
      ══════════════════════════════════════════ */}
      {tab === 'curriculum' && (
        <div className="space-y-3">
          <SortableList
            items={modules}
            onReorder={reorderModules}
            renderItem={(mod, { handleProps }) => (
              <ModuleRow
                module={mod}
                handleProps={handleProps}
                workspaceId={workspaceId}
                courseId={courseId}
                collapsed={collapsed.has(mod.id)}
                onToggleCollapse={() => setCollapsed((prev) => {
                  const next = new Set(prev)
                  next.has(mod.id) ? next.delete(mod.id) : next.add(mod.id)
                  return next
                })}
                onDeleteModule={() => deleteModule(mod.id)}
                onUpdateTitle={(title: string) => updateModuleTitle(mod.id, title)}
                onUpdateDrip={(drip: Record<string, any>) => updateModuleDrip(mod.id, drip)}
                allModules={modules}
                onReorderLessons={(reordered: any[]) => reorderLessons(mod.id, reordered)}
                onDeleteLesson={(lessonId: string) => deleteLesson(mod.id, lessonId)}
                isAddingLesson={addingLessonTo === mod.id}
                newLessonTitle={addingLessonTo === mod.id ? newLessonTitle : ''}
                onStartAddLesson={() => { setAddingLessonTo(mod.id); setNewLessonTitle('') }}
                onNewLessonTitleChange={setNewLessonTitle}
                onCreateLesson={() => createLesson(mod.id)}
                onCancelAddLesson={() => setAddingLessonTo(null)}
              />
            )}
          />

          {/* Add module */}
          {addingModule ? (
            <div className="card p-4 flex items-center gap-3">
              <input
                autoFocus
                className="input-field flex-1"
                placeholder="Module title..."
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createModule(); if (e.key === 'Escape') setAddingModule(false) }}
              />
              <button onClick={createModule} disabled={moduleLoading || !newModuleTitle.trim()} className="btn-primary text-sm">
                {moduleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
              </button>
              <button onClick={() => setAddingModule(false)} className="btn-ghost text-sm">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAddingModule(true)}
              className="w-full card p-4 text-slate-400 hover:text-white border-dashed hover:border-navy-600 flex items-center justify-center gap-2 transition-colors text-sm">
              <Plus className="w-4 h-4" /> Add module
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          DETAILS TAB
      ══════════════════════════════════════════ */}
      {tab === 'details' && (
        <div className="max-w-2xl space-y-6">
          <section className="card p-6 space-y-4">
            <h2 className="font-semibold text-white">Basic Info</h2>
            <div>
              <label className="label">Course Title *</label>
              <input className="input-field" value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">URL Slug *</label>
              <input className="input-field font-mono text-sm" value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
            </div>
            <div>
              <label className="label">Short Description <span className="text-slate-500 font-normal">(shown in catalog)</span></label>
              <textarea className="input-field resize-none" rows={2} maxLength={300}
                value={form.short_desc}
                onChange={(e) => setForm((f) => ({ ...f, short_desc: e.target.value }))} />
              <p className="text-slate-600 text-xs mt-1">{form.short_desc.length}/300</p>
            </div>
            <div>
              <label className="label">Full Description</label>
              <textarea className="input-field resize-y min-h-[120px]" value={form.long_desc}
                onChange={(e) => setForm((f) => ({ ...f, long_desc: e.target.value }))} />
            </div>
          </section>

          <section className="card p-6 space-y-4">
            <h2 className="font-semibold text-white">Media</h2>
            <div>
              <label className="label">Thumbnail URL</label>
              <input className="input-field" placeholder="https://..." value={form.thumbnail_url}
                onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))} />
              {form.thumbnail_url && (
                <img src={form.thumbnail_url} alt="thumbnail preview"
                  className="mt-3 w-40 h-24 object-cover rounded-lg border border-navy-700" />
              )}
            </div>
          </section>

          <section className="card p-6 space-y-4">
            <h2 className="font-semibold text-white">Pricing</h2>
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" id="is_free" checked={form.is_free}
                onChange={(e) => setForm((f) => ({ ...f, is_free: e.target.checked }))}
                className="w-4 h-4 accent-yellow-400" />
              <label htmlFor="is_free" className="text-slate-300 text-sm cursor-pointer">Free course</label>
            </div>
            {!form.is_free && (
              <div>
                <label className="label">Price (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input type="number" min="0" step="0.01" className="input-field pl-7" value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
                </div>
              </div>
            )}
          </section>

          <section className="card p-6 space-y-4">
            <h2 className="font-semibold text-white">Details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Difficulty</label>
                <select className="input-field" value={form.difficulty}
                  onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}>
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Duration (hours)</label>
                <input type="number" min="0" step="0.5" className="input-field" value={form.duration_hrs}
                  onChange={(e) => setForm((f) => ({ ...f, duration_hrs: e.target.value }))} />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input-field" value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Language</label>
                <select className="input-field" value={form.language}
                  onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}>
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="card p-6 space-y-4">
            <h2 className="font-semibold text-white">Learning Outcomes</h2>
            <p className="text-slate-400 text-sm">What will students be able to do after completing this course?</p>
            {form.outcomes.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input className="input-field flex-1" placeholder={`Outcome ${i + 1}`}
                  value={o} onChange={(e) => updateArrayItem('outcomes', i, e.target.value)} />
                {form.outcomes.length > 1 && (
                  <button onClick={() => removeArrayItem('outcomes', i)} className="btn-ghost p-2 text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => addArrayItem('outcomes')} className="btn-ghost text-sm flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add outcome
            </button>
          </section>

          <section className="card p-6 space-y-4">
            <h2 className="font-semibold text-white">Requirements</h2>
            <p className="text-slate-400 text-sm">What should students know before taking this course?</p>
            {form.requirements.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input className="input-field flex-1" placeholder={`Requirement ${i + 1}`}
                  value={r} onChange={(e) => updateArrayItem('requirements', i, e.target.value)} />
                {form.requirements.length > 1 && (
                  <button onClick={() => removeArrayItem('requirements', i)} className="btn-ghost p-2 text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => addArrayItem('requirements')} className="btn-ghost text-sm flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add requirement
            </button>
          </section>

          <div className="pb-8">
            <button onClick={saveDetails} disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          PUBLISH TAB
      ══════════════════════════════════════════ */}
      {tab === 'publish' && (
        <div className="max-w-xl space-y-4">
          <div className="card p-6">
            <h2 className="font-semibold text-white mb-4">Visibility</h2>
            <div className="space-y-3">
              <StatusOption
                active={course?.status === 'published'}
                icon={Globe}
                label="Published"
                desc="Visible in your workspace catalog. Students can enroll."
                onClick={() => setStatus('published')}
                color="text-green-400"
              />
              <StatusOption
                active={course?.status === 'draft'}
                icon={Lock}
                label="Draft"
                desc="Only you can see this course. Work in progress."
                onClick={() => setStatus('draft')}
                color="text-slate-400"
              />
              <StatusOption
                active={course?.status === 'archived'}
                icon={Archive}
                label="Archived"
                desc="Hidden from catalog. Existing enrollees keep access."
                onClick={() => setStatus('archived')}
                color="text-amber-400"
              />
            </div>
          </div>

          {course?.published_at && (
            <p className="text-slate-500 text-xs px-1">
              First published {new Date(course.published_at).toLocaleDateString()}
            </p>
          )}

          {/* Certificates */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="font-semibold text-white">Certificates</h2>
                <p className="text-slate-400 text-sm mt-0.5">
                  Auto-issue a certificate of completion when a student finishes all lessons.
                </p>
              </div>
              <button
                onClick={async () => {
                  const next = !certEnabled
                  setCertEnabled(next)
                  setCertSaving(true)
                  await fetch(`/api/platform/courses/${courseId}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ certificates_enabled: next }),
                  })
                  setCertSaving(false)
                  setToast({ message: next ? 'Certificates enabled.' : 'Certificates disabled.', type: 'success' })
                }}
                disabled={certSaving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  certEnabled ? 'bg-gold-500' : 'bg-navy-700'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  certEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            {certEnabled && (
              <p className="text-xs text-gold-400/80 mt-3 flex items-center gap-1.5">
                ✓ Students will receive a PDF certificate when they complete all lessons.
              </p>
            )}
          </div>

          <div className="card p-6 border-red-900/40">
            <h2 className="font-semibold text-white mb-2">Danger Zone</h2>
            <p className="text-slate-400 text-sm mb-4">Permanently delete this course and all its content. Cannot be undone.</p>
            <button
              onClick={async () => {
                if (!confirm('Delete this course? This is permanent.')) return
                const res = await fetch(`/api/platform/courses/${courseId}`, { method: 'DELETE' })
                if (res.ok) router.push(`/platform/workspaces/${workspaceId}/courses`)
              }}
              className="btn-ghost text-sm text-red-400 hover:text-red-300 border-red-900/40 hover:border-red-700"
            >
              <Trash2 className="w-4 h-4" /> Delete course
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

// ─────────────────────────────────────────
// Module row sub-component
// ─────────────────────────────────────────
function ModuleRow({
  module, handleProps, workspaceId, courseId,
  collapsed, onToggleCollapse,
  onDeleteModule, onUpdateTitle, onUpdateDrip,
  onReorderLessons, onDeleteLesson,
  isAddingLesson, newLessonTitle,
  onStartAddLesson, onNewLessonTitleChange, onCreateLesson, onCancelAddLesson,
  allModules,
}: any) {
  const [editing,      setEditing]      = useState(false)
  const [title,        setTitle]        = useState(module.title)
  const [showDrip,     setShowDrip]     = useState(false)
  const [dripType,     setDripType]     = useState(module.drip_unlock_type ?? 'immediate')
  const [dripDays,     setDripDays]     = useState(module.drip_delay_days ?? 0)
  const [dripDate,     setDripDate]     = useState(module.drip_unlock_date ? module.drip_unlock_date.slice(0, 16) : '')
  const [dripModuleId, setDripModuleId] = useState(module.drip_unlock_module_id ?? '')

  const saveDrip = () => {
    onUpdateDrip({
      drip_unlock_type:      dripType,
      drip_delay_days:       dripType === 'days_after_enrollment' ? parseInt(String(dripDays)) || 0 : 0,
      drip_unlock_date:      dripType === 'specific_date' && dripDate ? dripDate : null,
      drip_unlock_module_id: dripType === 'after_module' && dripModuleId ? dripModuleId : null,
    })
    setShowDrip(false)
  }

  const commitTitle = () => {
    setEditing(false)
    if (title.trim() !== module.title) onUpdateTitle(title.trim() || module.title)
  }

  return (
    <div className="card overflow-hidden mb-2">
      {/* Module header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-navy-800/40 border-b border-navy-800">
        <DragHandle dragHandleProps={handleProps} />
        <button onClick={onToggleCollapse} className="text-slate-500 hover:text-slate-300 transition-colors">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {editing ? (
          <input
            autoFocus
            className="input-field flex-1 py-1 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitle(module.title); setEditing(false) } }}
          />
        ) : (
          <span
            className="text-white font-medium flex-1 cursor-pointer hover:text-gold-300"
            onClick={() => setEditing(true)}
          >
            {module.title}
          </span>
        )}
        <span className="text-slate-500 text-xs">{module.lessons?.length ?? 0} lessons</span>
        <button onClick={() => setShowDrip((v) => !v)}
          className={`btn-ghost p-1.5 text-xs flex items-center gap-1 ${dripType !== 'immediate' ? 'text-gold-400' : 'text-slate-500'}`}
          title="Drip settings">
          <Clock className="w-3.5 h-3.5" />
          {dripType !== 'immediate' && <span className="text-xs">Drip</span>}
        </button>
        <button onClick={onDeleteModule} className="btn-ghost p-1.5 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Module drip settings panel */}
      {showDrip && (
        <div className="px-4 py-3 bg-navy-900/60 border-b border-navy-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Module Drip Rule</span>
            <button onClick={() => setShowDrip(false)} className="text-slate-600 hover:text-slate-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <select className="input-field text-sm" value={dripType}
            onChange={(e) => setDripType(e.target.value)}>
            <option value="immediate">Available immediately</option>
            <option value="days_after_enrollment">X days after enrollment</option>
            <option value="specific_date">On a specific date</option>
            <option value="after_module">After completing another module</option>
          </select>
          {dripType === 'days_after_enrollment' && (
            <div className="flex items-center gap-2">
              <input type="number" min="1" className="input-field w-24 text-sm" value={dripDays}
                onChange={(e) => setDripDays(e.target.value)} />
              <span className="text-slate-400 text-sm">days after enrollment</span>
            </div>
          )}
          {dripType === 'specific_date' && (
            <input type="datetime-local" className="input-field text-sm" value={dripDate}
              onChange={(e) => setDripDate(e.target.value)} />
          )}
          {dripType === 'after_module' && (
            <select className="input-field text-sm" value={dripModuleId}
              onChange={(e) => setDripModuleId(e.target.value)}>
              <option value="">Select a module…</option>
              {(allModules ?? []).filter((m: any) => m.id !== module.id).map((m: any) => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          )}
          <button onClick={saveDrip} className="btn-primary text-xs px-3 py-1.5">Save</button>
        </div>
      )}

      {/* Lessons */}
      {!collapsed && (
        <div>
          <SortableList
            items={module.lessons ?? []}
            onReorder={onReorderLessons}
            renderItem={(lesson: any, { handleProps: lhp }) => (
              <LessonRow
                lesson={lesson}
                handleProps={lhp}
                workspaceId={workspaceId}
                courseId={courseId}
                onDelete={() => onDeleteLesson(lesson.id)}
              />
            )}
          />

          {/* Add lesson row */}
          {isAddingLesson ? (
            <div className="flex items-center gap-2 px-4 py-3 border-t border-navy-800">
              <input
                autoFocus
                className="input-field flex-1 py-1.5 text-sm"
                placeholder="Lesson title..."
                value={newLessonTitle}
                onChange={(e) => onNewLessonTitleChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onCreateLesson(); if (e.key === 'Escape') onCancelAddLesson() }}
              />
              <button onClick={onCreateLesson} disabled={!newLessonTitle.trim()} className="btn-primary text-xs px-3 py-1.5">Add</button>
              <button onClick={onCancelAddLesson} className="btn-ghost text-xs">Cancel</button>
            </div>
          ) : (
            <button onClick={onStartAddLesson}
              className="w-full text-slate-500 hover:text-gold-400 text-xs flex items-center gap-1.5 px-6 py-3 border-t border-navy-800 hover:bg-navy-800/20 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add lesson
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// Lesson row sub-component
// ─────────────────────────────────────────
const CONTENT_ICON: Record<string, string> = {
  video: '▶', text: '📄', file: '📎', canva: '🎨',
  google_embed: '📊', live: '📡', link: '🔗',
}

function LessonRow({ lesson, handleProps, workspaceId, courseId, onDelete }: any) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-t border-navy-800 hover:bg-navy-800/20 group">
      <DragHandle dragHandleProps={handleProps} />
      <span className="text-slate-500 text-xs w-5 text-center shrink-0">
        {CONTENT_ICON[lesson.content_type] ?? '•'}
      </span>
      <Link
        href={`/platform/workspaces/${workspaceId}/courses/${courseId}/lessons/${lesson.id}`}
        className="flex-1 text-slate-300 hover:text-white text-sm truncate"
      >
        {lesson.title}
      </Link>
      {lesson.is_free && (
        <span className="text-xs text-gold-400 bg-gold-500/10 px-1.5 py-0.5 rounded shrink-0">Free</span>
      )}
      {lesson.duration_mins > 0 && (
        <span className="text-slate-600 text-xs shrink-0">{lesson.duration_mins}m</span>
      )}
      <button onClick={onDelete} className="btn-ghost p-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────
// Publish status option
// ─────────────────────────────────────────
function StatusOption({ active, icon: Icon, label, desc, onClick, color }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-colors flex items-start gap-3 ${
        active ? 'border-gold-500 bg-gold-500/5' : 'border-navy-700 hover:border-navy-600'
      }`}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${active ? 'text-gold-400' : color}`} />
      <div>
        <p className={`font-medium text-sm ${active ? 'text-gold-400' : 'text-white'}`}>{label}</p>
        <p className="text-slate-400 text-xs mt-0.5">{desc}</p>
      </div>
      {active && (
        <span className="ml-auto text-xs text-gold-400 bg-gold-500/10 px-2 py-0.5 rounded font-medium">Active</span>
      )}
    </button>
  )
}
