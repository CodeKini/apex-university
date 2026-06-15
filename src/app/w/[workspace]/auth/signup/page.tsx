'use client'

import { useState }                    from 'react'
import { useParams, useRouter }        from 'next/navigation'
import Link                            from 'next/link'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Loader2 }                     from 'lucide-react'
import { useWorkspace }                from '@/lib/workspace/context'

export default function WorkspaceSignupPage() {
  const params    = useParams()
  const router    = useRouter()
  const slug      = params.workspace as string
  const { workspace } = useWorkspace()
  const supabase  = createClientComponentClient()

  const [form,    setForm]    = useState({ name: '', email: '', password: '', confirm: '' })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }

    setLoading(true)

    // 1. Create Supabase auth user.
    //    handle_new_user trigger auto-creates a profiles row.
    //    account_type: 'member' means handle_new_platform_user will NOT create a platform_users row.
    const { error: authErr } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options:  {
        data: { full_name: form.name.trim(), account_type: 'member' },
        emailRedirectTo: `${location.origin}/w/${slug}/auth/callback`,
      },
    })

    if (authErr) { setLoading(false); setError(authErr.message); return }

    // 2. Join the workspace (add to workspace_members)
    const joinRes = await fetch(`/api/w/${slug}/join`, { method: 'POST' })
    setLoading(false)

    if (!joinRes.ok) {
      const d = await joinRes.json()
      setError(d.error ?? 'Failed to join workspace.')
      return
    }

    router.push(`/w/${slug}/dashboard`)
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
          <h1 className="font-display text-2xl font-bold text-white">Join {workspace.name}</h1>
          <p className="text-slate-400 text-sm mt-2">Create your free account to get started.</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input className="input-field" type="text" required autoComplete="name"
                value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Jane Doe" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input-field" type="email" required autoComplete="email"
                value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input-field" type="password" required autoComplete="new-password"
                value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="8+ characters" />
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input className="input-field" type="password" required autoComplete="new-password"
                value={form.confirm} onChange={(e) => set('confirm', e.target.value)} />
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
                : 'Create account'}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-6">
            Already have an account?{' '}
            <Link href={`/w/${slug}/auth/login`} className="text-gold-400 hover:text-gold-300">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
