import Link from 'next/link'
import { LayoutDashboard, Plus, Settings, LogOut } from 'lucide-react'

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-navy-950 flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-navy-800 flex flex-col py-6 px-4">
        <Link href="/platform/dashboard" className="flex items-center gap-2 mb-8 px-2">
          <span className="font-display text-lg font-bold text-white">Apex</span>
          <span className="text-xs text-gold-400 bg-gold-500/10 px-1.5 py-0.5 rounded font-medium">Creator</span>
        </Link>

        <nav className="flex-1 space-y-1">
          <NavLink href="/platform/dashboard" icon={LayoutDashboard}>Dashboard</NavLink>
          <NavLink href="/platform/onboarding" icon={Plus}>New Workspace</NavLink>
          <NavLink href="/platform/settings"   icon={Settings}>Account Settings</NavLink>
        </nav>

        <div className="border-t border-navy-800 pt-4">
          <Link
            href="/platform/auth/logout"
            className="flex items-center gap-2.5 px-3 py-2 text-slate-400 hover:text-red-400 text-sm rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
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
      className="flex items-center gap-2.5 px-3 py-2 text-slate-400 hover:text-white hover:bg-navy-800/60 text-sm rounded-lg transition-colors"
    >
      <Icon className="w-4 h-4" />
      {children}
    </Link>
  )
}
