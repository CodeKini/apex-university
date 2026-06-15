import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceRoleClient }    from '@/lib/supabase/server'
import { z } from 'zod'

const Schema = z.object({
  status:           z.enum(['approved','rejected','paid']),
  rejection_reason: z.string().nullable().optional(),
  payout_note:      z.string().nullable().optional(),
})

// PATCH /api/platform/commissions/[commissionId] — approve/reject/mark paid
export async function PATCH(req: NextRequest, { params }: { params: { commissionId: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: comm } = await (supabase as any)
    .from('affiliate_commissions').select('*, affiliates(workspace_id)')
    .eq('id', params.commissionId).single()
  if (!comm) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const workspaceId = comm.workspace_id
  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', session.user.id).single()
  const isPlatformAdmin = pu?.platform_role === 'platform_admin'
  if (!isPlatformAdmin) {
    const { data: wm } = await (supabase as any)
      .from('workspace_members').select('role')
      .eq('workspace_id', workspaceId).eq('user_id', session.user.id).in('role', ['owner','admin']).single()
    if (!wm) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body   = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const svc = createServiceRoleClient() as any
  const updates: Record<string, any> = {
    status:     parsed.data.status,
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.status === 'approved')  updates.approved_at      = new Date().toISOString()
  if (parsed.data.status === 'rejected')  updates.rejection_reason = parsed.data.rejection_reason ?? null
  if (parsed.data.status === 'paid') {
    updates.paid_at = new Date().toISOString()
    // Create payout record and update affiliate totals
    await svc.from('affiliate_payouts').insert({
      affiliate_id: comm.affiliate_id,
      workspace_id: workspaceId,
      amount_cents: comm.commission_cents,
      note:         parsed.data.payout_note ?? null,
    })
  }

  const { data, error } = await svc
    .from('affiliate_commissions').update(updates).eq('id', params.commissionId).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ commission: data })
}
