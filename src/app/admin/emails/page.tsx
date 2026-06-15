'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock } from 'lucide-react'

const TEMPLATES = [
  'all','creator_welcome','trial_started','trial_ending_soon','subscription_active',
  'subscription_failed','student_welcome','free_enrollment_confirm','paid_receipt',
  'course_access_granted','refund_confirmation',
]

function StatusIcon({ status }: { status: string }) {
  if (status === 'sent')   return <CheckCircle size={14} className="text-green-500" />
  if (status === 'failed') return <XCircle size={14} className="text-red-500" />
  return <Clock size={14} className="text-gray-400" />
}

export default function AdminEmailsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [template, setTemplate] = useState('all')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), status })
    if (search)             params.set('search', search)
    if (template !== 'all') params.set('template', template)
    fetch(`/api/admin/emails?${params}`)
      .then(r => r.json())
      .then(d => { setEvents(d.events ?? []); setTotal(d.total ?? 0) })
      .finally(() => setLoading(false))
  }, [page, search, template, status])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Email Audit</h1>
        <p className="text-sm text-gray-500 mt-1">{total.toLocaleString()} events</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search email…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select value={template} onChange={e => { setTemplate(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {TEMPLATES.map(t => (
            <option key={t} value={t}>{t === 'all' ? 'All templates' : t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {['all','sent','failed'].map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                status === s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Template</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Recipient</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Workspace</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Sent At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">No emails found.</td></tr>
            ) : events.map((e: any) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <StatusIcon status={e.status} />
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <div className="font-mono text-xs text-gray-600">{e.template}</div>
                  {e.error && <div className="text-xs text-red-500 truncate max-w-[200px]">{e.error}</div>}
                </td>
                <td className="px-4 py-3">
                  <div className="text-gray-900 truncate max-w-[180px]">{e.recipient_email}</div>
                  {e.recipient_name && <div className="text-xs text-gray-400 truncate">{e.recipient_name}</div>}
                </td>
                <td className="px-4 py-3 text-gray-500 truncate max-w-[120px]">{e.workspace?.name ?? '—'}</td>
                <td className="px-4 py-3 text-right text-gray-400">
                  {new Date(e.created_at).toLocaleString()}
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
