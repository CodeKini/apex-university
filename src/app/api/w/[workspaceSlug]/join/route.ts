// POST /api/w/[workspaceSlug]/join
// Adds the currently authenticated user to the workspace as a 'member'.
// Called immediately after student signup on a workspace auth page.

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceRoleClient }    from '@/lib/supabase/server'
import { checkStudentLimit }          from '@/lib/plans'
import { sendEmail }                  from '@/lib/email/send'
import { studentWelcome }             from '@/lib/email/templates'
import { signupLimit, rateLimitResponse } from '@/lib/rateLimit'
import { cookies }                    from 'next/headers'

const REFERRAL_COOKIE = 'apex_ref'

export async function POST(
  req: NextRequest,
  { params }: { params: { workspaceSlug: string } }
) {
  const rl = await signupLimit(req)
  if (!rl.ok) return rateLimitResponse(rl, 'Too many join attempts. Please wait a moment and try again.')

  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Look up workspace by slug
  const { data: workspace } = await (supabase as any)
    .from('workspaces')
    .select('id, name, slug, settings, seats_used')
    .eq('slug', params.workspaceSlug)
    .single()

  if (!workspace) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 })

  // Idempotent: already a member?
  const { data: existing } = await (supabase as any)
    .from('workspace_members')
    .select('id, role')
    .eq('workspace_id', workspace.id)
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ member: existing, already_member: true })
  }

  // Plan limit check before adding a new member
  const limit = await checkStudentLimit(supabase as any, workspace.id)
  if (!limit.ok) return NextResponse.json({ error: limit.message }, { status: 402 })

  // Add as member
  const meta = session.user.user_metadata ?? {}
  const { data: member, error } = await (supabase as any)
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id:      session.user.id,
      email:        session.user.email ?? '',
      full_name:    meta.full_name  ?? null,
      avatar_url:   meta.avatar_url ?? null,
      role:         'member',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bump seats_used counter
  await (supabase as any)
    .from('workspaces')
    .update({ seats_used: (workspace as any).seats_used + 1 })
    .eq('id', workspace.id)

  // ── Affiliate referral attribution ──────────────────────────────────────────
  // Read the httpOnly referral cookie set by middleware on ?ref=CODE visits.
  try {
    const cookieStore  = cookies()
    const refCode      = cookieStore.get(REFERRAL_COOKIE)?.value
    if (refCode) {
      const svc = createServiceRoleClient() as any
      const { data: affiliate } = await svc
        .from('affiliates')
        .select('id')
        .eq('workspace_id', workspace.id)
        .eq('referral_code', refCode)
        .eq('status', 'approved')
        .maybeSingle()

      if (affiliate) {
        // Persist affiliate reference on the user (used for commission at purchase time)
        await svc.from('platform_users')
          .update({ referred_by_affiliate_id: affiliate.id })
          .eq('id', session.user.id)
          .is('referred_by_affiliate_id', null) // don't overwrite existing attribution

        // Increment signup counter
        await svc.rpc('increment_affiliate_signups', { p_affiliate_id: affiliate.id })
      }
    }
  } catch {}

  // Welcome email — non-blocking
  const studentEmail = session.user.email ?? ''
  const studentName  = meta.full_name ?? ''
  if (studentEmail) {
    const tpl = studentWelcome({
      name:          studentName,
      workspaceName: workspace.name,
      workspaceSlug: params.workspaceSlug,
    })
    sendEmail({
      to: studentEmail, toName: studentName,
      subject: tpl.subject, html: tpl.html,
      template: 'student_welcome', workspaceId: workspace.id,
    }).catch(() => {})
  }

  return NextResponse.json({ member }, { status: 201 })
}
