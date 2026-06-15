'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link                            from 'next/link'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useWorkspace }                from '@/lib/workspace/context'
import {
  BookOpen, Clock, BarChart2, Globe, CheckCircle2,
  ChevronDown, ChevronRight, ArrowRight, Loader2, Lock, Tag, X,
} from 'lucide-react'
import { formatPrice } from '@/lib/utils'

function CourseLandingInner() {
  const params    = useParams()
  const router    = useRouter()
  const searchParams = useSearchParams()
  const workSlug  = params.workspace as string
  const courseSlug = params.slug     as string
  const { workspace } = useWorkspace()
  const supabase  = createClientComponentClient()
  const purchaseSuccess = searchParams.get('purchase') === 'success'

  const [course,    setCourse]    = useState<any>(null)
  const [modules,   setModules]   = useState<any[]>([])
  const [enrolled,  setEnrolled]  = useState(false)
  const [session,   setSession]   = useState<any>(null)
  const [loading,   setLoading]   = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set([0]))
  const [couponInput,     setCouponInput]     = useState('')
  const [couponApplied,   setCouponApplied]   = useState<null | {
    code: string; discountCents: number; finalCents: number; discountType: string; discountValue: number
  }>(null)
  const [couponError,     setCouponError]     = useState('')
  const [validatingCoupon, setValidatingCoupon] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session: s } } = await supabase.auth.getSession()
      setSession(s)

      // Fetch published course by slug within workspace
      const cRes  = await fetch(`/api/platform/courses?workspaceId=${workspace.id}&status=published`)
      const cData = await cRes.json()
      const c     = (cData.courses ?? []).find((x: any) => x.slug === courseSlug)
      if (!c) { router.push(`/w/${workSlug}/courses`); return }

      // Fetch modules + lessons
      const mRes  = await fetch(`/api/platform/modules?courseId=${c.id}`)
      const mData = await mRes.json()

      setCourse(c)
      setModules(mData.modules ?? [])

      // Check enrollment
      if (s) {
        const eRes  = await fetch(`/api/platform/enrollments?workspaceId=${workspace.id}&courseId=${c.id}`)
        const eData = await eRes.json()
        setEnrolled(eData.enrolled ?? false)
      }
      setLoading(false)
    }
    init()
  }, [workspace.id, courseSlug, workSlug])

  const handleEnroll = async () => {
    if (!session) { router.push(`/w/${workSlug}/auth/signup`); return }
    setEnrolling(true)
    const res = await fetch('/api/platform/enrollments', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ workspace_id: workspace.id, course_id: course.id }),
    })
    setEnrolling(false)
    if (res.ok) {
      setEnrolled(true)
      router.push(`/w/${workSlug}/learn/${courseSlug}`)
    }
  }

  const handleBuy = async () => {
    if (!session) { router.push(`/w/${workSlug}/auth/signup?redirect=/w/${workSlug}/courses/${courseSlug}`); return }
    setEnrolling(true)
    const res  = await fetch('/api/stripe/checkout/course', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        courseId:    course.id,
        workspaceId: workspace.id,
        couponCode:  couponApplied?.code,
      }),
    })
    const data = await res.json()
    setEnrolling(false)
    if (!res.ok) { setCouponError(data.error ?? 'Checkout failed.'); return }
    if (data.url) window.location.href = data.url
  }

  const handleApplyCoupon = async () => {
    if (!couponInput.trim() || !course) return
    setValidatingCoupon(true); setCouponError(''); setCouponApplied(null)
    const res  = await fetch('/api/student/coupons/validate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code: couponInput.trim(), courseId: course.id, workspaceId: workspace.id }),
    })
    const data = await res.json()
    setValidatingCoupon(false)
    if (!res.ok) { setCouponError(data.error ?? 'Invalid coupon.'); return }
    setCouponApplied(data)
  }

  const removeCoupon = () => { setCouponApplied(null); setCouponInput(''); setCouponError('') }

  const toggleModule = (i: number) =>
    setExpandedModules((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })

  const totalLessons = modules.reduce((sum, m) => sum + (m.lessons?.length ?? 0), 0)

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading...</div>
  if (!course) return null

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {purchaseSuccess && (
        <div className="card border-green-500/30 bg-green-500/5 p-4 flex items-center gap-3 mb-6">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          <div>
            <p className="text-green-400 font-semibold text-sm">Purchase successful! You're enrolled.</p>
            <p className="text-slate-400 text-xs mt-0.5">You now have full access to this course.</p>
          </div>
          <Link href={`/w/${workSlug}/learn/${courseSlug}`}
            className="ml-auto btn-primary text-sm shrink-0 flex items-center gap-1.5">
            Start learning <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* ── Main content ── */}
        <div className="lg:col-span-2 space-y-8">
          {/* Hero */}
          <div>
            {course.thumbnail_url && (
              <img src={course.thumbnail_url} alt={course.title}
                className="w-full h-56 object-cover rounded-2xl mb-6" />
            )}
            <div className="flex flex-wrap gap-2 mb-3">
              {course.difficulty && (
                <span className="text-xs bg-navy-800 text-slate-300 px-2 py-1 rounded">{course.difficulty}</span>
              )}
              {course.category && (
                <span className="text-xs bg-navy-800 text-slate-300 px-2 py-1 rounded">{course.category}</span>
              )}
              {course.language && (
                <span className="text-xs bg-navy-800 text-slate-300 px-2 py-1 rounded flex items-center gap-1">
                  <Globe className="w-3 h-3" /> {course.language}
                </span>
              )}
            </div>
            <h1 className="font-display text-3xl font-bold text-white mb-3">{course.title}</h1>
            <p className="text-slate-300 text-base leading-relaxed">{course.short_desc}</p>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-6 text-sm text-slate-400 border-y border-navy-800 py-4">
            {course.duration_hrs > 0 && (
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {course.duration_hrs}h total</span>
            )}
            <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> {totalLessons} lessons</span>
            {course.difficulty && (
              <span className="flex items-center gap-1.5"><BarChart2 className="w-4 h-4" /> {course.difficulty}</span>
            )}
          </div>

          {/* Description */}
          {course.long_desc && (
            <section>
              <h2 className="font-display text-xl font-bold text-white mb-3">About this course</h2>
              <p className="text-slate-300 leading-relaxed whitespace-pre-line">{course.long_desc}</p>
            </section>
          )}

          {/* Outcomes */}
          {course.outcomes?.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-white mb-4">What you'll learn</h2>
              <ul className="grid sm:grid-cols-2 gap-2">
                {course.outcomes.filter(Boolean).map((o: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                    {o}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Requirements */}
          {course.requirements?.filter(Boolean).length > 0 && (
            <section>
              <h2 className="font-display text-xl font-bold text-white mb-4">Requirements</h2>
              <ul className="space-y-2">
                {course.requirements.filter(Boolean).map((r: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                    <span className="text-slate-500 mt-0.5">•</span> {r}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Curriculum */}
          <section>
            <h2 className="font-display text-xl font-bold text-white mb-4">Course Curriculum</h2>
            <div className="space-y-2">
              {modules.map((mod, i) => (
                <div key={mod.id} className="card overflow-hidden">
                  <button onClick={() => toggleModule(i)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-navy-800/40 text-left">
                    <span className="font-medium text-white text-sm">{mod.title}</span>
                    <span className="flex items-center gap-2 text-slate-500 text-xs">
                      {mod.lessons?.length ?? 0} lessons
                      {expandedModules.has(i)
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />}
                    </span>
                  </button>

                  {expandedModules.has(i) && (
                    <div className="divide-y divide-navy-800">
                      {(mod.lessons ?? []).map((lesson: any) => (
                        <div key={lesson.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                          {lesson.is_free
                            ? <BookOpen className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                            : <Lock      className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                          <span className={lesson.is_free ? 'text-slate-300' : 'text-slate-500'}>
                            {lesson.title}
                          </span>
                          {lesson.is_free && (
                            <span className="ml-auto text-xs text-gold-400 shrink-0">Free preview</span>
                          )}
                          {lesson.duration_mins > 0 && (
                            <span className="ml-auto text-slate-600 text-xs shrink-0">{lesson.duration_mins}m</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Sticky CTA card ── */}
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-20">
            {course.thumbnail_url && (
              <img src={course.thumbnail_url} alt="" className="w-full h-32 object-cover rounded-xl mb-5" />
            )}

            <div className="text-2xl font-bold text-white mb-1">
              {course.is_free ? <span className="text-green-400">Free</span> : formatPrice(course.price)}
            </div>
            {!course.is_free && course.price > 0 && (
              <p className="text-slate-400 text-xs mb-4">One-time purchase • Lifetime access</p>
            )}

            {enrolled ? (
              <Link href={`/w/${workSlug}/learn/${courseSlug}`}
                className="btn-primary w-full flex items-center justify-center gap-2 mb-3">
                Continue learning <ArrowRight className="w-4 h-4" />
              </Link>
            ) : course.is_free || course.price === 0 ? (
              <button onClick={handleEnroll} disabled={enrolling}
                className="btn-primary w-full flex items-center justify-center gap-2 mb-3">
                {enrolling ? <><Loader2 className="w-4 h-4 animate-spin" /> Enrolling...</> : 'Enroll for free'}
              </button>
            ) : (
              <>
                {/* Coupon input */}
                {session && !couponApplied && (
                  <div className="mb-3">
                    <div className="flex gap-2">
                      <input
                        className="input flex-1 text-sm uppercase placeholder-slate-600"
                        placeholder="Coupon code"
                        value={couponInput}
                        onChange={(e) => { setCouponInput(e.target.value); setCouponError('') }}
                        onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                      />
                      <button
                        onClick={handleApplyCoupon}
                        disabled={validatingCoupon || !couponInput.trim()}
                        className="btn-ghost text-sm px-3 flex items-center gap-1"
                      >
                        {validatingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
                        Apply
                      </button>
                    </div>
                    {couponError && <p className="text-red-400 text-xs mt-1">{couponError}</p>}
                  </div>
                )}

                {/* Applied coupon badge */}
                {couponApplied && (
                  <div className="mb-3 flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                    <Tag className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-semibold text-green-400">{couponApplied.code}</p>
                      <p className="text-xs text-slate-400">
                        {couponApplied.discountType === 'percent'
                          ? `${couponApplied.discountValue}% off`
                          : `$${(couponApplied.discountCents / 100).toFixed(2)} off`}
                        {' · '}saves ${(couponApplied.discountCents / 100).toFixed(2)}
                      </p>
                    </div>
                    <button onClick={removeCoupon} className="text-slate-500 hover:text-white shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Price display */}
                {couponApplied && (
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-2xl font-bold text-white">
                      ${(couponApplied.finalCents / 100).toFixed(2)}
                    </span>
                    <span className="text-slate-500 line-through text-sm">
                      {formatPrice(course.price)}
                    </span>
                  </div>
                )}

                <button onClick={handleBuy} disabled={enrolling}
                  className="btn-primary w-full flex items-center justify-center gap-2 mb-3">
                  {enrolling
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting...</>
                    : couponApplied
                      ? `Buy for $${(couponApplied.finalCents / 100).toFixed(2)}`
                      : `Buy for ${formatPrice(course.price)}`}
                </button>
              </>
            )}

            {!session && (
              <p className="text-center text-slate-500 text-xs">
                <Link href={`/w/${workSlug}/auth/login`} className="text-gold-400 hover:underline">Log in</Link>
                {' '}to enroll
              </p>
            )}

            <ul className="space-y-2 mt-4 text-sm text-slate-400">
              <li className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> {totalLessons} lessons</li>
              {course.duration_hrs > 0 && (
                <li className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {course.duration_hrs} hours</li>
              )}
              <li className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> {course.language || 'English'}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CourseLandingPage() {
  return <Suspense><CourseLandingInner /></Suspense>
}
