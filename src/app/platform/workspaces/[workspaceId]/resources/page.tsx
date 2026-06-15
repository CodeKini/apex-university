'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams }  from 'next/navigation'
import {
  Upload, Plus, Pencil, Trash2, Archive, ArchiveRestore,
  FileText, File, Image, Music, Video, Link2, ExternalLink,
  Download, Loader2, X, CheckCircle2, AlertCircle,
} from 'lucide-react'

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  pdf:          'PDF',
  zip:          'ZIP / Archive',
  image:        'Image',
  audio:        'Audio',
  video_link:   'Video Link',
  canva_link:   'Canva',
  google_link:  'Google Doc/Sheet/Slide',
  external_url: 'External URL',
  file:         'File',
}

const RESOURCE_TYPE_ICONS: Record<string, React.ElementType> = {
  pdf:          FileText,
  zip:          File,
  image:        Image,
  audio:        Music,
  video_link:   Video,
  canva_link:   Link2,
  google_link:  Link2,
  external_url: ExternalLink,
  file:         File,
}

const ACCESS_TYPE_LABELS: Record<string, string> = {
  free:             'Free (anyone)',
  paid_course:      'Any paid enrollment',
  membership:       'Membership',
  specific_courses: 'Specific courses',
  specific_paths:   'Specific paths',
}

const FILE_UPLOAD_TYPES = new Set(['pdf','zip','image','audio','file'])

interface Resource {
  id: string
  title: string
  description: string | null
  resource_type: string
  file_name: string | null
  file_size: number | null
  external_url: string | null
  storage_path: string | null
  access_type: string
  course_ids: string[]
  path_ids: string[]
  is_active: boolean
  download_count: number
  created_at: string
}

interface Course { id: string; title: string }
interface Path   { id: string; title: string }

const EMPTY_FORM = {
  title:         '',
  description:   '',
  resource_type: 'pdf' as string,
  access_type:   'membership' as string,
  external_url:  '',
  course_ids:    [] as string[],
  path_ids:      [] as string[],
}

export default function ResourceLibraryCreatorPage() {
  const params      = useParams()
  const workspaceId = params.workspaceId as string

  const [resources, setResources] = useState<Resource[]>([])
  const [courses,   setCourses]   = useState<Course[]>([])
  const [paths,     setPaths]     = useState<Path[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState<'create' | 'edit' | null>(null)
  const [editing,   setEditing]   = useState<Resource | null>(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [file,      setFile]      = useState<File | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null)
  const [filter,    setFilter]    = useState<'all' | 'active' | 'inactive'>('active')
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    const [rRes, cRes, pRes] = await Promise.all([
      fetch(`/api/platform/resources?workspaceId=${workspaceId}`),
      fetch(`/api/platform/courses?workspaceId=${workspaceId}`),
      fetch(`/api/platform/paths?workspaceId=${workspaceId}`),
    ])
    const [rData, cData, pData] = await Promise.all([rRes.json(), cRes.json(), pRes.json()])
    setResources(rData.resources ?? [])
    setCourses(cData.courses ?? [])
    setPaths(pData.paths ?? [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFile(null)
    setModal('create')
  }

  const openEdit = (r: Resource) => {
    setEditing(r)
    setForm({
      title:         r.title,
      description:   r.description ?? '',
      resource_type: r.resource_type,
      access_type:   r.access_type,
      external_url:  r.external_url ?? '',
      course_ids:    r.course_ids ?? [],
      path_ids:      r.path_ids ?? [],
    })
    setFile(null)
    setModal('edit')
  }

  const closeModal = () => { setModal(null); setEditing(null); setFile(null) }

  const needsUpload = FILE_UPLOAD_TYPES.has(form.resource_type)

  const save = async () => {
    if (!form.title.trim()) { showToast('Title is required.', false); return }
    setSaving(true)

    try {
      let storagePath: string | null = editing?.storage_path ?? null
      let fileName:    string | null = editing?.file_name    ?? null
      let fileSize:    number | null = editing?.file_size    ?? null

      // Upload file if provided
      if (file && needsUpload) {
        const fd = new FormData()
        fd.append('file', file)
        const upRes = await fetch(`/api/platform/workspaces/${workspaceId}/resources/upload`, {
          method: 'POST', body: fd,
        })
        const upData = await upRes.json()
        if (!upRes.ok) { showToast(upData.error ?? 'Upload failed.', false); setSaving(false); return }
        storagePath = upData.storage_path
        fileName    = upData.file_name
        fileSize    = upData.file_size
      }

      const payload = {
        workspace_id:  workspaceId,
        title:         form.title.trim(),
        description:   form.description.trim() || null,
        resource_type: form.resource_type,
        storage_path:  storagePath,
        file_name:     fileName,
        file_size:     fileSize,
        external_url:  !needsUpload ? (form.external_url.trim() || null) : null,
        access_type:   form.access_type,
        course_ids:    form.course_ids,
        path_ids:      form.path_ids,
      }

      if (editing) {
        const res = await fetch(`/api/platform/resources/${editing.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) { showToast(data.error ?? 'Save failed.', false); setSaving(false); return }
        setResources((prev) => prev.map((r) => r.id === editing.id ? data.resource : r))
        showToast('Resource updated!')
      } else {
        const res = await fetch('/api/platform/resources', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) { showToast(data.error ?? 'Create failed.', false); setSaving(false); return }
        setResources((prev) => [data.resource, ...prev])
        showToast('Resource created!')
      }
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (r: Resource) => {
    const res = await fetch(`/api/platform/resources/${r.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !r.is_active }),
    })
    if (res.ok) setResources((prev) => prev.map((x) => x.id === r.id ? { ...x, is_active: !r.is_active } : x))
  }

  const deleteResource = async (r: Resource) => {
    if (!confirm(`Delete "${r.title}"? This cannot be undone.`)) return
    const res = await fetch(`/api/platform/resources/${r.id}`, { method: 'DELETE' })
    if (res.ok) setResources((prev) => prev.filter((x) => x.id !== r.id))
  }

  const toggleCourseId = (id: string) =>
    set('course_ids', form.course_ids.includes(id) ? form.course_ids.filter((x) => x !== id) : [...form.course_ids, id])
  const togglePathId = (id: string) =>
    set('path_ids', form.path_ids.includes(id) ? form.path_ids.filter((x) => x !== id) : [...form.path_ids, id])

  const filtered = resources.filter((r) =>
    filter === 'all' ? true : filter === 'active' ? r.is_active : !r.is_active
  )

  const totalDownloads = resources.reduce((s, r) => s + (r.download_count ?? 0), 0)
  const activeCount    = resources.filter((r) => r.is_active).length

  if (loading) return <div className="py-20 text-center text-slate-500 text-sm"><Loader2 className="w-5 h-5 animate-spin inline" /></div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Resource Library</h1>
          <p className="text-slate-400 text-sm mt-1">Upload and manage downloadable resources for your students.</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Resource
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Resources', value: resources.length },
          { label: 'Active',          value: activeCount },
          { label: 'Total Downloads', value: totalDownloads },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['active','inactive','all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${filter === f ? 'bg-gold-500 text-navy-950 font-medium' : 'text-slate-400 hover:text-white bg-navy-800/40'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card p-16 text-center space-y-3">
          <Upload className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-slate-400">No resources yet. Add your first resource above.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-800 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Resource</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Access</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Downloads</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800/60">
              {filtered.map((r) => {
                const Icon = RESOURCE_TYPE_ICONS[r.resource_type] ?? File
                return (
                  <tr key={r.id} className={`hover:bg-navy-800/20 transition-colors ${!r.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate max-w-xs">{r.title}</p>
                          {r.file_name && <p className="text-slate-500 text-xs truncate">{r.file_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{RESOURCE_TYPE_LABELS[r.resource_type] ?? r.resource_type}</td>
                    <td className="px-4 py-3 text-slate-400">{ACCESS_TYPE_LABELS[r.access_type] ?? r.access_type}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="flex items-center justify-end gap-1 text-slate-400">
                        <Download className="w-3.5 h-3.5" /> {r.download_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${r.is_active ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-slate-500 bg-slate-800/50 border-slate-700'}`}>
                        {r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(r)} className="btn-ghost p-1.5" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => toggleActive(r)} className="btn-ghost p-1.5" title={r.is_active ? 'Archive' : 'Restore'}>
                          {r.is_active ? <Archive className="w-3.5 h-3.5" /> : <ArchiveRestore className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => deleteResource(r)} className="btn-ghost p-1.5 text-red-400" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-navy-800">
              <h2 className="font-semibold text-white">{modal === 'create' ? 'Add Resource' : 'Edit Resource'}</h2>
              <button onClick={closeModal}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="label">Title <span className="text-red-400">*</span></label>
                <input className="input-field" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Lesson Workbook" />
              </div>

              {/* Description */}
              <div>
                <label className="label">Description</label>
                <textarea className="input-field resize-none" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional description" />
              </div>

              {/* Resource type */}
              <div>
                <label className="label">Resource Type</label>
                <select className="input-field" value={form.resource_type} onChange={(e) => { set('resource_type', e.target.value); setFile(null) }}>
                  {Object.entries(RESOURCE_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              {/* File upload or URL */}
              {needsUpload ? (
                <div>
                  <label className="label">File {modal === 'edit' && editing?.file_name && '(leave blank to keep current)'}</label>
                  {editing?.file_name && !file && (
                    <p className="text-slate-400 text-xs mb-2">Current: {editing.file_name} ({editing.file_size ? `${(editing.file_size / 1024 / 1024).toFixed(1)} MB` : ''})</p>
                  )}
                  <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  <button onClick={() => fileRef.current?.click()} className="btn-ghost w-full flex items-center justify-center gap-2 py-3 border-dashed border-navy-600 border">
                    <Upload className="w-4 h-4" />
                    {file ? file.name : 'Choose file'}
                  </button>
                  {file && <p className="text-slate-400 text-xs mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>}
                </div>
              ) : (
                <div>
                  <label className="label">URL</label>
                  <input className="input-field" value={form.external_url} onChange={(e) => set('external_url', e.target.value)} placeholder="https://..." />
                </div>
              )}

              {/* Access type */}
              <div>
                <label className="label">Access</label>
                <select className="input-field" value={form.access_type} onChange={(e) => set('access_type', e.target.value)}>
                  {Object.entries(ACCESS_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Specific courses */}
              {form.access_type === 'specific_courses' && courses.length > 0 && (
                <div>
                  <label className="label">Courses</label>
                  <div className="space-y-1 max-h-40 overflow-y-auto border border-navy-700 rounded-xl p-3">
                    {courses.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer text-slate-300 hover:text-white">
                        <input type="checkbox" checked={form.course_ids.includes(c.id)} onChange={() => toggleCourseId(c.id)} className="accent-gold-500" />
                        {c.title}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Specific paths */}
              {form.access_type === 'specific_paths' && paths.length > 0 && (
                <div>
                  <label className="label">Learning Paths</label>
                  <div className="space-y-1 max-h-40 overflow-y-auto border border-navy-700 rounded-xl p-3">
                    {paths.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer text-slate-300 hover:text-white">
                        <input type="checkbox" checked={form.path_ids.includes(p.id)} onChange={() => togglePathId(p.id)} className="accent-gold-500" />
                        {p.title}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle2 className="w-4 h-4" /> Save</>}
              </button>
              <button onClick={closeModal} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm shadow-xl border ${toast.ok ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
