'use client'

import { useState, Suspense }           from 'react'
import { useParams, useRouter,
         useSearchParams }              from 'next/navigation'
import Link                             from 'next/link'
import { createClientComponentClient }  from '@supabase/auth-helpers-nextjs'
import { Loader2 }                      from 'lucide-react'
import { useWorkspace }                 from '@/lib/workspace/context'

function LoginForm() {
  const params       = useParams()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const slug         = params.workspace as string
  const redirectTo   = searchParams.get('redirect') ?? `/w/${slug}/dashboard`
  const { workspace } = useWorkspace()
  const supabase     = createClientComponentClient()

  const [email,   setEmail]   = useState('')
  const [pw,      setPw]      = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (authErr) { setLoading(false); setError(authErr.message); return }

    // Ensure they're a member of this workspace (in case they have an account from elsewhere)
    await fetch(`/api/w/${slug}/join`, { method: 'POST' })

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {workspace.logo_url
            ? <img src={workspace.logo_url} alt={workspace.name} className="w-16 h-16 rounded-2xl object-cover mx-auto mb-4" />
            : <div className="w-16 h-16 rounded-2xl bg-gold-500/10 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-gold-400">{workspace.name[0]}</div>
          }
          <h1 className="font-display text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-slate-400 text-sm mt-2">Sign in to continue learning at {workspace.name}.</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input-field" type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input-field" type="password" required autoComplete="current-password"
                value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-6">
            Don't have an account?{' '}
            <Link href={`/w/${slug}/auth/signup`} className="text-gold-400 hover:text-gold-300">Sign up free</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function WorkspaceLoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
