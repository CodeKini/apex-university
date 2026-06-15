'use client'

import Link          from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, Users2, LayoutDashboard, Zap } from 'lucide-react'

interface Props {
  slug: string
}

export default function MobileNav({ slug }: Props) {
  const pathname = usePathname()
  const base     = `/w/${slug}`

  const links = [
    { href: `${base}`,            icon: Home,            label: 'Home'      },
    { href: `${base}/courses`,    icon: BookOpen,        label: 'Courses'   },
    { href: `${base}/community`,  icon: Users2,          label: 'Community' },
    { href: `${base}/dashboard`,  icon: LayoutDashboard, label: 'Dashboard' },
    { href: `${base}/profile`,    icon: Zap,             label: 'XP'        },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40
                    bg-navy-900/95 backdrop-blur border-t border-navy-800
                    safe-area-bottom">
      <div className="flex items-stretch h-14">
        {links.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== base && pathname.startsWith(href))
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors
                ${active ? 'text-gold-400' : 'text-slate-500 hover:text-slate-300'}`}>
              <Icon className={`w-5 h-5 transition-transform ${active ? 'scale-110' : ''}`} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
