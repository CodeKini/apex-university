// Server-side workspace resolution from slug, domain, or request host.
// Always called from Server Components or API routes — never from client.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Workspace } from '@/types/workspace'

export async function getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', slug)
    .single()
  return data ?? null
}

export async function getWorkspaceByDomain(domain: string): Promise<Workspace | null> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('workspace_domains')
    .select('workspace_id, workspaces(*)')
    .eq('domain', domain)
    .eq('verified', true)
    .single()
  if (!data) return null
  return (data as any).workspaces ?? null
}

// Extracts workspace slug from a Next.js request Host header.
// Returns null when the request is for the root platform domain.
//
// Subdomain routing (production):
//   myacademy.apex-university.com → slug = "myacademy"
// Path-based routing (development / localhost):
//   localhost:3000/w/myacademy → slug extracted by middleware before this runs
export function extractSlugFromHost(host: string, rootDomain: string): string | null {
  // Strip port from host
  const hostname = host.split(':')[0]
  const root     = rootDomain.split(':')[0]

  // Exact match → platform root, no workspace
  if (hostname === root || hostname === `www.${root}`) return null

  // Subdomain match → workspace slug
  if (hostname.endsWith(`.${root}`)) {
    const sub = hostname.slice(0, -(`.${root}`).length)
    // Exclude www and any platform subdomains
    if (sub && sub !== 'www' && sub !== 'app' && sub !== 'api') return sub
  }

  return null
}
