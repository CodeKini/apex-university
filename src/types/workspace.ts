// ============================================================
// WORKSPACE TYPESCRIPT TYPES
// Mirrors the tables created in 003_multi_tenant_core.sql
// ============================================================

export type WorkspacePlanStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
export type WorkspaceMemberRole = 'owner' | 'admin' | 'moderator' | 'member'
export type PlatformUserRole    = 'creator' | 'platform_admin'

// -------------------------------------------------------
// Core table shapes
// -------------------------------------------------------

export interface PlatformUser {
  id:                 string
  email:              string
  full_name:          string | null
  avatar_url:         string | null
  platform_role:      PlatformUserRole
  stripe_customer_id: string | null
  created_at:         string
  updated_at:         string
}

export interface Workspace {
  id:                     string
  slug:                   string
  name:                   string
  tagline:                string | null
  logo_url:               string | null
  favicon_url:            string | null
  cover_url:              string | null
  owner_id:               string
  plan_name:              string
  plan_status:            WorkspacePlanStatus
  stripe_customer_id:     string | null
  stripe_subscription_id: string | null
  trial_ends_at:          string
  seats_used:             number
  storage_used_bytes:     number
  settings:               WorkspaceSettings
  created_at:             string
  updated_at:             string
}

export interface WorkspaceMember {
  id:           string
  workspace_id: string
  user_id:      string
  email:        string
  full_name:    string | null
  avatar_url:   string | null
  role:         WorkspaceMemberRole
  joined_at:    string
  last_seen_at: string | null
}

export interface WorkspaceInvite {
  id:           string
  workspace_id: string
  invited_by:   string
  email:        string
  role:         WorkspaceMemberRole
  token:        string
  accepted_at:  string | null
  expires_at:   string
  created_at:   string
}

export interface WorkspaceDomain {
  id:                   string
  workspace_id:         string
  domain:               string
  verified:             boolean
  ssl_provisioned:      boolean
  txt_verification_key: string
  is_primary:           boolean
  status:               'pending' | 'verified' | 'failed'
  verified_at:          string | null
  created_at:           string
}

export interface WorkspaceBranding {
  academy_name:          string | null
  tagline:               string | null
  logo_url:              string | null
  hero_image_url:        string | null
  primary_color:         string | null
  secondary_color:       string | null
  accent_color:          string | null
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

// -------------------------------------------------------
// Settings jsonb shape
// -------------------------------------------------------

export interface WorkspaceSettings {
  accent_color?:        string    // hex, e.g. "#6366f1"
  login_headline?:      string
  login_subheadline?:   string
  welcome_message?:     string
  allow_self_signup?:   boolean   // students can sign up without invite
  require_approval?:    boolean   // admin approves each new member
  community_enabled?:   boolean
  [key: string]:        unknown
}

// -------------------------------------------------------
// Extended types (with joined relations)
// -------------------------------------------------------

export interface WorkspaceWithOwner extends Workspace {
  owner: Pick<PlatformUser, 'id' | 'email' | 'full_name' | 'avatar_url'>
}

export interface WorkspaceWithMembership extends Workspace {
  my_role: WorkspaceMemberRole | null   // null if not a member (owner view)
  member_count: number
}

// -------------------------------------------------------
// Context type passed through the app via WorkspaceProvider
// -------------------------------------------------------

export interface WorkspaceContext {
  workspace:  Workspace
  membership: WorkspaceMember | null   // null for the owner when viewing as creator
  isOwner:    boolean
  isAdmin:    boolean                  // owner OR admin role
  branding:   WorkspaceBranding | null
}

// -------------------------------------------------------
// API payloads
// -------------------------------------------------------

export interface CreateWorkspacePayload {
  name:    string
  slug:    string
  tagline: string
}

export interface UpdateWorkspacePayload {
  name?:        string
  tagline?:     string
  logo_url?:    string
  favicon_url?: string
  cover_url?:   string
  settings?:    Partial<WorkspaceSettings>
}
