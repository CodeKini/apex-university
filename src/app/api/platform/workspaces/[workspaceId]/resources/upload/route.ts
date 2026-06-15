import { NextRequest, NextResponse }      from 'next/server'
import { createServerSupabaseClient }    from '@/lib/supabase/server'
import { checkStorageLimit }             from '@/lib/plans'
import { uploadLimit, rateLimitResponse } from '@/lib/rateLimit'

const BUCKET   = 'workspace-resources'
const MAX_BYTES = 500 * 1024 * 1024 // 500 MB

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/zip','application/x-zip-compressed',
  'image/jpeg','image/jpg','image/png','image/webp','image/gif',
  'audio/mpeg','audio/mp4','audio/wav','audio/ogg',
  'video/mp4','video/webm',
  'application/octet-stream',
])

async function assertAccess(supabase: any, workspaceId: string, userId: string) {
  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', userId).single()
  if (pu?.platform_role === 'platform_admin') return true
  const { data: wm } = await (supabase as any)
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', userId).in('role', ['owner','admin']).single()
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
  if (!rl.ok) return rateLimitResponse(rl, 'Upload limit reached.')

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 500 MB)' }, { status: 413 })

  // Check mime type — treat unknown as octet-stream
  const mimeType = ALLOWED_TYPES.has(file.type) ? file.type : 'application/octet-stream'

  const { data: pu } = await (supabase as any)
    .from('platform_users').select('platform_role').eq('id', session.user.id).maybeSingle()
  const storageCheck = await checkStorageLimit(supabase, params.workspaceId, file.size, pu?.platform_role === 'platform_admin')
  if (!storageCheck.ok) return NextResponse.json({ error: storageCheck.message }, { status: 402 })

  const ext      = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 100)
  const path     = `${params.workspaceId}/${Date.now()}_${safeName}`
  const buffer   = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: false })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  await (supabase as any).rpc('increment_storage_bytes', {
    p_workspace_id: params.workspaceId,
    p_bytes:        file.size,
  })

  return NextResponse.json({
    storage_path: path,
    file_name:    file.name,
    file_size:    file.size,
    mime_type:    mimeType,
  }, { status: 201 })
}
