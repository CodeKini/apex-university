import { notFound }    from 'next/navigation'
import Link             from 'next/link'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { Award, CheckCircle2, Shield } from 'lucide-react'

interface Props { params: { code: string } }

export default async function VerifyPathCertPage({ params }: Props) {
  const supabase = createServiceRoleClient() as any

  const { data: cert } = await supabase
    .from('path_certificates')
    .select('student_name, path_title, workspace_name, issued_at, verification_code, storage_url')
    .eq('verification_code', params.code)
    .maybeSingle()

  if (!cert) notFound()

  const issued = new Date(cert.issued_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        {/* Verified banner */}
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
          <Shield className="w-5 h-5 text-green-400 shrink-0" />
          <span className="text-green-300 text-sm font-medium">Verified Certificate</span>
        </div>

        {/* Card */}
        <div className="card p-8 text-center space-y-4">
          <Award className="w-12 h-12 text-gold-400 mx-auto" />
          <div>
            <p className="text-slate-400 text-sm">This certifies that</p>
            <p className="text-2xl font-bold text-white mt-1">{cert.student_name}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">has successfully completed all courses in the learning path</p>
            <p className="text-lg font-semibold text-gold-400 mt-1">"{cert.path_title}"</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">issued by</p>
            <p className="font-medium text-white">{cert.workspace_name}</p>
          </div>

          <div className="border-t border-navy-800 pt-4 space-y-1">
            <p className="text-sm text-slate-400">Issued on {issued}</p>
            <p className="text-xs text-slate-600">Verification code: {cert.verification_code}</p>
          </div>

          <div className="flex items-center justify-center gap-2 text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            This certificate is authentic and verified by Apex University.
          </div>
        </div>

        {cert.storage_url && (
          <div className="text-center">
            <a href={cert.storage_url} target="_blank" rel="noreferrer" className="btn-primary inline-flex">
              Download PDF Certificate
            </a>
          </div>
        )}

        <div className="text-center">
          <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
            ← Back to Apex University
          </Link>
        </div>
      </div>
    </div>
  )
}
