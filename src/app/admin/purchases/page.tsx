'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

const STATUS_TABS = ['all', 'completed', 'refunded', 'pending']

function statusBadge(s: string) {
  const m: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    refunded:  'bg-gray-100 text-gray-500',
    pending:   'bg-amber-100 text-amber-700',
    failed:    'bg-red-100 text-red-700',
  }
  return m[s] ?? 'bg-gray-100 text-gray-500'
}

export default function AdminPurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), status })
    if (search) params.set('search', search)
    fetch(`/api/admin/purchases?${params}`)
      .then(r => r.json())
      .then(d => { setPurchases(d.purchases ?? []); setTotal(d.total ?? 0) })
      .finally(() => setLoading(false))
  }, [page, search, status])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
        <p className="text-sm text-gray-500 mt-1">{total.toLocaleString()} total</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search payment intent ID…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-1">
          {STATUS_TABS.map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                status === s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Course</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Buyer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Workspace</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Amount</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : purchases.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No purchases found.</td></tr>
            ) : purchases.map((p: any) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.course?.title ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700">
                  <div className="truncate max-w-[150px]">{p.buyer?.email ?? '—'}</div>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <div className="truncate max-w-[120px]">{p.workspace?.name ?? '—'}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(p.status)}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  ${((p.amount_cents ?? 0) / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-gray-400">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {total > 25 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 25)}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-white">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 25 >= total}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-white">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
