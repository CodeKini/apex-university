'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams }                        from 'next/navigation'
import { useWorkspace }                     from '@/lib/workspace/context'
import { Trophy, Flame, Zap, Loader2 }     from 'lucide-react'

const RANK_COLORS = ['text-gold-400', 'text-slate-300', 'text-amber-600']
const RANK_ICONS  = ['🥇', '🥈', '🥉']

export default function LeaderboardPage() {
  const params    = useParams()
  const workSlug  = params.workspace as string
  const { workspace } = useWorkspace()

  const [entries,  setEntries]  = useState<any[]>([])
  const [myRank,   setMyRank]   = useState<number | null>(null)
  const [loading,  setLoading]  = useState(true)

  const fetchData = useCallback(async () => {
    const res  = await fetch(`/api/student/gamification/leaderboard?workspaceId=${workspace.id}`)
    const json = await res.json()
    setEntries(json.entries ?? [])
    setMyRank(json.my_rank)
    setLoading(false)
  }, [workspace.id])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-gold-400" />
          <h1 className="font-display text-3xl font-bold text-white">Leaderboard</h1>
        </div>
        {myRank && (
          <div className="card px-4 py-2 text-sm">
            <span className="text-slate-400">Your rank: </span>
            <span className="font-bold text-white">#{myRank}</span>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          No activity yet — be the first on the leaderboard!
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-10">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Student</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Lvl</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">XP</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <Flame className="w-3.5 h-3.5 inline" />
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Badges</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-800/60">
              {entries.map((e: any) => (
                <tr
                  key={e.user_id}
                  className={`transition-colors ${
                    e.is_me
                      ? 'bg-gold-500/5 border-l-2 border-gold-500/50'
                      : 'hover:bg-navy-800/20'
                  }`}
                >
                  <td className="px-4 py-3 font-bold">
                    {e.rank <= 3
                      ? <span className="text-lg">{RANK_ICONS[e.rank - 1]}</span>
                      : <span className={`text-slate-400 ${e.is_me ? 'text-gold-400' : ''}`}>#{e.rank}</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {e.avatar_url ? (
                        <img src={e.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-navy-700 flex items-center justify-center text-xs text-slate-400 font-bold">
                          {e.full_name?.[0] ?? '?'}
                        </div>
                      )}
                      <span className={`font-medium ${e.is_me ? 'text-gold-300' : 'text-white'}`}>
                        {e.full_name}{e.is_me ? ' (you)' : ''}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-bold text-white bg-navy-700 rounded-full px-2 py-0.5">
                      {e.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gold-400">
                    {e.total_xp.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-300 text-xs">
                    {e.streak > 0 ? (
                      <span className="flex items-center justify-center gap-1">
                        <Flame className="w-3 h-3 text-orange-400" />{e.streak}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-400 text-xs font-medium">
                    {e.badge_count || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
