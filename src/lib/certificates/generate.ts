// Server-only — generates a certificate PDF, uploads to Supabase Storage, inserts DB row.
// Called from the progress API route when a student reaches 100% completion.

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont, degrees } from 'pdf-lib'
import { createServiceRoleClient } from '@/lib/supabase/server'

export interface CertBranding {
  accentHex:  string   // replaces GOLD throughout
  footerText: string | null
}

// ── Layout constants ───────────────────────────────────────────────────
const W = 792   // US Letter landscape width  (pts)
const H = 612   // US Letter landscape height (pts)

// Colors
const IVORY  = rgb(0.992, 0.980, 0.961)  // #FDFAF5
const GOLD   = rgb(0.698, 0.502, 0.035)  // #B28009
const BLACK  = rgb(0.08,  0.08,  0.08)
const GRAY   = rgb(0.35,  0.35,  0.35)
const LGRAY  = rgb(0.65,  0.65,  0.65)

function cx(font: PDFFont, text: string, size: number): number {
  return (W - font.widthOfTextAtSize(text, size)) / 2
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return rgb(r, g, b)
}

async function buildPdf(
  studentName:   string,
  courseTitle:   string,
  workspaceName: string,
  issuedAt:      Date,
  verificationCode: string,
  appUrl:        string,
  branding?:     CertBranding | null,
): Promise<Uint8Array> {
  const ACCENT = branding?.accentHex ? hexToRgb(branding.accentHex) : GOLD
  const doc  = await PDFDocument.create()
  const page: PDFPage = doc.addPage([W, H])

  const bold    = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique)

  // ── Background ──────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: IVORY })

  // ── Double border ───────────────────────────────────────────────────
  page.drawRectangle({
    x: 18, y: 18, width: W - 36, height: H - 36,
    borderColor: ACCENT, borderWidth: 3,
    color: IVORY,
  })
  page.drawRectangle({
    x: 26, y: 26, width: W - 52, height: H - 52,
    borderColor: ACCENT, borderWidth: 0.8,
  })

  // ── Corner ornaments (filled squares at corners) ────────────────────
  const ornSize = 6
  const ornOffset = 15
  const corners = [
    { x: ornOffset,          y: H - ornOffset - ornSize },
    { x: W - ornOffset - ornSize, y: H - ornOffset - ornSize },
    { x: ornOffset,          y: ornOffset },
    { x: W - ornOffset - ornSize, y: ornOffset },
  ]
  for (const c of corners) {
    page.drawRectangle({ x: c.x, y: c.y, width: ornSize, height: ornSize, color: ACCENT })
  }

  // ── Header ──────────────────────────────────────────────────────────
  const certText = 'CERTIFICATE'
  page.drawText(certText, {
    x:    cx(bold, certText, 46),
    y:    H - 110,
    font: bold,
    size: 46,
    color: BLACK,
  })

  const ofText = 'OF  COMPLETION'
  page.drawText(ofText, {
    x:    cx(regular, ofText, 16),
    y:    H - 140,
    font: regular,
    size: 16,
    color: ACCENT,
    wordBreaks: [],
  })

  // ── Divider ─────────────────────────────────────────────────────────
  page.drawLine({
    start: { x: 80, y: H - 160 },
    end:   { x: W - 80, y: H - 160 },
    thickness: 0.5,
    color: ACCENT,
  })

  // ── Body ─────────────────────────────────────────────────────────────
  const certifies = 'This is to certify that'
  page.drawText(certifies, {
    x:    cx(oblique, certifies, 14),
    y:    H - 200,
    font: oblique,
    size: 14,
    color: GRAY,
  })

  // Student name — large, prominent
  const nameSize = Math.min(36, 32 + Math.max(0, (20 - studentName.length) * 0.3))
  page.drawText(studentName, {
    x:    cx(bold, studentName, nameSize),
    y:    H - 248,
    font: bold,
    size: nameSize,
    color: BLACK,
  })

  // Underline below name
  const nameWidth = bold.widthOfTextAtSize(studentName, nameSize)
  page.drawLine({
    start: { x: (W - nameWidth) / 2, y: H - 258 },
    end:   { x: (W + nameWidth) / 2, y: H - 258 },
    thickness: 0.8,
    color: LGRAY,
  })

  const completed = 'has successfully completed'
  page.drawText(completed, {
    x:    cx(regular, completed, 14),
    y:    H - 286,
    font: regular,
    size: 14,
    color: GRAY,
  })

  // Course title — clamp length to two display lines
  const maxCourseSz = courseTitle.length > 50 ? 18 : courseTitle.length > 35 ? 22 : 26
  page.drawText(courseTitle, {
    x:    cx(bold, courseTitle, maxCourseSz),
    y:    H - 322,
    font: bold,
    size: maxCourseSz,
    color: BLACK,
  })

  const offered = `offered by ${workspaceName}`
  page.drawText(offered, {
    x:    cx(oblique, offered, 13),
    y:    H - 352,
    font: oblique,
    size: 13,
    color: GRAY,
  })

  // ── Divider ──────────────────────────────────────────────────────────
  page.drawLine({
    start: { x: 80, y: H - 380 },
    end:   { x: W - 80, y: H - 380 },
    thickness: 0.5,
    color: ACCENT,
  })

  // ── Footer ───────────────────────────────────────────────────────────
  const dateStr = issuedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // Left: issue date
  page.drawText('ISSUED', { x: 80, y: H - 408, font: bold, size: 8, color: LGRAY })
  page.drawText(dateStr, { x: 80, y: H - 424, font: regular, size: 11, color: GRAY })

  // Center: verification code label
  const codeLabel = 'VERIFICATION CODE'
  page.drawText(codeLabel, {
    x: cx(bold, codeLabel, 8), y: H - 408, font: bold, size: 8, color: LGRAY,
  })
  page.drawText(verificationCode, {
    x: cx(bold, verificationCode, 12), y: H - 424, font: bold, size: 12, color: ACCENT,
  })

  // Right: verify URL
  const verifyUrl = `${appUrl}/verify/${verificationCode}`
  page.drawText('VERIFY AT', { x: W - 80 - regular.widthOfTextAtSize('VERIFY AT', 8), y: H - 408, font: bold, size: 8, color: LGRAY })
  const urlSize = 8
  page.drawText(verifyUrl, {
    x: W - 80 - regular.widthOfTextAtSize(verifyUrl, urlSize),
    y: H - 424,
    font: regular,
    size: urlSize,
    color: GRAY,
  })

  // ── Academy watermark (light, rotated) ──────────────────────────────
  const wm = workspaceName.toUpperCase()
  const wmSize = 48
  const wmWidth = bold.widthOfTextAtSize(wm, wmSize)
  page.drawText(wm, {
    x:       (W - wmWidth) / 2,
    y:       H / 2 - 20,
    font:    bold,
    size:    wmSize,
    color:   rgb(0.9, 0.88, 0.85),
    rotate:  degrees(-20),
    opacity: 0.18,
  })

  doc.setTitle(`Certificate of Completion — ${courseTitle}`)
  doc.setAuthor(workspaceName)
  doc.setSubject(`Awarded to ${studentName}`)

  return doc.save()
}

// ── Public API ─────────────────────────────────────────────────────────

export interface CertificateInput {
  userId:       string
  courseId:     string
  workspaceId:  string
  enrollmentId: string | null
  studentName:  string
  courseTitle:  string
  workspaceName: string
}

export async function issueCertificate(input: CertificateInput): Promise<string | null> {
  const supabase = createServiceRoleClient() as any

  // Idempotent: return existing code if already issued
  const { data: existing } = await supabase
    .from('certificates')
    .select('verification_code')
    .eq('course_id', input.courseId)
    .eq('user_id', input.userId)
    .maybeSingle()
  if (existing) return existing.verification_code

  // Check course has certificates enabled
  const { data: course } = await supabase
    .from('courses')
    .select('certificates_enabled')
    .eq('id', input.courseId)
    .single()
  if (!course?.certificates_enabled) return null

  // Generate unique verification code: e.g. APEX-A3F9K2X8
  const code = `APEX-${Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32])
    .join('')}`

  const issuedAt  = new Date()
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://example.com'

  // Load workspace plan + cert branding (Pro only)
  let certBranding: CertBranding | null = null
  try {
    const { getCertBranding } = await import('@/lib/branding/fetch')
    const { data: ws } = await supabase
      .from('workspaces').select('plan_name').eq('id', input.workspaceId).single()
    certBranding = await getCertBranding(input.workspaceId, ws?.plan_name ?? '')
  } catch { /* non-blocking */ }

  // Generate PDF bytes
  const pdfBytes = await buildPdf(
    input.studentName,
    input.courseTitle,
    input.workspaceName,
    issuedAt,
    code,
    appUrl,
    certBranding,
  )

  // Upload to Supabase Storage
  const storagePath = `${input.workspaceId}/${input.courseId}/${input.userId}.pdf`
  const { error: uploadErr } = await supabase.storage
    .from('certificates')
    .upload(storagePath, pdfBytes, {
      contentType:  'application/pdf',
      cacheControl: '31536000',
      upsert:       true,
    })

  let storageUrl: string | null = null
  if (!uploadErr) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    storageUrl = `${supabaseUrl}/storage/v1/object/public/certificates/${storagePath}`
  } else {
    console.error('[Certificate] Storage upload failed:', uploadErr.message)
  }

  // Insert DB record
  const { error: insertErr } = await supabase.from('certificates').insert({
    workspace_id:      input.workspaceId,
    course_id:         input.courseId,
    user_id:           input.userId,
    enrollment_id:     input.enrollmentId,
    student_name:      input.studentName,
    course_title:      input.courseTitle,
    workspace_name:    input.workspaceName,
    issued_at:         issuedAt.toISOString(),
    verification_code: code,
    storage_path:      storageUrl ? storagePath : null,
    storage_url:       storageUrl,
  })

  if (insertErr) {
    console.error('[Certificate] DB insert failed:', insertErr.message)
    return null
  }

  return code
}

// Check if all lessons in a course are complete for a given user.
// Returns true only if at least one lesson exists and all are marked complete.
export async function isCourseComplete(
  supabase: any,
  userId:   string,
  courseId: string,
): Promise<boolean> {
  const [{ count: total }, { count: done }] = await Promise.all([
    supabase
      .from('lessons')
      .select('id', { count: 'exact', head: true })
      .eq('course_id', courseId),
    supabase
      .from('lesson_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .eq('completed', true),
  ])
  return (total ?? 0) > 0 && total === done
}
