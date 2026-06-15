// PATCH /api/platform/quizzes/[quizId]  — update quiz settings
// DELETE /api/platform/quizzes/[quizId] — delete quiz (cascade deletes questions, options, attempts)

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'

async function assertQuizAccess(supabase: any, quizId: string, userId: string) {
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
  if (!quiz) return null

  const { data: pu } = await supabase
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return quiz

  const { data: wm } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', quiz.workspace_id).eq('user_id', userId)
    .in('role', ['owner', 'admin']).single()
  return wm ? quiz : null
}

const PatchSchema = z.object({
  pass_score:     z.number().int().min(0).max(100).optional(),
  max_attempts:   z.number().int().min(0).optional(),
  reveal_answers: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { quizId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quiz = await assertQuizAccess(supabase, params.quizId, session.user.id)
  if (!quiz) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body   = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { data: updated, error } = await supabase
    .from('quizzes').update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.quizId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ quiz: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { quizId: string } }) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quiz = await assertQuizAccess(supabase, params.quizId, session.user.id)
  if (!quiz) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase.from('quizzes').delete().eq('id', params.quizId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
