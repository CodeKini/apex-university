import { NextRequest, NextResponse }   from 'next/server'
import { createServerSupabaseClient }  from '@/lib/supabase/server'
import { z }                           from 'zod'
import { checkCourseLimit }            from '@/lib/plans'

const PAGE_SIZE = 20

const CreateSchema = z.object({
  workspace_id: z.string().uuid(),
  title:        z.string().min(3).max(120),
  slug:         z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, 'Lowercase, numbers, hyphens only'),
})

async function assertWorkspaceAccess(supabase: any, workspaceId: string, userId: string) {
  // Platform admin bypass
  const { data: pu } = await supabase
    .from('platform_users')
    .select('platform_role')
    .eq('id', userId)
    .single()
  if (pu?.platform_role === 'platform_admin') return true

  // Workspace owner/admin
  const { data: wm } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .in('role', ['owner', 'admin'])
    .single()
  return !!wm
}

// GET /api/platform/courses?workspaceId=...&status=...&page=...
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const workspaceId = searchParams.get('workspaceId')
  const status      = searchParams.get('status')
  const page        = Math.max(1, parseInt(searchParams.get('page') ?? '1'))

  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const ok = await assertWorkspaceAccess(supabase, workspaceId, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let q = supabase
    .from('courses')
    .select('*, enrollment_count:enrollments(count)', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (status && status !== 'all') q = q.eq('status', status)

  const { data, count, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    courses:  data ?? [],
    total:    count ?? 0,
    has_more: (count ?? 0) > page * PAGE_SIZE,
  })
}

// POST /api/platform/courses
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { workspace_id, title, slug } = parsed.data

  const ok = await assertWorkspaceAccess(supabase, workspace_id, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Plan limit — platform admins bypass
  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', session.user.id).maybeSingle()
  const limit = await checkCourseLimit(supabase, workspace_id, pu?.platform_role === 'platform_admin')
  if (!limit.ok) return NextResponse.json({ error: limit.message }, { status: 402 })

  // Check slug uniqueness within workspace
  const { data: existing } = await supabase
    .from('courses')
    .select('id')
    .eq('workspace_id', workspace_id)
    .eq('slug', slug)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'Slug already used in this workspace' }, { status: 409 })

  const { data: course, error } = await (supabase as any)
    .from('courses')
    .insert({
      workspace_id,
      instructor_id: session.user.id,
      title,
      slug,
      short_desc: '',
      long_desc:  '',
      price:      0,
      status:     'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ course }, { status: 201 })
}
