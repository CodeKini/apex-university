export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'rejected'
export type PayoutMethod     = 'bank' | 'paypal' | 'stripe' | 'check' | 'crypto' | 'other'

export type CourseStatus = 'draft' | 'review' | 'published' | 'rejected' | 'archived'
export type ContentType  = 'video' | 'canva' | 'google_embed' | 'text' | 'file' | 'quiz' | 'exam' | 'live'
export type VideoSource  = 'storage' | 'youtube' | 'vimeo' | 'loom' | 'wistia'
export type EmbedType    = 'canva' | 'google_doc' | 'google_sheet' | 'google_slide'
export type CompletionMethod = 'video_watched' | 'quiz_passed' | 'manual_mark'
export type UserRole     = 'student' | 'instructor' | 'admin' | 'moderator'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: UserRole
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          parent_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
      courses: {
        Row: {
          id: string
          instructor_id: string | null
          slug: string
          title: string
          short_desc: string
          long_desc: string
          price: number
          thumbnail_url: string | null
          difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
          duration_hrs: number
          status: CourseStatus
          is_published: boolean   // legacy — kept for backward compat, mirrors status=published
          is_free: boolean
          outcomes: string[] | null
          requirements: string[] | null
          category: string | null
          category_id: string | null
          language: string
          stripe_price_id: string | null
          review_notes: string | null
          submitted_at: string | null
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['courses']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['courses']['Insert']>
      }
      modules: {
        Row: {
          id: string
          course_id: string
          title: string
          description: string | null
          position: number
          is_published: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['modules']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['modules']['Insert']>
      }
      lessons: {
        Row: {
          id: string
          module_id: string
          course_id: string
          title: string
          description: string | null
          content_type: ContentType
          position: number
          duration_mins: number
          is_free: boolean
          is_published: boolean
          drip_delay_days: number
          completion_method: CompletionMethod
          // content fields
          video_url: string | null
          video_source: VideoSource | null
          thumbnail_url: string | null
          embed_url: string | null
          embed_type: EmbedType | null
          rich_text: string | null
          live_url: string | null
          live_scheduled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['lessons']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['lessons']['Insert']>
      }
      lesson_resources: {
        Row: {
          id: string
          lesson_id: string
          course_id: string
          title: string
          file_path: string
          file_size: number | null
          mime_type: string | null
          position: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['lesson_resources']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['lesson_resources']['Insert']>
      }
      enrollments: {
        Row: {
          id: string
          user_id: string
          course_id: string
          enrolled_at: string
        }
        Insert: Omit<Database['public']['Tables']['enrollments']['Row'], 'id' | 'enrolled_at'>
        Update: never
      }
      lesson_progress: {
        Row: {
          id: string
          user_id: string
          lesson_id: string
          course_id: string
          completed: boolean
          progress_pct: number
          last_watched: string
        }
        Insert: Omit<Database['public']['Tables']['lesson_progress']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['lesson_progress']['Insert']>
      }
      purchases: {
        Row: {
          id: string
          user_id: string
          course_id: string
          stripe_session_id: string
          stripe_payment_intent: string | null
          amount_cents: number
          currency: string
          status: 'pending' | 'completed' | 'refunded'
          purchased_at: string
        }
        Insert: Omit<Database['public']['Tables']['purchases']['Row'], 'id' | 'purchased_at'>
        Update: Partial<Database['public']['Tables']['purchases']['Insert']>
      }
      admin_activity_logs: {
        Row: {
          id: string
          admin_id: string
          action: string
          entity_type: string | null
          entity_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['admin_activity_logs']['Row'], 'id' | 'created_at'>
        Update: never
      }
      platform_settings: {
        Row: { key: string; value: string; updated_at: string }
        Insert: Omit<Database['public']['Tables']['platform_settings']['Row'], 'updated_at'>
        Update: Partial<Database['public']['Tables']['platform_settings']['Insert']>
      }
      instructor_commissions: {
        Row: {
          id: string
          purchase_id: string
          instructor_id: string
          course_id: string
          purchase_amount_cents: number
          platform_pct: number
          instructor_pct: number
          platform_fee_cents: number
          instructor_earnings_cents: number
          currency: string
          status: CommissionStatus
          payout_id: string | null
          rejection_reason: string | null
          approved_at: string | null
          paid_at: string | null
          rejected_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['instructor_commissions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['instructor_commissions']['Insert']>
      }
      instructor_payouts: {
        Row: {
          id: string
          instructor_id: string
          amount_cents: number
          currency: string
          method: PayoutMethod
          reference: string | null
          notes: string | null
          paid_at: string | null
          created_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['instructor_payouts']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['instructor_payouts']['Insert']>
      }
    }
  }
}

// ── Convenience row types ──────────────────────────────────────
export type Profile              = Database['public']['Tables']['profiles']['Row']
export type InstructorCommission = Database['public']['Tables']['instructor_commissions']['Row']
export type InstructorPayout     = Database['public']['Tables']['instructor_payouts']['Row']
export type Category        = Database['public']['Tables']['categories']['Row']
export type Course          = Database['public']['Tables']['courses']['Row']
export type Module          = Database['public']['Tables']['modules']['Row']
export type Lesson          = Database['public']['Tables']['lessons']['Row']
export type LessonResource  = Database['public']['Tables']['lesson_resources']['Row']
export type Enrollment      = Database['public']['Tables']['enrollments']['Row']
export type LessonProgress  = Database['public']['Tables']['lesson_progress']['Row']
export type Purchase        = Database['public']['Tables']['purchases']['Row']

// ── Extended / joined types ────────────────────────────────────
export interface LessonWithResources extends Lesson {
  lesson_resources: LessonResource[]
}

export interface ModuleWithLessons extends Module {
  lessons: LessonWithResources[]
}

export interface CourseWithModules extends Course {
  modules: ModuleWithLessons[]
  instructor?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
  category_data?: Category | null
  enrollment?: Enrollment | null
  progress_pct?: number
}

export interface EnrolledCourse extends Course {
  enrolled_at: string
  progress_pct: number
  completed_lessons: number
  total_lessons: number
}

export interface InstructorCourseRow extends Course {
  enrollment_count: number
  lesson_count: number
}

// Commission with joined purchase + course data (used in instructor earnings view)
export interface CommissionWithDetails extends InstructorCommission {
  purchase:  Pick<Purchase, 'purchased_at' | 'stripe_session_id'> | null
  course:    Pick<Course, 'title' | 'slug'> | null
  payout?:   Pick<InstructorPayout, 'paid_at' | 'method' | 'reference'> | null
}

// Commission with instructor name (used in admin view)
export interface CommissionWithInstructor extends InstructorCommission {
  instructor: Pick<Profile, 'full_name' | 'email'> | null
  course:     Pick<Course, 'title'> | null
  purchase:   Pick<Purchase, 'purchased_at'> | null
}

// Earnings summary returned by /api/instructor/earnings
export interface EarningsSummary {
  total_earnings_cents:   number
  pending_cents:          number
  approved_cents:         number
  paid_cents:             number
  total_students:         number
  total_sales:            number
  platform_pct:           number
  instructor_pct:         number
  by_course: {
    course_id:    string
    course_title: string
    sales:        number
    earnings_cents: number
  }[]
}
