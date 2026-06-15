'use client'

import { useState }        from 'react'
import { useRouter }       from 'next/navigation'
import Link                from 'next/link'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Loader2 }         from 'lucide-react'

export default function CreatorSignupPage() {
  const router   = useRouter()
  const supabase = createClientComponentClient()

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }

    setLoading(true)

    // Sign up with Supabase auth. The { account_type: 'creator' } metadata
    // triggers the handle_new_platform_user() function which creates the
    // platform_users row automatically.
    const { error: authError } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options: {
        data: { full_name: form.name.trim(), account_type: 'creator' },
        emailRedirectTo: `${location.origin}/platform/auth/callback`,
      },
    })

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    router.push('/platform/auth/verify')
  }

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="font-display text-2xl font-bold text-white">Apex</span>
          <p className="text-slate-400 text-sm mt-2">Create your creator account</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input
                className="input-field"
                type="text"
                autoComplete="name"
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label className="label">Email</label>
              <input
                className="input-field"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                className="input-field"
                type="password"
                autoComplete="new-password"
                required
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="8+ characters"
              />
            </div>

            <div>
              <label className="label">Confirm password</label>
              <input
                className="input-field"
                type="password"
                autoComplete="new-password"
                required
                value={form.confirm}
                onChange={(e) => set('confirm', e.target.value)}
              />
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : 'Create creator account'}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-6">
            Already have an account?{' '}
            <Link href="/platform/auth/login" className="text-gold-400 hover:text-gold-300">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          By signing up you agree to our{' '}
          <Link href="/terms-of-service" className="underline hover:text-slate-400">Terms</Link>{' '}
          and{' '}
          <Link href="/privacy-policy" className="underline hover:text-slate-400">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  )
}
