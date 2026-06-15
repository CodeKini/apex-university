// Quiz system types

export type QuestionType =
  | 'multiple_choice'
  | 'multiple_select'
  | 'true_false'
  | 'short_answer'

export interface Quiz {
  id:             string
  lesson_id:      string
  workspace_id:   string
  course_id:      string
  pass_score:     number
  max_attempts:   number
  reveal_answers: boolean
  created_at:     string
  updated_at:     string
}

export interface QuizQuestion {
  id:            string
  quiz_id:       string
  question_type: QuestionType
  question_text: string
  explanation:   string | null
  points:        number
  position:      number
  options:       QuizOption[]
}

// Full option — includes is_correct (creator view only)
export interface QuizOption {
  id:          string
  question_id: string
  option_text: string
  is_correct:  boolean
  position:    number
}

// Student view — is_correct NEVER sent to client
export interface StudentQuizOption {
  id:          string
  question_id: string
  option_text: string
  position:    number
}

export interface StudentQuizQuestion {
  id:            string
  quiz_id:       string
  question_type: QuestionType
  question_text: string
  points:        number
  position:      number
  options:       StudentQuizOption[]
}

export interface StudentQuiz {
  id:             string
  lesson_id:      string
  pass_score:     number
  max_attempts:   number
  reveal_answers: boolean
  questions:      StudentQuizQuestion[]
}

export interface QuizAttempt {
  id:             string
  quiz_id:        string
  user_id:        string
  attempt_number: number
  score:          number
  passed:         boolean
  submitted_at:   string
}

export interface QuizAnswerResult {
  question_id:          string
  is_correct:           boolean
  selected_option_ids:  string[]
  correct_option_ids?:  string[]  // only when reveal_answers = true
  explanation?:         string | null
}

export interface QuizSubmitResult {
  attempt_id:     string
  attempt_number: number
  score:          number
  passed:         boolean
  answers:        QuizAnswerResult[]
}

// Creator result view
export interface QuizResultRow {
  attempt: QuizAttempt
  student_name:  string
  student_email: string
  answers: QuizAnswerResult[]
}
