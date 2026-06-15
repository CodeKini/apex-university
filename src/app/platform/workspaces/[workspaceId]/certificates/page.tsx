'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Award, Download, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'

export default function WorkspaceCertificatesPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [certs, setCerts] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/platform/certificates?workspaceId=${workspaceId}&page=${page}`)
      .then(r => r.json())
      .then(d => { setCerts(d.certificates ?? []); setTotal(d.total ?? 0) })
      .finally(() => setLoading(false))
  }, [workspaceId, page])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-gold-400" /> Certificates
          </h1>
          <p className="text-slate-400 text-sm mt-1">{total.toLocaleString()} issued</p>
        </div>
      </div>

      {loading ? (
        <div className="card py-16 text-center text-slate-500 text-sm">Loading…</div>
      ) : certs.length === 0 ? (
        <div className="card py-16 text-center">
          <Award className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No certificates issued yet.</p>
          <p className="text-slate-500 text-xs mt-1">
            Enable certificates on a course and students will receive them on completion.
          </p>
        </div>
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-navy-700">
                <tr>
                  <th className="text-left px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">Student</th>
                  <th className="text-left px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">Course</th>
                  <th className="text-left px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">Issued</th>
                  <th className="text-left px-5 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">Code</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800">
                {certs.map((c: any) => (
                  <tr key={c.id} className="hover:bg-navy-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-white">{c.student_name}</td>
                    <td className="px-5 py-3.5 text-slate-300">{c.course_title}</td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {new Date(c.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-gold-400">{c.verification_code}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        {c.storage_url && (
                          <a href={c.storage_url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-navy-700 transition-colors"
                            title="Download PDF">
                            <Download size={14} />
                          </a>
                        )}
                        <a
                          href={`/verify/${c.verification_code}`}
                          target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-navy-700 transition-colors"
                          title="View verification page">
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > 25 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-slate-400">Page {page} of {Math.ceil(total / 25)}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                  className="p-1.5 rounded border border-navy-700 text-slate-400 disabled:opacity-40 hover:text-white">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => setPage(p => p + 1)} disabled={page * 25 >= total}
                  className="p-1.5 rounded border border-navy-700 text-slate-400 disabled:opacity-40 hover:text-white">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
