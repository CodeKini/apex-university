'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams }                         from 'next/navigation'
import { useToast }                          from '@/hooks/useToast'
import { ToastStack }                        from '@/components/ui/ToastStack'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Sale {
  id:                    string
  user_id:               string
  amount_cents:          number
  currency:              string
  status:                'completed' | 'refunded' | 'pending'
  created_at:            string
  stripe_payment_intent: string | null
  courses: { id: string; title: string; slug: string } | null
  buyer:   { full_name: string | null; email: string; avatar_url: string | null } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMoney(cents: number, currency: string) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: currency.toUpperCase() })
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  refunded:  'bg-red-100   text-red-800',
  pending:   'bg-amber-100 text-amber-800',
}

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  if (url) return <img src={url} alt="" className="w-8 h-8 rounded-full object-cover" />
  const initials = (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">
      {initials}
    </div>
  )
}

// ── Refund confirm modal ──────────────────────────────────────────────────────

function RefundModal({
  sale,
  onCancel,
  onConfirm,
  busy,
}: {
  sale:      Sale
  onCancel:  () => void
  onConfirm: () => void
  busy:      boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Issue refund?</h2>
        <p className="text-sm text-gray-600 mb-1">
          Refund <strong>{fmtMoney(sale.amount_cents, sale.currency)}</strong> to{' '}
          <strong>{sale.buyer?.full_name ?? sale.buyer?.email ?? 'this student'}</strong>?
        </p>
        <p className="text-sm text-gray-500 mb-5">
          Course: <em>{sale.courses?.title}</em>. Their enrollment will be revoked and they'll
          receive a confirmation email. This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center gap-2"
          >
            {busy && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {busy ? 'Processing…' : 'Issue Refund'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SalesPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { toasts, show, dismiss } = useToast()

  const [sales,        setSales]       = useState<Sale[]>([])
  const [loading,      setLoading]     = useState(true)
  const [error,        setError]       = useState<string | null>(null)
  const [statusFilter, setFilter]      = useState<'all' | 'completed' | 'refunded'>('all')
  const [search,       setSearch]      = useState('')
  const [refundTarget, setRefundTarget] = useState<Sale | null>(null)
  const [refunding,    setRefunding]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/platform/sales?workspaceId=${workspaceId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load sales')
      setSales(json.sales ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const issueRefund = async () => {
    if (!refundTarget) return
    setRefunding(true)
    try {
      const res  = await fetch('/api/platform/sales/refund', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ workspaceId, purchaseId: refundTarget.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Refund failed')

      setSales(prev => prev.map(s =>
        s.id === refundTarget.id ? { ...s, status: 'refunded' } : s
      ))
      setRefundTarget(null)
      show('Refund issued successfully. Student has been notified.', 'success')
    } catch (e: any) {
      show(e.message ?? 'Refund failed', 'error')
    } finally {
      setRefunding(false)
    }
  }

  // Totals
  const totalRevenue  = sales.filter(s => s.status === 'completed').reduce((n, s) => n + s.amount_cents, 0)
  const totalRefunded = sales.filter(s => s.status === 'refunded' ).reduce((n, s) => n + s.amount_cents, 0)

  // Filtered list
  const filtered = sales.filter(s => {
    const q      = search.toLowerCase()
    const buyer  = s.buyer
    const matchQ = !q
      || buyer?.full_name?.toLowerCase().includes(q)
      || buyer?.email?.toLowerCase().includes(q)
      || s.courses?.title?.toLowerCase().includes(q)
    const matchS = statusFilter === 'all' || s.status === statusFilter
    return matchQ && matchS
  })

  if (loading) return <div className="p-8 text-center text-gray-500">Loading sales…</div>
  if (error)   return <div className="p-8 text-center text-red-600">{error}</div>

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <ToastStack toasts={toasts} dismiss={dismiss} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales & Refunds</h1>
          <p className="text-sm text-gray-500 mt-1">{sales.length} total transactions</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Gross Revenue</p>
          <p className="text-xl font-bold text-gray-900">
            {fmtMoney(totalRevenue + totalRefunded, 'usd')}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Net Revenue</p>
          <p className="text-xl font-bold text-green-700">{fmtMoney(totalRevenue, 'usd')}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Refunded</p>
          <p className="text-xl font-bold text-red-600">{fmtMoney(totalRefunded, 'usd')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          type="text"
          placeholder="Search by student, course…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex gap-1">
          {(['all', 'completed', 'refunded'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Course</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">No transactions found</td>
              </tr>
            )}
            {filtered.map(sale => (
              <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={sale.buyer?.full_name ?? null} url={sale.buyer?.avatar_url ?? null} />
                    <div>
                      <div className="font-medium text-gray-900 text-xs">{sale.buyer?.full_name ?? '—'}</div>
                      <div className="text-gray-500 text-xs">{sale.buyer?.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">
                  {sale.courses?.title ?? '—'}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {fmtMoney(sale.amount_cents, sale.currency)}
                </td>
                <td className="px-4 py-3 text-gray-500">{fmt(sale.created_at)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[sale.status] ?? ''}`}>
                    {sale.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {sale.status === 'completed' && sale.stripe_payment_intent && (
                    <button
                      onClick={() => setRefundTarget(sale)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Refund
                    </button>
                  )}
                  {sale.status === 'refunded' && (
                    <span className="text-xs text-gray-400">Refunded</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Refund confirm modal */}
      {refundTarget && (
        <RefundModal
          sale={refundTarget}
          onCancel={() => setRefundTarget(null)}
          onConfirm={issueRefund}
          busy={refunding}
        />
      )}
    </div>
  )
}
