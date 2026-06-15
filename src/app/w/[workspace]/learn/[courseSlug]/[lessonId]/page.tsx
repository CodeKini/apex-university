'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter }             from 'next/navigation'
import Link                                 from 'next/link'
import { createClientComponentClient }      from '@supabase/auth-helpers-nextjs'
import { useWorkspace }                     from '@/lib/workspace/context'
import LessonSidebar                        from '@/components/course-player/LessonSidebar'
import LessonViewer                         from '@/components/course-player/LessonViewer'
import QuizPlayer                           from '@/components/quiz/QuizPlayer'
import PostComposer                         from '@/components/community/PostComposer'
import CommentThread                        from '@/components/community/CommentThread'
import {
  CheckCircle2, ChevronLeft, ChevronRight, Loader2, ArrowLeft, Lock, Clock,
} from 'lucide-react'
import OfflineContentBanner from '@/components/pwa/OfflineContentBanner'

interface Lesson {
  id: string
  title: string
  content_type: string
  content: Record<string, any> | null
  description: string | null
  duration_mins: number
  is_free: boolean
  drip_delay_days: number
  drip_unlock_type: string
  position: number
  module_id: string
  completion_method: 'manual_mark' | 'video_watched' | 'quiz_passed'
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

export default function LessonPlayerPage() {
  const params      = useParams()
  const router      = useRouter()
  const workSlug    = params.workspace   as string
  const courseSlug  = params.courseSlug  as string
  const lessonId    = params.lessonId    as string
  const { workspace } = useWorkspace()
  const supabase    = createClientComponentClient()

  const [loading,      setLoading]      = useState(true)
  const [enrolled,     setEnrolled]     = useState(false)
  const [accessible,   setAccessible]   = useState(false)
  const [dripStatus,   setDripStatus]   = useState<DripStatus | null>(null)
  const [dripStatuses, setDripStatuses] = useState<Record<string, DripStatus>>({})
  const [lesson,       setLesson]       = useState<Lesson | null>(null)
  const [modules,      setModules]      = useState<Module[]>([])
  const [allLessons,   setAllLessons]   = useState<Lesson[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [marking,      setMarking]      = useState(false)
  const [courseId,     setCourseId]     = useState<string | null>(null)
  const [userId,       setUserId]       = useState<string | null>(null)
  const [quiz,            setQuiz]            = useState<any>(null)
  const [quizAttempts,    setQuizAttempts]    = useState<any[]>([])
  const [lessonPosts,     setLessonPosts]     = useState<any[]>([])
  const [lessonComments,  setLessonComments]  = useState<Record<string, any[]>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push(`/w/${workSlug}/auth/login?redirect=/w/${workSlug}/learn/${courseSlug}/${lessonId}`); return }
    setUserId(session.user.id)

    // Find course
    const cRes  = await fetch(`/api/platform/courses?workspaceId=${workspace.id}&status=published`)
    const cData = await cRes.json()
    const course = (cData.courses ?? []).find((x: any) => x.slug === courseSlug)
    if (!course) { router.push(`/w/${workSlug}/courses`); return }
    setCourseId(course.id)

    // Check enrollment
    const eRes  = await fetch(`/api/platform/enrollments?workspaceId=${workspace.id}&courseId=${course.id}`)
    const eData = await eRes.json()
    const isEnrolled = eData.enrolled ?? false
    setEnrolled(isEnrolled)

    // Fetch modules + lessons
    const mRes  = await fetch(`/api/platform/modules?courseId=${course.id}`)
    const mData = await mRes.json()
    const mods: Module[] = mData.modules ?? []
    setModules(mods)

    const flat = mods
      .sort((a, b) => a.position - b.position)
      .flatMap((m) => m.lessons.sort((a, b) => a.position - b.position))
    setAllLessons(flat)

    // Current lesson
    const { data: lessonData } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .single()

    if (!lessonData) { router.push(`/w/${workSlug}/courses/${courseSlug}`); return }
    setLesson(lessonData as Lesson)

    // Access: enrolled OR is_free
    const baseAccess = isEnrolled || lessonData.is_free

    if (baseAccess && isEnrolled) {
      // Server-side drip check
      const [accessRes, dripRes] = await Promise.all([
        fetch(`/api/student/lessons/${lessonId}/access?courseId=${course.id}`),
        fetch(`/api/student/courses/${course.id}/drip-status`),
      ])
      const accessData = await accessRes.json()
      const dripData   = await dripRes.json()
      setDripStatus({
        locked:    accessData.locked ?? false,
        reason:    accessData.reason ?? '',
        unlocksAt: accessData.unlocksAt ?? null,
      })
      setDripStatuses(dripData.statuses ?? {})
      setAccessible(accessData.accessible ?? false)
    } else {
      setAccessible(baseAccess)
    }

    // Progress + quiz (parallel when enrolled)
    if (isEnrolled) {
      const [pRes, qRes] = await Promise.all([
        fetch(`/api/platform/progress?courseId=${course.id}`),
        fetch(`/api/student/quizzes?lessonId=${lessonId}`),
      ])
      const pData = await pRes.json()
      setCompletedIds(new Set(
        Object.entries(pData.progress ?? {})
          .filter(([, v]: [string, any]) => v.completed)
          .map(([k]) => k)
      ))
      const qData = await qRes.json()
      if (qData.quiz) {
        setQuiz(qData.quiz)
        const attRes = await fetch(`/api/student/quizzes/${qData.quiz.id}/attempts`)
        const attData = await attRes.json()
        setQuizAttempts(attData.attempts ?? [])
      }

      // Lesson comments (posts with post_type=lesson_comment)
      const lcRes  = await fetch(`/api/community/posts?workspaceId=${workspace.id}&lessonId=${lessonId}&type=lesson_comment&limit=50`)
      const lcData = await lcRes.json()
      setLessonPosts(lcData.posts ?? [])
    }

    setLoading(false)
  }, [lessonId, workspace.id, courseSlug, workSlug])

  useEffect(() => { fetchData() }, [fetchData])

  const markComplete = async () => {
    if (!courseId || !lesson) return
    setMarking(true)
    await fetch('/api/platform/progress', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ lesson_id: lesson.id, course_id: courseId, completed: true }),
    })
    setCompletedIds((prev) => new Set([...prev, lesson.id]))
    setMarking(false)
  }

  const currentIndex = allLessons.findIndex((l) => l.id === lessonId)
  const prevLesson   = currentIndex > 0                   ? allLessons[currentIndex - 1] : null
  const nextLesson   = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null
  const isComplete   = completedIds.has(lessonId)

  const goTo = (l: Lesson) => router.push(`/w/${workSlug}/learn/${courseSlug}/${l.id}`)

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-slate-500 text-sm">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading lesson...
    </div>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">
      <OfflineContentBanner />
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <LessonSidebar
        modules={modules}
        currentLessonId={lessonId}
        workspaceSlug={workSlug}
        courseSlug={courseSlug}
        completedLessonIds={completedIds}
        enrolled={enrolled}
        dripStatuses={dripStatuses}
      />

      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center gap-4 px-6 py-3 border-b border-navy-800 bg-navy-950/90 backdrop-blur-sm">
          <Link href={`/w/${workSlug}/courses/${courseSlug}`}
            className="text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="text-slate-300 text-sm font-medium flex-1 truncate">
            {lesson?.title}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => prevLesson && goTo(prevLesson)}
              disabled={!prevLesson}
              className="p-1.5 rounded hover:bg-navy-800 disabled:opacity-30 transition-colors text-slate-400"
              title="Previous lesson"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => nextLesson && goTo(nextLesson)}
              disabled={!nextLesson}
              className="p-1.5 rounded hover:bg-navy-800 disabled:opacity-30 transition-colors text-slate-400"
              title="Next lesson"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {enrolled && lesson?.completion_method !== 'quiz_passed' && (
              <button
                onClick={markComplete}
                disabled={marking || isComplete}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all ${
                  isComplete
                    ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                    : 'bg-navy-800 text-slate-300 hover:bg-navy-700 border border-navy-700'
                }`}
              >
                {marking
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <CheckCircle2 className="w-3.5 h-3.5" />}
                {isComplete ? 'Completed' : 'Mark complete'}
              </button>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="max-w-3xl mx-auto px-6 py-8">
          {!accessible ? (
            <div className="card p-16 text-center space-y-4">
              {dripStatus?.locked ? (
                <>
                  <Clock className="w-12 h-12 text-gold-500/60 mx-auto" />
                  <h2 className="font-semibold text-white text-lg">Content not yet available</h2>
                  <p className="text-slate-400 text-sm">{dripStatus.reason}</p>
                  {dripStatus.unlocksAt && (
                    <p className="text-xs text-slate-500">
                      Unlocks {new Date(dripStatus.unlocksAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <Lock className="w-12 h-12 text-slate-600 mx-auto" />
                  <h2 className="font-semibold text-white text-lg">This lesson is locked</h2>
                  <p className="text-slate-400 text-sm">Enroll in this course to unlock all lessons.</p>
                  <Link href={`/w/${workSlug}/courses/${courseSlug}`} className="btn-primary inline-flex">
                    View course
                  </Link>
                </>
              )}
            </div>
          ) : lesson ? (
            <>
              <h1 className="font-display text-2xl font-bold text-white mb-6">{lesson.title}</h1>
              <LessonViewer lesson={lesson} />

              {/* Quiz */}
              {enrolled && quiz && courseId && (
                <div className="mt-8">
                  <QuizPlayer
                    quiz={quiz}
                    initialAttempts={quizAttempts}
                    courseId={courseId}
                    workspaceId={workspace.id}
                    onQuizPassed={() => {
                      markComplete()
                      setCompletedIds((prev) => new Set([...prev, lesson.id]))
                    }}
                  />
                </div>
              )}

              {/* Lesson comments */}
              {enrolled && (
                <div className="mt-10 pt-6 border-t border-navy-800">
                  <h2 className="font-semibold text-white text-sm mb-4">Lesson Discussion</h2>
                  <div className="mb-4">
                    <PostComposer
                      workspaceId={workspace.id}
                      lessonId={lessonId}
                      courseId={courseId ?? undefined}
                      placeholder="Ask a question or share a note about this lesson…"
                      onCreated={(post) => setLessonPosts((prev) => [{ ...post, reactions: [], comments: [] }, ...prev])}
                    />
                  </div>
                  {lessonPosts.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No comments yet.</p>
                  ) : (
                    <div className="space-y-6">
                      {lessonPosts.map((post) => (
                        <div key={post.id} className="card p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 rounded-full bg-navy-700 flex items-center justify-center text-xs font-bold text-slate-300">
                              {post.author?.full_name?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <span className="text-sm font-medium text-white">{post.author?.full_name}</span>
                            <span className="text-xs text-slate-500 ml-auto">
                              {new Date(post.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-slate-300 text-sm whitespace-pre-wrap break-words mb-3">{post.body}</p>
                          <CommentThread
                            postId={post.id}
                            workspaceId={workspace.id}
                            comments={lessonComments[post.id] ?? []}
                            currentUserId={userId ?? ''}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Bottom nav */}
              <div className="flex items-center justify-between mt-10 pt-6 border-t border-navy-800">
                {prevLesson ? (
                  <button onClick={() => goTo(prevLesson)}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                    <ChevronLeft className="w-4 h-4" /> {prevLesson.title}
                  </button>
                ) : <span />}

                {nextLesson ? (
                  <button onClick={() => goTo(nextLesson)}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                    {nextLesson.title} <ChevronRight className="w-4 h-4" />
                  </button>
                ) : enrolled ? (
                  <Link href={`/w/${workSlug}/dashboard`}
                    className="flex items-center gap-2 text-sm text-green-400 hover:text-green-300 transition-colors">
                    Course complete! Go to dashboard <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : <span />}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
    </div>
  )
}
