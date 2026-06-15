export type EnrollmentAccessStatus = 'active' | 'expired' | 'revoked'
export type EnrollmentSource       = 'free' | 'manual' | 'stripe'

export interface WorkspaceEnrollment {
  id:            string
  user_id:       string
  course_id:     string
  workspace_id:  string
  enrolled_at:   string
  access_status: EnrollmentAccessStatus
  expires_at:    string | null
  source:        EnrollmentSource
}

export interface LessonProgress {
  id:           string
  user_id:      string
  lesson_id:    string
  course_id:    string
  workspace_id: string | null
  completed:    boolean
  progress_pct: number
  last_watched: string
}

// Enriched enrollment returned by the student dashboard API
export interface EnrolledCourse {
  enrollment:      WorkspaceEnrollment
  course: {
    id:            string
    slug:          string
    title:         string
    short_desc:    string
    thumbnail_url: string | null
    difficulty:    string
    duration_hrs:  number
  }
  total_lessons:     number
  completed_lessons: number
  progress_pct:      number          // 0–100
  last_lesson_id:    string | null   // most-recently-watched lesson
}

// Lightweight check returned by GET /api/platform/enrollments?courseId=X
export interface EnrollmentCheck {
  enrolled:      boolean
  access_status: EnrollmentAccessStatus | null
  expires_at:    string | null
}
