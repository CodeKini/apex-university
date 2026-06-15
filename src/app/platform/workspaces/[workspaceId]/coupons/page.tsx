'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams }                        from 'next/navigation'
import { Plus, Tag, Loader2, MoreHorizontal, CheckCircle2, XCircle } from 'lucide-react'

interface Coupon {
  id: string
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  applies_to: string
  max_redemptions: number | null
  per_user_limit: number
  redemption_count: number
  starts_at: string | null
  expires_at: string | null
  is_active: boolean
  revenue_saved_cents: number
  created_at: string
}

function formatDiscount(c: Coupon) {
  return c.discount_type === 'percent'
    ? `${c.discount_value}% off`
    : `$${Number(c.discount_value).toFixed(2)} off`
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CouponStatus({ c }: { c: Coupon }) {
  if (!c.is_active) return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">Archived</span>
  const now = new Date()
  if (c.starts_at && new Date(c.starts_at) > now)
    return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">Scheduled</span>
  if (c.expires_at && new Date(c.expires_at) < now)
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Expired</span>
  if (c.max_redemptions !== null && c.redemption_count >= c.max_redemptions)
    return <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400">Maxed out</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">Active</span>
}

// ── Create / Edit modal ───────────────────────────────────────────────────────

interface ModalProps {
  workspaceId: string
  coupon?: Coupon | null
  courses: { id: string; title: string }[]
  onSave: () => void
  onClose: () => void
}

function CouponModal({ workspaceId, coupon, courses, onSave, onClose }: ModalProps) {
  const editing = !!coupon

  const [code,           setCode]           = useState(coupon?.code           ?? '')
  const [discountType,   setDiscountType]   = useState(coupon?.discount_type  ?? 'percent')
  const [discountValue,  setDiscountValue]  = useState(String(coupon?.discount_value ?? ''))
  const [appliesTo,      setAppliesTo]      = useState(coupon?.applies_to     ?? 'all')
  const [courseIds,      setCourseIds]      = useState<string[]>(coupon?.applies_to === 'specific' ? (coupon as any).course_ids ?? [] : [])
  const [maxRedemptions, setMaxRedemptions] = useState(coupon?.max_redemptions != null ? String(coupon.max_redemptions) : '')
  const [perUserLimit,   setPerUserLimit]   = useState(String(coupon?.per_user_limit ?? 1))
  const [startsAt,       setStartsAt]       = useState(coupon?.starts_at  ? coupon.starts_at.slice(0,16) : '')
  const [expiresAt,      setExpiresAt]      = useState(coupon?.expires_at ? coupon.expires_at.slice(0,16) : '')
  const [isActive,       setIsActive]       = useState(coupon?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const toggleCourse = (id: string) => {
    setCourseIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) { setError('Code is required.'); return }
    if (!discountValue || Number(discountValue) <= 0) { setError('Discount value must be positive.'); return }
    if (discountType === 'percent' && Number(discountValue) > 100) { setError('Percent discount cannot exceed 100.'); return }
    if (appliesTo === 'specific' && courseIds.length === 0) { setError('Select at least one course.'); return }
    setSaving(true); setError('')

    const payload: any = {
      code:            code.trim().toUpperCase(),
      discount_type:   discountType,
      discount_value:  Number(discountValue),
      applies_to:      appliesTo,
      course_ids:      appliesTo === 'specific' ? courseIds : null,
      max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
      per_user_limit:  Number(perUserLimit) || 1,
      starts_at:       startsAt  ? new Date(startsAt).toISOString()  : null,
      expires_at:      expiresAt ? new Date(expiresAt).toISOString() : null,
      is_active:       isActive,
    }

    const url     = editing ? `/api/platform/coupons/${coupon!.id}` : '/api/platform/coupons'
    const method  = editing ? 'PATCH' : 'POST'
    if (!editing) payload.workspace_id = workspaceId

    const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Save failed.'); return }
    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="font-display text-lg font-bold text-white mb-4">{editing ? 'Edit Coupon' : 'Create Coupon'}</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Coupon Code</label>
              <input className="input uppercase" placeholder="e.g. LAUNCH50" value={code} onChange={(e) => setCode(e.target.value)} required />
              <p className="text-xs text-slate-500 mt-1">Students enter this at checkout. Automatically uppercased.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Discount Type</label>
                <select className="input" value={discountType} onChange={(e) => setDiscountType(e.target.value as any)}>
                  <option value="percent">Percent (%)</option>
                  <option value="fixed">Fixed ($)</option>
                </select>
              </div>
              <div>
                <label className="label">Discount Value</label>
                <input type="number" min={0.01} step="0.01" className="input" placeholder={discountType === 'percent' ? '50' : '10.00'} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="label">Applies To</label>
              <select className="input" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)}>
                <option value="all">All paid courses</option>
                <option value="specific">Specific courses</option>
              </select>
            </div>

            {appliesTo === 'specific' && (
              <div>
                <label className="label">Select Courses</label>
                <div className="border border-navy-700 rounded-lg divide-y divide-navy-700 max-h-40 overflow-y-auto">
                  {courses.length === 0 && <p className="text-xs text-slate-500 p-3">No courses available.</p>}
                  {courses.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-navy-800">
                      <input type="checkbox" checked={courseIds.includes(c.id)} onChange={() => toggleCourse(c.id)} className="accent-gold-400" />
                      <span className="text-sm text-slate-300">{c.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Max Redemptions <span className="text-slate-500 font-normal">(optional)</span></label>
                <input type="number" min={1} className="input" placeholder="Unlimited" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} />
              </div>
              <div>
                <label className="label">Per-User Limit</label>
                <input type="number" min={1} className="input" value={perUserLimit} onChange={(e) => setPerUserLimit(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Start Date <span className="text-slate-500 font-normal">(optional)</span></label>
                <input type="datetime-local" className="input" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div>
                <label className="label">Expiry Date <span className="text-slate-500 font-normal">(optional)</span></label>
                <input type="datetime-local" className="input" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-gold-400" />
              <label htmlFor="active" className="text-sm text-slate-300 cursor-pointer">Active</label>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? 'Save Changes' : 'Create Coupon'}
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

export default function CouponsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [coupons,  setCoupons]  = useState<Coupon[]>([])
  const [courses,  setCourses]  = useState<{ id: string; title: string }[]>([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState<'create' | 'edit' | null>(null)
  const [editing,  setEditing]  = useState<Coupon | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const fetchCoupons = useCallback(async () => {
    const [cRes, coRes] = await Promise.all([
      fetch(`/api/platform/coupons?workspaceId=${workspaceId}`),
      fetch(`/api/platform/courses?workspaceId=${workspaceId}`),
    ])
    const [cd, cod] = await Promise.all([cRes.json(), coRes.json()])
    setCoupons(cd.coupons ?? [])
    setCourses((cod.courses ?? []).map((c: any) => ({ id: c.id, title: c.title })))
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { fetchCoupons() }, [fetchCoupons])

  const archive = async (id: string) => {
    await fetch(`/api/platform/coupons/${id}`, { method: 'DELETE' })
    setMenuOpen(null)
    fetchCoupons()
  }

  const openEdit = (c: Coupon) => {
    setEditing(c); setModal('edit'); setMenuOpen(null)
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>

  const totalRevenueSaved = coupons.reduce((s, c) => s + (c.revenue_saved_cents ?? 0), 0)
  const totalRedemptions  = coupons.reduce((s, c) => s + c.redemption_count, 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Coupons</h1>
          <p className="text-slate-400 text-sm mt-1">Create discount codes for your students.</p>
        </div>
        <button onClick={() => { setEditing(null); setModal('create') }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Coupon
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-2xl font-bold text-white">{coupons.length}</div>
          <div className="text-xs text-slate-400 mt-1">Total Coupons</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-white">{totalRedemptions}</div>
          <div className="text-xs text-slate-400 mt-1">Total Redemptions</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-gold-400">${(totalRevenueSaved / 100).toFixed(2)}</div>
          <div className="text-xs text-slate-400 mt-1">Revenue Discounted</div>
        </div>
      </div>

      {/* Coupon list */}
      {coupons.length === 0 ? (
        <div className="card p-16 text-center space-y-3">
          <Tag className="w-10 h-10 text-slate-600 mx-auto" />
          <h2 className="font-semibold text-white">No coupons yet</h2>
          <p className="text-slate-400 text-sm">Create your first discount code.</p>
          <button onClick={() => setModal('create')} className="btn-primary inline-flex">Create Coupon</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-800">
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Code</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Discount</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Redemptions</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Revenue Saved</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Expires</th>
                <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b border-navy-800/50 last:border-0 hover:bg-navy-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-white">{c.code}</span>
                    <span className="text-xs text-slate-500 ml-2">{c.applies_to === 'all' ? 'all courses' : 'specific courses'}</span>
                  </td>
                  <td className="px-4 py-3 text-gold-400 font-medium">{formatDiscount(c)}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {c.redemption_count}
                    {c.max_redemptions !== null && <span className="text-slate-500">/{c.max_redemptions}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300">${((c.revenue_saved_cents ?? 0) / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(c.expires_at)}</td>
                  <td className="px-4 py-3"><CouponStatus c={c} /></td>
                  <td className="px-4 py-3 relative">
                    <button onClick={() => setMenuOpen(menuOpen === c.id ? null : c.id)} className="text-slate-500 hover:text-white">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {menuOpen === c.id && (
                      <div className="absolute right-8 top-2 z-20 bg-navy-800 border border-navy-700 rounded-lg py-1 w-36 shadow-xl">
                        <button onClick={() => openEdit(c)} className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-navy-700">Edit</button>
                        <button onClick={() => archive(c.id)} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-navy-700">Archive</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(modal === 'create' || modal === 'edit') && (
        <CouponModal
          workspaceId={workspaceId}
          coupon={modal === 'edit' ? editing : null}
          courses={courses}
          onSave={() => { setModal(null); fetchCoupons() }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
