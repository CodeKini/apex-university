'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams }                        from 'next/navigation'
import {
  Zap, Flame, Trophy, Star, Users, Loader2, Save, CheckCircle2,
} from 'lucide-react'

const EVENT_LABELS: Record<string, string> = {
  complete_lesson:  'Complete Lesson',
  pass_quiz:        'Pass Quiz',
  complete_course:  'Complete Course',
  earn_certificate: 'Earn Certificate',
  complete_path:    'Complete Learning Path',
  community_post:   'Community Post',
  receive_reaction: 'Receive Reaction',
  refer_purchase:   'Referral Purchase',
  daily_streak:     'Daily Streak Bonus',
}

const EVENTS = Object.keys(EVENT_LABELS) as string[]

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-navy-800 text-white' : 'text-slate-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}

export default function GamificationPage() {
  const params      = useParams()
  const workspaceId = params.workspaceId as string

  const [tab,       setTab]       = useState<'settings' | 'badges' | 'students'>('settings')
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [settings,  setSettings]  = useState<any>(null)
  const [badges,    setBadges]    = useState<any[]>([])
  const [students,  setStudents]  = useState<any[]>([])
  const [studLoad,  setStudLoad]  = useState(false)

  const fetchSettings = useCallback(async () => {
    const res  = await fetch(`/api/platform/gamification/settings?workspaceId=${workspaceId}`)
    const json = await res.json()
    setSettings(json.settings ?? {})
    setBadges(json.badges ?? [])
    setLoading(false)
  }, [workspaceId])

  const fetchStudents = useCallback(async () => {
    setStudLoad(true)
    const res  = await fetch(`/api/platform/gamification/students?workspaceId=${workspaceId}`)
    const json = await res.json()
    setStudents(json.students ?? [])
    setStudLoad(false)
  }, [workspaceId])

  useEffect(() => { fetchSettings() }, [fetchSettings])
  useEffect(() => { if (tab === 'students') fetchStudents() }, [tab, fetchStudents])

  const setField = (key: string, value: any) =>
    setSettings((s: any) => ({ ...s, [key]: value }))

  const saveSettings = async () => {
    setSaving(true)
    const badge_toggles: Record<string, boolean> = {}
    for (const b of badges) badge_toggles[b.id] = b.is_enabled
    await fetch('/api/platform/gamification/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, ...settings, badge_toggles }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return (
    <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
  )

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Gamification</h1>
          <p className="text-slate-400 text-sm mt-1">XP events, levels, badges, and streaks for students.</p>
        </div>
        {tab !== 'students' && (
          <button onClick={saveSettings} disabled={saving} className="btn-primary flex items-center gap-2">
            {saved
              ? <><CheckCircle2 className="w-4 h-4" /> Saved</>
              : saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <><Save className="w-4 h-4" /> Save Changes</>
            }
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-navy-800 pb-1">
        <TabBtn label="Settings" active={tab === 'settings'} onClick={() => setTab('settings')} />
        <TabBtn label="Badges"   active={tab === 'badges'}   onClick={() => setTab('badges')} />
        <TabBtn label="Students" active={tab === 'students'} onClick={() => setTab('students')} />
      </div>

      {/* ── Settings tab ── */}
      {tab === 'settings' && (
        <div className="space-y-6">
          {/* Master toggle */}
          <div className="card p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">Enable Gamification</p>
              <p className="text-sm text-slate-400">When disabled, no XP is awarded and student dashboards hide gamification UI.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings?.enabled ?? true}
                onChange={(e) => setField('enabled', e.target.checked)}
              />
              <div className="w-11 h-6 bg-navy-700 peer-focus:outline-none rounded-full peer
                peer-checked:after:translate-x-full peer-checked:after:border-white
                after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all
                peer-checked:bg-gold-500" />
            </label>
          </div>

          {/* XP events */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-navy-800 flex items-center gap-2">
              <Zap className="w-4 h-4 text-gold-400" />
              <h2 className="font-semibold text-white text-sm">XP Events</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-800">
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Event</th>
                  <th className="px-5 py-2.5 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Enabled</th>
                  <th className="px-5 py-2.5 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider w-36">XP Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60">
                {EVENTS.map((ev) => (
                  <tr key={ev}>
                    <td className="px-5 py-3 text-slate-300">{EVENT_LABELS[ev]}</td>
                    <td className="px-5 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={settings?.[`ev_${ev}`] ?? true}
                        onChange={(e) => setField(`ev_${ev}`, e.target.checked)}
                        className="w-4 h-4 accent-gold-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <input
                        type="number" min={0} max={9999}
                        value={settings?.[`xp_${ev}`] ?? ''}
                        onChange={(e) => setField(`xp_${ev}`, parseInt(e.target.value) || 0)}
                        placeholder={String({
                          complete_lesson: 10, pass_quiz: 25, complete_course: 100,
                          earn_certificate: 150, complete_path: 200, community_post: 5,
                          receive_reaction: 2, refer_purchase: 500, daily_streak: 15,
                        }[ev] ?? 0)}
                        className="input-field w-24 text-center py-1.5 text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Badges tab ── */}
      {tab === 'badges' && (
        <div>
          <p className="text-sm text-slate-400 mb-4">Toggle which badges students can earn. Disabled badges are hidden from students.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {badges.map((b: any) => (
              <div
                key={b.id}
                className={`card p-4 transition-all ${b.is_enabled ? '' : 'opacity-50'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{b.icon}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={b.is_enabled}
                      onChange={(e) => setBadges((prev) =>
                        prev.map((x) => x.id === b.id ? { ...x, is_enabled: e.target.checked } : x)
                      )}
                    />
                    <div className="w-9 h-5 bg-navy-700 rounded-full peer
                      peer-checked:after:translate-x-full peer-checked:after:border-white
                      after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                      after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all
                      peer-checked:bg-gold-500" />
                  </label>
                </div>
                <p className="font-semibold text-white text-sm">{b.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Students tab ── */}
      {tab === 'students' && (
        <div>
          {studLoad ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
          ) : students.length === 0 ? (
            <div className="card p-12 text-center text-slate-400">No student XP data yet.</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-800 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Student</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Lvl</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">XP</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Streak</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Badges</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-800/60">
                  {students.map((s: any) => (
                    <tr key={s.user_id} className="hover:bg-navy-800/20">
                      <td className="px-4 py-3 text-slate-400">{s.rank}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-white">{s.full_name}</p>
                          <p className="text-xs text-slate-500">{s.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-bold text-white bg-navy-700 rounded-full px-2 py-0.5">{s.level}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gold-400">
                        {s.total_xp.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-300">
                        {s.streak > 0
                          ? <span className="flex items-center justify-center gap-1"><Flame className="w-3 h-3 text-orange-400" />{s.streak}</span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-0.5 flex-wrap">
                          {s.badges.slice(0, 5).map((b: any, i: number) => (
                            <span key={i} title={b.name} className="text-base leading-none">{b.icon}</span>
                          ))}
                          {s.badges.length > 5 && (
                            <span className="text-xs text-slate-500">+{s.badges.length - 5}</span>
                          )}
                          {s.badges.length === 0 && <span className="text-slate-600 text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {s.last_active ? new Date(s.last_active).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
