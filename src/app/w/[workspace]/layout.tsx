import { notFound }                    from 'next/navigation'
import { createServerSupabaseClient }  from '@/lib/supabase/server'
import { getWorkspaceBySlug }          from '@/lib/workspace/resolve'
import { getWorkspaceBranding }        from '@/lib/branding/fetch'
import { isWhiteLabelPlan }            from '@/lib/plans'
import WorkspaceShell                  from '@/components/workspace/WorkspaceShell'
import type { WorkspaceContext }       from '@/types/workspace'

interface Props {
  children: React.ReactNode
  params:   { workspace: string }
}

export async function generateMetadata({ params }: Props) {
  const ws = await getWorkspaceBySlug(params.workspace)
  if (!ws) return {}
  let faviconUrl = ws.favicon_url ?? undefined
  if (isWhiteLabelPlan(ws.plan_name)) {
    try {
      const b = await getWorkspaceBranding(ws.id)
      faviconUrl = ws.favicon_url ?? undefined
      return {
        title:       b.academy_name ?? ws.name,
        description: b.tagline      ?? ws.tagline ?? undefined,
        icons:       faviconUrl ? [faviconUrl] : undefined,
      }
    } catch { /* fall through */ }
  }
  return {
    title:       ws.name,
    description: ws.tagline ?? undefined,
    icons:       faviconUrl ? [faviconUrl] : undefined,
  }
}

export default async function WorkspaceLayout({ children, params }: Props) {
  const slug      = params.workspace
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  // Get current user's membership (if any)
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  let membership = null
  if (session) {
    const { data } = await (supabase as any)
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('user_id', session.user.id)
      .single()
    membership = data ?? null

    // Update last_seen_at (best-effort, non-blocking)
    if (membership) {
      ;(supabase as any)
        .from('workspace_members')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', membership.id)
        .then(() => {})
    }
  }

  const isOwner = session?.user.id === workspace.owner_id
  const isAdmin = isOwner || membership?.role === 'admin'

  // Load branding (non-blocking — fail gracefully)
  let branding = null
  try {
    branding = await getWorkspaceBranding(workspace.id)
  } catch { /* ignore */ }

  const ctx: WorkspaceContext = { workspace, membership, isOwner, isAdmin, branding }

  return <WorkspaceShell ctx={ctx}>{children}</WorkspaceShell>
}
