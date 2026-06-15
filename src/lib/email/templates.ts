// Server-only email templates.
// All templates return { subject, html }.
// Keep styles inline — email clients don't load external CSS.

const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://apexuniversity.com'
const brand   = 'Apex University'
const accent  = '#6366f1' // indigo-500

export interface EmailBranding {
  name:       string
  logo_url:   string | null
  accent:     string
  footer:     string | null
  from_name:  string | null
}

function shell(content: string, branding?: EmailBranding | null): string {
  const b       = branding?.name     ?? brand
  const a       = branding?.accent   ?? accent
  const footer  = branding?.footer   ?? `You're receiving this because you have an account on ${b}. Questions? Reply to this email.`
  const logoHtml = branding?.logo_url
    ? `<img src="${branding.logo_url}" alt="${b}" style="height:32px;max-width:160px;object-fit:contain;vertical-align:middle;" />`
    : `<span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">${b}</span>`
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${b}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;max-width:560px;width:100%;">
        <tr><td style="background:${a};padding:24px 32px;">
          ${logoHtml}
        </td></tr>
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>
        <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">${footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function btn(text: string, url: string, accentColor?: string): string {
  const a = accentColor ?? accent
  return `<a href="${url}" style="display:inline-block;background:${a};color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px;">${text}</a>`
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;">${text}</h1>`
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">${text}</p>`
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">`
}

// ── Creator emails ─────────────────────────────────────────────────────────────

export function creatorWelcome(opts: { name: string; email: string }) {
  return {
    subject: `Welcome to ${brand} — let's build your academy`,
    html: shell(`
      ${h1(`Welcome, ${opts.name || 'Creator'}!`)}
      ${p(`You've joined <strong>${brand}</strong> as a course creator. Your 14-day free trial has started — no credit card required.`)}
      ${p(`Here's what to do next:`)}
      <ol style="margin:0 0 20px;padding-left:20px;font-size:15px;color:#475569;line-height:2;">
        <li>Create your workspace</li>
        <li>Add your first course</li>
        <li>Invite students</li>
      </ol>
      ${btn('Go to Dashboard', `${appUrl}/platform`)}
      ${divider()}
      ${p(`Your trial ends in 14 days. After that, choose a Starter, Growth, or Pro plan.`)}
    `),
  }
}

export function trialStarted(opts: { name: string; workspaceName: string; trialEndsAt: string; workspaceId: string }) {
  const endsDate = new Date(opts.trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return {
    subject: `Your ${brand} trial is active — expires ${endsDate}`,
    html: shell(`
      ${h1(`Your trial is active!`)}
      ${p(`<strong>${opts.workspaceName}</strong> is live on ${brand}. You have until <strong>${endsDate}</strong> to explore everything.`)}
      ${p(`Your trial includes all Pro features — unlimited courses, unlimited students, 250 GB storage.`)}
      ${btn('Manage Workspace', `${appUrl}/platform/workspaces/${opts.workspaceId}/billing`)}
      ${divider()}
      ${p(`Pick a plan before your trial ends to keep your workspace active.`)}
    `),
  }
}

export function trialEndingSoon(opts: { name: string; workspaceName: string; daysLeft: number; workspaceId: string }) {
  return {
    subject: `⏰ Your ${brand} trial ends in ${opts.daysLeft} day${opts.daysLeft === 1 ? '' : 's'}`,
    html: shell(`
      ${h1(`Trial ending soon`)}
      ${p(`Your trial for <strong>${opts.workspaceName}</strong> expires in <strong>${opts.daysLeft} day${opts.daysLeft === 1 ? '' : 's'}</strong>.`)}
      ${p(`Choose a plan now to avoid any interruption to your workspace and student access.`)}
      ${btn('Choose a Plan', `${appUrl}/platform/workspaces/${opts.workspaceId}/billing`)}
    `),
  }
}

export function subscriptionActive(opts: { name: string; workspaceName: string; planName: string; workspaceId: string }) {
  const planLabel = opts.planName.charAt(0).toUpperCase() + opts.planName.slice(1)
  return {
    subject: `You're on ${planLabel} — ${opts.workspaceName} is fully active`,
    html: shell(`
      ${h1(`Subscription activated!`)}
      ${p(`<strong>${opts.workspaceName}</strong> is now on the <strong>${planLabel}</strong> plan. Your workspace is fully active.`)}
      ${btn('Go to Dashboard', `${appUrl}/platform/workspaces/${opts.workspaceId}`)}
      ${divider()}
      ${p(`Manage your billing, invoices, and plan at any time from the Billing page.`)}
    `),
  }
}

export function subscriptionFailed(opts: { name: string; workspaceName: string; workspaceId: string }) {
  return {
    subject: `Action required: payment failed for ${opts.workspaceName}`,
    html: shell(`
      ${h1(`Payment failed`)}
      ${p(`We couldn't process your payment for <strong>${opts.workspaceName}</strong>. Your workspace is now in a past-due state.`)}
      ${p(`Update your payment method to restore full access.`)}
      ${btn('Fix Payment', `${appUrl}/platform/workspaces/${opts.workspaceId}/billing`)}
      ${divider()}
      ${p(`If you need help, reply to this email and we'll sort it out.`)}
    `),
  }
}

// ── Student emails ─────────────────────────────────────────────────────────────

export function studentWelcome(opts: { name: string; workspaceName: string; workspaceSlug: string; branding?: EmailBranding | null }) {
  const dashUrl = `${appUrl}/w/${opts.workspaceSlug}/dashboard`
  const a = opts.branding?.accent
  return {
    subject: `Welcome to ${opts.workspaceName}!`,
    html: shell(`
      ${h1(`Welcome to ${opts.workspaceName}!`)}
      ${p(`Hi ${opts.name || 'there'}, you're now a member of <strong>${opts.workspaceName}</strong>.`)}
      ${p(`Browse available courses and start learning whenever you're ready.`)}
      ${btn('Go to Dashboard', dashUrl, a)}
    `, opts.branding),
  }
}

export function freeEnrollmentConfirm(opts: {
  name:          string
  workspaceName: string
  workspaceSlug: string
  courseTitle:   string
  courseSlug:    string
  branding?:     EmailBranding | null
}) {
  const learnUrl = `${appUrl}/w/${opts.workspaceSlug}/learn/${opts.courseSlug}`
  const a = opts.branding?.accent
  return {
    subject: `You're enrolled in "${opts.courseTitle}"`,
    html: shell(`
      ${h1(`You're enrolled!`)}
      ${p(`Hi ${opts.name || 'there'}, you now have access to <strong>${opts.courseTitle}</strong> on ${opts.workspaceName}.`)}
      ${btn('Start Learning', learnUrl, a)}
    `, opts.branding),
  }
}

export function paidReceiptEmail(opts: {
  name:          string
  email:         string
  workspaceName: string
  workspaceSlug: string
  courseTitle:   string
  courseSlug:    string
  amountCents:   number
  currency:      string
  purchaseId:    string
  branding?:     EmailBranding | null
}) {
  const amount   = (opts.amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: opts.currency.toUpperCase() })
  const learnUrl = `${appUrl}/w/${opts.workspaceSlug}/learn/${opts.courseSlug}`
  const date     = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const a = opts.branding?.accent
  return {
    subject: `Receipt: ${opts.courseTitle} — ${amount}`,
    html: shell(`
      ${h1(`Your receipt`)}
      ${p(`Thanks for your purchase, ${opts.name || 'there'}!`)}
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 0;color:#64748b;">Course</td>
          <td style="padding:10px 0;text-align:right;font-weight:500;">${opts.courseTitle}</td>
        </tr>
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 0;color:#64748b;">Amount</td>
          <td style="padding:10px 0;text-align:right;font-weight:500;">${amount}</td>
        </tr>
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 0;color:#64748b;">Date</td>
          <td style="padding:10px 0;text-align:right;">${date}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#64748b;">Order ID</td>
          <td style="padding:10px 0;text-align:right;font-family:monospace;font-size:12px;color:#94a3b8;">${opts.purchaseId}</td>
        </tr>
      </table>
      ${btn('Start Learning', learnUrl, a)}
      ${divider()}
      ${p(`Keep this email as your receipt. If you have questions about your purchase, reply to this email.`)}
    `, opts.branding),
  }
}

export function courseAccessGranted(opts: {
  name:          string
  workspaceName: string
  workspaceSlug: string
  courseTitle:   string
  courseSlug:    string
  branding?:     EmailBranding | null
}) {
  const learnUrl = `${appUrl}/w/${opts.workspaceSlug}/learn/${opts.courseSlug}`
  const a = opts.branding?.accent
  return {
    subject: `You've been enrolled in "${opts.courseTitle}"`,
    html: shell(`
      ${h1(`Course access granted`)}
      ${p(`Hi ${opts.name || 'there'}, ${opts.workspaceName} has given you access to <strong>${opts.courseTitle}</strong>.`)}
      ${btn('Start Learning', learnUrl, a)}
    `, opts.branding),
  }
}

export function refundConfirmation(opts: {
  name:        string
  courseTitle: string
  amountCents: number
  currency:    string
  purchaseId:  string
}) {
  const amount = (opts.amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: opts.currency.toUpperCase() })
  return {
    subject: `Refund processed: ${opts.courseTitle}`,
    html: shell(`
      ${h1(`Refund confirmation`)}
      ${p(`Hi ${opts.name || 'there'}, your refund of <strong>${amount}</strong> for <em>${opts.courseTitle}</em> has been processed.`)}
      ${p(`Refunds typically appear on your statement within 5–10 business days depending on your bank.`)}
      ${p(`Order ID: <code style="font-size:12px;color:#94a3b8;">${opts.purchaseId}</code>`)}
      ${divider()}
      ${p(`If you have questions, reply to this email.`)}
    `),
  }
}
