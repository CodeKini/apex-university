'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Globe, CheckCircle, Loader2 } from 'lucide-react'

type Step = 'details' | 'preview' | 'done'

const RESERVED_SLUGS = new Set([
  'www', 'app', 'api', 'admin', 'platform', 'dashboard', 'login', 'signup',
  'blog', 'help', 'support', 'mail', 'email', 'static', 'cdn',
])

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep]       = useState<Step>('details')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [workspace, setWorkspace] = useState<any>(null)

  const [form, setForm] = useState({
    name:    '',
    slug:    '',
    tagline: '',
  })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleNameBlur = () => {
    if (!form.slug) set('slug', toSlug(form.name))
  }

  const handleSlugChange = (v: string) => {
    set('slug', v.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  const slugError = (): string => {
    if (!form.slug) return ''
    if (form.slug.length < 2) return 'Too short (min 2 chars)'
    if (RESERVED_SLUGS.has(form.slug)) return 'That name is reserved'
    if (!/^[a-z0-9-]+$/.test(form.slug)) return 'Lowercase letters, numbers, and hyphens only'
    return ''
  }

  const canProceed =
    form.name.trim().length >= 2 &&
    form.slug.length >= 2 &&
    !slugError() &&
    !RESERVED_SLUGS.has(form.slug)

  const handleCreate = async () => {
    setError('')
    setLoading(true)
    const res = await fetch('/api/workspaces', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Please try again.')
      return
    }

    setWorkspace(data.workspace)
    setStep('done')
  }

  if (step === 'done') {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h1 className="font-display text-2xl font-bold text-white mb-3">Your workspace is ready!</h1>
        <p className="text-slate-400 mb-2">
          <span className="text-white font-medium">{workspace?.name}</span> is live at:
        </p>
        <div className="card p-4 font-mono text-sm text-gold-400 mb-8">
          {workspace?.slug}.apex-university.com
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href={`/platform/workspaces/${workspace?.id}`} className="btn-primary">
            Manage workspace →
          </Link>
          <Link href={`/w/${workspace?.slug}`} className="btn-outline" target="_blank">
            View as student
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/platform/dashboard" className="text-slate-500 text-sm hover:text-slate-300 flex items-center gap-1 mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
        </Link>
        <h1 className="font-display text-2xl font-bold text-white">Create a workspace</h1>
        <p className="text-slate-400 text-sm mt-1">
          Your workspace is your branded academy. Students will access it at{' '}
          <span className="text-slate-300">yourname.apex-university.com</span>.
        </p>
      </div>

      {/* Step: Details */}
      <div className="card p-6 space-y-5">
        <div>
          <label className="label">Workspace name *</label>
          <input
            className="input-field"
            placeholder="My Fitness Academy"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            onBlur={handleNameBlur}
          />
        </div>

        <div>
          <label className="label">URL slug *</label>
          <div className="flex items-center gap-0">
            <span className="px-3 py-2.5 bg-navy-800 border border-navy-700 border-r-0 rounded-l-lg text-slate-400 text-sm whitespace-nowrap">
              apex-university.com/
            </span>
            <input
              className="input-field rounded-l-none border-l-0"
              placeholder="my-fitness-academy"
              value={form.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
            />
          </div>
          {slugError() && <p className="text-red-400 text-xs mt-1">{slugError()}</p>}
          {!slugError() && form.slug && (
            <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {form.slug}.apex-university.com
            </p>
          )}
        </div>

        <div>
          <label className="label">Tagline <span className="text-slate-500 font-normal">(optional)</span></label>
          <input
            className="input-field"
            placeholder="Transform your body in 90 days."
            value={form.tagline}
            onChange={(e) => set('tagline', e.target.value)}
            maxLength={160}
          />
          <p className="text-slate-600 text-xs mt-1">{form.tagline.length}/160</p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleCreate}
            disabled={!canProceed || loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
            ) : (
              <>Create workspace <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>

      <p className="text-slate-600 text-xs text-center mt-6">
        You can change your workspace name, branding, and settings at any time.
        The URL slug cannot be changed after creation.
      </p>
    </div>
  )
}
