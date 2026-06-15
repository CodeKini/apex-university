// Server-only. Never import in client components.
import { createServiceRoleClient } from '@/lib/supabase/server'

export interface WorkspaceBranding {
  academy_name:          string | null
  tagline:               string | null
  logo_url:              string | null
  hero_image_url:        string | null
  primary_color:         string
  secondary_color:       string
  accent_color:          string
  footer_text:           string | null
  social_links:          Record<string, string>
  hide_powered_by_apex:  boolean
  custom_email_branding: boolean
  custom_cert_branding:  boolean
  custom_login_branding: boolean
  login_bg_url:          string | null
  login_welcome_message: string | null
  email_from_name:       string | null
}

export const DEFAULT_BRANDING: WorkspaceBranding = {
  academy_name:          null,
  tagline:               null,
  logo_url:              null,
  hero_image_url:        null,
  primary_color:         '#1e293b',
  secondary_color:       '#0f172a',
  accent_color:          '#eab308',
  footer_text:           null,
  social_links:          {},
  hide_powered_by_apex:  false,
  custom_email_branding: false,
  custom_cert_branding:  false,
  custom_login_branding: false,
  login_bg_url:          null,
  login_welcome_message: null,
  email_from_name:       null,
}

export async function getWorkspaceBranding(workspaceId: string): Promise<WorkspaceBranding> {
  try {
    const svc = createServiceRoleClient() as any
    const { data } = await svc
      .from('workspace_branding')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (!data) return DEFAULT_BRANDING
    return { ...DEFAULT_BRANDING, ...data, social_links: data.social_links ?? {} }
  } catch {
    return DEFAULT_BRANDING
  }
}

export interface EmailBranding {
  name:      string
  logo_url:  string | null
  accent:    string
  footer:    string | null
  from_name: string | null
}

// Returns email branding only if plan is 'pro' and custom_email_branding is enabled.
export async function getEmailBranding(
  workspaceId:   string,
  planName:      string,
  workspaceName: string,
): Promise<EmailBranding | null> {
  if (planName !== 'pro') return null
  const b = await getWorkspaceBranding(workspaceId)
  if (!b.custom_email_branding) return null
  return {
    name:      b.academy_name ?? workspaceName,
    logo_url:  b.logo_url,
    accent:    b.accent_color,
    footer:    b.footer_text,
    from_name: b.email_from_name,
  }
}

export interface CertBranding {
  accentHex:  string
  footerText: string | null
}

// Returns cert branding only if plan is 'pro' and custom_cert_branding is enabled.
export async function getCertBranding(
  workspaceId: string,
  planName:    string,
): Promise<CertBranding | null> {
  if (planName !== 'pro') return null
  const b = await getWorkspaceBranding(workspaceId)
  if (!b.custom_cert_branding) return null
  return { accentHex: b.accent_color, footerText: b.footer_text }
}
