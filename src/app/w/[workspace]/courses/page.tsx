'use client'

import { useState, useEffect }         from 'react'
import { useParams }                   from 'next/navigation'
import Link                            from 'next/link'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useWorkspace }                from '@/lib/workspace/context'
import { BookOpen, Clock, BarChart2, ArrowRight } from 'lucide-react'
import { formatPrice }                 from '@/lib/utils'

export default function WorkspaceCatalogPage() {
  const params    = useParams()
  const slug      = params.workspace as string
  const { workspace } = useWorkspace()
  const supabase  = createClientComponentClient()

  const [courses,    setCourses]    = useState<any[]>([])
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set())
  const [loading,    setLoading]    = useState(true)
  const [session,    setSession]    = useState<any>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session: s } } = await supabase.auth.getSession()
      setSession(s)

      const res  = await fetch(`/api/platform/courses?workspaceId=${workspace.id}&status=published`)
      const data = await res.json()
      setCourses(data.courses ?? [])

      if (s) {
        const eRes  = await fetch(`/api/platform/enrollments?workspaceId=${workspace.id}`)
        const eData = await eRes.json()
        setEnrolledIds(new Set((eData.enrollments ?? []).map((e: any) => e.course.id)))
      }
      setLoading(false)
    }
    init()
  }, [workspace.id])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-white">Courses</h1>
        <p className="text-slate-400 text-sm mt-1">{courses.length} course{courses.length !== 1 ? 's' : ''} available</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500 text-sm">Loading courses...</div>
      ) : courses.length === 0 ? (
        <div className="card p-16 text-center">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No courses published yet. Check back soon.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              slug={slug}
              enrolled={enrolledIds.has(course.id)}
              loggedIn={!!session}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CourseCard({ course, slug, enrolled, loggedIn }: {
  course: any; slug: string; enrolled: boolean; loggedIn: boolean
}) {
  return (
    <Link href={`/w/${slug}/courses/${course.slug}`}
      className="card p-0 overflow-hidden flex flex-col hover:border-navy-600 transition-colors group">
      {course.thumbnail_url ? (
        <img src={course.thumbnail_url} alt={course.title} className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-navy-800 to-navy-700 flex items-center justify-center">
          <BookOpen className="w-8 h-8 text-navy-500" />
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-white line-clamp-2 group-hover:text-gold-300 transition-colors">
            {course.title}
          </h3>
          {enrolled && (
            <span className="text-xs text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded shrink-0">Enrolled</span>
          )}
        </div>

        <p className="text-slate-400 text-sm line-clamp-2 mb-4 flex-1">{course.short_desc}</p>

        <div className="flex items-center gap-4 text-slate-500 text-xs mb-4">
          {course.difficulty && (
            <span className="flex items-center gap-1">
              <BarChart2 className="w-3 h-3" /> {course.difficulty}
            </span>
          )}
          {course.duration_hrs > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {course.duration_hrs}h
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="font-semibold text-white">
            {course.is_free ? (
              <span className="text-green-400">Free</span>
            ) : (
              formatPrice(course.price)
            )}
          </div>
          <span className="text-gold-400 text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
            {enrolled ? 'Continue' : 'Learn more'}
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
