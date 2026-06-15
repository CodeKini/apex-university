'use client'

import { useState }    from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link            from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function NewPathPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const router          = useRouter()

  const [title,               setTitle]               = useState('')
  const [description,         setDescription]         = useState('')
  const [difficulty,          setDifficulty]          = useState('beginner')
  const [estimatedHours,      setEstimatedHours]      = useState('')
  const [certificatesEnabled, setCertificatesEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    setSaving(true); setError('')

    const res = await fetch('/api/platform/paths', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id:         workspaceId,
        title:                title.trim(),
        description:          description.trim() || undefined,
        difficulty,
        estimated_hours:      estimatedHours ? parseInt(estimatedHours) : undefined,
        certificates_enabled: certificatesEnabled,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to create path.'); setSaving(false); return }
    router.push(`/platform/workspaces/${workspaceId}/paths/${data.path.id}`)
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/platform/workspaces/${workspaceId}/paths`} className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-display text-xl font-bold text-white">New Learning Path</h1>
      </div>

      <form onSubmit={submit} className="card p-6 space-y-4">
        <div>
          <label className="label">Path Title</label>
          <input
            className="input"
            placeholder="e.g. Full-Stack Web Development"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">Description <span className="text-slate-500 font-normal">(optional)</span></label>
          <textarea
            className="input min-h-[80px] resize-y"
            placeholder="What will students learn in this path?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
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
            <label className="label">Estimated Hours <span className="text-slate-500 font-normal">(optional)</span></label>
            <input
              type="number"
              min={1}
              className="input"
              placeholder="e.g. 40"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 py-2">
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

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Path
          </button>
          <Link href={`/platform/workspaces/${workspaceId}/paths`} className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
