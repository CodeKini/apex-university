import { NextRequest, NextResponse }  from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceRoleClient }    from '@/lib/supabase/server'
import { checkResourceAccess }        from '@/lib/resources/access'

const BUCKET = 'workspace-resources'
const SIGNED_URL_EXPIRES = 60 // seconds

// GET /api/student/resources/[resourceId]/download?workspaceId=...
// Server-side access check → returns signed URL or external URL
export async function GET(
  req: NextRequest,
  { params }: { params: { resourceId: string } },
) {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  // Server-side access gate
  const access = await checkResourceAccess(supabase, session.user.id, params.resourceId, workspaceId)
  if (!access.granted) {
    return NextResponse.json({ error: access.reason }, { status: 403 })
  }

  // Fetch resource
  const { data: resource } = await (supabase as any)
    .from('workspace_resources')
    .select('id, storage_path, external_url, file_name, resource_type, access_type')
    .eq('id', params.resourceId)
    .single()

  if (!resource) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Track download (fire-and-forget)
  ;(async () => {
    try {
      const svc = createServiceRoleClient()
      await (svc as any).from('resource_download_events').insert({
        resource_id:  params.resourceId,
        user_id:      session.user.id,
        workspace_id: workspaceId,
        access_type:  access.via,
      })
      await (svc as any).rpc('increment_resource_downloads', { resource_id_input: params.resourceId })
    } catch {}
  })()

  // External URL / link types — return URL directly
  if (resource.external_url && !resource.storage_path) {
    return NextResponse.json({ url: resource.external_url, type: 'external' })
  }

  // Uploaded file — generate short-lived signed URL via service role
  if (resource.storage_path) {
    const svc = createServiceRoleClient()
    const { data: signed, error } = await svc.storage
      .from(BUCKET)
      .createSignedUrl(resource.storage_path, SIGNED_URL_EXPIRES, {
        download: resource.file_name ?? true,
      })

    if (error || !signed?.signedUrl) {
      return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 })
    }

    return NextResponse.json({ url: signed.signedUrl, type: 'signed', expiresIn: SIGNED_URL_EXPIRES })
  }

  return NextResponse.json({ error: 'No downloadable content' }, { status: 400 })
}
