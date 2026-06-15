export interface DripStatus {
  locked: boolean
  reason: string
  unlocksAt: Date | null
}

export async function getLessonDripStatus(
  supabase: any,
  userId: string,
  lessonId: string,
): Promise<DripStatus> {
  const unlocked: DripStatus = { locked: false, reason: '', unlocksAt: null }

  // Fetch lesson with its module
  const { data: lesson } = await supabase
    .from('lessons')
    .select(`
      id, drip_unlock_type, drip_delay_days, drip_unlock_date,
      drip_unlock_lesson_id, drip_unlock_module_id,
      module_id,
      modules:module_id (
        id, course_id,
        drip_unlock_type, drip_delay_days, drip_unlock_date, drip_unlock_module_id, position
      )
    `)
    .eq('id', lessonId)
    .single()

  if (!lesson) return unlocked

  const mod = lesson.modules as any
  const courseId = mod?.course_id

  // Get enrollment date
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('enrolled_at, created_at')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .single()

  if (!enrollment) return unlocked

  const enrolledAt = new Date(enrollment.enrolled_at ?? enrollment.created_at)

  // Check module-level drip first
  if (mod && mod.drip_unlock_type !== 'immediate') {
    const modStatus = await checkModuleDrip(supabase, userId, mod, enrolledAt)
    if (modStatus.locked) return modStatus
  }

  // Check lesson-level drip
  return checkLessonDrip(supabase, userId, lesson, enrolledAt)
}

async function checkModuleDrip(
  supabase: any,
  userId: string,
  mod: any,
  enrolledAt: Date,
): Promise<DripStatus> {
  const now = new Date()

  if (mod.drip_unlock_type === 'days_after_enrollment') {
    const unlocksAt = new Date(enrolledAt)
    unlocksAt.setDate(unlocksAt.getDate() + (mod.drip_delay_days ?? 0))
    if (now < unlocksAt) {
      return { locked: true, reason: `Module unlocks ${formatDate(unlocksAt)}`, unlocksAt }
    }
  }

  if (mod.drip_unlock_type === 'specific_date' && mod.drip_unlock_date) {
    const unlocksAt = new Date(mod.drip_unlock_date)
    if (now < unlocksAt) {
      return { locked: true, reason: `Module unlocks ${formatDate(unlocksAt)}`, unlocksAt }
    }
  }

  if (mod.drip_unlock_type === 'after_module' && mod.drip_unlock_module_id) {
    const complete = await isModuleComplete(supabase, userId, mod.drip_unlock_module_id)
    if (!complete) {
      const { data: prevMod } = await supabase
        .from('modules').select('title').eq('id', mod.drip_unlock_module_id).single()
      return {
        locked: true,
        reason: `Complete "${prevMod?.title ?? 'previous module'}" to unlock`,
        unlocksAt: null,
      }
    }
  }

  return { locked: false, reason: '', unlocksAt: null }
}

async function checkLessonDrip(
  supabase: any,
  userId: string,
  lesson: any,
  enrolledAt: Date,
): Promise<DripStatus> {
  const now = new Date()
  const type = lesson.drip_unlock_type ?? 'immediate'

  if (type === 'immediate') return { locked: false, reason: '', unlocksAt: null }

  if (type === 'days_after_enrollment') {
    const days = lesson.drip_delay_days ?? 0
    const unlocksAt = new Date(enrolledAt)
    unlocksAt.setDate(unlocksAt.getDate() + days)
    if (now < unlocksAt) {
      return { locked: true, reason: `Unlocks ${formatDate(unlocksAt)}`, unlocksAt }
    }
  }

  if (type === 'specific_date' && lesson.drip_unlock_date) {
    const unlocksAt = new Date(lesson.drip_unlock_date)
    if (now < unlocksAt) {
      return { locked: true, reason: `Unlocks ${formatDate(unlocksAt)}`, unlocksAt }
    }
  }

  if (type === 'after_lesson' && lesson.drip_unlock_lesson_id) {
    const { data: prog } = await supabase
      .from('lesson_progress')
      .select('completed')
      .eq('lesson_id', lesson.drip_unlock_lesson_id)
      .eq('user_id', userId)
      .single()
    if (!prog?.completed) {
      const { data: prevLesson } = await supabase
        .from('lessons').select('title').eq('id', lesson.drip_unlock_lesson_id).single()
      return {
        locked: true,
        reason: `Complete "${prevLesson?.title ?? 'previous lesson'}" to unlock`,
        unlocksAt: null,
      }
    }
  }

  if (type === 'after_module' && lesson.drip_unlock_module_id) {
    const complete = await isModuleComplete(supabase, userId, lesson.drip_unlock_module_id)
    if (!complete) {
      const { data: prevMod } = await supabase
        .from('modules').select('title').eq('id', lesson.drip_unlock_module_id).single()
      return {
        locked: true,
        reason: `Complete "${prevMod?.title ?? 'previous module'}" to unlock`,
        unlocksAt: null,
      }
    }
  }

  return { locked: false, reason: '', unlocksAt: null }
}

async function isModuleComplete(supabase: any, userId: string, moduleId: string): Promise<boolean> {
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id')
    .eq('module_id', moduleId)
    .eq('is_published', true)

  if (!lessons || lessons.length === 0) return true

  const ids = lessons.map((l: any) => l.id)
  const { data: progress } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', userId)
    .eq('completed', true)
    .in('lesson_id', ids)

  return (progress ?? []).length >= ids.length
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Bulk drip status for all lessons in a course (for sidebar display)
export async function getCourseDripStatuses(
  supabase: any,
  userId: string,
  courseId: string,
): Promise<Record<string, DripStatus>> {
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id')
    .eq('course_id', courseId)
    .eq('is_published', true)

  if (!lessons || lessons.length === 0) return {}

  const statuses: Record<string, DripStatus> = {}
  await Promise.all(
    lessons.map(async (l: any) => {
      statuses[l.id] = await getLessonDripStatus(supabase, userId, l.id)
    })
  )
  return statuses
}
