'use client'

import { useState, useEffect }  from 'react'
import { useParams }            from 'next/navigation'
import Link                     from 'next/link'
import { ExternalLink, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import FileUpload               from '@/components/branding/FileUpload'
import ColorPicker              from '@/components/branding/ColorPicker'

interface WorkspaceForm {
  name:         string
  tagline:      string
  description:  string
  logo_url:     string
  accent_color: string
  favicon_url:  string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function WorkspaceSettingsPage() {
  const { workspaceId } = useParams() as { workspaceId: string }

  const [form,      setForm]      = useState<WorkspaceForm>({
    name: '', tagline: '', description: '', logo_url: '', accent_color: '#eab308', favicon_url: '',
  })
  const [slug,      setSlug]      = useState('')
  const [loading,   setLoading]   = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errMsg,    setErrMsg]    = useState('')

  useEffect(() => {
    fetch(`/api/platform/workspaces/${workspaceId}/settings`)
      .then((r) => r.json())
      .then(({ workspace }) => {
        if (!workspace) return
        const s = workspace.settings ?? {}
        setSlug(workspace.slug)
        setForm({
          name:         workspace.name         ?? '',
          tagline:      workspace.tagline       ?? '',
          description:  workspace.description   ?? '',
          logo_url:     workspace.logo_url      ?? '',
          accent_color: s.accent_color          ?? '#eab308',
          favicon_url:  s.favicon_url           ?? '',
        })
        setLoading(false)
      })
  }, [workspaceId])

  const set = (k: keyof WorkspaceForm, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setSaveState('saving')
    setErrMsg('')
    const res = await fetch(`/api/platform/workspaces/${workspaceId}/settings`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:        form.name,
        tagline:     form.tagline,
        description: form.description,
        logo_url:    form.logo_url,
        settings: {
          accent_color: form.accent_color,
          favicon_url:  form.favicon_url,
        },
      }),
    })
    if (res.ok) {
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } else {
      const d = await res.json()
      setErrMsg(d.error ?? 'Failed to save')
      setSaveState('error')
    }
  }

  if (loading) return <div className="py-20 text-center text-slate-500 text-sm">Loading...</div>

  return (
    <div className="max-w-3xl space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Workspace Settings</h1>
          <p className="text-slate-400 text-sm mt-1">Customize your academy's identity and branding.</p>
        </div>
        <Link
          href={`/w/${slug}`}
          target="_blank"
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> Public page
        </Link>
      </div>

      {/* ── Basic info ───────────────────────────────────────────────────── */}
      <Section title="Basic Information" description="Your academy's name and tagline shown to students.">
        <div className="space-y-5">
          <div>
            <label className="label">Academy name</label>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              maxLength={100}
              placeholder="My Academy"
            />
          </div>
          <div>
            <label className="label">Tagline</label>
            <input
              className="input-field"
              value={form.tagline}
              onChange={(e) => set('tagline', e.target.value)}
              maxLength={200}
              placeholder="Learn anything, anywhere."
            />
            <p className="text-xs text-slate-500 mt-1">{form.tagline.length}/200</p>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input-field resize-none"
              rows={4}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={2000}
              placeholder="Tell students what your academy is about."
            />
            <p className="text-xs text-slate-500 mt-1">{form.description.length}/2000</p>
          </div>
        </div>
      </Section>

      {/* ── Branding ─────────────────────────────────────────────────────── */}
      <Section title="Branding" description="Upload your logo and favicon, and set your brand color.">
        <div className="space-y-6">
          {/* Logo + Favicon side by side */}
          <div className="flex flex-wrap gap-8">
            <FileUpload
              workspaceId={workspaceId}
              type="logo"
              currentUrl={form.logo_url}
              onUploaded={(url) => set('logo_url', url)}
              label="Logo"
              hint="Square image, 256×256 recommended. PNG or WebP."
            />
            <FileUpload
              workspaceId={workspaceId}
              type="favicon"
              currentUrl={form.favicon_url}
              onUploaded={(url) => set('favicon_url', url)}
              label="Favicon"
              hint="32×32 or 64×64 ICO, PNG, or WebP."
            />
          </div>

          {/* Brand color */}
          <div className="max-w-xs">
            <ColorPicker
              value={form.accent_color}
              onChange={(c) => set('accent_color', c)}
              label="Brand color"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Used for buttons, progress bars, and highlights across your workspace.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Preview ──────────────────────────────────────────────────────── */}
      <Section title="Public Preview" description="How your workspace header looks to visitors.">
        <WorkspacePreview form={form} slug={slug} />
      </Section>

      {/* ── Save ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 pt-2 border-t border-navy-800">
        <button
          onClick={save}
          disabled={saveState === 'saving'}
          className="btn-primary flex items-center gap-2"
        >
          {saveState === 'saving'
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            : saveState === 'saved'
            ? <><CheckCircle2 className="w-4 h-4" /> Saved!</>
            : <><Save className="w-4 h-4" /> Save changes</>}
        </button>

        {saveState === 'error' && (
          <span className="flex items-center gap-1.5 text-sm text-red-400">
            <AlertCircle className="w-4 h-4" /> {errMsg || 'An error occurred'}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title, description, children,
}: {
  title: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="grid sm:grid-cols-3 gap-6">
      <div className="sm:col-span-1">
        <h2 className="font-semibold text-white text-sm">{title}</h2>
        {description && <p className="text-slate-400 text-xs mt-1 leading-relaxed">{description}</p>}
      </div>
      <div className="sm:col-span-2 card p-6">
        {children}
      </div>
    </div>
  )
}

function WorkspacePreview({ form, slug }: { form: WorkspaceForm; slug: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-navy-700">
      {/* Simulated nav */}
      <div className="bg-navy-900 border-b border-navy-800 px-6 py-3 flex items-center justify-between"
        style={{ borderBottomColor: form.accent_color + '22' }}>
        <div className="flex items-center gap-2.5">
          {form.logo_url ? (
            <img src={form.logo_url} alt="" className="w-7 h-7 rounded-lg object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
              style={{ backgroundColor: form.accent_color + '33', color: form.accent_color }}>
              {form.name?.[0] ?? 'A'}
            </div>
          )}
          <span className="font-semibold text-white text-sm">{form.name || 'Your Academy'}</span>
        </div>
        <div className="flex items-center gap-3 text-slate-400 text-xs">
          <span>Home</span><span>Courses</span><span>Dashboard</span>
        </div>
      </div>

      {/* Simulated hero */}
      <div className="bg-gradient-to-b from-navy-900 to-navy-950 px-6 py-10 text-center">
        {form.logo_url && (
          <img src={form.logo_url} alt="" className="w-14 h-14 rounded-2xl object-cover mx-auto mb-4" />
        )}
        <h1 className="font-display text-2xl font-bold text-white mb-2">
          {form.name || 'Your Academy Name'}
        </h1>
        <p className="text-slate-400 text-sm">{form.tagline || 'Your tagline goes here'}</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="text-xs text-slate-500">apex-university.com/w/{slug}</span>
        </div>
        <button
          className="mt-5 px-5 py-2 rounded-lg text-sm font-medium text-navy-950 transition-none"
          style={{ backgroundColor: form.accent_color }}
          disabled
        >
          Browse Courses
        </button>
      </div>
    </div>
  )
}
