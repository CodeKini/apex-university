'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Users, TrendingUp, DollarSign, CheckCircle2, XCircle, Clock,
  Settings, ChevronDown, ChevronUp, Loader2, AlertCircle, Copy, Ban,
} from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pending:   'text-amber-400  bg-amber-500/10  border-amber-500/20',
  approved:  'text-green-400  bg-green-500/10  border-green-500/20',
  rejected:  'text-red-400    bg-red-500/10    border-red-500/20',
  suspended: 'text-slate-400  bg-slate-800/50  border-slate-700',
}
const COMM_STATUS_COLORS: Record<string, string> = {
  pending:  'text-amber-400  bg-amber-500/10  border-amber-500/20',
  approved: 'text-blue-400   bg-blue-500/10   border-blue-500/20',
  paid:     'text-green-400  bg-green-500/10  border-green-500/20',
  rejected: 'text-red-400    bg-red-500/10    border-red-500/20',
}

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function AffiliatesCreatorPage() {
  const params      = useParams()
  const workspaceId = params.workspaceId as string

  const [program,     setProgram]     = useState<any>(null)
  const [affiliates,  setAffiliates]  = useState<any[]>([])
  const [commissions, setCommissions] = useState<any[]>([])
  const [tab,         setTab]         = useState<'affiliates' | 'commissions' | 'settings'>('affiliates')
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState<string | null>(null)
  const [progForm,    setProgForm]    = useState({
    is_enabled:           false,
    commission_pct:       20,
    cookie_duration_days: 30,
    approval_required:    true,
    payout_notes:         '',
  })

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    const [pRes, aRes, cRes] = await Promise.all([
      fetch(`/api/platform/affiliate-program?workspaceId=${workspaceId}`),
      fetch(`/api/platform/affiliates?workspaceId=${workspaceId}`),
      fetch(`/api/platform/commissions?workspaceId=${workspaceId}`),
    ])
    const [pData, aData, cData] = await Promise.all([pRes.json(), aRes.json(), cRes.json()])
    setAffiliates(aData.affiliates ?? [])
    setCommissions(cData.commissions ?? [])
    if (pData.program) {
      setProgram(pData.program)
      setProgForm({
        is_enabled:           pData.program.is_enabled,
        commission_pct:       pData.program.commission_pct,
        cookie_duration_days: pData.program.cookie_duration_days,
        approval_required:    pData.program.approval_required,
        payout_notes:         pData.program.payout_notes ?? '',
      })
    }
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const saveProgram = async () => {
    setSaving(true)
    const res = await fetch(`/api/platform/affiliate-program?workspaceId=${workspaceId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...progForm,
        commission_pct:       Number(progForm.commission_pct),
        cookie_duration_days: Number(progForm.cookie_duration_days),
        payout_notes:         progForm.payout_notes.trim() || null,
      }),
    })
    setSaving(false)
    if (res.ok) { const d = await res.json(); setProgram(d.program); showToast('Settings saved!') }
  }

  const updateAffiliate = async (id: string, status: string, rejection_note?: string) => {
    const res = await fetch(`/api/platform/affiliates/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rejection_note: rejection_note ?? null }),
    })
    if (res.ok) {
      const d = await res.json()
      setAffiliates((prev) => prev.map((a) => a.id === id ? { ...a, ...d.affiliate } : a))
      showToast(`Affiliate ${status}!`)
    }
  }

  const updateCommission = async (id: string, status: string) => {
    const res = await fetch(`/api/platform/commissions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const d = await res.json()
      setCommissions((prev) => prev.map((c) => c.id === id ? { ...c, ...d.commission } : c))
      showToast(`Commission ${status}!`)
    }
  }

  const totalEarned   = commissions.filter((c) => c.status === 'paid').reduce((s, c) => s + c.commission_cents, 0)
  const totalPending  = commissions.filter((c) => c.status === 'pending').reduce((s, c) => s + c.commission_cents, 0)
  const approvedCount = affiliates.filter((a) => a.status === 'approved').length
  const pendingCount  = affiliates.filter((a) => a.status === 'pending').length

  if (loading) return <div className="py-20 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-500 inline" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Affiliate Program</h1>
          <p className="text-slate-400 text-sm mt-1">Manage referral affiliates and commissions.</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${program?.is_enabled ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-slate-500 bg-navy-800 border-navy-700'}`}>
          {program?.is_enabled ? 'Program Active' : 'Program Disabled'}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Affiliates', value: approvedCount,       icon: Users },
          { label: 'Pending Approval',  value: pendingCount,        icon: Clock,        warn: pendingCount > 0 },
          { label: 'Pending Payouts',   value: fmt(totalPending),   icon: DollarSign,   warn: totalPending > 0 },
          { label: 'Total Paid Out',    value: fmt(totalEarned),    icon: TrendingUp },
        ].map((s) => (
          <div key={s.label} className={`card p-4 ${s.warn ? 'border-amber-500/30' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.warn ? 'text-amber-400' : 'text-slate-500'}`} />
            </div>
            <p className={`text-xl font-bold ${s.warn ? 'text-amber-400' : 'text-white'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-navy-800">
        {(['affiliates','commissions','settings'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm capitalize transition-colors border-b-2 -mb-px ${tab === t ? 'border-gold-500 text-gold-400 font-medium' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {t}
            {t === 'affiliates' && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-navy-950 text-xs rounded-full px-1.5 py-0.5 font-bold">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── AFFILIATES TAB ──────────────────────────────────────────────────── */}
      {tab === 'affiliates' && (
        affiliates.length === 0 ? (
          <div className="card p-16 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-slate-400">No affiliates yet.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-800 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Affiliate</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Code</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Clicks</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Sales</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Earned</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60">
                {affiliates.map((a) => (
                  <tr key={a.id} className="hover:bg-navy-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{a.user?.full_name ?? 'Unknown'}</p>
                      <p className="text-slate-500 text-xs">{a.user?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-gold-400 text-xs bg-navy-800 px-2 py-0.5 rounded">{a.referral_code}</code>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{a.total_clicks}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{a.total_purchases}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{fmt(a.total_earned_cents)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[a.status] ?? ''}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        {a.status === 'pending' && (
                          <>
                            <button onClick={() => updateAffiliate(a.id, 'approved')}
                              className="btn-ghost p-1.5 text-green-400" title="Approve">
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => updateAffiliate(a.id, 'rejected')}
                              className="btn-ghost p-1.5 text-red-400" title="Reject">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {a.status === 'approved' && (
                          <button onClick={() => updateAffiliate(a.id, 'suspended')}
                            className="btn-ghost p-1.5 text-slate-400" title="Suspend">
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                        {a.status === 'suspended' && (
                          <button onClick={() => updateAffiliate(a.id, 'approved')}
                            className="btn-ghost p-1.5 text-green-400" title="Reinstate">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── COMMISSIONS TAB ─────────────────────────────────────────────────── */}
      {tab === 'commissions' && (
        commissions.length === 0 ? (
          <div className="card p-16 text-center space-y-2">
            <DollarSign className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-slate-400">No commissions yet.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-800 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Affiliate</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Source</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Sale</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Commission</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60">
                {commissions.map((c) => (
                  <tr key={c.id} className="hover:bg-navy-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{c.affiliate?.user?.full_name ?? '—'}</p>
                      <code className="text-slate-500 text-xs">{c.affiliate?.referral_code}</code>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-400">{c.source_type}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{fmt(c.purchase_amount_cents)}</td>
                    <td className="px-4 py-3 text-right font-medium text-white">{fmt(c.commission_cents)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${COMM_STATUS_COLORS[c.status] ?? ''}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        {c.status === 'pending' && (
                          <button onClick={() => updateCommission(c.id, 'approved')}
                            className="btn-ghost text-xs px-2 py-1 text-blue-400">
                            Approve
                          </button>
                        )}
                        {c.status === 'approved' && (
                          <button onClick={() => updateCommission(c.id, 'paid')}
                            className="btn-ghost text-xs px-2 py-1 text-green-400">
                            Mark Paid
                          </button>
                        )}
                        {['pending','approved'].includes(c.status) && (
                          <button onClick={() => updateCommission(c.id, 'rejected')}
                            className="btn-ghost text-xs px-2 py-1 text-red-400">
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── SETTINGS TAB ────────────────────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="card p-6 max-w-lg space-y-5">
          <h2 className="font-semibold text-white">Program Settings</h2>

          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={progForm.is_enabled}
                onChange={(e) => setProgForm((f) => ({ ...f, is_enabled: e.target.checked }))} />
              <div className={`w-10 h-5 rounded-full transition-colors ${progForm.is_enabled ? 'bg-gold-500' : 'bg-navy-700'}`} />
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${progForm.is_enabled ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-slate-300 text-sm">Enable affiliate program</span>
          </label>

          <div>
            <label className="label">Commission % <span className="text-slate-500">(paid to affiliate per sale)</span></label>
            <div className="flex items-center gap-2">
              <input type="number" min="1" max="100" step="0.5" className="input-field w-28"
                value={progForm.commission_pct}
                onChange={(e) => setProgForm((f) => ({ ...f, commission_pct: Number(e.target.value) }))} />
              <span className="text-slate-400">%</span>
            </div>
          </div>

          <div>
            <label className="label">Cookie Duration <span className="text-slate-500">(days)</span></label>
            <div className="flex items-center gap-2">
              <input type="number" min="1" max="365" className="input-field w-28"
                value={progForm.cookie_duration_days}
                onChange={(e) => setProgForm((f) => ({ ...f, cookie_duration_days: Number(e.target.value) }))} />
              <span className="text-slate-400">days</span>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="accent-gold-500"
              checked={progForm.approval_required}
              onChange={(e) => setProgForm((f) => ({ ...f, approval_required: e.target.checked }))} />
            <span className="text-slate-300 text-sm">Require approval before affiliates can earn</span>
          </label>

          <div>
            <label className="label">Payout Instructions <span className="text-slate-500">(shown to affiliates)</span></label>
            <textarea className="input-field resize-none" rows={3}
              placeholder="e.g. PayPal payments processed on the 1st of each month, minimum $50"
              value={progForm.payout_notes}
              onChange={(e) => setProgForm((f) => ({ ...f, payout_notes: e.target.value }))} />
          </div>

          <button onClick={saveProgram} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Settings'}
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm shadow-xl bg-green-500/10 border border-green-500/30 text-green-400">
          {toast}
        </div>
      )}
    </div>
  )
}
