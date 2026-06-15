import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const UpdateSchema = z.object({
  status:         z.enum(['approved','rejected','suspended']).optional(),
  rejection_note: z.string().nullable().optional(),
})

async function loadAffiliate(supabase: any, affiliateId: string, userId: string) {
  const { data: a } = await (supabase as any)
    .from('affiliates').select('*').eq('id', affiliateId).single()
  if (!a) return null

  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return a

  const { data: wm } = await (supabase as any)
    .from('workspace_members').select('role')
    .eq('workspace_id', a.workspace_id).eq('user_id', userId).in('role', ['owner','admin']).single()
  return wm ? a : null
}

// PATCH /api/platform/affiliates/[affiliateId] — approve/reject/suspend
export async function PATCH(req: NextRequest, { params }: { params: { affiliateId: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const affiliate = await loadAffiliate(supabase, params.affiliateId, session.user.id)
  if (!affiliate) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body   = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const updates: Record<string, any> = { ...parsed.data, updated_at: new Date().toISOString() }
  if (parsed.data.status === 'approved') updates.approved_at = new Date().toISOString()

  const { data, error } = await (supabase as any)
    .from('affiliates').update(updates).eq('id', params.affiliateId).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ affiliate: data })
}
