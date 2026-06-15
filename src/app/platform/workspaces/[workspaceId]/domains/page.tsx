'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams }                        from 'next/navigation'
import { Globe, Plus, Trash2, Star, CheckCircle2, Clock, XCircle, Loader2, Copy, Info } from 'lucide-react'

const STATUS_STYLES: Record<string, string> = {
  verified: 'text-green-400 bg-green-500/10 border-green-500/20',
  pending:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
  failed:   'text-red-400   bg-red-500/10   border-red-500/20',
}
const STATUS_ICONS: Record<string, React.ElementType> = {
  verified: CheckCircle2,
  pending:  Clock,
  failed:   XCircle,
}

export default function DomainsPage() {
  const { workspaceId } = useParams() as { workspaceId: string }
  const [domains,     setDomains]     = useState<any[]>([])
  const [canAdd,      setCanAdd]      = useState(false)
  const [planName,    setPlanName]    = useState('')
  const [loading,     setLoading]     = useState(true)
  const [adding,      setAdding]      = useState(false)
  const [newDomain,   setNewDomain]   = useState('')
  const [addError,    setAddError]    = useState('')
  const [verifying,   setVerifying]   = useState<string | null>(null)
  const [verifyInfo,  setVerifyInfo]  = useState<Record<string, any>>({})
  const [deleting,    setDeleting]    = useState<string | null>(null)
  const [copied,      setCopied]      = useState<string | null>(null)

  const load = useCallback(async () => {
    const res  = await fetch(`/api/platform/domains?workspaceId=${workspaceId}`)
    const json = await res.json()
    setDomains(json.domains ?? [])
    setCanAdd(json.can_use_custom_domain ?? false)
    setPlanName(json.plan_name ?? '')
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const addDomain = async () => {
    if (!newDomain.trim()) return
    setAdding(true)
    setAddError('')
    const res  = await fetch('/api/platform/domains', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, domain: newDomain.trim().toLowerCase() }),
    })
    const json = await res.json()
    setAdding(false)
    if (!res.ok) { setAddError(json.error ?? 'Failed to add domain'); return }
    setNewDomain('')
    load()
  }

  const deleteDomain = async (id: string) => {
    setDeleting(id)
    await fetch(`/api/platform/domains/${id}`, { method: 'DELETE' })
    setDeleting(null)
    load()
  }

  const setPrimary = async (id: string) => {
    await fetch(`/api/platform/domains/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_primary: true }),
    })
    load()
  }

  const requestVerify = async (id: string) => {
    setVerifying(id)
    const res  = await fetch(`/api/platform/domains/${id}/verify`, { method: 'POST' })
    const json = await res.json()
    setVerifying(null)
    if (json.instructions) {
      setVerifyInfo((v) => ({ ...v, [id]: json.instructions }))
    }
    load()
  }

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
          <Globe className="w-6 h-6 text-gold-400" /> Custom Domains
        </h1>
        <p className="text-slate-400 text-sm mt-1">Serve your academy from your own domain.</p>
      </div>

      {!canAdd && (
        <div className="card p-5 border-amber-500/20 bg-amber-500/5">
          <p className="text-sm font-semibold text-amber-400 mb-1">Growth or Pro plan required</p>
          <p className="text-xs text-slate-400">
            You are on the <strong className="text-white capitalize">{planName}</strong> plan.
            Upgrade to Growth or Pro to add custom domains.
          </p>
        </div>
      )}

      {/* Add domain */}
      {canAdd && (
        <div className="card p-5">
          <h2 className="font-semibold text-white text-sm mb-3">Add a Domain</h2>
          <div className="flex gap-2">
            <input
              className="input-field flex-1"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addDomain()}
              placeholder="academy.example.com"
            />
            <button onClick={addDomain} disabled={adding || !newDomain.trim()}
              className="btn-primary flex items-center gap-1.5 shrink-0">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
          </div>
          {addError && <p className="text-xs text-red-400 mt-2">{addError}</p>}
        </div>
      )}

      {/* Domain list */}
      {domains.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <Globe className="w-8 h-8 mx-auto mb-3 opacity-40" />
          No custom domains yet.
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((d) => {
            const StatusIcon = STATUS_ICONS[d.status] ?? Clock
            const info = verifyInfo[d.id]
            return (
              <div key={d.id} className="card p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Globe className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">{d.domain}</span>
                        {d.is_primary && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-400">
                            Primary
                          </span>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border mt-1 ${STATUS_STYLES[d.status] ?? ''}`}>
                        <StatusIcon className="w-3 h-3" />
                        {d.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {d.status === 'verified' && !d.is_primary && (
                      <button onClick={() => setPrimary(d.id)} title="Set as primary"
                        className="p-1.5 text-slate-400 hover:text-gold-400 transition-colors">
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    {d.status === 'pending' && (
                      <button
                        onClick={() => requestVerify(d.id)}
                        disabled={verifying === d.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-navy-700 text-white hover:bg-navy-600 transition-colors disabled:opacity-50"
                      >
                        {verifying === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Verify'}
                      </button>
                    )}
                    <button onClick={() => deleteDomain(d.id)} disabled={deleting === d.id}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors">
                      {deleting === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* DNS instructions */}
                {d.status === 'pending' && (
                  <div className="bg-navy-800/60 rounded-lg p-4 text-xs space-y-2 border border-navy-700">
                    <div className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1">
                      <Info className="w-3.5 h-3.5 text-blue-400" /> DNS Verification Required
                    </div>
                    <p className="text-slate-400">Add this TXT record to your DNS provider, then click <strong>Verify</strong>:</p>
                    <div className="space-y-1.5">
                      {[
                        { label: 'Type',  value: 'TXT' },
                        { label: 'Name',  value: info?.record_name  ?? `_apex-verification.${d.domain}` },
                        { label: 'Value', value: info?.record_value ?? `apex-verification=${d.txt_verification_key}` },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="text-slate-500 w-10 shrink-0">{label}</span>
                          <code className="bg-navy-700 px-2 py-0.5 rounded text-slate-200 flex-1 min-w-0 break-all">{value}</code>
                          <button onClick={() => copyText(value, `${d.id}:${label}`)}
                            className="shrink-0 text-slate-500 hover:text-white">
                            {copied === `${d.id}:${label}` ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {d.status === 'verified' && d.verified_at && (
                  <p className="text-xs text-slate-500">Verified {new Date(d.verified_at).toLocaleDateString()}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* How it works */}
      <div className="card p-5 text-sm space-y-2">
        <h3 className="font-semibold text-white">How custom domains work</h3>
        <ol className="list-decimal list-inside space-y-1.5 text-slate-400 text-xs">
          <li>Add your domain (e.g. <code className="text-slate-300">academy.example.com</code>)</li>
          <li>Add the TXT verification record to your DNS provider</li>
          <li>Click <strong className="text-white">Verify</strong> — DNS changes can take up to 48 hours</li>
          <li>Point a CNAME record from your domain to <code className="text-slate-300">{process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'apexuniversity.com'}</code></li>
          <li>Set as Primary to use it as the main URL for your academy</li>
        </ol>
      </div>
    </div>
  )
}
