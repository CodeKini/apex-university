'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'

function fmt(bytes: number) {
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function EnvRow({ name, status }: { name: string; status: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="font-mono text-xs text-gray-600">{name}</span>
      {status === 'ok' ? (
        <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle size={13} /> OK</span>
      ) : status === 'missing' ? (
        <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><XCircle size={13} /> Missing</span>
      ) : (
        <span className="flex items-center gap-1 text-xs text-amber-600 font-medium"><AlertTriangle size={13} /> Placeholder</span>
      )}
    </div>
  )
}

export default function AdminSystemPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    fetch('/api/admin/system').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )

  const { db, envChecks, recentEmailErrors } = data ?? {}

  const allEnvOk = envChecks && Object.values(envChecks).every((v: any) => v === 'ok')

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-sm text-gray-500 mt-1">Environment configuration and platform metrics</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* DB counts */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Workspaces', value: db?.workspaces ?? 0 },
          { label: 'Students',   value: db?.students   ?? 0 },
          { label: 'Courses',    value: db?.courses    ?? 0 },
          { label: 'Purchases',  value: db?.purchases  ?? 0 },
          { label: 'Storage',    value: fmt(db?.totalStorageBytes ?? 0) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{String(value)}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Env checks */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Environment Variables</h2>
          {allEnvOk
            ? <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle size={13} /> All configured</span>
            : <span className="text-xs text-amber-600 font-medium flex items-center gap-1"><AlertTriangle size={13} /> Issues detected</span>
          }
        </div>
        <div className="px-5 py-1">
          {envChecks && Object.entries(envChecks).map(([name, status]: any) => (
            <EnvRow key={name} name={name} status={status} />
          ))}
        </div>
      </div>

      {/* Recent email errors */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Email Failures</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {(recentEmailErrors ?? []).map((e: any) => (
            <div key={e.id} className="px-5 py-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-gray-600">{e.template}</span>
                <span className="text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</span>
              </div>
              {e.error && <div className="text-xs text-red-500 mt-0.5">{e.error}</div>}
            </div>
          ))}
          {(!recentEmailErrors || recentEmailErrors.length === 0) && (
            <div className="px-5 py-4 text-sm text-gray-400 flex items-center gap-2">
              <CheckCircle size={14} className="text-green-500" /> No recent email failures.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
