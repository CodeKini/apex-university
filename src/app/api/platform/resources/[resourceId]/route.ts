import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceRoleClient }    from '@/lib/supabase/server'
import { z } from 'zod'

const UpdateSchema = z.object({
  title:         z.string().min(1).max(200).optional(),
  description:   z.string().nullable().optional(),
  resource_type: z.enum(['pdf','zip','image','audio','video_link','canva_link','google_link','external_url','file']).optional(),
  storage_path:  z.string().nullable().optional(),
  file_name:     z.string().nullable().optional(),
  file_size:     z.number().int().nullable().optional(),
  external_url:  z.string().nullable().optional(),
  access_type:   z.enum(['free','paid_course','membership','specific_courses','specific_paths']).optional(),
  course_ids:    z.array(z.string().uuid()).optional(),
  path_ids:      z.array(z.string().uuid()).optional(),
  is_active:     z.boolean().optional(),
})

async function loadResource(supabase: any, resourceId: string, userId: string) {
  const { data: r } = await (supabase as any)
    .from('workspace_resources').select('*').eq('id', resourceId).single()
  if (!r) return null

  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return r

  const { data: wm } = await (supabase as any)
    .from('workspace_members').select('role')
    .eq('workspace_id', r.workspace_id).eq('user_id', userId).in('role', ['owner','admin']).single()
  return wm ? r : null
}

// GET /api/platform/resources/[resourceId]
export async function GET(req: NextRequest, { params }: { params: { resourceId: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resource = await loadResource(supabase, params.resourceId, session.user.id)
  if (!resource) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ resource })
}

// PATCH /api/platform/resources/[resourceId]
export async function PATCH(req: NextRequest, { params }: { params: { resourceId: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resource = await loadResource(supabase, params.resourceId, session.user.id)
  if (!resource) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body   = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const { data, error } = await (supabase as any)
    .from('workspace_resources')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', params.resourceId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resource: data })
}

// DELETE /api/platform/resources/[resourceId]  — hard delete + storage cleanup
export async function DELETE(req: NextRequest, { params }: { params: { resourceId: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resource = await loadResource(supabase, params.resourceId, session.user.id)
  if (!resource) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Remove from storage if uploaded file
  if (resource.storage_path) {
    const svc = createServiceRoleClient()
    await svc.storage.from('workspace-resources').remove([resource.storage_path])
  }

  const { error } = await (supabase as any)
    .from('workspace_resources').delete().eq('id', params.resourceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
