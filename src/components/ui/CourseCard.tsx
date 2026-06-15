import Link from 'next/link'
import Image from 'next/image'
import { Clock, BarChart2, ArrowRight } from 'lucide-react'
import { formatPrice, formatDuration } from '@/lib/utils'
import type { Course } from '@/types/database'

interface CourseCardProps {
  course: Course
  enrolled?: boolean
  progressPct?: number
}

export default function CourseCard({ course, enrolled, progressPct }: CourseCardProps) {
  const href = enrolled
    ? `/course-player/${course.slug}`
    : `/course/${course.slug}`

  // Difficulty badge color
  const difficultyColor = {
    Beginner: 'bg-emerald-500/20 text-emerald-400',
    Intermediate: 'bg-blue-500/20 text-blue-400',
    Advanced: 'bg-red-500/20 text-red-400',
  }[course.difficulty]

  return (
    <Link href={href} className="group block">
      <div className="card overflow-hidden hover:border-gold-500/40 transition-all duration-300 hover:-translate-y-1">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-navy-800 overflow-hidden">
          {course.thumbnail_url ? (
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            // Placeholder gradient — REPLACE with real course thumbnails
            <div className="absolute inset-0 bg-gradient-to-br from-navy-700 to-navy-900 flex items-center justify-center">
              <span className="text-4xl font-display text-navy-600">A</span>
            </div>
          )}

          {/* Progress bar for enrolled courses */}
          {enrolled && progressPct !== undefined && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-navy-700">
              <div
                className="h-full bg-gold-gradient transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${difficultyColor}`}>
              {course.difficulty}
            </span>
            {enrolled && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-400">
                Enrolled
              </span>
            )}
          </div>

          <h3 className="font-display font-semibold text-white text-lg mb-2 group-hover:text-gold-300 transition-colors line-clamp-2">
            {course.title}
          </h3>
          <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-2">
            {course.short_desc}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-slate-500 text-xs">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(course.duration_hrs)}
              </span>
              <span className="flex items-center gap-1">
                <BarChart2 className="w-3.5 h-3.5" />
                {course.difficulty}
              </span>
            </div>

            {enrolled ? (
              <span className="text-gold-400 text-sm font-medium flex items-center gap-1">
                {progressPct === 100 ? 'Review' : 'Continue'}
                <ArrowRight className="w-4 h-4" />
              </span>
            ) : (
              <span className="font-display font-bold text-white text-lg">
                {formatPrice(course.price)}
              </span>
            )}
          </div>

          {enrolled && progressPct !== undefined && (
            <div className="mt-3 text-xs text-slate-500">{progressPct}% complete</div>
          )}
        </div>
      </div>
    </Link>
  )
}
