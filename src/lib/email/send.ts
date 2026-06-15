// Server-only email helper. Never import in client components.
// Wraps Resend. Never throws — always returns ok/error so callers can log and continue.

import { Resend } from 'resend'
import { createServiceRoleClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.EMAIL_FROM ?? 'Apex University <noreply@apexuniversity.com>'

export interface SendEmailOptions {
  to:           string
  toName?:      string
  subject:      string
  html:         string
  template:     string
  workspaceId?: string | null
  metadata?:    Record<string, unknown>
}

export interface SendEmailResult {
  ok:       boolean
  resendId: string | null
  error:    string | null
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  let resendId: string | null = null
  let status: 'sent' | 'failed' = 'sent'
  let errorMsg: string | null = null

  try {
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      opts.toName ? `${opts.toName} <${opts.to}>` : opts.to,
      subject: opts.subject,
      html:    opts.html,
    })

    if (error) throw new Error(error.message)
    resendId = data?.id ?? null
  } catch (err: any) {
    status   = 'failed'
    errorMsg = err?.message ?? String(err)
    console.error(`[Email] Failed to send template="${opts.template}" to="${opts.to}":`, errorMsg)
  }

  // Audit log — best-effort, never throws
  try {
    const supabase = createServiceRoleClient() as any
    await supabase.from('email_events').insert({
      workspace_id:    opts.workspaceId ?? null,
      recipient_email: opts.to,
      recipient_name:  opts.toName ?? null,
      template:        opts.template,
      resend_id:       resendId,
      status,
      error:           errorMsg,
      metadata:        opts.metadata ?? {},
    })
  } catch (auditErr: any) {
    console.error('[Email] Audit log failed:', auditErr?.message)
  }

  return { ok: status === 'sent', resendId, error: errorMsg }
}
