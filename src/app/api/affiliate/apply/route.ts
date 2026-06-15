import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const Schema = z.object({ workspaceId: z.string().uuid() })

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// POST /api/affiliate/apply
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { workspaceId } = parsed.data

  // Check affiliate program exists and is enabled
  const { data: prog } = await (supabase as any)
    .from('affiliate_programs').select('is_enabled, approval_required')
    .eq('workspace_id', workspaceId).maybeSingle()

  if (!prog?.is_enabled) return NextResponse.json({ error: 'Affiliate program is not active' }, { status: 400 })

  // Check not already an affiliate
  const { data: existing } = await (supabase as any)
    .from('affiliates').select('id, status').eq('workspace_id', workspaceId).eq('user_id', session.user.id).maybeSingle()
  if (existing) return NextResponse.json({ affiliate: existing, alreadyApplied: true })

  // Generate unique referral code
  let code = generateCode()
  let attempts = 0
  while (attempts < 5) {
    const { data: clash } = await (supabase as any)
      .from('affiliates').select('id').eq('workspace_id', workspaceId).eq('referral_code', code).maybeSingle()
    if (!clash) break
    code = generateCode()
    attempts++
  }

  const status = prog.approval_required ? 'pending' : 'approved'

  const { data, error } = await (supabase as any)
    .from('affiliates').insert({
      workspace_id:  workspaceId,
      user_id:       session.user.id,
      referral_code: code,
      status,
      approved_at:   status === 'approved' ? new Date().toISOString() : null,
    }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ affiliate: data, alreadyApplied: false }, { status: 201 })
}
