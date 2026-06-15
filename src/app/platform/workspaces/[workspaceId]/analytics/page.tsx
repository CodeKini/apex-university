'use client'

import { useState, useEffect }  from 'react'
import { useParams }            from 'next/navigation'
import Link                     from 'next/link'
import {
  Users, DollarSign, BookOpen, TrendingUp, ArrowRight,
  CheckCircle2, Circle, Zap, UserPlus, Settings, PlusCircle,
} from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import type { WorkspaceAnalytics, CourseCompletionStat } from '@/types/analytics'

export default function WorkspaceAnalyticsPage() {
  const { workspaceId } = useParams() as { workspaceId: string }
  const [data,    setData]    = useState<WorkspaceAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/platform/analytics?workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
  }, [workspaceId])

  if (loading) return <div className="py-20 text-center text-slate-500 text-sm">Loading analytics...</div>
  if (!data)   return <div className="py-20 text-center text-slate-500 text-sm">Failed to load analytics.</div>

  const { stats, recentEnrollments, recentActivity, courseCompletions } = data

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Analytics</h1>
        <p className="text-slate-400 text-sm mt-1">Workspace performance overview</p>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Total Students"
          value={stats.totalStudents.toLocaleString()}
          color="blue"
        />
        <StatCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Total Revenue"
          value={formatPrice(stats.totalRevenue)}
          color="green"
          sub="from paid enrollments"
        />
        <StatCard
          icon={<BookOpen className="w-5 h-5" />}
          label="Active Courses"
          value={String(stats.activeCourses)}
          color="gold"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Enrollments This Week"
          value={String(stats.enrollmentsThisWeek)}
          color="purple"
        />
      </div>

      {/* ── Mid row: recent enrollments + course completions ────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent enrollments */}
        <div className="card p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-gold-400" /> Recent Enrollments
          </h2>
          {recentEnrollments.length === 0 ? (
            <p className="text-slate-500 text-sm py-6 text-center">No enrollments yet.</p>
          ) : (
            <div className="space-y-3">
              {recentEnrollments.map((e) => (
                <div key={e.id} className="flex items-center gap-3">
                  <Avatar name={e.student.full_name} url={e.student.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm font-medium truncate">
                      {e.student.full_name ?? 'Student'}
                    </p>
                    <p className="text-slate-500 text-xs truncate">{e.course.title}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <SourceBadge source={e.source} />
                    <p className="text-slate-600 text-xs mt-0.5">{timeAgo(e.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Course completion overview */}
        <div className="card p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" /> Course Completion
          </h2>
          {courseCompletions.length === 0 ? (
            <p className="text-slate-500 text-sm py-6 text-center">No published courses yet.</p>
          ) : (
            <div className="space-y-5">
              {courseCompletions.map((c) => (
                <CompletionRow key={c.course_id} stat={c} workspaceId={workspaceId} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent student activity ──────────────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-gold-400" /> Recent Student Activity
        </h2>
        {recentActivity.length === 0 ? (
          <p className="text-slate-500 text-sm py-6 text-center">No student activity yet.</p>
        ) : (
          <div className="divide-y divide-navy-800">
            {recentActivity.map((a, i) => (
              <div key={i} className="py-3 flex items-center gap-3">
                <span className="shrink-0">
                  {a.completed
                    ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                    : <Circle       className="w-4 h-4 text-slate-600" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 text-sm truncate">
                    <span className="font-medium">{a.student.full_name ?? 'Student'}</span>
                    {a.completed ? ' completed ' : ' is watching '}
                    <span className="text-slate-400">{a.lesson.title}</span>
                  </p>
                  <p className="text-slate-500 text-xs truncate">{a.course.title}</p>
                </div>
                <span className="text-slate-600 text-xs shrink-0">{timeAgo(a.updated_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick actions ────────────────────────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction
            href={`/platform/workspaces/${workspaceId}/courses/new`}
            icon={<PlusCircle className="w-4 h-4" />}
            label="New Course"
          />
          <QuickAction
            href={`/platform/workspaces/${workspaceId}/members`}
            icon={<UserPlus className="w-4 h-4" />}
            label="Manage Members"
          />
          <QuickAction
            href={`/platform/workspaces/${workspaceId}/settings`}
            icon={<Settings className="w-4 h-4" />}
            label="Workspace Settings"
          />
          <QuickAction
            href={`/platform/workspaces/${workspaceId}/courses`}
            icon={<BookOpen className="w-4 h-4" />}
            label="All Courses"
          />
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, color, sub,
}: {
  icon: React.ReactNode; label: string; value: string; color: string; sub?: string
}) {
  const colorMap: Record<string, string> = {
    blue:   'text-blue-400   bg-blue-500/10',
    green:  'text-green-400  bg-green-500/10',
    gold:   'text-gold-400   bg-gold-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
  }
  return (
    <div className="card p-5">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${colorMap[color]}`}>{icon}</div>
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className="text-white font-bold text-2xl">{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

function CompletionRow({ stat, workspaceId }: { stat: CourseCompletionStat; workspaceId: string }) {
  return (
    <div>
      <div className="flex items-start justify-between mb-1.5">
        <Link
          href={`/platform/workspaces/${workspaceId}/courses`}
          className="text-slate-300 text-sm hover:text-white transition-colors truncate max-w-[65%]"
        >
          {stat.title}
        </Link>
        <span className="text-slate-500 text-xs shrink-0">
          {stat.enrolled_count} enrolled · {stat.completion_rate}% complete
        </span>
      </div>
      <div className="h-1.5 bg-navy-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all"
          style={{ width: `${stat.completion_rate}%` }}
        />
      </div>
    </div>
  )
}

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  if (url) return <img src={url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
  return (
    <div className="w-8 h-8 rounded-full bg-navy-800 flex items-center justify-center shrink-0">
      <span className="text-slate-400 text-xs font-medium">
        {name?.[0]?.toUpperCase() ?? '?'}
      </span>
    </div>
  )
}

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    free:   { label: 'Free',   cls: 'text-green-400  bg-green-500/10' },
    stripe: { label: 'Paid',   cls: 'text-blue-400   bg-blue-500/10'  },
    manual: { label: 'Manual', cls: 'text-slate-400  bg-navy-800'     },
  }
  const { label, cls } = map[source] ?? map.manual
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${cls}`}>{label}</span>
  )
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 p-3 rounded-xl bg-navy-900 border border-navy-800
        hover:border-navy-700 hover:bg-navy-800 transition-colors text-slate-300 text-sm group"
    >
      <span className="text-gold-400">{icon}</span>
      {label}
      <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
