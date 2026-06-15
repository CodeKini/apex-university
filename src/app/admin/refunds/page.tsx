'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function AdminRefundsPage() {
  const [purchases, setPurchases] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/purchases?status=refunded&page=${page}`)
      .then(r => r.json())
      .then(d => { setPurchases(d.purchases ?? []); setTotal(d.total ?? 0) })
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])

  const totalRefunded = purchases.reduce((s, p) => s + (p.amount_cents ?? 0), 0)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Refunds</h1>
        <p className="text-sm text-gray-500 mt-1">
          {total.toLocaleString()} refunds ·{' '}
          {total > 0 && `$${(totalRefunded / 100).toFixed(2)} on this page`}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Course</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Buyer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Workspace</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Amount</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Refunded At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : purchases.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">No refunds yet.</td></tr>
            ) : purchases.map((p: any) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.course?.title ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700 truncate max-w-[160px]">{p.buyer?.email ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700 truncate max-w-[120px]">{p.workspace?.name ?? '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  ${((p.amount_cents ?? 0) / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-gray-400">
                  {p.refunded_at ? new Date(p.refunded_at).toLocaleDateString() : '—'}
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
