'use client'

import { CheckCircle2, Zap, Loader2 } from 'lucide-react'
import type { Plan }                  from '@/types/billing'

interface Props {
  plan:           Plan
  currentPlan:    string
  currentStatus:  string
  workspaceId:    string
  onSelect:       (planName: string) => void
  loading:        boolean
}

export default function PlanCard({
  plan, currentPlan, currentStatus, workspaceId, onSelect, loading,
}: Props) {
  const isCurrentPlan = currentPlan === plan.name
  const isActive      = isCurrentPlan && ['active', 'trialing'].includes(currentStatus)

  return (
    <div
      className={`card p-6 flex flex-col relative transition-all ${
        plan.highlighted
          ? 'border-gold-500/50 bg-gold-500/5'
          : isActive
          ? 'border-green-500/30'
          : ''
      }`}
    >
      {plan.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-gold-500 text-navy-950 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
            <Zap className="w-3 h-3" /> Most popular
          </span>
        </div>
      )}

      {isActive && (
        <div className="absolute -top-3 right-4">
          <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            Current plan
          </span>
        </div>
      )}

      <div className="mb-5">
        <h3 className="font-display text-lg font-bold text-white">{plan.label}</h3>
        <div className="flex items-baseline gap-1 mt-2">
          <span className="text-3xl font-bold text-white">${plan.price}</span>
          <span className="text-slate-400 text-sm">/month</span>
        </div>
        <p className="text-slate-500 text-xs mt-1">Billed monthly · 14-day free trial</p>
      </div>

      <ul className="space-y-2.5 mb-6 flex-1">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(plan.name)}
        disabled={loading || isActive}
        className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
          isActive
            ? 'bg-green-500/10 text-green-400 border border-green-500/30 cursor-default'
            : plan.highlighted
            ? 'btn-primary'
            : 'bg-navy-800 text-white hover:bg-navy-700 border border-navy-700'
        }`}
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting...</>
        ) : isActive ? (
          'Current plan'
        ) : isCurrentPlan ? (
          'Reactivate'
        ) : (
          `Start with ${plan.label}`
        )}
      </button>
    </div>
  )
}
