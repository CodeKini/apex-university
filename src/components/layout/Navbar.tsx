'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Menu, X, GraduationCap, ChevronDown } from 'lucide-react'
import type { Profile } from '@/types/database'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      setProfile(data)
    }
    getProfile()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => getProfile())
    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    router.push('/')
  }

  const navLinks = [
    { href: '/courses', label: 'Courses' },
    { href: '/about', label: 'About' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/contact', label: 'Contact' },
  ]

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy-950/90 backdrop-blur-md border-b border-navy-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo — REPLACE with your brand name/logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-navy-900" />
            </div>
            <span className="font-display font-bold text-lg text-white">
              Apex <span className="gold-text">University</span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === l.href
                    ? 'text-gold-400 bg-navy-700/50'
                    : 'text-slate-300 hover:text-white hover:bg-navy-700/30'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Auth / User area */}
          <div className="hidden md:flex items-center gap-3">
            {profile ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-navy-700/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gold-gradient flex items-center justify-center text-navy-900 font-bold text-sm">
                    {profile.full_name?.[0]?.toUpperCase() ?? profile.email[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-300">{profile.full_name ?? 'Account'}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-navy-800 border border-navy-600 rounded-xl shadow-xl py-1">
                    <Link href="/dashboard" className="block px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-navy-700/50">Dashboard</Link>
                    <Link href="/my-courses" className="block px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-navy-700/50">My Courses</Link>
                    <Link href="/profile" className="block px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-navy-700/50">Profile & Settings</Link>
                    {profile.role === 'admin' && (
                      <Link href="/admin" className="block px-4 py-2.5 text-sm text-gold-400 hover:bg-navy-700/50">Admin Panel</Link>
                    )}
                    <hr className="my-1 border-navy-600" />
                    <button onClick={signOut} className="w-full text-left px-4 py-2.5 text-sm text-slate-400 hover:text-red-400 hover:bg-navy-700/50">
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/login" className="btn-ghost text-slate-300">Log In</Link>
                <Link href="/signup" className="btn-primary text-sm px-5 py-2.5">Start Learning</Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-slate-300 hover:text-white"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden py-4 border-t border-navy-700/50 space-y-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-navy-700/30 rounded-lg"
              >
                {l.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-navy-700/50 mt-2 space-y-2">
              {profile ? (
                <>
                  <Link href="/dashboard" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm text-slate-300">Dashboard</Link>
                  <button onClick={signOut} className="w-full text-left px-4 py-3 text-sm text-red-400">Sign Out</button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm text-slate-300">Log In</Link>
                  <Link href="/signup" onClick={() => setOpen(false)} className="btn-primary w-full text-center">Start Learning</Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
