// Server-only — generates a path-completion certificate PDF.
// Called fire-and-forget after all courses in a learning path are finished.

import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import { createServiceRoleClient }                   from '@/lib/supabase/server'

const W = 792
const H = 612
const IVORY = rgb(0.992, 0.980, 0.961)
const GOLD  = rgb(0.698, 0.502, 0.035)
const BLACK = rgb(0.08,  0.08,  0.08)
const GRAY  = rgb(0.35,  0.35,  0.35)
const LGRAY = rgb(0.65,  0.65,  0.65)

function cx(font: import('pdf-lib').PDFFont, text: string, size: number): number {
  return (W - font.widthOfTextAtSize(text, size)) / 2
}

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return 'PATH-' + Array.from(bytes).map((b) => chars[b % chars.length]).join('')
}

async function buildPathPdf(
  studentName:   string,
  pathTitle:     string,
  workspaceName: string,
  issuedAt:      Date,
  code:          string,
  appUrl:        string,
): Promise<Uint8Array> {
  const doc  = await PDFDocument.create()
  const page = doc.addPage([W, H])

  const bold    = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique)

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: IVORY })

  // Double border
  page.drawRectangle({ x: 18, y: 18, width: W - 36, height: H - 36, borderColor: GOLD, borderWidth: 2.5, opacity: 0 })
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: GOLD, borderWidth: 0.7, opacity: 0 })

  // Corner ornaments
  const corners: Array<[number, number]> = [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]]
  for (const [x, y] of corners) {
    page.drawCircle({ x, y, size: 5, color: GOLD })
  }

  // Watermark
  const wmText  = workspaceName.toUpperCase()
  const wmWidth = bold.widthOfTextAtSize(wmText, 72)
  page.drawText(wmText, {
    x: (W - wmWidth) / 2, y: H / 2 - 30,
    size: 72, font: bold, color: GOLD, opacity: 0.04,
    rotate: degrees(-20),
  })

  // Academy name
  const academy = workspaceName.toUpperCase()
  page.drawText(academy, { x: cx(bold, academy, 11), y: H - 55, size: 11, font: bold, color: GOLD })
  page.drawLine({ start: { x: 60, y: H - 65 }, end: { x: W - 60, y: H - 65 }, thickness: 0.5, color: GOLD, opacity: 0.5 })

  // Title
  const title = 'LEARNING PATH CERTIFICATE'
  page.drawText(title, { x: cx(bold, title, 13), y: H - 95, size: 13, font: bold, color: GRAY })

  const sub = 'OF COMPLETION'
  page.drawText(sub, { x: cx(bold, sub, 10), y: H - 113, size: 10, font: bold, color: LGRAY })

  // Presented to
  const present = 'THIS CERTIFICATE IS PROUDLY PRESENTED TO'
  page.drawText(present, { x: cx(regular, present, 9), y: H - 155, size: 9, font: regular, color: LGRAY })

  // Student name
  page.drawText(studentName, { x: cx(bold, studentName, 38), y: H - 215, size: 38, font: bold, color: BLACK })
  page.drawLine({ start: { x: 120, y: H - 228 }, end: { x: W - 120, y: H - 228 }, thickness: 0.5, color: GOLD, opacity: 0.6 })

  // Achievement
  const achieve = 'for successfully completing all courses in the learning path:'
  page.drawText(achieve, { x: cx(oblique, achieve, 11), y: H - 260, size: 11, font: oblique, color: GRAY })

  // Path title
  const displayPath = `"${pathTitle}"`
  const pathSize    = displayPath.length > 50 ? 18 : 22
  page.drawText(displayPath, { x: cx(bold, displayPath, pathSize), y: H - 305, size: pathSize, font: bold, color: BLACK })

  // Divider
  page.drawLine({ start: { x: 60, y: H - 360 }, end: { x: W - 60, y: H - 360 }, thickness: 0.4, color: LGRAY, opacity: 0.5 })

  // Footer row
  const dateStr   = issuedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const verifyUrl = `${appUrl}/verify/path/${code}`

  page.drawText('DATE ISSUED',    { x: 80,       y: H - 388, size: 7, font: bold,    color: LGRAY })
  page.drawText(dateStr,          { x: 80,       y: H - 403, size: 10, font: regular, color: GRAY })
  page.drawText('VERIFICATION',   { x: W / 2 - 60, y: H - 388, size: 7, font: bold, color: LGRAY })
  page.drawText(code,             { x: W / 2 - 60, y: H - 403, size: 10, font: regular, color: GRAY })
  page.drawText('VERIFY AT',      { x: W - 270,  y: H - 388, size: 7, font: bold,    color: LGRAY })
  page.drawText(verifyUrl,        { x: W - 270,  y: H - 403, size: 7, font: regular,  color: LGRAY })

  return doc.save()
}

// ── Public interface ──────────────────────────────────────────────────────────

interface PathCertInput {
  userId:        string
  pathId:        string
  workspaceId:   string
  studentName:   string
  pathTitle:     string
  workspaceName: string
}

export async function issuePathCertificate(input: PathCertInput): Promise<string | null> {
  const supabase = createServiceRoleClient() as any

  // Idempotent — return existing code if already issued
  const { data: existing } = await supabase
    .from('path_certificates').select('verification_code')
    .eq('path_id', input.pathId).eq('user_id', input.userId).maybeSingle()
  if (existing) return existing.verification_code

  const code      = randomCode()
  const issuedAt  = new Date()
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-app.com'

  const pdfBytes = await buildPathPdf(
    input.studentName, input.pathTitle, input.workspaceName, issuedAt, code, appUrl,
  )

  const storagePath = `paths/${input.workspaceId}/${input.pathId}/${input.userId}.pdf`
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  let storageUrl: string | null = null

  const { error: uploadErr } = await supabase.storage
    .from('certificates')
    .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true })

  if (!uploadErr) {
    storageUrl = `${supabaseUrl}/storage/v1/object/public/certificates/${storagePath}`
  }

  const { error: insertErr } = await supabase.from('path_certificates').insert({
    path_id:           input.pathId,
    user_id:           input.userId,
    workspace_id:      input.workspaceId,
    student_name:      input.studentName,
    path_title:        input.pathTitle,
    workspace_name:    input.workspaceName,
    issued_at:         issuedAt.toISOString(),
    verification_code: code,
    storage_path:      storageUrl ? storagePath : null,
    storage_url:       storageUrl,
  })

  if (insertErr) {
    console.error('[PathCertificate] DB insert failed:', insertErr.message)
    return null
  }

  // Mark path enrollment as completed
  await supabase.from('learning_path_enrollments')
    .update({ completed_at: issuedAt.toISOString() })
    .eq('path_id', input.pathId).eq('user_id', input.userId)

  return code
}

export async function isPathComplete(
  supabase: any,
  userId:   string,
  pathId:   string,
): Promise<boolean> {
  const { data: pathCourses } = await supabase
    .from('learning_path_courses').select('course_id')
    .eq('path_id', pathId).order('position')

  if (!pathCourses || pathCourses.length === 0) return false

  for (const { course_id } of pathCourses) {
    const [{ count: total }, { count: done }] = await Promise.all([
      supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('course_id', course_id),
      supabase.from('lesson_progress').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('course_id', course_id).eq('completed', true),
    ])
    if ((total ?? 0) === 0 || total !== done) return false
  }
  return true
}
