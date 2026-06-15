'use client'

import Link                           from 'next/link'
import { useEffect, useState }        from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { WorkspaceProvider }          from '@/lib/workspace/context'
import type { WorkspaceContext }      from '@/types/workspace'
import { BookOpen, Home, Settings, Crown, LayoutDashboard, LogIn, UserPlus, AlertTriangle, Users2, GitBranch, Library, TrendingUp, Zap, Trophy } from 'lucide-react'
import { isWhiteLabelPlan } from '@/lib/plans'
import NotificationBell     from '@/components/community/NotificationBell'
import MobileNav            from '@/components/pwa/MobileNav'
import InstallPrompt        from '@/components/pwa/InstallPrompt'

interface Props {
  ctx:      WorkspaceContext
  children: React.ReactNode
}

export default function WorkspaceShell({ ctx, children }: Props) {
  const { workspace, isOwner, isAdmin, branding } = ctx
  const slug     = workspace.slug
  const accent   = branding?.accent_color ?? (workspace.settings as any)?.accent_color ?? '#eab308'
  const primary  = branding?.primary_color   ?? '#1e293b'
  const secondary = branding?.secondary_color ?? '#0f172a'
  const supabase = createClientComponentClient()
  const [session, setSession] = useState<any>(undefined)

  const isWhiteLabel = isWhiteLabelPlan(workspace.plan_name)
  const showPoweredBy = !(isWhiteLabel && branding?.hide_powered_by_apex)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  return (
    <WorkspaceProvider value={ctx}>
      <style>{`:root {
        --workspace-accent: ${accent};
        --ws-primary: ${primary};
        --ws-secondary: ${secondary};
        --ws-accent: ${accent};
      }`}</style>

      <div className="min-h-screen bg-navy-950 pb-safe-area-bottom md:pb-0">
        {/* Workspace top nav — hidden on mobile when logged in (bottom nav takes over) */}
        <header className="border-b border-navy-800 bg-navy-900/80 backdrop-blur sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link href={`/w/${slug}`} className="flex items-center gap-2.5">
              {workspace.logo_url ? (
                <img src={workspace.logo_url} alt={workspace.name} className="w-7 h-7 rounded-lg object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-gold-500/20 flex items-center justify-center">
                  <span className="text-gold-400 font-bold text-xs">{workspace.name[0]}</span>
                </div>
              )}
              <span className="font-semibold text-white text-sm">{workspace.name}</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <NavLink href={`/w/${slug}`}          icon={Home}>Home</NavLink>
              <NavLink href={`/w/${slug}/courses`}  icon={BookOpen}>Courses</NavLink>

              {session === undefined ? null : session ? (
                <>
                  <NavLink href={`/w/${slug}/dashboard`}   icon={LayoutDashboard}>Dashboard</NavLink>
                  <NavLink href={`/w/${slug}/paths`}       icon={GitBranch}>Paths</NavLink>
                  <NavLink href={`/w/${slug}/community`}   icon={Users2}>Community</NavLink>
                  <NavLink href={`/w/${slug}/resources`}   icon={Library}>Resources</NavLink>
                  <NavLink href={`/w/${slug}/membership`}  icon={Crown}>Membership</NavLink>
                  <NavLink href={`/w/${slug}/affiliate`}    icon={TrendingUp}>Affiliate</NavLink>
                  <NavLink href={`/w/${slug}/profile`}     icon={Zap}>XP</NavLink>
                  <NavLink href={`/w/${slug}/leaderboard`} icon={Trophy}>Leaderboard</NavLink>
                  <NotificationBell workspaceId={workspace.id} />
                </>
              ) : (
                <>
                  <NavLink href={`/w/${slug}/auth/login`}  icon={LogIn}>Log in</NavLink>
                  <NavLink href={`/w/${slug}/auth/signup`} icon={UserPlus}>Sign up</NavLink>
                </>
              )}

              {/* Owner/admin controls */}
              {isAdmin && (
                <NavLink href={`/platform/workspaces/${workspace.id}`} icon={Settings}>
                  Manage
                </NavLink>
              )}
            </nav>
          </div>
        </header>

        {/* Trial banner */}
        {isOwner && workspace.plan_status === 'trialing' && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 text-center">
            <span className="text-amber-400 text-xs flex items-center justify-center gap-1.5">
              <Crown className="w-3.5 h-3.5" />
              Free trial — subscribe to keep your workspace after the trial ends.
              <Link href={`/platform/workspaces/${workspace.id}/billing`} className="underline hover:no-underline">Choose a plan</Link>
            </span>
          </div>
        )}

        {/* Past-due warning banner (for all visitors — workspace still accessible) */}
        {workspace.plan_status === 'past_due' && (
          <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-2 text-center">
            <span className="text-red-400 text-xs flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              This workspace has a payment issue and may be suspended soon.
              {isOwner && (
                <Link href={`/platform/workspaces/${workspace.id}/billing`} className="underline hover:no-underline">Fix now</Link>
              )}
            </span>
          </div>
        )}

        {/* Canceled / suspended — block content, show upgrade prompt */}
        {workspace.plan_status === 'canceled' ? (
          <div className="flex items-center justify-center min-h-[60vh] px-6">
            <div className="card p-10 max-w-md text-center">
              <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
              <h2 className="font-display text-xl font-bold text-white mb-2">Workspace Suspended</h2>
              <p className="text-slate-400 text-sm mb-6">
                This workspace's subscription has been canceled. The creator needs to reactivate it.
              </p>
              {isOwner && (
                <Link href={`/platform/workspaces/${workspace.id}/billing`} className="btn-primary">
                  Reactivate workspace
                </Link>
              )}
            </div>
          </div>
        ) : (
          // Add bottom padding on mobile so content isn't hidden behind the bottom nav
          <div className="md:pb-0 pb-16">
            {children}
          </div>
        )}

        {/* Powered-by footer — hidden for Pro white-label workspaces that opt out */}
        {showPoweredBy && (
          <footer className="border-t border-navy-800 py-4 text-center mb-16 md:mb-0">
            <p className="text-xs text-slate-600">
              Powered by{' '}
              <a href="https://apexuniversity.com" target="_blank" rel="noopener noreferrer"
                className="hover:text-slate-400 transition-colors">
                Apex University
              </a>
            </p>
          </footer>
        )}

        {/* Mobile bottom nav — shown when logged in */}
        {session && <MobileNav slug={slug} />}

        {/* PWA install prompt */}
        <InstallPrompt />
      </div>
    </WorkspaceProvider>
  )
}

function NavLink({
  href,
  icon: Icon,
  children,
}: {
  href: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-navy-800/60 text-sm rounded-lg transition-colors"
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </Link>
  )
}
