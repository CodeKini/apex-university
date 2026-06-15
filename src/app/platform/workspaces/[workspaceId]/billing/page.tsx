'use client'

import { useState, useEffect }         from 'react'
import { useParams, useSearchParams }  from 'next/navigation'
import { Suspense }                    from 'react'
import {
  AlertTriangle, CheckCircle2, ExternalLink, CreditCard,
  Clock, TrendingUp, Loader2, BookOpen, Users, HardDrive,
} from 'lucide-react'
import PlanCard       from '@/components/billing/PlanCard'
import { PLANS }      from '@/lib/stripe'
import { formatPrice } from '@/lib/utils'
import type { BillingInfo, PurchaseWithCourse } from '@/types/billing'
import type { WorkspaceUsage } from '@/lib/plans'

function BillingPageInner() {
  const { workspaceId }  = useParams() as { workspaceId: string }
  const searchParams     = useSearchParams()

  const [billing,    setBilling]    = useState<BillingInfo | null>(null)
  const [purchases,  setPurchases]  = useState<PurchaseWithCourse[]>([])
  const [usage,      setUsage]      = useState<WorkspaceUsage | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [selecting,  setSelecting]  = useState<string | null>(null)
  const [portalBusy, setPortalBusy] = useState(false)

  const showSuccess  = searchParams.get('success')  === '1'
  const showCanceled = searchParams.get('canceled') === '1'

  useEffect(() => {
    Promise.all([
      fetch(`/api/platform/billing?workspaceId=${workspaceId}`).then(r => r.json()),
      fetch(`/api/platform/usage?workspaceId=${workspaceId}`).then(r => r.json()),
    ]).then(([billingData, usageData]) => {
      setBilling(billingData.billing)
      setPurchases(billingData.purchases ?? [])
      setUsage(usageData.usage ?? null)
      setLoading(false)
    })
  }, [workspaceId])

  const handleSelectPlan = async (planName: string) => {
    setSelecting(planName)
    const res  = await fetch('/api/stripe/checkout/subscription', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ workspaceId, planName }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else          setSelecting(null)
  }

  const handleManagePortal = async () => {
    setPortalBusy(true)
    const res  = await fetch('/api/platform/billing', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ workspaceId }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else          setPortalBusy(false)
  }

  if (loading) return <div className="py-20 text-center text-slate-500 text-sm">Loading billing...</div>

  const status    = billing?.plan_status ?? 'trialing'
  const planName  = billing?.plan_name   ?? 'trial'
  const trialEnd  = billing?.trial_ends_at ? new Date(billing.trial_ends_at) : null
  const daysLeft  = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : 0
  const hasStripe = !!billing?.stripe_subscription_id

  return (
    <div className="space-y-8 max-w-5xl">

      {/* ── Banners ── */}
      {showSuccess && (
        <div className="card border-green-500/30 bg-green-500/5 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          <div>
            <p className="text-green-400 font-semibold text-sm">Subscription activated!</p>
            <p className="text-slate-400 text-xs mt-0.5">Your workspace is now on the {planName} plan. Enjoy!</p>
          </div>
        </div>
      )}

      {status === 'past_due' && (
        <div className="card border-red-500/30 bg-red-500/5 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="flex-1">
            <p className="text-red-400 font-semibold text-sm">Payment past due</p>
            <p className="text-slate-400 text-xs mt-0.5">Update your payment method to keep your workspace active.</p>
          </div>
          <button onClick={handleManagePortal} disabled={portalBusy}
            className="btn-primary text-sm shrink-0 flex items-center gap-1.5">
            {portalBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
            Fix payment
          </button>
        </div>
      )}

      {status === 'canceled' && (
        <div className="card border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-amber-300 text-sm flex-1">Your subscription is canceled. Subscribe to a plan to reactivate your workspace.</p>
        </div>
      )}

      {/* ── Current plan status card ── */}
      <div className="card p-6">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gold-400" /> Current Plan
        </h2>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-slate-500 text-xs">Plan</p>
            <p className="text-white font-bold text-lg capitalize mt-0.5">{planName}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Status</p>
            <StatusBadge status={status} />
          </div>
          {status === 'trialing' && trialEnd && (
            <div>
              <p className="text-slate-500 text-xs">Trial ends</p>
              <p className="text-amber-400 font-medium text-sm mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
              </p>
            </div>
          )}
          {hasStripe && (
            <div className="ml-auto">
              <button
                onClick={handleManagePortal}
                disabled={portalBusy}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
              >
                {portalBusy
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <ExternalLink className="w-4 h-4" />}
                Manage billing
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Usage meters ── */}
      {usage && <UsageMeters usage={usage} />}

      {/* ── Plan selection ── */}
      <div>
        <h2 className="font-display text-xl font-bold text-white mb-2">Choose a Plan</h2>
        <p className="text-slate-400 text-sm mb-6">
          All plans include a 14-day free trial. No credit card required to start.
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.name}
              plan={plan}
              currentPlan={planName}
              currentStatus={status}
              workspaceId={workspaceId}
              onSelect={handleSelectPlan}
              loading={selecting === plan.name}
            />
          ))}
        </div>
      </div>

      {/* ── Recent student purchases in this workspace ── */}
      {purchases.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gold-400" /> Recent Course Purchases
          </h2>
          <div className="divide-y divide-navy-800">
            {purchases.map((p) => (
              <div key={p.id} className="py-3 flex items-center gap-4 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 truncate">{(p as any).courses?.title ?? 'Unknown course'}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <span className="text-green-400 font-medium shrink-0">
                  {formatPrice(p.amount_cents / 100)}
                </span>
                <span className="text-xs text-slate-500 capitalize shrink-0">{p.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function UsageMeter({
  icon: Icon,
  label,
  used,
  max,
  formatUsed,
  formatMax,
}: {
  icon: React.ElementType
  label: string
  used: number
  max: number
  formatUsed: (n: number) => string
  formatMax:  (n: number) => string
}) {
  const unlimited = max === -1
  const pct       = unlimited ? 0 : Math.min(100, Math.round((used / max) * 100))
  const near      = pct >= 80
  const over      = pct >= 100

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-slate-400">
          <Icon className="w-4 h-4" />
          {label}
        </span>
        <span className={over ? 'text-red-400 font-medium' : near ? 'text-amber-400' : 'text-slate-300'}>
          {formatUsed(used)}
          {!unlimited && <span className="text-slate-500"> / {formatMax(max)}</span>}
          {unlimited && <span className="text-slate-500"> / unlimited</span>}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 bg-navy-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-indigo-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

function UsageMeters({ usage }: { usage: WorkspaceUsage }) {
  const GB = 1024 * 1024 * 1024
  const fmtGB  = (b: number) => b < GB ? `${(b / (1024 * 1024)).toFixed(0)} MB` : `${(b / GB).toFixed(1)} GB`
  const fmtNum = (n: number) => n.toLocaleString()

  return (
    <div className="card p-6 space-y-5">
      <h2 className="font-semibold text-white flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-gold-400" /> Plan Usage
        <span className="ml-auto text-xs text-slate-500 font-normal capitalize">{usage.plan} plan</span>
      </h2>
      <UsageMeter
        icon={BookOpen}
        label="Courses"
        used={usage.courseCount}
        max={usage.limits.maxCourses}
        formatUsed={fmtNum}
        formatMax={fmtNum}
      />
      <UsageMeter
        icon={Users}
        label="Students"
        used={usage.studentCount}
        max={usage.limits.maxStudents}
        formatUsed={fmtNum}
        formatMax={fmtNum}
      />
      <UsageMeter
        icon={HardDrive}
        label="Storage"
        used={usage.storageBytes}
        max={usage.limits.maxStorageBytes}
        formatUsed={fmtGB}
        formatMax={fmtGB}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:   { label: 'Active',    cls: 'text-green-400 bg-green-500/10' },
    trialing: { label: 'Trial',     cls: 'text-amber-400 bg-amber-500/10' },
    past_due: { label: 'Past due',  cls: 'text-red-400   bg-red-500/10'   },
    canceled: { label: 'Canceled',  cls: 'text-slate-400 bg-navy-800'     },
    paused:   { label: 'Paused',    cls: 'text-slate-400 bg-navy-800'     },
  }
  const { label, cls } = map[status] ?? map.canceled
  return (
    <span className={`text-sm font-medium px-2 py-0.5 rounded mt-0.5 inline-block ${cls}`}>{label}</span>
  )
}

export default function WorkspaceBillingPage() {
  return <Suspense><BillingPageInner /></Suspense>
}
