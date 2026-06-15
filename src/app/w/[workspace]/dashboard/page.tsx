'use client'

import { useState, useEffect }  from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link                     from 'next/link'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useWorkspace }         from '@/lib/workspace/context'
import { BookOpen, Award, ArrowRight, CheckCircle2, Clock, Download, ExternalLink, Lock } from 'lucide-react'
import type { EnrolledCourse }  from '@/types/enrollment'

export default function WorkspaceDashboardPage() {
  const params    = useParams()
  const router    = useRouter()
  const slug      = params.workspace as string
  const { workspace } = useWorkspace()
  const supabase  = createClientComponentClient()

  const [loading,        setLoading]        = useState(true)
  const [enrollments,    setEnrollments]    = useState<EnrolledCourse[]>([])
  const [certificates,   setCertificates]   = useState<any[]>([])
  const [userName,       setUserName]       = useState('')
  const [upcomingLessons, setUpcomingLessons] = useState<any[]>([])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push(`/w/${slug}/auth/login`); return }
      setUserName(session.user.user_metadata?.full_name?.split(' ')[0] ?? 'there')

      const [enrRes, certRes] = await Promise.all([
        fetch(`/api/platform/enrollments?workspaceId=${workspace.id}`),
        fetch(`/api/student/certificates?workspaceId=${workspace.id}`),
      ])
      const [enrData, certData] = await Promise.all([enrRes.json(), certRes.json()])
      const enrolls: EnrolledCourse[] = enrData.enrollments ?? []
      setEnrollments(enrolls)
      setCertificates(certData.certificates ?? [])

      // Fetch drip statuses for in-progress / not-started enrollments and collect upcoming locked lessons
      const activeCourseIds = enrolls.filter((e) => e.progress_pct < 100).map((e) => e.course.id)
      if (activeCourseIds.length > 0) {
        const dripResults = await Promise.all(
          activeCourseIds.map((cid) =>
            fetch(`/api/student/courses/${cid}/drip-status`).then((r) => r.json()).then((d) => ({ cid, statuses: d.statuses ?? {} }))
          )
        )
        // For each course, get module/lesson data to find upcoming drip-locked lessons
        const moduleResults = await Promise.all(
          activeCourseIds.map((cid) =>
            fetch(`/api/platform/modules?courseId=${cid}`).then((r) => r.json()).then((d) => ({ cid, modules: d.modules ?? [] }))
          )
        )
        const upcoming: any[] = []
        for (const { cid, statuses } of dripResults) {
          const courseEnroll = enrolls.find((e) => e.course.id === cid)
          const modData = moduleResults.find((m) => m.cid === cid)
          if (!courseEnroll || !modData) continue
          for (const mod of modData.modules) {
            for (const lesson of (mod.lessons ?? [])) {
              const st = statuses[lesson.id]
              if (st?.locked) {
                upcoming.push({
                  lessonId:    lesson.id,
                  lessonTitle: lesson.title,
                  moduleTitle: mod.title,
                  courseTitle: courseEnroll.course.title,
                  courseSlug:  courseEnroll.course.slug,
                  reason:      st.reason,
                  unlocksAt:   st.unlocksAt,
                })
              }
            }
          }
        }
        // Sort: those with a date first (soonest), then no-date ones
        upcoming.sort((a, b) => {
          if (a.unlocksAt && b.unlocksAt) return new Date(a.unlocksAt).getTime() - new Date(b.unlocksAt).getTime()
          if (a.unlocksAt) return -1
          if (b.unlocksAt) return 1
          return 0
        })
        setUpcomingLessons(upcoming.slice(0, 6))
      }

      setLoading(false)
    }
    init()
  }, [workspace.id, slug])

  const inProgress  = enrollments.filter((e) => e.progress_pct > 0 && e.progress_pct < 100)
  const completed   = enrollments.filter((e) => e.progress_pct === 100)
  const notStarted  = enrollments.filter((e) => e.progress_pct === 0)

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Greeting */}
      <div className="mb-10">
        <h1 className="font-display text-2xl font-bold text-white">
          {loading ? 'Loading...' : `Welcome back, ${userName}!`}
        </h1>
        <p className="text-slate-400 text-sm mt-1">Continue where you left off.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500 text-sm">Loading your courses...</div>
      ) : enrollments.length === 0 ? (
        <EmptyState slug={slug} />
      ) : (
        <div className="space-y-10">
          {/* In progress */}
          {inProgress.length > 0 && (
            <section>
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gold-400" /> In Progress
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {inProgress.map((e) => (
                  <CourseCard key={e.enrollment.id} enrolled={e} slug={slug} />
                ))}
              </div>
            </section>
          )}

          {/* Not started */}
          {notStarted.length > 0 && (
            <section>
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-400" /> Not Started
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {notStarted.map((e) => (
                  <CourseCard key={e.enrollment.id} enrolled={e} slug={slug} />
                ))}
              </div>
            </section>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <section>
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" /> Completed
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {completed.map((e) => (
                  <CourseCard key={e.enrollment.id} enrolled={e} slug={slug} completed />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming drip-locked lessons */}
          {upcomingLessons.length > 0 && (
            <section>
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" /> Coming Up
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {upcomingLessons.map((item) => (
                  <div key={item.lessonId} className="card p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-navy-800 flex items-center justify-center shrink-0">
                      <Lock className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate">{item.lessonTitle}</p>
                      <p className="text-slate-500 text-xs truncate">{item.courseTitle} · {item.moduleTitle}</p>
                      <p className="text-slate-400 text-xs mt-1">{item.reason}</p>
                    </div>
                    {item.unlocksAt && (
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-gold-400">
                          {new Date(item.unlocksAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Certificates */}
          {certificates.length > 0 && (
            <section>
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Award className="w-4 h-4 text-gold-400" /> My Certificates
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {certificates.map((cert: any) => (
                  <div key={cert.id} className="card p-5 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center shrink-0">
                        <Award className="w-5 h-5 text-gold-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-sm line-clamp-2">{cert.course_title}</div>
                        <div className="text-slate-400 text-xs mt-0.5">{cert.workspace_name}</div>
                        <div className="text-slate-500 text-xs mt-1">
                          Issued {new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1">
                      {cert.storage_url && (
                        <a href={cert.storage_url} target="_blank" rel="noopener noreferrer"
                          className="flex-1 btn-ghost text-xs flex items-center justify-center gap-1.5 py-1.5">
                          <Download className="w-3.5 h-3.5" /> Download PDF
                        </a>
                      )}
                      <a href={`/verify/${cert.verification_code}`} target="_blank" rel="noopener noreferrer"
                        className="flex-1 btn-ghost text-xs flex items-center justify-center gap-1.5 py-1.5">
                        <ExternalLink className="w-3.5 h-3.5" /> Verify
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function CourseCard({ enrolled: e, slug, completed = false }: { enrolled: EnrolledCourse; slug: string; completed?: boolean }) {
  const resumeUrl = e.last_lesson_id
    ? `/w/${slug}/learn/${e.course.slug}/${e.last_lesson_id}`
    : `/w/${slug}/learn/${e.course.slug}`

  return (
    <div className="card p-0 overflow-hidden flex flex-col hover:border-navy-600 transition-colors">
      {e.course.thumbnail_url ? (
        <img src={e.course.thumbnail_url} alt={e.course.title} className="w-full h-36 object-cover" />
      ) : (
        <div className="w-full h-36 bg-navy-800 flex items-center justify-center">
          <BookOpen className="w-8 h-8 text-navy-600" />
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-semibold text-white line-clamp-2 mb-1">{e.course.title}</h3>
        <p className="text-slate-400 text-xs mb-4 line-clamp-2">{e.course.short_desc}</p>

        {/* Progress bar */}
        <div className="mt-auto">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-slate-500 text-xs">{e.completed_lessons}/{e.total_lessons} lessons</span>
            <span className={`text-xs font-medium ${completed ? 'text-green-400' : 'text-gold-400'}`}>
              {e.progress_pct}%
            </span>
          </div>
          <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${completed ? 'bg-green-500' : 'bg-gold-500'}`}
              style={{ width: `${e.progress_pct}%` }}
            />
          </div>
        </div>

        <Link href={resumeUrl}
          className="btn-primary text-sm mt-4 flex items-center justify-center gap-1.5">
          {completed ? 'Review course' : e.progress_pct > 0 ? 'Continue' : 'Start learning'}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  )
}

function EmptyState({ slug }: { slug: string }) {
  return (
    <div className="card p-16 text-center">
      <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
      <h2 className="font-semibold text-white mb-2">No courses yet</h2>
      <p className="text-slate-400 text-sm mb-6">Browse the course catalog to find something to learn.</p>
      <Link href={`/w/${slug}/courses`} className="btn-primary inline-flex items-center gap-2">
        Browse courses <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
