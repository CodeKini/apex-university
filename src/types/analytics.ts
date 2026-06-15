export interface WorkspaceStats {
  totalStudents: number
  totalRevenue: number
  activeCourses: number
  enrollmentsThisWeek: number
}

export interface RecentEnrollment {
  id: string
  created_at: string
  source: string
  student: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }
  course: {
    id: string
    title: string
    slug: string
    price: number
    is_free: boolean
  }
}

export interface RecentActivity {
  lesson_id: string
  updated_at: string
  completed: boolean
  progress_pct: number
  student: {
    id: string
    full_name: string | null
  }
  lesson: {
    id: string
    title: string
  }
  course: {
    id: string
    title: string
    slug: string
  }
}

export interface CourseCompletionStat {
  course_id: string
  title: string
  slug: string
  enrolled_count: number
  completed_count: number
  completion_rate: number
  total_lessons: number
}

export interface WorkspaceAnalytics {
  stats: WorkspaceStats
  recentEnrollments: RecentEnrollment[]
  recentActivity: RecentActivity[]
  courseCompletions: CourseCompletionStat[]
}
