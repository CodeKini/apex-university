// Public certificate verification page — /verify/[code]
// No auth required. Fetches only safe public metadata.

import { Metadata } from 'next'
import Link         from 'next/link'
import { CheckCircle, XCircle, Award, Download } from 'lucide-react'

interface Props { params: { code: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Certificate Verification — ${params.code}`,
    description: 'Verify an Apex University certificate of completion.',
  }
}

async function verifyCertificate(code: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${appUrl}/api/certificates/${code}`, { cache: 'no-store' })
    return res.json()
  } catch {
    return { error: 'Network error' }
  }
}

export default async function VerifyPage({ params }: Props) {
  const { valid, certificate, error } = await verifyCertificate(params.code)

  const issuedDate = certificate?.issuedAt
    ? new Date(certificate.issuedAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-gray-500 text-sm mb-4">
            <Award size={16} className="text-indigo-600" />
            <span>Certificate Verification</span>
          </div>
        </div>

        {valid && certificate ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Green verified banner */}
            <div className="bg-green-50 border-b border-green-100 px-8 py-5 flex items-center gap-3">
              <CheckCircle size={22} className="text-green-600 shrink-0" />
              <div>
                <div className="font-semibold text-green-800">Certificate Verified</div>
                <div className="text-sm text-green-600">This certificate is authentic.</div>
              </div>
            </div>

            {/* Certificate details */}
            <div className="px-8 py-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Award size={28} className="text-indigo-600" />
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Certificate of Completion</div>
                <h1 className="text-2xl font-bold text-gray-900 mt-2">{certificate.courseTitle}</h1>
              </div>

              <div className="space-y-4">
                <Row label="Awarded to"   value={certificate.studentName} />
                <Row label="Issued by"    value={certificate.workspaceName} />
                <Row label="Issue date"   value={issuedDate ?? '—'} />
                <Row label="Verify code"  value={certificate.verificationCode} mono />
              </div>

              {certificate.pdfUrl && (
                <a
                  href={certificate.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl transition-colors"
                >
                  <Download size={16} />
                  Download Certificate PDF
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-red-50 border-b border-red-100 px-8 py-5 flex items-center gap-3">
              <XCircle size={22} className="text-red-600 shrink-0" />
              <div>
                <div className="font-semibold text-red-800">Certificate Not Found</div>
                <div className="text-sm text-red-600">
                  {error === 'Certificate not found'
                    ? 'No certificate exists with this verification code.'
                    : 'Unable to verify this certificate. Please try again.'}
                </div>
              </div>
            </div>
            <div className="px-8 py-8 text-center">
              <p className="text-sm text-gray-500 mb-1">Verification code checked:</p>
              <code className="text-sm font-mono bg-gray-100 px-3 py-1 rounded text-gray-700">
                {params.code}
              </code>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by <Link href="/" className="text-indigo-600 hover:underline">Apex University</Link>
        </p>
      </div>
    </div>
  )
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium text-gray-900 text-right ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  )
}
