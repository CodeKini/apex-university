// Server-only. Used in every /admin API route.

import { NextResponse }            from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function requirePlatformAdmin() {
  const supabase = createServerSupabaseClient() as any
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return { session: null, supabase, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: pu } = await supabase
    .from('platform_users').select('platform_role, full_name, email')
    .eq('id', session.user.id).maybeSingle()

  if (!pu || pu.platform_role !== 'platform_admin') {
    return { session, supabase, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { session, supabase, error: null }
}

export async function auditLog(opts: {
  adminId:    string
  action:     string
  targetType: 'workspace' | 'user' | 'purchase' | 'system'
  targetId?:  string
  metadata?:  Record<string, unknown>
}) {
  try {
    const supabase = createServiceRoleClient() as any
    await supabase.from('admin_audit_log').insert({
      admin_id:    opts.adminId,
      action:      opts.action,
      target_type: opts.targetType,
      target_id:   opts.targetId ?? null,
      metadata:    opts.metadata ?? {},
    })
  } catch (e) {
    console.error('[AdminAudit] Failed to write audit log:', e)
  }
}
