'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams }        from 'next/navigation'
import { useWorkspace }                      from '@/lib/workspace/context'
import { Suspense }                          from 'react'
import Link                                  from 'next/link'
import {
  Crown, CheckCircle2, Loader2, ArrowRight, AlertCircle, Settings,
} from 'lucide-react'

interface Tier {
  id: string
  name: string
  description: string | null
  monthly_price: number
  yearly_price: number | null
  benefits: string[]
  community_access: boolean
  resource_library_access: boolean
  included_course_ids: string[]
  included_path_ids: string[]
}

interface Subscription {
  id: string
  tier_id: string
  status: string
  interval: string
  current_period_end: string | null
  stripe_subscription_id: string | null
  tier: { name: string; monthly_price: number; yearly_price: number | null }
}

const STATUS_COLORS: Record<string, string> = {
  active:    'text-green-400 bg-green-500/10 border-green-500/20',
  trialing:  'text-blue-400  bg-blue-500/10  border-blue-500/20',
  past_due:  'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  canceled:  'text-red-400   bg-red-500/10   border-red-500/20',
  paused:    'text-slate-400 bg-slate-500/10 border-slate-500/20',
}

function MembershipPageInner() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const { workspace } = useWorkspace()
  const workSlug     = params.workspace as string
  const justSucceeded = searchParams.get('success') === '1'

  const [tiers,    setTiers]    = useState<Tier[]>([])
  const [sub,      setSub]      = useState<Subscription | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [interval, setInterval] = useState<'month' | 'year'>('month')
  const [checking, setChecking] = useState<string | null>(null)
  const [managing, setManaging] = useState(false)

  const fetchData = useCallback(async () => {
    if (!workspace?.id) return
    const res  = await fetch(`/api/student/memberships?workspaceId=${workspace.id}`)
    const data = await res.json()
    setTiers(data.tiers ?? [])
    setSub(data.subscription ?? null)
    setLoading(false)
  }, [workspace?.id])

  useEffect(() => { fetchData() }, [fetchData])

  const subscribe = async (tierId: string) => {
    setChecking(tierId)
    const res  = await fetch('/api/stripe/checkout/membership', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tierId, workspaceId: workspace.id, interval }),
    })
    const data = await res.json()
    setChecking(null)
    if (data.url) window.location.href = data.url
  }

  const manage = async () => {
    setManaging(true)
    const res  = await fetch('/api/stripe/billing-portal/membership', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ workspaceId: workspace.id }),
    })
    const data = await res.json()
    setManaging(false)
    if (data.url) window.location.href = data.url
  }

  if (loading) return (
    <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
  )

  const activeSub = sub && ['active','trialing'].includes(sub.status) ? sub : null

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Success banner */}
      {justSucceeded && (
        <div className="card border-green-500/30 bg-green-500/5 p-4 flex items-center gap-3 mb-6">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          <div>
            <p className="font-semibold text-green-400 text-sm">Membership activated!</p>
            <p className="text-slate-400 text-xs mt-0.5">You now have access to all included content.</p>
          </div>
        </div>
      )}

      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-bold text-white">Membership</h1>
        <p className="text-slate-400 mt-2">Get unlimited access to courses, paths, and community.</p>
      </div>

      {/* Current subscription card */}
      {sub && (
        <div className={`card p-5 mb-8 border ${activeSub ? 'border-gold-500/30 bg-gold-500/5' : ''}`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Crown className={`w-6 h-6 ${activeSub ? 'text-gold-400' : 'text-slate-500'}`} />
              <div>
                <p className="font-semibold text-white">{sub.tier?.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  ${sub.interval === 'year' ? sub.tier?.yearly_price : sub.tier?.monthly_price}
                  /{sub.interval === 'year' ? 'yr' : 'mo'}
                  {sub.current_period_end && (
                    <> · {sub.status === 'canceled' ? 'Access until' : 'Renews'}{' '}
                    {new Date(sub.current_period_end).toLocaleDateString()}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-1 rounded-full border capitalize ${STATUS_COLORS[sub.status] ?? ''}`}>
                {sub.status.replace('_',' ')}
              </span>
              {activeSub && (
                <button onClick={manage} disabled={managing}
                  className="btn-ghost text-sm flex items-center gap-1.5">
                  {managing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings className="w-3.5 h-3.5" />}
                  Manage
                </button>
              )}
            </div>
          </div>
          {sub.status === 'past_due' && (
            <div className="mt-3 flex items-center gap-2 text-yellow-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Your payment failed. Update your billing info to keep access.
              <button onClick={manage} disabled={managing} className="underline hover:no-underline ml-1">
                Update billing
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pricing interval toggle */}
      {!activeSub && tiers.some(t => t.yearly_price) && (
        <div className="flex justify-center mb-8">
          <div className="flex bg-navy-800 rounded-xl p-1 gap-1">
            {(['month','year'] as const).map((v) => (
              <button key={v} onClick={() => setInterval(v)}
                className={`px-5 py-1.5 rounded-lg text-sm transition-colors ${
                  interval === v ? 'bg-gold-500 text-navy-950 font-medium' : 'text-slate-400 hover:text-white'
                }`}>
                {v === 'month' ? 'Monthly' : 'Yearly'}
                {v === 'year' && <span className="ml-1.5 text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">Save</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tier cards */}
      {tiers.length === 0 ? (
        <div className="card p-16 text-center space-y-2">
          <Crown className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-slate-400">No membership tiers available yet.</p>
        </div>
      ) : (
        <div className={`grid gap-5 ${tiers.length === 1 ? 'max-w-sm mx-auto' : tiers.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
          {tiers.map((tier) => {
            const price    = interval === 'year' && tier.yearly_price ? tier.yearly_price : tier.monthly_price
            const perMonth = interval === 'year' && tier.yearly_price ? (tier.yearly_price / 12).toFixed(2) : null
            const isCurrent = sub?.tier_id === tier.id

            return (
              <div key={tier.id}
                className={`card p-6 flex flex-col ${isCurrent ? 'border-gold-500/50 bg-gold-500/5' : 'hover:border-navy-700'}`}>
                <div className="mb-4">
                  <h3 className="font-display font-bold text-white text-lg">{tier.name}</h3>
                  {tier.description && <p className="text-slate-400 text-sm mt-1">{tier.description}</p>}
                </div>

                <div className="mb-5">
                  <span className="text-3xl font-bold text-white">${price}</span>
                  <span className="text-slate-400 text-sm">/{interval === 'year' ? 'yr' : 'mo'}</span>
                  {perMonth && <p className="text-xs text-slate-500 mt-0.5">${perMonth}/month billed annually</p>}
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {tier.benefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      {b}
                    </li>
                  ))}
                  {tier.community_access && (
                    <li className="flex items-start gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      Community access
                    </li>
                  )}
                  {tier.resource_library_access && (
                    <li className="flex items-start gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      Resource library
                    </li>
                  )}
                  {tier.included_course_ids.length === 0 && (
                    <li className="flex items-start gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      All courses included
                    </li>
                  )}
                  {tier.included_path_ids.length === 0 && (
                    <li className="flex items-start gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      All learning paths included
                    </li>
                  )}
                </ul>

                {isCurrent && activeSub ? (
                  <button disabled className="btn-primary w-full opacity-60">Current Plan</button>
                ) : activeSub ? (
                  <button onClick={manage} disabled={managing}
                    className="btn-ghost w-full flex items-center justify-center gap-2">
                    Switch Plan
                  </button>
                ) : (
                  <button onClick={() => subscribe(tier.id)} disabled={!!checking}
                    className="btn-primary w-full flex items-center justify-center gap-2">
                    {checking === tier.id
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                      : <>Get Started <ArrowRight className="w-4 h-4" /></>}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Access summary for active members */}
      {activeSub && (
        <div className="mt-8 card p-5">
          <h2 className="font-semibold text-white mb-3 text-sm">Your Access</h2>
          <div className="grid sm:grid-cols-2 gap-2 text-sm text-slate-400">
            <Link href={`/w/${workSlug}/courses`} className="flex items-center gap-2 hover:text-white transition-colors">
              <ArrowRight className="w-3.5 h-3.5 text-gold-400" /> Browse courses
            </Link>
            <Link href={`/w/${workSlug}/paths`} className="flex items-center gap-2 hover:text-white transition-colors">
              <ArrowRight className="w-3.5 h-3.5 text-gold-400" /> Learning paths
            </Link>
            <Link href={`/w/${workSlug}/community`} className="flex items-center gap-2 hover:text-white transition-colors">
              <ArrowRight className="w-3.5 h-3.5 text-gold-400" /> Community
            </Link>
            <Link href={`/w/${workSlug}/dashboard`} className="flex items-center gap-2 hover:text-white transition-colors">
              <ArrowRight className="w-3.5 h-3.5 text-gold-400" /> Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MembershipPage() {
  return <Suspense><MembershipPageInner /></Suspense>
}
