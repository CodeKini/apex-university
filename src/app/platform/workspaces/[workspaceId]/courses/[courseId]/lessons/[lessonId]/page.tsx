'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter }              from 'next/navigation'
import Link                                  from 'next/link'
import { ArrowLeft, Save, Loader2, BarChart2 } from 'lucide-react'
import Toast                                 from '@/components/ui/Toast'
import QuizBuilder                           from '@/components/quiz/QuizBuilder'

// ─────────────────────────────────────────
const CONTENT_TYPES = [
  { value: 'video',        label: 'Video',          desc: 'YouTube, Vimeo, Loom, Wistia, or direct URL' },
  { value: 'text',         label: 'Text / Article', desc: 'HTML rich-text content' },
  { value: 'file',         label: 'File Download',  desc: 'PDF, ZIP, DOCX, or any file URL' },
  { value: 'canva',        label: 'Canva',          desc: 'Embed a Canva design' },
  { value: 'google_embed', label: 'Google Docs',    desc: 'Doc, Sheet, or Slides' },
  { value: 'live',         label: 'Live Session',   desc: 'Zoom or Google Meet' },
  { value: 'link',         label: 'External Link',  desc: 'Send students to an external URL' },
]

const VIDEO_SOURCES = [
  { value: 'youtube', label: 'YouTube',     placeholder: 'https://www.youtube.com/watch?v=...' },
  { value: 'vimeo',   label: 'Vimeo',      placeholder: 'https://vimeo.com/...' },
  { value: 'loom',    label: 'Loom',       placeholder: 'https://www.loom.com/share/...' },
  { value: 'wistia',  label: 'Wistia',     placeholder: 'https://...' },
  { value: 'storage', label: 'Direct URL', placeholder: 'https://...' },
]

const GOOGLE_TYPES = [
  { value: 'google_doc',   label: 'Google Doc' },
  { value: 'google_sheet', label: 'Google Sheet' },
  { value: 'google_slide', label: 'Google Slides' },
]

// ─────────────────────────────────────────
export default function LessonEditorPage() {
  const params      = useParams()
  const router      = useRouter()
  const workspaceId = params.workspaceId as string
  const courseId    = params.courseId    as string
  const lessonId    = params.lessonId    as string

  const [lesson,  setLesson]  = useState<any>(null)
  const [modules, setModules] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [toast,  setToast]  = useState<any>(null)
  const [form,   setForm]   = useState({
    title:             '',
    description:       '',
    content_type:      'video',
    position:          1,
    duration_mins:     0,
    is_free:           false,
    is_published:      true,
    drip_unlock_type:      'immediate',
    drip_delay_days:       0,
    drip_unlock_date:      '',
    drip_unlock_lesson_id: '',
    drip_unlock_module_id: '',
    completion_method: 'manual_mark',
    // Video
    video_url:    '',
    video_source: 'youtube',
    // Embed
    embed_url:    '',
    embed_type:   'google_doc',
    // Text
    rich_text:    '',
    // Live
    live_url:          '',
    live_scheduled_at: '',
    // File / link
    file_url:  '',
    link_url:  '',
    link_text: '',
  })

  const load = useCallback(async () => {
    const [res, mRes] = await Promise.all([
      fetch(`/api/platform/lessons/${lessonId}`),
      fetch(`/api/platform/modules?courseId=${courseId}`),
    ])
    if (!res.ok) { router.push(`/platform/workspaces/${workspaceId}/courses/${courseId}`); return }
    const { lesson: l } = await res.json()
    const mData = await mRes.json()
    setModules(mData.modules ?? [])
    setLesson(l)
    setForm({
      title:             l.title ?? '',
      description:       l.description ?? '',
      content_type:      l.content_type ?? 'video',
      position:          l.position ?? 1,
      duration_mins:     l.duration_mins ?? 0,
      is_free:           l.is_free ?? false,
      is_published:      l.is_published ?? true,
      drip_unlock_type:      l.drip_unlock_type ?? 'immediate',
      drip_delay_days:       l.drip_delay_days ?? 0,
      drip_unlock_date:      l.drip_unlock_date ? l.drip_unlock_date.slice(0, 16) : '',
      drip_unlock_lesson_id: l.drip_unlock_lesson_id ?? '',
      drip_unlock_module_id: l.drip_unlock_module_id ?? '',
      completion_method: l.completion_method ?? 'manual_mark',
      video_url:         l.video_url ?? '',
      video_source:      l.video_source ?? 'youtube',
      embed_url:         l.embed_url ?? '',
      embed_type:        l.embed_type ?? 'google_doc',
      rich_text:         l.rich_text ?? '',
      live_url:          l.live_url ?? '',
      live_scheduled_at: l.live_scheduled_at?.slice(0, 16) ?? '',
      // file/link both stored in embed_url
      file_url:  (l.content_type === 'file' ? l.embed_url : '') ?? '',
      link_url:  (l.content_type === 'link' ? l.embed_url : '') ?? '',
      link_text: '',
    })
  }, [lessonId, courseId, workspaceId, router])

  useEffect(() => { load() }, [load])

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.title.trim()) { setToast({ message: 'Title is required.', type: 'error' }); return }
    setSaving(true)

    const payload: Record<string, unknown> = {
      title:             form.title.trim(),
      description:       form.description.trim() || null,
      content_type:      form.content_type,
      position:          parseInt(String(form.position)) || 1,
      duration_mins:     parseInt(String(form.duration_mins)) || 0,
      is_free:           form.is_free,
      is_published:      form.is_published,
      drip_unlock_type:      form.drip_unlock_type,
      drip_delay_days:       parseInt(String(form.drip_delay_days)) || 0,
      drip_unlock_date:      form.drip_unlock_type === 'specific_date' && form.drip_unlock_date ? form.drip_unlock_date : null,
      drip_unlock_lesson_id: form.drip_unlock_type === 'after_lesson' && form.drip_unlock_lesson_id ? form.drip_unlock_lesson_id : null,
      drip_unlock_module_id: form.drip_unlock_type === 'after_module' && form.drip_unlock_module_id ? form.drip_unlock_module_id : null,
      completion_method: form.completion_method,
    }

    if (form.content_type === 'video') {
      payload.video_url    = form.video_url.trim() || null
      payload.video_source = form.video_source
    }
    if (form.content_type === 'canva') {
      payload.embed_url  = form.embed_url.trim() || null
      payload.embed_type = 'canva'
    }
    if (form.content_type === 'google_embed') {
      payload.embed_url  = form.embed_url.trim() || null
      payload.embed_type = form.embed_type
    }
    if (form.content_type === 'text') {
      payload.rich_text = form.rich_text
    }
    if (form.content_type === 'live') {
      payload.live_url          = form.live_url.trim() || null
      payload.live_scheduled_at = form.live_scheduled_at || null
    }
    if (form.content_type === 'file') {
      payload.embed_url = form.file_url.trim() || null
    }
    if (form.content_type === 'link') {
      payload.embed_url = form.link_url.trim() || null
    }

    const res = await fetch(`/api/platform/lessons/${lessonId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    setToast(res.ok
      ? { message: 'Lesson saved!', type: 'success' }
      : { message: 'Failed to save.', type: 'error' })
  }

  if (!lesson) return <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading...</div>

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href={`/platform/workspaces/${workspaceId}/courses/${courseId}`}
            className="text-slate-500 text-sm hover:text-slate-300 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Course
          </Link>
          <h1 className="font-display text-xl font-bold text-white">Lesson Editor</h1>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save</>}
        </button>
      </div>

      <div className="space-y-6">
        {/* ── Basic Info ── */}
        <section className="card p-6 space-y-4">
          <h2 className="font-semibold text-white">Lesson Info</h2>
          <div>
            <label className="label">Title *</label>
            <input className="input-field" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <label className="label">Description <span className="text-slate-500 font-normal">(optional)</span></label>
            <textarea className="input-field resize-none" rows={2} value={form.description}
              onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Duration (minutes)</label>
              <input type="number" min="0" className="input-field" value={form.duration_mins}
                onChange={(e) => set('duration_mins', e.target.value)} />
            </div>
            <div>
              <label className="label">Position in module</label>
              <input type="number" min="1" className="input-field" value={form.position}
                onChange={(e) => set('position', e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_free} onChange={(e) => set('is_free', e.target.checked)} className="w-4 h-4 accent-yellow-400" />
              <span className="text-slate-300 text-sm">Free preview</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_published} onChange={(e) => set('is_published', e.target.checked)} className="w-4 h-4 accent-yellow-400" />
              <span className="text-slate-300 text-sm">Published</span>
            </label>
          </div>
        </section>

        {/* ── Content Type Picker ── */}
        <section className="card p-6 space-y-4">
          <h2 className="font-semibold text-white">Content Type</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CONTENT_TYPES.map((ct) => (
              <button key={ct.value} type="button" onClick={() => set('content_type', ct.value)}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  form.content_type === ct.value
                    ? 'border-gold-500 bg-gold-500/10'
                    : 'border-navy-700 hover:border-navy-500'
                }`}>
                <p className={`text-sm font-medium ${form.content_type === ct.value ? 'text-gold-400' : 'text-white'}`}>
                  {ct.label}
                </p>
                <p className="text-slate-500 text-xs mt-0.5">{ct.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ── Video ── */}
        {form.content_type === 'video' && (
          <section className="card p-6 space-y-4">
            <h2 className="font-semibold text-white">Video</h2>
            <div>
              <label className="label">Platform</label>
              <select className="input-field" value={form.video_source} onChange={(e) => set('video_source', e.target.value)}>
                {VIDEO_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Video URL</label>
              <input className="input-field" value={form.video_url} onChange={(e) => set('video_url', e.target.value)}
                placeholder={VIDEO_SOURCES.find((s) => s.value === form.video_source)?.placeholder ?? 'https://...'} />
            </div>
          </section>
        )}

        {/* ── Canva ── */}
        {form.content_type === 'canva' && (
          <section className="card p-6 space-y-4">
            <h2 className="font-semibold text-white">Canva Embed</h2>
            <p className="text-slate-400 text-sm">In Canva: Share → Embed → copy the embed URL.</p>
            <div>
              <label className="label">Canva Embed URL</label>
              <input className="input-field" value={form.embed_url} onChange={(e) => set('embed_url', e.target.value)}
                placeholder="https://www.canva.com/design/.../view?embed" />
            </div>
          </section>
        )}

        {/* ── Google Embed ── */}
        {form.content_type === 'google_embed' && (
          <section className="card p-6 space-y-4">
            <h2 className="font-semibold text-white">Google Embed</h2>
            <p className="text-slate-400 text-sm">File → Share → Publish to web → copy the embed URL.</p>
            <div>
              <label className="label">Document Type</label>
              <select className="input-field" value={form.embed_type} onChange={(e) => set('embed_type', e.target.value)}>
                {GOOGLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Embed URL</label>
              <input className="input-field" value={form.embed_url} onChange={(e) => set('embed_url', e.target.value)}
                placeholder="https://docs.google.com/..." />
            </div>
          </section>
        )}

        {/* ── Text ── */}
        {form.content_type === 'text' && (
          <section className="card p-6 space-y-4">
            <h2 className="font-semibold text-white">Text Content</h2>
            <p className="text-slate-400 text-sm">Enter HTML. A rich-text editor can be added in a future update.</p>
            <div>
              <label className="label">Content (HTML)</label>
              <textarea className="input-field min-h-[240px] resize-y font-mono text-xs" value={form.rich_text}
                onChange={(e) => set('rich_text', e.target.value)}
                placeholder="<h2>Introduction</h2><p>...</p>" />
            </div>
          </section>
        )}

        {/* ── File ── */}
        {form.content_type === 'file' && (
          <section className="card p-6 space-y-4">
            <h2 className="font-semibold text-white">File Download</h2>
            <p className="text-slate-400 text-sm">Paste a direct URL to a PDF, ZIP, DOCX, or any downloadable file.</p>
            <div>
              <label className="label">File URL</label>
              <input className="input-field" value={form.file_url} onChange={(e) => set('file_url', e.target.value)}
                placeholder="https://... (PDF, ZIP, DOCX, etc.)" />
            </div>
          </section>
        )}

        {/* ── External Link ── */}
        {form.content_type === 'link' && (
          <section className="card p-6 space-y-4">
            <h2 className="font-semibold text-white">External Link</h2>
            <p className="text-slate-400 text-sm">Students will see a button that opens this URL in a new tab.</p>
            <div>
              <label className="label">URL</label>
              <input className="input-field" value={form.link_url} onChange={(e) => set('link_url', e.target.value)}
                placeholder="https://..." />
            </div>
          </section>
        )}

        {/* ── Live ── */}
        {form.content_type === 'live' && (
          <section className="card p-6 space-y-4">
            <h2 className="font-semibold text-white">Live Session</h2>
            <div>
              <label className="label">Meeting URL</label>
              <input className="input-field" value={form.live_url} onChange={(e) => set('live_url', e.target.value)}
                placeholder="https://zoom.us/j/... or https://meet.google.com/..." />
            </div>
            <div>
              <label className="label">Scheduled Date & Time</label>
              <input type="datetime-local" className="input-field" value={form.live_scheduled_at}
                onChange={(e) => set('live_scheduled_at', e.target.value)} />
            </div>
          </section>
        )}

        {/* ── Completion & Access ── */}
        <section className="card p-6 space-y-4">
          <h2 className="font-semibold text-white">Completion & Access</h2>
          <div>
            <label className="label">Completion Method</label>
            <select className="input-field" value={form.completion_method}
              onChange={(e) => set('completion_method', e.target.value)}>
              <option value="manual_mark">Student clicks "Mark Complete"</option>
              <option value="video_watched">Auto-complete when video is watched (85%+)</option>
              <option value="quiz_passed">Auto-complete when quiz is passed</option>
            </select>
          </div>
          <div className="space-y-3">
            <label className="label">Drip / Unlock Rule</label>
            <select className="input-field" value={form.drip_unlock_type}
              onChange={(e) => set('drip_unlock_type', e.target.value)}>
              <option value="immediate">Available immediately</option>
              <option value="days_after_enrollment">X days after enrollment</option>
              <option value="specific_date">On a specific date</option>
              <option value="after_lesson">After completing a lesson</option>
              <option value="after_module">After completing a module</option>
            </select>

            {form.drip_unlock_type === 'days_after_enrollment' && (
              <div className="flex items-center gap-3">
                <input type="number" min="1" className="input-field w-28" value={form.drip_delay_days}
                  onChange={(e) => set('drip_delay_days', e.target.value)} />
                <span className="text-slate-400 text-sm">days after enrollment</span>
              </div>
            )}

            {form.drip_unlock_type === 'specific_date' && (
              <input type="datetime-local" className="input-field" value={form.drip_unlock_date}
                onChange={(e) => set('drip_unlock_date', e.target.value)} />
            )}

            {form.drip_unlock_type === 'after_lesson' && (
              <select className="input-field" value={form.drip_unlock_lesson_id}
                onChange={(e) => set('drip_unlock_lesson_id', e.target.value)}>
                <option value="">Select a lesson…</option>
                {modules.flatMap((m: any) =>
                  (m.lessons ?? [])
                    .filter((l: any) => l.id !== lessonId)
                    .map((l: any) => (
                      <option key={l.id} value={l.id}>{m.title} → {l.title}</option>
                    ))
                )}
              </select>
            )}

            {form.drip_unlock_type === 'after_module' && (
              <select className="input-field" value={form.drip_unlock_module_id}
                onChange={(e) => set('drip_unlock_module_id', e.target.value)}>
                <option value="">Select a module…</option>
                {modules.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            )}
          </div>
        </section>

        <div className="flex gap-3 pb-4">
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Lesson</>}
          </button>
          <Link href={`/platform/workspaces/${workspaceId}/courses/${courseId}`} className="btn-ghost">
            ← Back to Course
          </Link>
        </div>

        {/* ── Quiz Builder ── */}
        {lesson && (
          <>
            <div className="flex items-center justify-between py-2">
              <hr className="border-navy-700 flex-1" />
              <span className="text-slate-600 text-xs px-3">QUIZ</span>
              <hr className="border-navy-700 flex-1" />
            </div>
            <Link
              href={`/platform/workspaces/${workspaceId}/courses/${courseId}/lessons/${lessonId}/quiz-results`}
              className="btn-ghost text-xs flex items-center gap-1.5 self-start mb-2"
            >
              <BarChart2 className="w-3.5 h-3.5" /> View quiz results
            </Link>
            <QuizBuilder
              lessonId={lessonId}
              courseId={courseId}
              workspaceId={workspaceId}
            />
          </>
        )}

        <div className="pb-10" />
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
