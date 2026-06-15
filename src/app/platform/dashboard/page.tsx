import { redirect } from 'next/navigation'
import Link         from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Plus, Globe, Users, ChevronRight, AlertTriangle } from 'lucide-react'
import type { Workspace } from '@/types/workspace'

export const metadata = { title: 'Creator Dashboard — Apex' }

export default async function CreatorDashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/platform/auth/login')

  // Must be a platform_user (creator)
  const { data: platformUser } = await (supabase as any)
    .from('platform_users')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!platformUser) redirect('/platform/auth/signup')

  const { data: workspaces } = await (supabase as any)
    .from('workspaces')
    .select('*')
    .eq('owner_id', session.user.id)
    .order('created_at', { ascending: false })

  const list = (workspaces ?? []) as Workspace[]

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Welcome back{platformUser.full_name ? `, ${platformUser.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage your academies and workspaces.</p>
        </div>
        <Link href="/platform/onboarding" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Workspace
        </Link>
      </div>

      {/* Workspace grid */}
      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {list.map((ws) => (
            <WorkspaceCard key={ws.id} workspace={ws} />
          ))}
          <CreateCard />
        </div>
      )}
    </div>
  )
}

function WorkspaceCard({ workspace: ws }: { workspace: Workspace }) {
  const isTrialing = ws.plan_status === 'trialing'
  const trialEnds  = new Date(ws.trial_ends_at)
  const daysLeft   = Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86400000))

  return (
    <div className="card p-0 overflow-hidden flex flex-col hover:border-navy-600 transition-colors">
      {/* Cover / logo */}
      <div className="h-24 bg-gradient-to-br from-navy-800 to-navy-700 flex items-center justify-center relative">
        {ws.cover_url ? (
          <img src={ws.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <Globe className="w-8 h-8 text-navy-500" />
        )}
        {ws.logo_url && (
          <img src={ws.logo_url} alt={ws.name}
            className="absolute bottom-0 left-4 translate-y-1/2 w-10 h-10 rounded-xl border-2 border-navy-900 object-cover" />
        )}
      </div>

      <div className="p-5 pt-7 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="font-semibold text-white truncate">{ws.name}</h2>
          <PlanBadge status={ws.plan_status} />
        </div>

        <p className="text-slate-500 text-xs mb-1">apex-university.com/<span className="text-slate-400">{ws.slug}</span></p>

        {ws.tagline && <p className="text-slate-400 text-sm mt-1 line-clamp-2">{ws.tagline}</p>}

        {isTrialing && daysLeft <= 7 && (
          <div className="flex items-center gap-1.5 mt-3 text-amber-400 text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            {daysLeft === 0 ? 'Trial expired' : `${daysLeft} days left in trial`}
          </div>
        )}

        <div className="flex items-center gap-3 mt-auto pt-4">
          <div className="flex items-center gap-1 text-slate-500 text-xs">
            <Users className="w-3.5 h-3.5" />
            {ws.seats_used} members
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Link
            href={`/platform/workspaces/${ws.id}`}
            className="btn-outline text-xs flex-1 justify-center flex items-center gap-1"
          >
            Manage
          </Link>
          <Link
            href={`/w/${ws.slug}`}
            className="btn-ghost text-xs flex items-center gap-1"
            target="_blank"
          >
            Preview <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function PlanBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    trialing:  'bg-blue-500/10 text-blue-400',
    active:    'bg-green-500/10 text-green-400',
    past_due:  'bg-red-500/10 text-red-400',
    canceled:  'bg-slate-500/10 text-slate-400',
    paused:    'bg-amber-500/10 text-amber-400',
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize shrink-0 ${map[status] ?? ''}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function CreateCard() {
  return (
    <Link
      href="/platform/onboarding"
      className="card border-dashed flex flex-col items-center justify-center gap-3 p-8 hover:border-gold-500/40 hover:bg-gold-500/5 transition-colors group min-h-[220px]"
    >
      <div className="w-12 h-12 rounded-full bg-gold-500/10 flex items-center justify-center group-hover:bg-gold-500/20 transition-colors">
        <Plus className="w-5 h-5 text-gold-400" />
      </div>
      <div className="text-center">
        <p className="text-white font-medium text-sm">New workspace</p>
        <p className="text-slate-500 text-xs mt-0.5">Launch another academy</p>
      </div>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="card p-16 text-center">
      <Globe className="w-12 h-12 text-slate-600 mx-auto mb-4" />
      <h2 className="font-display text-xl font-bold text-white mb-2">Create your first workspace</h2>
      <p className="text-slate-400 text-sm max-w-sm mx-auto mb-8">
        A workspace is your branded academy — where you publish courses, build community, and grow your audience.
      </p>
      <Link href="/platform/onboarding" className="btn-primary inline-flex items-center gap-2">
        <Plus className="w-4 h-4" /> Get started
      </Link>
    </div>
  )
}
