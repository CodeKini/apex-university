'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams }                        from 'next/navigation'
import {
  Plus, Crown, Loader2, MoreHorizontal, Users, TrendingUp,
  CheckCircle2, XCircle, Edit2, Trash2, ChevronDown, ChevronUp,
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
  is_active: boolean
  active_count: [{ count: number }]
  stripe_monthly_price_id: string | null
  stripe_yearly_price_id:  string | null
}

interface AnalyticsData {
  active_count:   number
  canceled_count: number
  past_due_count: number
  mrr:            number
  subscriptions:  any[]
}

// ── Create / Edit Modal ────────────────────────────────────────────────────────

interface ModalProps {
  workspaceId: string
  tier?: Tier | null
  courses: { id: string; title: string }[]
  paths:   { id: string; title: string }[]
  onSave:  () => void
  onClose: () => void
}

function TierModal({ workspaceId, tier, courses, paths, onSave, onClose }: ModalProps) {
  const editing = !!tier
  const [name,          setName]          = useState(tier?.name ?? '')
  const [description,   setDescription]   = useState(tier?.description ?? '')
  const [monthlyPrice,  setMonthlyPrice]  = useState(String(tier?.monthly_price ?? ''))
  const [yearlyPrice,   setYearlyPrice]   = useState(tier?.yearly_price != null ? String(tier.yearly_price) : '')
  const [benefits,      setBenefits]      = useState<string[]>(tier?.benefits ?? [''])
  const [communityAccess,  setCommunityAccess]  = useState(tier?.community_access  ?? false)
  const [resourceAccess,   setResourceAccess]   = useState(tier?.resource_library_access ?? false)
  const [includedCourseIds, setIncludedCourseIds] = useState<string[]>(tier?.included_course_ids ?? [])
  const [includedPathIds,   setIncludedPathIds]   = useState<string[]>(tier?.included_path_ids   ?? [])
  const [isActive,      setIsActive]      = useState(tier?.is_active ?? true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [showCourses, setShowCourses] = useState(false)
  const [showPaths,   setShowPaths]   = useState(false)

  const setBenefit = (i: number, v: string) => setBenefits((p) => p.map((x, j) => j === i ? v : x))
  const addBenefit = () => setBenefits((p) => [...p, ''])
  const removeBenefit = (i: number) => setBenefits((p) => p.filter((_, j) => j !== i))
  const toggleCourse = (id: string) => setIncludedCourseIds((p) => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const togglePath   = (id: string) => setIncludedPathIds  ((p) => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim())     { setError('Name is required.'); return }
    if (!monthlyPrice || Number(monthlyPrice) < 0) { setError('Monthly price is required.'); return }
    setSaving(true); setError('')

    const payload: any = {
      name:                    name.trim(),
      description:             description.trim() || null,
      monthly_price:           Number(monthlyPrice),
      yearly_price:            yearlyPrice ? Number(yearlyPrice) : null,
      benefits:                benefits.filter(Boolean),
      community_access:        communityAccess,
      resource_library_access: resourceAccess,
      included_course_ids:     includedCourseIds,
      included_path_ids:       includedPathIds,
      is_active:               isActive,
    }
    if (!editing) payload.workspace_id = workspaceId

    const url    = editing ? `/api/platform/memberships/${tier!.id}` : '/api/platform/memberships'
    const method = editing ? 'PATCH' : 'POST'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data   = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Save failed.'); return }
    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="font-display text-lg font-bold text-white mb-5">{editing ? 'Edit Membership Tier' : 'Create Membership Tier'}</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Tier Name</label>
              <input className="input" placeholder="e.g. Pro Member" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Description <span className="text-slate-500 font-normal">(optional)</span></label>
              <textarea className="input min-h-[60px] resize-y" placeholder="What students get with this membership…" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Monthly Price ($)</label>
                <input type="number" min={0} step="0.01" className="input" placeholder="9.99" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} required />
              </div>
              <div>
                <label className="label">Yearly Price ($) <span className="text-slate-500 font-normal">(optional)</span></label>
                <input type="number" min={0} step="0.01" className="input" placeholder="99.99" value={yearlyPrice} onChange={(e) => setYearlyPrice(e.target.value)} />
              </div>
            </div>

            {/* Benefits */}
            <div>
              <label className="label">Benefits</label>
              <div className="space-y-2">
                {benefits.map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="input flex-1" placeholder={`Benefit ${i + 1}`} value={b} onChange={(e) => setBenefit(i, e.target.value)} />
                    {benefits.length > 1 && (
                      <button type="button" onClick={() => removeBenefit(i)} className="text-slate-600 hover:text-red-400 px-2">×</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addBenefit} className="text-xs text-gold-400 hover:text-gold-300 mt-2">+ Add benefit</button>
            </div>

            {/* Access toggles */}
            <div className="space-y-2">
              <label className="label">Access</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={communityAccess}  onChange={(e) => setCommunityAccess(e.target.checked)}  className="w-4 h-4 accent-gold-400" />
                <span className="text-sm text-slate-300">Community access</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={resourceAccess} onChange={(e) => setResourceAccess(e.target.checked)}   className="w-4 h-4 accent-gold-400" />
                <span className="text-sm text-slate-300">Resource library access</span>
              </label>
            </div>

            {/* Included courses */}
            {courses.length > 0 && (
              <div>
                <button type="button" onClick={() => setShowCourses(v => !v)}
                  className="flex items-center gap-2 text-sm text-slate-300 hover:text-white w-full">
                  {showCourses ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  Included Courses
                  <span className="text-slate-500 font-normal text-xs">
                    {includedCourseIds.length === 0 ? '(all courses)' : `(${includedCourseIds.length} selected)`}
                  </span>
                </button>
                {showCourses && (
                  <div className="mt-2 border border-navy-700 rounded-lg divide-y divide-navy-700 max-h-36 overflow-y-auto">
                    <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-navy-800">
                      <input type="checkbox" checked={includedCourseIds.length === 0}
                        onChange={() => setIncludedCourseIds([])} className="accent-gold-400" />
                      <span className="text-sm text-slate-300 italic">All courses</span>
                    </label>
                    {courses.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-navy-800">
                        <input type="checkbox" checked={includedCourseIds.includes(c.id)} onChange={() => toggleCourse(c.id)} className="accent-gold-400" />
                        <span className="text-sm text-slate-300">{c.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Included paths */}
            {paths.length > 0 && (
              <div>
                <button type="button" onClick={() => setShowPaths(v => !v)}
                  className="flex items-center gap-2 text-sm text-slate-300 hover:text-white w-full">
                  {showPaths ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  Included Learning Paths
                  <span className="text-slate-500 font-normal text-xs">
                    {includedPathIds.length === 0 ? '(all paths)' : `(${includedPathIds.length} selected)`}
                  </span>
                </button>
                {showPaths && (
                  <div className="mt-2 border border-navy-700 rounded-lg divide-y divide-navy-700 max-h-36 overflow-y-auto">
                    <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-navy-800">
                      <input type="checkbox" checked={includedPathIds.length === 0}
                        onChange={() => setIncludedPathIds([])} className="accent-gold-400" />
                      <span className="text-sm text-slate-300 italic">All paths</span>
                    </label>
                    {paths.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-navy-800">
                        <input type="checkbox" checked={includedPathIds.includes(p.id)} onChange={() => togglePath(p.id)} className="accent-gold-400" />
                        <span className="text-sm text-slate-300">{p.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-gold-400" />
              <label htmlFor="active" className="text-sm text-slate-300 cursor-pointer">Active (visible to students)</label>
            </div>

            {!editing && (
              <div className="bg-navy-800/60 rounded-lg p-3 text-xs text-slate-400">
                Stripe product and price IDs will be created automatically when you save this tier.
              </div>
            )}
            {editing && !tier?.stripe_monthly_price_id && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-400">
                No Stripe price configured. Students cannot subscribe until a price is set up.
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? 'Save Changes' : 'Create Tier'}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MembershipsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [tiers,    setTiers]    = useState<Tier[]>([])
  const [courses,  setCourses]  = useState<{ id: string; title: string }[]>([])
  const [paths,    setPaths]    = useState<{ id: string; title: string }[]>([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState<'create' | 'edit' | null>(null)
  const [editing,  setEditing]  = useState<Tier | null>(null)
  const [analytics, setAnalytics] = useState<Record<string, AnalyticsData>>({})
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const [tRes, cRes, pRes] = await Promise.all([
      fetch(`/api/platform/memberships?workspaceId=${workspaceId}`),
      fetch(`/api/platform/courses?workspaceId=${workspaceId}`),
      fetch(`/api/platform/paths?workspaceId=${workspaceId}`),
    ])
    const [td, cd, pd] = await Promise.all([tRes.json(), cRes.json(), pRes.json()])
    setTiers(td.tiers ?? [])
    setCourses((cd.courses ?? []).map((c: any) => ({ id: c.id, title: c.title })))
    setPaths((pd.paths   ?? []).map((p: any) => ({ id: p.id, title: p.title })))
    setLoading(false)

    // Fetch analytics for each tier
    const tiers: Tier[] = td.tiers ?? []
    if (tiers.length > 0) {
      const aResults = await Promise.all(
        tiers.map((t: Tier) => fetch(`/api/platform/memberships/${t.id}/analytics`).then(r => r.json()))
      )
      const aMap: Record<string, AnalyticsData> = {}
      tiers.forEach((t: Tier, i: number) => { aMap[t.id] = aResults[i] })
      setAnalytics(aMap)
    }
  }, [workspaceId])

  useEffect(() => { fetchAll() }, [fetchAll])

  const deactivate = async (id: string) => {
    await fetch(`/api/platform/memberships/${id}`, { method: 'DELETE' })
    setMenuOpen(null); fetchAll()
  }

  const totalMRR     = Object.values(analytics).reduce((s, a) => s + (a.mrr ?? 0), 0)
  const totalActive  = Object.values(analytics).reduce((s, a) => s + (a.active_count ?? 0), 0)
  const totalCanceled= Object.values(analytics).reduce((s, a) => s + (a.canceled_count ?? 0), 0)

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Memberships</h1>
          <p className="text-slate-400 text-sm mt-1">Recurring subscription tiers for your students.</p>
        </div>
        <button onClick={() => { setEditing(null); setModal('create') }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Tier
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-2xl font-bold text-white">{totalActive}</div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Users className="w-3 h-3" /> Active Members</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-gold-400">${totalMRR.toFixed(2)}</div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Estimated MRR</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-red-400">{totalCanceled}</div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1"><XCircle className="w-3 h-3" /> Canceled</div>
        </div>
      </div>

      {tiers.length === 0 ? (
        <div className="card p-16 text-center space-y-3">
          <Crown className="w-10 h-10 text-slate-600 mx-auto" />
          <h2 className="font-semibold text-white">No membership tiers yet</h2>
          <p className="text-slate-400 text-sm">Create recurring subscription tiers for your students.</p>
          <button onClick={() => setModal('create')} className="btn-primary inline-flex">Create Tier</button>
        </div>
      ) : (
        <div className="space-y-4">
          {tiers.map((tier) => {
            const a = analytics[tier.id]
            const activeCount = a?.active_count ?? tier.active_count?.[0]?.count ?? 0
            return (
              <div key={tier.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <h3 className="font-semibold text-white text-lg">{tier.name}</h3>
                      {!tier.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">Inactive</span>}
                      {!tier.stripe_monthly_price_id && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">No Stripe price</span>
                      )}
                    </div>
                    {tier.description && <p className="text-slate-400 text-sm mb-3">{tier.description}</p>}

                    <div className="flex flex-wrap gap-4 text-sm mb-3">
                      <span className="font-medium text-gold-400">${tier.monthly_price}/mo</span>
                      {tier.yearly_price && <span className="text-slate-400">${tier.yearly_price}/yr</span>}
                      <span className="flex items-center gap-1 text-slate-400"><Users className="w-3.5 h-3.5" />{activeCount} active</span>
                      {a && <span className="text-slate-400">MRR: <span className="text-white">${a.mrr.toFixed(2)}</span></span>}
                      {a?.past_due_count ? <span className="text-yellow-400">{a.past_due_count} past due</span> : null}
                    </div>

                    {tier.benefits.length > 0 && (
                      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        {tier.benefits.slice(0, 4).map((b, i) => (
                          <li key={i} className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" />{b}</li>
                        ))}
                        {tier.benefits.length > 4 && <li className="text-slate-600">+{tier.benefits.length - 4} more</li>}
                      </ul>
                    )}

                    {a?.subscriptions && a.subscriptions.length > 0 && (
                      <div className="mt-4 border-t border-navy-800 pt-3">
                        <p className="text-xs text-slate-500 mb-2">Recent members</p>
                        <div className="flex flex-wrap gap-2">
                          {a.subscriptions.filter((s: any) => ['active','trialing'].includes(s.status)).slice(0, 8).map((s: any) => (
                            <span key={s.id} className="text-xs bg-navy-800 rounded-lg px-2 py-1 text-slate-300">
                              {s.user?.full_name || s.user?.email}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative shrink-0">
                    <button onClick={() => setMenuOpen(menuOpen === tier.id ? null : tier.id)}
                      className="text-slate-500 hover:text-white p-1">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {menuOpen === tier.id && (
                      <div className="absolute right-0 top-6 z-20 bg-navy-800 border border-navy-700 rounded-lg py-1 w-36 shadow-xl">
                        <button onClick={() => { setEditing(tier); setModal('edit'); setMenuOpen(null) }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-navy-700 flex items-center gap-2">
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={() => deactivate(tier.id)}
                          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-navy-700 flex items-center gap-2">
                          <Trash2 className="w-3 h-3" /> Deactivate
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(modal === 'create' || modal === 'edit') && (
        <TierModal
          workspaceId={workspaceId}
          tier={modal === 'edit' ? editing : null}
          courses={courses}
          paths={paths}
          onSave={() => { setModal(null); fetchAll() }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
