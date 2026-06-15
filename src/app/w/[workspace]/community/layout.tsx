'use client'

import Link        from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { Rss, Megaphone, Users, MessageSquare } from 'lucide-react'

const TABS = [
  { label: 'Feed',          icon: Rss,           href: '' },
  { label: 'Announcements', icon: Megaphone,      href: '/announcements' },
  { label: 'Members',       icon: Users,          href: '/members' },
  { label: 'Messages',      icon: MessageSquare,  href: '/messages' },
]

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { workspace } = useParams<{ workspace: string }>()
  const base = `/w/${workspace}/community`

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Sub-nav */}
      <nav className="flex items-center gap-1 mb-8 border-b border-navy-800 pb-0">
        {TABS.map(({ label, icon: Icon, href }) => {
          const fullHref = base + href
          const active   = href === ''
            ? pathname === base || pathname === `${base}/`
            : pathname.startsWith(fullHref)
          return (
            <Link
              key={label}
              href={fullHref}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-gold-400 text-gold-400'
                  : 'border-transparent text-slate-400 hover:text-white hover:border-navy-600'
              }`}
            >
              <Icon size={14} />
              {label}
            </Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}
