'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Building2, Users, BookOpen, ShoppingBag, AlertTriangle } from 'lucide-react'

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export default function AdminWorkspaceDetailPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/workspaces/${workspaceId}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [workspaceId])

  async function toggleSuspend() {
    if (!data?.workspace) return
    const action = data.workspace.suspended_at ? 'reactivate' : 'suspend'
    setActing(true)
    await fetch('/api/admin/workspaces', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, action }),
    })
    const fresh = await fetch(`/api/admin/workspaces/${workspaceId}`).then(r => r.json())
    setData(fresh)
    setActing(false)
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )

  const { workspace, members, courses, purchases } = data ?? {}
  if (!workspace) return <div className="p-8 text-gray-500">Workspace not found.</div>

  const totalRev = (purchases ?? []).reduce((s: number, p: any) => s + (p.status === 'completed' ? p.amount_cents : 0), 0)

  return (
    <div className="p-8 max-w-5xl">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft size={14} /> Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{workspace.name}</h1>
          <p className="text-sm text-gray-400">{workspace.slug} · ID: {workspace.id}</p>
        </div>
        <button
          onClick={toggleSuspend} disabled={acting}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            workspace.suspended_at
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {acting ? '…' : workspace.suspended_at ? 'Reactivate Workspace' : 'Suspend Workspace'}
        </button>
      </div>

      {workspace.suspended_at && (
        <div className="mb-5 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={15} />
          Suspended on {new Date(workspace.suspended_at).toLocaleString()}
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Building2, label: 'Plan',     value: `${workspace.plan_name ?? '—'} (${workspace.plan_status ?? '—'})` },
          { icon: Users,     label: 'Students', value: workspace.seats_used ?? 0 },
          { icon: BookOpen,  label: 'Courses',  value: courses?.length ?? 0 },
          { icon: ShoppingBag, label: 'Revenue', value: `$${(totalRev / 100).toFixed(2)}` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className="font-semibold text-gray-900 text-sm">{String(value)}</div>
          </div>
        ))}
      </div>

      {/* Owner + billing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Owner</h2>
          <div className="text-sm text-gray-700">{workspace.owner?.full_name ?? '—'}</div>
          <div className="text-sm text-gray-400">{workspace.owner?.email}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Billing</h2>
          <div className="text-xs text-gray-400 space-y-1">
            <div>Stripe Customer: <span className="font-mono text-gray-700">{workspace.stripe_customer_id ?? '—'}</span></div>
            <div>Subscription: <span className="font-mono text-gray-700">{workspace.stripe_subscription_id ?? '—'}</span></div>
            <div>Storage: <span className="text-gray-700">{fmt(workspace.storage_used_bytes ?? 0)}</span></div>
            {workspace.trial_ends_at && (
              <div>Trial ends: <span className="text-gray-700">{new Date(workspace.trial_ends_at).toLocaleDateString()}</span></div>
            )}
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Members <span className="text-gray-400 font-normal">({members?.length})</span></h2>
        </div>
        <div className="divide-y divide-gray-50">
          {(members ?? []).map((m: any) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-medium">
                {(m.full_name || m.email || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{m.full_name || '—'}</div>
                <div className="text-gray-400 text-xs truncate">{m.email}</div>
              </div>
              <span className="ml-auto text-xs capitalize text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{m.role}</span>
            </div>
          ))}
          {(!members || members.length === 0) && (
            <div className="px-5 py-4 text-sm text-gray-400">No members.</div>
          )}
        </div>
      </div>

      {/* Courses */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Courses <span className="text-gray-400 font-normal">({courses?.length})</span></h2>
        </div>
        <div className="divide-y divide-gray-50">
          {(courses ?? []).map((c: any) => (
            <div key={c.id} className="flex items-center px-5 py-3 text-sm">
              <div className="font-medium text-gray-900">{c.title}</div>
              <span className={`ml-3 text-xs px-2 py-0.5 rounded-full capitalize ${
                c.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>{c.status}</span>
              <span className="ml-auto text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
            </div>
          ))}
          {(!courses || courses.length === 0) && (
            <div className="px-5 py-4 text-sm text-gray-400">No courses.</div>
          )}
        </div>
      </div>

      {/* Recent purchases */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Purchases</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {(purchases ?? []).map((p: any) => (
            <div key={p.id} className="flex items-center px-5 py-3 text-sm">
              <div className="font-medium text-gray-900">{p.courses?.title ?? '—'}</div>
              <span className={`ml-3 text-xs px-2 py-0.5 rounded-full capitalize ${
                p.status === 'completed' ? 'bg-green-100 text-green-700' :
                p.status === 'refunded'  ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'
              }`}>{p.status}</span>
              <span className="ml-auto font-semibold text-gray-900">${((p.amount_cents ?? 0) / 100).toFixed(2)}</span>
            </div>
          ))}
          {(!purchases || purchases.length === 0) && (
            <div className="px-5 py-4 text-sm text-gray-400">No purchases.</div>
          )}
        </div>
      </div>
    </div>
  )
}
