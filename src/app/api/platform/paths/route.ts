// GET  /api/platform/paths?workspaceId= — list paths (creator)
// POST /api/platform/paths              — create path

import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z }                          from 'zod'

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const CreateSchema = z.object({
  workspace_id:         z.string().uuid(),
  title:                z.string().min(1).max(200),
  slug:                 z.string().max(200).optional(),
  description:          z.string().max(2000).optional(),
  thumbnail_url:        z.string().url().optional().or(z.literal('')),
  difficulty:           z.enum(['beginner','intermediate','advanced']).default('beginner'),
  estimated_hours:      z.number().int().positive().optional(),
  certificates_enabled: z.boolean().default(false),
})

async function requireManager(supabase: any, workspaceId: string, userId: string) {
  const { data } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle()
  return data && ['owner','admin'].includes(data.role) ? data : null
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = new URL(req.url).searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const manager = await requireManager(supabase, workspaceId, session.user.id)
  if (!manager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: paths, error } = await supabase
    .from('learning_paths')
    .select(`
      id, title, slug, description, thumbnail_url, difficulty,
      estimated_hours, status, certificates_enabled, created_at, updated_at,
      courses:learning_path_courses(count),
      enrollments:learning_path_enrollments(count)
    `)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ paths: paths ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { workspace_id, slug: rawSlug, ...rest } = parsed.data
  const manager = await requireManager(supabase, workspace_id, session.user.id)
  if (!manager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const slug = slugify(rawSlug ?? rest.title)

  const { data: path, error } = await supabase
    .from('learning_paths')
    .insert({ workspace_id, slug, ...rest })
    .select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'A path with this slug already exists.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ path }, { status: 201 })
}
