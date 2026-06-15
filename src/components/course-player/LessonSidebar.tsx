'use client'

import Link                 from 'next/link'
import { CheckCircle2, Circle, Lock, ChevronDown, ChevronRight, Play } from 'lucide-react'
import { useState }         from 'react'

interface Lesson {
  id: string
  title: string
  duration_mins: number
  is_free: boolean
  content_type: string
  position: number
}

interface Module {
  id: string
  title: string
  position: number
  lessons: Lesson[]
}

interface DripStatus {
  locked: boolean
  reason: string
  unlocksAt: string | null
}

interface Props {
  modules: Module[]
  currentLessonId: string
  workspaceSlug: string
  courseSlug: string
  completedLessonIds: Set<string>
  enrolled: boolean
  dripStatuses?: Record<string, DripStatus>
}

export default function LessonSidebar({
  modules,
  currentLessonId,
  workspaceSlug,
  courseSlug,
  completedLessonIds,
  enrolled,
  dripStatuses = {},
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleModule = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const isAccessible = (lesson: Lesson) => {
    if (!enrolled && !lesson.is_free) return false
    return !dripStatuses[lesson.id]?.locked
  }

  return (
    <aside className="w-72 shrink-0 border-r border-navy-800 h-full overflow-y-auto flex flex-col bg-navy-950">
      <div className="px-4 py-3 border-b border-navy-800">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Course Content</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {modules.map((mod) => {
          const isOpen = !collapsed.has(mod.id)
          return (
            <div key={mod.id} className="border-b border-navy-800/50">
              <button
                onClick={() => toggleModule(mod.id)}
                className="w-full flex items-start gap-2 px-4 py-3 text-left hover:bg-navy-900/50 transition-colors"
              >
                <span className="shrink-0 mt-0.5 text-slate-500">
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </span>
                <span className="text-sm font-medium text-slate-200">{mod.title}</span>
              </button>

              {isOpen && (
                <div>
                  {mod.lessons.sort((a, b) => a.position - b.position).map((lesson) => {
                    const isCurrent   = lesson.id === currentLessonId
                    const isComplete  = completedLessonIds.has(lesson.id)
                    const accessible  = isAccessible(lesson)

                    return (
                      <div key={lesson.id}>
                        {accessible ? (
                          <Link
                            href={`/w/${workspaceSlug}/learn/${courseSlug}/${lesson.id}`}
                            className={`flex items-start gap-3 px-4 py-2.5 text-sm transition-colors ${
                              isCurrent
                                ? 'bg-gold-500/10 border-r-2 border-gold-500'
                                : 'hover:bg-navy-900/50'
                            }`}
                          >
                            <span className="shrink-0 mt-0.5">
                              {isComplete ? (
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                              ) : isCurrent ? (
                                <Play className="w-4 h-4 text-gold-400" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-600" />
                              )}
                            </span>
                            <span className={`flex-1 ${isCurrent ? 'text-gold-300 font-medium' : isComplete ? 'text-slate-400' : 'text-slate-300'}`}>
                              {lesson.title}
                            </span>
                            {lesson.duration_mins > 0 && (
                              <span className="shrink-0 text-slate-600 text-xs">{lesson.duration_mins}m</span>
                            )}
                          </Link>
                        ) : (
                          <div className="flex items-start gap-3 px-4 py-2.5 text-sm cursor-not-allowed opacity-60"
                            title={dripStatuses[lesson.id]?.reason || 'Locked'}>
                            <Lock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <span className="text-slate-500 block truncate">{lesson.title}</span>
                              {dripStatuses[lesson.id]?.reason && (
                                <span className="text-slate-600 text-xs block truncate mt-0.5">
                                  {dripStatuses[lesson.id].reason}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
