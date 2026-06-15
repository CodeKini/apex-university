// GET /api/certificates/[code]
// Public verification endpoint — returns only safe metadata, no user_id or internal IDs.

import { NextRequest, NextResponse }  from 'next/server'
import { createServiceRoleClient }    from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } },
) {
  if (!params.code || params.code.length < 8) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  const supabase = createServiceRoleClient() as any

  const { data, error } = await supabase
    .from('certificates')
    .select('student_name, course_title, workspace_name, issued_at, verification_code, storage_url')
    .eq('verification_code', params.code)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })

  // Only expose safe fields — no user_id, workspace_id, or internal IDs
  return NextResponse.json({
    valid: true,
    certificate: {
      studentName:      data.student_name,
      courseTitle:      data.course_title,
      workspaceName:    data.workspace_name,
      issuedAt:         data.issued_at,
      verificationCode: data.verification_code,
      pdfUrl:           data.storage_url,
    },
  })
}
