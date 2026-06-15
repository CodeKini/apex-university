'use client'

import { useState }                    from 'react'
import { useRouter, useSearchParams }  from 'next/navigation'
import Link                            from 'next/link'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Loader2 }                     from 'lucide-react'
import { Suspense }                    from 'react'

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirect     = searchParams.get('redirect') ?? '/platform/dashboard'
  const supabase     = createClientComponentClient()

  const [email,   setEmail]   = useState('')
  const [pw,      setPw]      = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: pw })
    setLoading(false)

    if (authError) { setError(authError.message); return }

    router.push(redirect)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="font-display text-2xl font-bold text-white">Apex</span>
          <p className="text-slate-400 text-sm mt-2">Sign in to your creator account</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input-field"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                className="input-field"
                type="password"
                autoComplete="current-password"
                required
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-slate-400 hover:text-white text-xs">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-6">
            New creator?{' '}
            <Link href="/platform/auth/signup" className="text-gold-400 hover:text-gold-300">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function CreatorLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
