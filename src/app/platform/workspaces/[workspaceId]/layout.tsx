import { redirect, notFound } from 'next/navigation'
import Link                   from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { BookOpen, BarChart2, Settings, Users, CreditCard, ArrowLeft, ShoppingBag, Award, Users2, GitBranch, Tag, Crown, Library, TrendingUp, Zap, Palette, Globe } from 'lucide-react'

interface Props {
  children: React.ReactNode
  params:   { workspaceId: string }
}

export default async function WorkspaceAdminLayout({ children, params }: Props) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/platform/auth/login')

  const { data: workspace } = await (supabase as any)
    .from('workspaces')
    .select('id, name, slug, logo_url, plan_status')
    .eq('id', params.workspaceId)
    .single()
  if (!workspace) notFound()

  // Only workspace owner/admin or platform admin can manage this workspace
  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', session.user.id).single()
  const isPlatformAdmin = pu?.platform_role === 'platform_admin'

  if (!isPlatformAdmin) {
    const { data: wm } = await (supabase as any)
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', params.workspaceId)
      .eq('user_id', session.user.id)
      .in('role', ['owner', 'admin'])
      .single()
    if (!wm) redirect('/platform/dashboard')
  }

  const base = `/platform/workspaces/${params.workspaceId}`

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col">
      {/* Workspace admin topbar */}
      <header className="border-b border-navy-800 bg-navy-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/platform/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              {workspace.logo_url ? (
                <img src={workspace.logo_url} alt="" className="w-6 h-6 rounded-md object-cover" />
              ) : (
                <div className="w-6 h-6 rounded-md bg-gold-500/20 flex items-center justify-center">
                  <span className="text-gold-400 text-xs font-bold">{workspace.name[0]}</span>
                </div>
              )}
              <span className="font-semibold text-white text-sm">{workspace.name}</span>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            <NavLink href={`${base}/courses`}   icon={BookOpen}>Courses</NavLink>
            <NavLink href={`${base}/members`}   icon={Users}>Members</NavLink>
            <NavLink href={`${base}/sales`}         icon={ShoppingBag}>Sales</NavLink>
            <NavLink href={`${base}/certificates`}  icon={Award}>Certificates</NavLink>
            <NavLink href={`${base}/memberships`}    icon={Crown}>Memberships</NavLink>
            <NavLink href={`${base}/coupons`}        icon={Tag}>Coupons</NavLink>
            <NavLink href={`${base}/paths`}          icon={GitBranch}>Paths</NavLink>
            <NavLink href={`${base}/resources`}      icon={Library}>Resources</NavLink>
            <NavLink href={`${base}/affiliates`}     icon={TrendingUp}>Affiliates</NavLink>
            <NavLink href={`${base}/gamification`}   icon={Zap}>XP</NavLink>
            <NavLink href={`${base}/branding`}       icon={Palette}>Branding</NavLink>
            <NavLink href={`${base}/domains`}        icon={Globe}>Domains</NavLink>
            <NavLink href={`${base}/community`}     icon={Users2}>Community</NavLink>
            <NavLink href={`${base}/analytics`}     icon={BarChart2}>Analytics</NavLink>
            <NavLink href={`${base}/billing`}   icon={CreditCard}>Billing</NavLink>
            <NavLink href={`${base}/settings`}  icon={Settings}>Settings</NavLink>
          </nav>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {children}
      </div>
    </div>
  )
}

function NavLink({ href, icon: Icon, children }: { href: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-navy-800/60 text-sm rounded-lg transition-colors">
      <Icon className="w-3.5 h-3.5" />
      {children}
    </Link>
  )
}
