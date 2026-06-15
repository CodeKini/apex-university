import Link from 'next/link'
import { GraduationCap } from 'lucide-react'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-navy-950 border-t border-navy-800 mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-navy-900" />
              </div>
              <span className="font-display font-bold text-white">
                Apex <span className="gold-text">University</span>
              </span>
            </Link>
            {/* REPLACE: Update tagline */}
            <p className="text-slate-400 text-sm leading-relaxed">
              Premium education for the ambitious. Learn wealth, business, and
              the skills that compound for life.
            </p>
          </div>

          {/* Learn */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Learn</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/courses', label: 'All Courses' },
                { href: '/pricing', label: 'Pricing' },
                { href: '/about', label: 'About Us' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-slate-400 text-sm hover:text-gold-400 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Account</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/login', label: 'Log In' },
                { href: '/signup', label: 'Sign Up' },
                { href: '/dashboard', label: 'Dashboard' },
                { href: '/my-courses', label: 'My Courses' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-slate-400 text-sm hover:text-gold-400 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/terms-of-service', label: 'Terms of Service' },
                { href: '/privacy-policy', label: 'Privacy Policy' },
                { href: '/contact', label: 'Contact Us' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-slate-400 text-sm hover:text-gold-400 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-navy-800 flex flex-col md:flex-row justify-between items-center gap-4">
          {/* REPLACE: Update company name and year */}
          <p className="text-slate-500 text-sm">© {year} Apex University. All rights reserved.</p>
          <p className="text-slate-600 text-xs">
            Payments secured by Stripe. All transactions encrypted.
          </p>
        </div>
      </div>
    </footer>
  )
}
