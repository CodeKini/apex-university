'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams }                        from 'next/navigation'
import { useWorkspace }                     from '@/lib/workspace/context'
import { Flame, Zap, Trophy, Star, Loader2 } from 'lucide-react'

function XpBar({ pct }: { pct: number }) {
  return (
    <div className="h-2 bg-navy-800 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-gold-500 to-amber-400 rounded-full transition-all duration-700"
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

function BadgeCard({ badge }: { badge: any }) {
  return (
    <div
      title={badge.description}
      className={`card p-4 text-center transition-all ${
        badge.earned
          ? 'border-gold-500/30 shadow-gold-500/10 shadow-sm'
          : 'opacity-40 grayscale'
      }`}
    >
      <div className="text-3xl mb-2">{badge.icon}</div>
      <p className="text-xs font-semibold text-white leading-tight">{badge.name}</p>
      {badge.earned && badge.awarded_at && (
        <p className="text-xs text-slate-500 mt-1">
          {new Date(badge.awarded_at).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const params    = useParams()
  const workSlug  = params.workspace as string
  const { workspace } = useWorkspace()

  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const res  = await fetch(`/api/student/gamification/me?workspaceId=${workspace.id}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [workspace.id])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
    </div>
  )

  if (!data?.enabled) return (
    <div className="max-w-xl mx-auto px-6 py-20 text-center">
      <p className="text-slate-400">Gamification is not enabled for this workspace.</p>
    </div>
  )

  const xp     = data.xp
  const streak = data.streak
  const badges = data.badges ?? []
  const earned = badges.filter((b: any) => b.earned).length

  const todayStr = new Date().toISOString().split('T')[0]
  const activeToday = streak.last_activity_date === todayStr

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <h1 className="font-display text-3xl font-bold text-white">My Progress</h1>

      {/* XP + Level card */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gold-500/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-gold-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Level</p>
              <p className="text-3xl font-bold text-white">{xp.level}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Total XP</p>
            <p className="text-2xl font-bold text-gold-400">{xp.total.toLocaleString()}</p>
          </div>
        </div>

        <XpBar pct={xp.progress_pct} />
        <div className="flex justify-between mt-1.5 text-xs text-slate-500">
          <span>{xp.xp_in_level.toLocaleString()} XP</span>
          {xp.level < 50 ? (
            <span>{xp.xp_to_next.toLocaleString()} XP to Level {xp.level + 1}</span>
          ) : (
            <span className="text-gold-400">Max Level!</span>
          )}
        </div>
      </div>

      {/* Streak card */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <Flame className={`w-6 h-6 ${activeToday ? 'text-orange-400' : 'text-slate-600'}`} />
            <p className="font-semibold text-white">Daily Streak</p>
          </div>
          <p className="text-4xl font-bold text-white">{streak.current}
            <span className="text-base font-normal text-slate-400 ml-1">days</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {activeToday ? '✓ Active today' : 'No activity yet today — learn something to keep your streak!'}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <Trophy className="w-6 h-6 text-gold-400" />
            <p className="font-semibold text-white">Best Streak</p>
          </div>
          <p className="text-4xl font-bold text-white">{streak.longest}
            <span className="text-base font-normal text-slate-400 ml-1">days</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">Personal record</p>
        </div>
      </div>

      {/* Badges */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-gold-400" />
            <h2 className="font-semibold text-white">Badges</h2>
          </div>
          <span className="text-sm text-slate-400">{earned} / {badges.length} earned</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {badges.map((b: any) => <BadgeCard key={b.id} badge={b} />)}
        </div>
      </div>
    </div>
  )
}
