'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building2, Users, BookOpen, DollarSign,
  TrendingUp, Activity,
} from 'lucide-react'

interface Stats {
  totalWorkspaces: number
  activeSubscriptions: number
  trialingSubscriptions: number
  totalStudents: number
  totalCourses: number
  monthlyRevenueCents: number
  recentSignups: any[]
  recentPurchases: any[]
}

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(setStats).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )

  if (!stats) return <div className="p-8 text-gray-500">Failed to load stats.</div>

  const revStr = `$${((stats.monthlyRevenueCents ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Platform Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Real-time overview of Apex University</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard icon={Building2}  label="Workspaces"   value={stats.totalWorkspaces}       color="bg-indigo-500" />
        <StatCard icon={Activity}   label="Active Plans"  value={stats.activeSubscriptions}    color="bg-green-500" />
        <StatCard icon={TrendingUp} label="Trialing"      value={stats.trialingSubscriptions}  color="bg-amber-500" />
        <StatCard icon={Users}      label="Students"      value={stats.totalStudents}           color="bg-blue-500" />
        <StatCard icon={BookOpen}   label="Courses"       value={stats.totalCourses}            color="bg-purple-500" />
        <StatCard icon={DollarSign} label="All-time Rev"  value={revStr}                        color="bg-emerald-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent signups */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Signups</h2>
            <Link href="/admin/users" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {stats.recentSignups.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
                  {(u.full_name || u.email || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{u.full_name || '—'}</div>
                  <div className="text-xs text-gray-400 truncate">{u.email}</div>
                </div>
                <div className="ml-auto text-xs text-gray-400 shrink-0">
                  {new Date(u.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
            {stats.recentSignups.length === 0 && <p className="text-sm text-gray-400">No signups yet.</p>}
          </div>
        </div>

        {/* Recent purchases */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Purchases</h2>
            <Link href="/admin/purchases" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {stats.recentPurchases.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">{p.courses?.title ?? '—'}</div>
                  <div className="text-xs text-gray-400 truncate">{p.workspaces?.name}</div>
                </div>
                <div className="text-sm font-semibold text-gray-900 shrink-0">
                  ${((p.amount_cents ?? 0) / 100).toFixed(2)}
                </div>
              </div>
            ))}
            {stats.recentPurchases.length === 0 && <p className="text-sm text-gray-400">No purchases yet.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
