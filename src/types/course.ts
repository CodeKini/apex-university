// Workspace-scoped course types
// Mirrors courses / modules / lessons tables after migration 004

export type CourseStatus    = 'draft' | 'published' | 'archived'
export type CourseDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'

export type ContentType =
  | 'video' | 'text' | 'file' | 'canva'
  | 'google_embed' | 'live' | 'link'

export type VideoSource  = 'youtube' | 'vimeo' | 'loom' | 'wistia' | 'storage'
export type EmbedType    = 'canva' | 'google_doc' | 'google_sheet' | 'google_slide'
export type CompletionMethod = 'manual_mark' | 'video_watched' | 'quiz_passed'

// ────────────────────────────────────────────────
// Table shapes
// ────────────────────────────────────────────────

export interface WorkspaceCourse {
  id:             string
  workspace_id:   string
  instructor_id:  string | null   // = platform_user.id (creator)
  slug:           string
  title:          string
  short_desc:     string
  long_desc:      string
  price:          number
  is_free:        boolean
  thumbnail_url:  string | null
  cover_url?:     string | null
  difficulty:     CourseDifficulty
  duration_hrs:   number
  category:       string | null
  language:       string
  status:         CourseStatus
  outcomes:       string[] | null
  requirements:   string[] | null
  stripe_price_id: string | null
  published_at:   string | null
  created_at:     string
  updated_at:     string
}

export interface WorkspaceModule {
  id:           string
  course_id:    string
  workspace_id: string
  title:        string
  description:  string | null
  position:     number
  created_at:   string
  // Joined
  lessons?:     WorkspaceLesson[]
}

export interface WorkspaceLesson {
  id:                string
  module_id:         string
  course_id:         string
  workspace_id:      string
  title:             string
  description:       string | null
  content_type:      ContentType
  position:          number
  duration_mins:     number
  is_free:           boolean
  is_published:      boolean
  drip_delay_days:   number
  completion_method: CompletionMethod
  // Video
  video_url:         string | null
  video_source:      VideoSource | null
  // Embed (Canva / Google)
  embed_url:         string | null
  embed_type:        EmbedType | null
  // Text
  rich_text:         string | null
  // Live
  live_url:          string | null
  live_scheduled_at: string | null
  created_at:        string
}

// ────────────────────────────────────────────────
// API payloads
// ────────────────────────────────────────────────

export interface CreateCoursePayload {
  workspace_id: string
  title:        string
  slug:         string
}

export interface UpdateCoursePayload {
  title?:        string
  slug?:         string
  short_desc?:   string
  long_desc?:    string
  price?:        number
  is_free?:      boolean
  thumbnail_url?: string | null
  difficulty?:   CourseDifficulty
  duration_hrs?: number
  category?:     string | null
  language?:     string
  status?:       CourseStatus
  outcomes?:     string[]
  requirements?: string[]
}

export interface CreateModulePayload {
  course_id:    string
  workspace_id: string
  title:        string
  description?: string
  position?:    number
}

export interface ReorderItem {
  id:       string
  position: number
}
