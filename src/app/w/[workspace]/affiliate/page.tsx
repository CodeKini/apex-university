'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useWorkspace } from '@/lib/workspace/context'
import {
  TrendingUp, MousePointerClick, Users, DollarSign,
  Copy, CheckCircle2, Loader2, Clock, Link2, ExternalLink,
} from 'lucide-react'

const COMM_STATUS_COLORS: Record<string, string> = {
  pending:  'text-amber-400  bg-amber-500/10  border-amber-500/20',
  approved: 'text-blue-400   bg-blue-500/10   border-blue-500/20',
  paid:     'text-green-400  bg-green-500/10  border-green-500/20',
  rejected: 'text-red-400    bg-red-500/10    border-red-500/20',
}

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}` }

export default function AffiliateDashboardPage() {
  const params   = useParams()
  const router   = useRouter()
  const workSlug = params.workspace as string
  const { workspace } = useWorkspace()
  const supabase = createClientComponentClient()

  const [data,      setData]      = useState<any>(null)
  const [loading,   setLoading]   = useState(true)
  const [applying,  setApplying]  = useState(false)
  const [copied,    setCopied]    = useState(false)

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push(`/w/${workSlug}/auth/login`); return }
    const res  = await fetch(`/api/affiliate/me?workspaceId=${workspace.id}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [workspace.id, workSlug])

  useEffect(() => { fetchData() }, [fetchData])

  const apply = async () => {
    setApplying(true)
    const res  = await fetch('/api/affiliate/apply', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: workspace.id }),
    })
    setApplying(false)
    if (res.ok) fetchData()
  }

  const referralUrl = data?.affiliate
    ? `${location.origin}/w/${workSlug}?ref=${data.affiliate.referral_code}`
    : null

  const copyLink = () => {
    if (!referralUrl) return
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) return (
    <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
  )

  const program   = data?.program
  const affiliate = data?.affiliate

  // Program not enabled
  if (!program?.is_enabled) return (
    <div className="max-w-xl mx-auto px-6 py-20 text-center">
      <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-4" />
      <h1 className="font-display text-2xl font-bold text-white mb-2">Affiliate Program</h1>
      <p className="text-slate-400">The affiliate program for this workspace is not currently active.</p>
    </div>
  )

  // Not yet applied
  if (!affiliate) return (
    <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-6">
      <TrendingUp className="w-12 h-12 text-gold-400 mx-auto" />
      <div>
        <h1 className="font-display text-2xl font-bold text-white mb-2">Join the Affiliate Program</h1>
        <p className="text-slate-400">Earn {program.commission_pct}% commission on every sale you refer.</p>
      </div>
      <div className="card p-5 text-left space-y-3 text-sm">
        <div className="flex items-center gap-2 text-slate-300"><CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" /> {program.commission_pct}% commission per sale</div>
        <div className="flex items-center gap-2 text-slate-300"><CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" /> {program.cookie_duration_days}-day tracking cookie</div>
        {program.approval_required && (
          <div className="flex items-center gap-2 text-slate-300"><Clock className="w-4 h-4 text-amber-400 shrink-0" /> Approval required — we'll review your application</div>
        )}
        {program.payout_notes && (
          <div className="flex items-start gap-2 text-slate-400 text-xs border-t border-navy-800 pt-3 mt-3">
            <span className="shrink-0 font-semibold text-slate-500">Payouts:</span> {program.payout_notes}
          </div>
        )}
      </div>
      <button onClick={apply} disabled={applying} className="btn-primary mx-auto flex items-center gap-2 px-8">
        {applying ? <><Loader2 className="w-4 h-4 animate-spin" /> Applying…</> : 'Apply Now'}
      </button>
    </div>
  )

  // Pending approval
  if (affiliate.status === 'pending') return (
    <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-4">
      <Clock className="w-12 h-12 text-amber-400 mx-auto" />
      <h1 className="font-display text-2xl font-bold text-white">Application Submitted</h1>
      <p className="text-slate-400">Your application is pending review. You'll be notified once approved.</p>
    </div>
  )

  // Rejected / suspended
  if (['rejected','suspended'].includes(affiliate.status)) return (
    <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-4">
      <h1 className="font-display text-2xl font-bold text-white capitalize">{affiliate.status}</h1>
      <p className="text-slate-400">Your affiliate application has been {affiliate.status}. Contact support for help.</p>
    </div>
  )

  // Approved affiliate dashboard
  const commissions = data?.commissions ?? []
  const payouts     = data?.payouts ?? []

  const pendingCents  = commissions.filter((c: any) => c.status === 'pending').reduce((s: number, c: any) => s + c.commission_cents, 0)
  const approvedCents = commissions.filter((c: any) => c.status === 'approved').reduce((s: number, c: any) => s + c.commission_cents, 0)
  const paidCents     = commissions.filter((c: any) => c.status === 'paid').reduce((s: number, c: any) => s + c.commission_cents, 0)

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-white">Affiliate Dashboard</h1>
        <p className="text-slate-400 mt-1">Earn {program?.commission_pct}% commission per sale.</p>
      </div>

      {/* Referral link */}
      <div className="card p-5">
        <h2 className="font-semibold text-white text-sm mb-3 flex items-center gap-2"><Link2 className="w-4 h-4 text-gold-400" /> Your Referral Link</h2>
        <div className="flex gap-2">
          <input
            readOnly
            value={referralUrl ?? ''}
            className="input-field flex-1 font-mono text-sm text-slate-300 bg-navy-800/60"
          />
          <button onClick={copyLink} className="btn-primary flex items-center gap-2 px-4 shrink-0">
            {copied ? <><CheckCircle2 className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
          </button>
        </div>
        <p className="text-slate-500 text-xs mt-2">Share this link. Anyone who signs up within {program?.cookie_duration_days} days and purchases will earn you a commission.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Clicks',           value: affiliate.total_clicks,    icon: MousePointerClick },
          { label: 'Signups',          value: affiliate.total_signups,   icon: Users },
          { label: 'Purchases',        value: affiliate.total_purchases, icon: TrendingUp },
          { label: 'Total Earned',     value: fmt(affiliate.total_earned_cents), icon: DollarSign },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</span>
              <s.icon className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Earnings breakdown */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: 'Pending Review',  value: fmt(pendingCents),  color: 'text-amber-400' },
          { label: 'Approved',        value: fmt(approvedCents), color: 'text-blue-400'  },
          { label: 'Paid Out',        value: fmt(paidCents),     color: 'text-green-400' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Payout info */}
      {program?.payout_notes && (
        <div className="card p-4 text-sm text-slate-400 border-l-2 border-gold-500/40">
          <span className="font-semibold text-slate-300">Payout info: </span>{program.payout_notes}
        </div>
      )}

      {/* Commission history */}
      {commissions.length > 0 && (
        <div>
          <h2 className="font-semibold text-white mb-3">Commission History</h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-800 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Source</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Sale</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Commission</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60">
                {commissions.map((c: any) => (
                  <tr key={c.id} className="hover:bg-navy-800/20">
                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 capitalize text-slate-300">{c.source_type}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{fmt(c.purchase_amount_cents)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-white">{fmt(c.commission_cents)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${COMM_STATUS_COLORS[c.status] ?? ''}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payout history */}
      {payouts.length > 0 && (
        <div>
          <h2 className="font-semibold text-white mb-3">Payout History</h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-800 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Amount</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60">
                {payouts.map((p: any) => (
                  <tr key={p.id} className="hover:bg-navy-800/20">
                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(p.paid_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-400">{fmt(p.amount_cents)}</td>
                    <td className="px-4 py-3 text-slate-400">{p.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
