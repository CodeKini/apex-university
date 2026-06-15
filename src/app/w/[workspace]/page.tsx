import Link                            from 'next/link'
import { getWorkspaceBySlug }          from '@/lib/workspace/resolve'
import { createServerSupabaseClient }  from '@/lib/supabase/server'
import { notFound }                    from 'next/navigation'
import { BookOpen, Users, ArrowRight } from 'lucide-react'

interface Props { params: { workspace: string } }

export default async function WorkspaceHomePage({ params }: Props) {
  const workspace = await getWorkspaceBySlug(params.workspace)
  if (!workspace) notFound()

  const supabase = createServerSupabaseClient()

  // Published courses in this workspace (Phase 2 will add workspace_id filter)
  // For now returns empty — the real course query comes in Phase 2.
  const courses: any[] = []

  const memberCount = workspace.seats_used

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      {/* Hero */}
      <section className="text-center mb-16">
        {workspace.logo_url && (
          <img
            src={workspace.logo_url}
            alt={workspace.name}
            className="w-20 h-20 rounded-2xl object-cover mx-auto mb-6"
          />
        )}
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4">
          {workspace.name}
        </h1>
        {workspace.tagline && (
          <p className="text-slate-300 text-lg max-w-xl mx-auto">{workspace.tagline}</p>
        )}

        {memberCount > 0 && (
          <div className="flex items-center justify-center gap-2 mt-6 text-slate-400 text-sm">
            <Users className="w-4 h-4" />
            {memberCount.toLocaleString()} members
          </div>
        )}
      </section>

      {/* Courses section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold text-white">Courses</h2>
          <Link href={`/w/${params.workspace}/courses`} className="text-gold-400 hover:text-gold-300 text-sm flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="card p-12 text-center">
            <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Courses coming soon.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((course: any) => (
              <Link
                key={course.id}
                href={`/w/${params.workspace}/courses/${course.slug}`}
                className="card p-0 overflow-hidden hover:border-navy-600 transition-colors"
              >
                {course.thumbnail_url && (
                  <img src={course.thumbnail_url} alt={course.title} className="w-full h-40 object-cover" />
                )}
                <div className="p-5">
                  <h3 className="font-semibold text-white line-clamp-2">{course.title}</h3>
                  <p className="text-slate-400 text-sm mt-1 line-clamp-2">{course.short_desc}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
