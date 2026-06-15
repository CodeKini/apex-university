'use client'

import Link        from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Building2, Users, ShoppingBag,
  Mail, Server, RotateCcw, ChevronRight, Award, Rocket,
} from 'lucide-react'

const NAV = [
  { href: '/admin',                    label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/admin/workspaces',         label: 'Workspaces',       icon: Building2 },
  { href: '/admin/users',              label: 'Users',            icon: Users },
  { href: '/admin/purchases',          label: 'Purchases',        icon: ShoppingBag },
  { href: '/admin/refunds',            label: 'Refunds',          icon: RotateCcw },
  { href: '/admin/certificates',       label: 'Certificates',     icon: Award },
  { href: '/admin/emails',             label: 'Emails',           icon: Mail },
  { href: '/admin/system',             label: 'System',           icon: Server },
  { href: '/admin/launch-readiness',   label: 'Launch Readiness', icon: Rocket },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-gray-900 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-700">
          <span className="text-white font-bold text-lg tracking-tight">Apex Admin</span>
          <span className="ml-2 text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-medium">INTERNAL</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="px-4 py-4 border-t border-gray-700">
          <Link href="/platform/dashboard" className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300">
            Back to Platform <ChevronRight size={12} />
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
