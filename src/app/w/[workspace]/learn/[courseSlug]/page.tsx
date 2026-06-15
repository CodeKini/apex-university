import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function CoursePlayerRoot({
  params,
}: {
  params: { workspace: string; courseSlug: string }
}) {
  const supabase = createServerSupabaseClient() as any

  // Find course in this workspace by slug
  const { data: course } = await supabase
    .from('courses')
    .select('id')
    .eq('slug', params.courseSlug)
    .single()

  if (!course) redirect(`/w/${params.workspace}/courses`)

  // Get first lesson of first module
  const { data: firstModule } = await supabase
    .from('modules')
    .select('id, lessons(id, position)')
    .eq('course_id', course.id)
    .order('position', { ascending: true })
    .limit(1)
    .single()

  const lessons = (firstModule?.lessons as any[]) ?? []
  const firstLesson = lessons.sort((a, b) => a.position - b.position)[0]

  if (firstLesson) {
    redirect(`/w/${params.workspace}/learn/${params.courseSlug}/${firstLesson.id}`)
  }

  redirect(`/w/${params.workspace}/courses/${params.courseSlug}`)
}
