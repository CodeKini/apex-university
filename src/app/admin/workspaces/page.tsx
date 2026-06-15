'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

const STATUS_TABS = ['all', 'trialing', 'active', 'past_due', 'canceled']

function badge(status: string) {
  const map: Record<string, string> = {
    trialing:  'bg-amber-100 text-amber-700',
    active:    'bg-green-100 text-green-700',
    past_due:  'bg-red-100 text-red-700',
    canceled:  'bg-gray-100 text-gray-600',
  }
  return map[status] ?? 'bg-gray-100 text-gray-500'
}

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), status })
    if (search) params.set('search', search)
    fetch(`/api/admin/workspaces?${params}`)
      .then(r => r.json())
      .then(d => { setWorkspaces(d.workspaces ?? []); setTotal(d.total ?? 0) })
      .finally(() => setLoading(false))
  }, [page, search, status])

  useEffect(() => { load() }, [load])

  async function toggleSuspend(ws: any) {
    const action = ws.suspended_at ? 'reactivate' : 'suspend'
    setActing(ws.id)
    await fetch('/api/admin/workspaces', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: ws.id, action }),
    })
    setActing(null)
    load()
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
        <p className="text-sm text-gray-500 mt-1">{total.toLocaleString()} total</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name or slug…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-1">
          {STATUS_TABS.map(s => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                status === s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Workspace</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Owner</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Plan</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Courses / Students</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : workspaces.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No workspaces found.</td></tr>
            ) : workspaces.map((ws: any) => (
              <tr key={ws.id} className={`hover:bg-gray-50 ${ws.suspended_at ? 'opacity-60' : ''}`}>
                <td className="px-4 py-3">
                  <Link href={`/admin/workspaces/${ws.id}`} className="font-medium text-gray-900 hover:text-indigo-600">{ws.name}</Link>
                  <div className="text-xs text-gray-400">{ws.slug}</div>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <div className="truncate max-w-[160px]">{ws.owner?.email ?? '—'}</div>
                </td>
                <td className="px-4 py-3 capitalize text-gray-700">{ws.plan_name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${badge(ws.plan_status)}`}>
                    {ws.suspended_at ? 'suspended' : (ws.plan_status ?? '—')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {ws.course_count} / {ws.seats_used}
                </td>
                <td className="px-4 py-3 text-right text-gray-400">
                  {new Date(ws.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleSuspend(ws)}
                    disabled={acting === ws.id}
                    className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                      ws.suspended_at
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {acting === ws.id ? '…' : ws.suspended_at ? 'Reactivate' : 'Suspend'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {total > 25 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-sm text-gray-500">
              Page {page} of {Math.ceil(total / 25)}
            </span>
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
