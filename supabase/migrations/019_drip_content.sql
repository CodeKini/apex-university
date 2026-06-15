-- Drip content: expand unlock rules on lessons and modules

-- Lessons: add new drip columns (keep drip_delay_days for 'days_after_enrollment')
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS drip_unlock_type TEXT NOT NULL DEFAULT 'immediate'
    CHECK (drip_unlock_type IN ('immediate','days_after_enrollment','specific_date','after_lesson','after_module')),
  ADD COLUMN IF NOT EXISTS drip_unlock_date TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS drip_unlock_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS drip_unlock_module_id UUID DEFAULT NULL;

-- Migrate existing drip_delay_days > 0 rows to 'days_after_enrollment' type
UPDATE public.lessons
  SET drip_unlock_type = 'days_after_enrollment'
  WHERE drip_delay_days > 0;

-- Modules: add module-level drip columns
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS drip_unlock_type TEXT NOT NULL DEFAULT 'immediate'
    CHECK (drip_unlock_type IN ('immediate','days_after_enrollment','specific_date','after_module')),
  ADD COLUMN IF NOT EXISTS drip_delay_days INT NOT NULL DEFAULT 0 CHECK (drip_delay_days >= 0),
  ADD COLUMN IF NOT EXISTS drip_unlock_date TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS drip_unlock_module_id UUID DEFAULT NULL;

-- Index for fast drip checks
CREATE INDEX IF NOT EXISTS idx_lessons_drip_unlock_lesson ON public.lessons(drip_unlock_lesson_id) WHERE drip_unlock_lesson_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lessons_drip_unlock_module ON public.lessons(drip_unlock_module_id) WHERE drip_unlock_module_id IS NOT NULL;
