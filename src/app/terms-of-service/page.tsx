import PublicLayout from '@/components/layout/PublicLayout'

export const metadata = { title: 'Terms of Service' }

// REPLACE: This is a placeholder. Have a lawyer review your actual Terms of Service.

export default function TermsPage() {
  return (
    <PublicLayout>
      <section className="max-w-3xl mx-auto px-4 py-24">
        <h1 className="section-title text-4xl mb-2">Terms of Service</h1>
        <p className="text-slate-500 text-sm mb-12">Last updated: January 1, 2025 — REPLACE with your actual date</p>

        <div className="prose prose-invert prose-slate max-w-none space-y-8 text-slate-300 text-sm leading-relaxed">
          {[
            {
              title: '1. Acceptance of Terms',
              body: 'By accessing or using Apex University, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the platform.',
            },
            {
              title: '2. Use of the Platform',
              body: 'You may use our platform for lawful purposes only. You agree not to share your account credentials, distribute course content, or attempt to circumvent our payment or access systems.',
            },
            {
              title: '3. Course Access',
              body: 'Upon purchase, you receive a personal, non-transferable license to access and view the course content. Courses may not be resold, redistributed, or shared.',
            },
            {
              title: '4. Refund Policy',
              body: 'We offer a 30-day money-back guarantee on all courses. Refund requests after 30 days will be considered on a case-by-case basis. To request a refund, contact support@apexuniversity.com.',
            },
            {
              title: '5. Intellectual Property',
              body: 'All course content, materials, and platform elements are the intellectual property of Apex University or its instructors. Unauthorized use is strictly prohibited.',
            },
            {
              title: '6. Limitation of Liability',
              body: 'Apex University shall not be liable for any indirect, incidental, or consequential damages arising from use of the platform. Results mentioned in testimonials are not guaranteed.',
            },
            {
              title: '7. Changes to Terms',
              body: 'We reserve the right to update these Terms at any time. Continued use of the platform after changes constitutes acceptance of the new Terms.',
            },
            {
              title: '8. Contact',
              body: 'For questions about these Terms, contact us at legal@apexuniversity.com. — REPLACE with your real legal contact',
            },
          ].map(({ title, body }) => (
            <div key={title}>
              <h2 className="text-white font-semibold text-base mb-2">{title}</h2>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  )
}
