'use client'

import { useEffect, useState, useCallback } from 'react'
import { Award, Download, ExternalLink, Search, ChevronLeft, ChevronRight } from 'lucide-react'

// Admin uses the same platform certificates endpoint — the requirePlatformAdmin guard
// in the API already allows platform admins to query any workspace.
// We query without workspaceId to get all, but that endpoint requires workspaceId.
// Instead we use the admin purchases pattern: call the service-role backed endpoint.

export default function AdminCertificatesPage() {
  const [certs,   setCerts]   = useState<any[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set('search', search)
    fetch(`/api/admin/certificates?${params}`)
      .then(r => r.json())
      .then(d => { setCerts(d.certificates ?? []); setTotal(d.total ?? 0) })
      .finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Award size={20} className="text-indigo-600" /> Certificates
        </h1>
        <p className="text-sm text-gray-500 mt-1">{total.toLocaleString()} issued across all workspaces</p>
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search student name or course…"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Student</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Course</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Workspace</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Code</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Issued</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : certs.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No certificates found.</td></tr>
            ) : certs.map((c: any) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.student_name}</td>
                <td className="px-4 py-3 text-gray-700">{c.course_title}</td>
                <td className="px-4 py-3 text-gray-500">{c.workspace_name}</td>
                <td className="px-4 py-3 font-mono text-xs text-indigo-600">{c.verification_code}</td>
                <td className="px-4 py-3 text-right text-gray-400">
                  {new Date(c.issued_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 justify-end">
                    {c.storage_url && (
                      <a href={c.storage_url} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Download PDF">
                        <Download size={13} />
                      </a>
                    )}
                    <a href={`/verify/${c.verification_code}`} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Verify">
                      <ExternalLink size={13} />
                    </a>
                  </div>
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
