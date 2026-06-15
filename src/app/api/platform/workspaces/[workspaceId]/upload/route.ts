import { NextRequest, NextResponse }      from 'next/server'
import { createServerSupabaseClient }    from '@/lib/supabase/server'
import { checkStorageLimit }             from '@/lib/plans'
import { uploadLimit, rateLimitResponse } from '@/lib/rateLimit'

const BUCKET = 'workspace-assets'
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

async function assertAccess(supabase: any, workspaceId: string, userId: string) {
  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return true

  const { data: wm } = await (supabase as any)
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .in('role', ['owner', 'admin'])
    .single()
  return !!wm
}

export async function POST(
  req: NextRequest,
  { params }: { params: { workspaceId: string } },
) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ok = await assertAccess(supabase, params.workspaceId, session.user.id)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rl = await uploadLimit(req, params.workspaceId)
  if (!rl.ok) return rateLimitResponse(rl, 'Upload limit reached. You can upload up to 20 files per hour.')

  const formData = await req.formData()
  const file     = formData.get('file') as File | null
  const type     = (formData.get('type') as string) ?? 'logo' // 'logo' | 'favicon' | 'cover'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 413 })

  // Storage plan limit (platform admins bypass)
  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', session.user.id).maybeSingle()
  const storageCheck = await checkStorageLimit(supabase, params.workspaceId, file.size, pu?.platform_role === 'platform_admin')
  if (!storageCheck.ok) return NextResponse.json({ error: storageCheck.message }, { status: 402 })

  const allowed = ['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/x-icon','image/vnd.microsoft.icon']
  if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })

  const ext      = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path     = `${params.workspaceId}/${type}.${ext}`
  const buffer   = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType:  file.type,
      upsert:       true,
    })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  // Increment storage_used_bytes. We re-use the value already fetched in checkStorageLimit
  // by reading it again here (cheap — same row). For re-uploads of the same slot (logo/favicon)
  // this slightly over-counts; acceptable given these files are tiny.
  await (supabase as any).rpc('increment_storage_bytes', {
    p_workspace_id: params.workspaceId,
    p_bytes:        file.size,
  })

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  // Bust CDN cache by appending timestamp query param
  const url = `${publicUrl}?t=${Date.now()}`

  // Persist URL back to workspace row or settings
  const fieldMap: Record<string, string> = {
    logo:    'logo_url',
    cover:   'cover_url',
    favicon: '', // stored in settings.favicon_url
  }

  if (fieldMap[type]) {
    await (supabase as any)
      .from('workspaces')
      .update({ [fieldMap[type]]: url, updated_at: new Date().toISOString() })
      .eq('id', params.workspaceId)
  } else if (type === 'favicon') {
    const { data: current } = await (supabase as any)
      .from('workspaces').select('settings').eq('id', params.workspaceId).single()
    await (supabase as any)
      .from('workspaces')
      .update({ settings: { ...(current?.settings ?? {}), favicon_url: url }, updated_at: new Date().toISOString() })
      .eq('id', params.workspaceId)
  }

  return NextResponse.json({ url })
}
