import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'
import { sendEmail }                  from '@/lib/email/send'
import { creatorWelcome, trialStarted } from '@/lib/email/templates'

const CreateSchema = z.object({
  name:    z.string().min(2).max(80),
  slug:    z.string().min(2).max(40).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
  tagline: z.string().max(160).optional().default(''),
})

const UpdateSchema = z.object({
  id:           z.string().uuid(),
  name:         z.string().min(2).max(80).optional(),
  tagline:      z.string().max(160).optional(),
  logo_url:     z.string().url().nullable().optional(),
  favicon_url:  z.string().url().nullable().optional(),
  cover_url:    z.string().url().nullable().optional(),
  settings:     z.record(z.unknown()).optional(),
})

// GET /api/workspaces — list workspaces owned by or where the caller is a member
export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Workspaces the caller owns (as a platform_user)
  const { data: owned } = await (supabase as any)
    .from('workspaces')
    .select('*, owner:platform_users(id, email, full_name, avatar_url)')
    .eq('owner_id', session.user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ workspaces: owned ?? [] })
}

// POST /api/workspaces — create a new workspace
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Caller must be a platform_user (creator)
  const { data: platformUser } = await (supabase as any)
    .from('platform_users')
    .select('id')
    .eq('id', session.user.id)
    .single()
  if (!platformUser) {
    return NextResponse.json(
      { error: 'You need a creator account to create a workspace.' },
      { status: 403 }
    )
  }

  const body   = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { name, slug, tagline } = parsed.data

  // Check slug availability
  const { data: existing } = await (supabase as any)
    .from('workspaces')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'That URL is already taken. Try another.' }, { status: 409 })
  }

  // Create workspace
  const { data: workspace, error } = await (supabase as any)
    .from('workspaces')
    .insert({ name, slug, tagline, owner_id: session.user.id })
    .select()
    .single()

  if (error || !workspace) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create workspace' }, { status: 500 })
  }

  // Add owner as workspace_member with role=owner
  await (supabase as any).from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id:      session.user.id,
    email:        session.user.email ?? '',
    full_name:    session.user.user_metadata?.full_name ?? null,
    avatar_url:   session.user.user_metadata?.avatar_url ?? null,
    role:         'owner',
  })

  // Emails — non-blocking; errors are logged but never fail the response
  const creatorEmail = session.user.email ?? ''
  const creatorName  = session.user.user_metadata?.full_name ?? ''
  if (creatorEmail) {
    const welcomeTpl = creatorWelcome({ name: creatorName, email: creatorEmail })
    sendEmail({
      to: creatorEmail, toName: creatorName,
      subject: welcomeTpl.subject, html: welcomeTpl.html,
      template: 'creator_welcome', workspaceId: workspace.id,
    }).catch(() => {})

    const trialTpl = trialStarted({
      name:          creatorName,
      workspaceName: workspace.name,
      trialEndsAt:   workspace.trial_ends_at ?? new Date(Date.now() + 14 * 86400000).toISOString(),
      workspaceId:   workspace.id,
    })
    sendEmail({
      to: creatorEmail, toName: creatorName,
      subject: trialTpl.subject, html: trialTpl.html,
      template: 'trial_started', workspaceId: workspace.id,
    }).catch(() => {})
  }

  return NextResponse.json({ workspace }, { status: 201 })
}

// PATCH /api/workspaces — update workspace settings / branding
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { id, settings, ...fields } = parsed.data

  // Verify ownership
  const { data: workspace } = await (supabase as any)
    .from('workspaces')
    .select('id, settings')
    .eq('id', id)
    .eq('owner_id', session.user.id)
    .single()
  if (!workspace) {
    return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 })
  }

  const update: Record<string, unknown> = { ...fields }
  if (settings) {
    update.settings = { ...(workspace.settings as object), ...settings }
  }

  const { data: updated, error } = await (supabase as any)
    .from('workspaces')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ workspace: updated })
}
