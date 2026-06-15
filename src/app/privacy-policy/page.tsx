import PublicLayout from '@/components/layout/PublicLayout'

export const metadata = { title: 'Privacy Policy' }

// REPLACE: This is a placeholder. Have a lawyer review and customize this for your
// actual data practices, jurisdiction, and GDPR/CCPA compliance requirements.

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <section className="max-w-3xl mx-auto px-4 py-24">
        <h1 className="section-title text-4xl mb-2">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mb-12">Last updated: January 1, 2025 — REPLACE with your actual date</p>

        <div className="space-y-8 text-slate-300 text-sm leading-relaxed">
          {[
            {
              title: '1. Information We Collect',
              body: 'We collect information you provide when creating an account (name, email), making a purchase (handled by Stripe — we do not store card details), and using the platform (progress data, lesson completions).',
            },
            {
              title: '2. How We Use Your Information',
              body: 'We use your information to provide and improve the platform, process payments, send transactional emails, and track your learning progress. We do not sell your personal information to third parties.',
            },
            {
              title: '3. Data Storage',
              body: 'Your account data is stored securely in Supabase (PostgreSQL). Payment information is processed and stored by Stripe. We apply encryption in transit and at rest.',
            },
            {
              title: '4. Cookies',
              body: 'We use essential cookies for authentication. We do not use advertising or tracking cookies without your consent.',
            },
            {
              title: '5. Third-Party Services',
              body: 'We use Stripe for payments (see Stripe\'s Privacy Policy), Supabase for data storage, and Vercel for hosting. Each provider has their own privacy practices.',
            },
            {
              title: '6. Your Rights',
              body: 'You may request access to, correction of, or deletion of your personal data at any time by contacting privacy@apexuniversity.com. — REPLACE with your real contact',
            },
            {
              title: '7. Data Retention',
              body: 'We retain your data as long as your account is active. Upon account deletion, personal data is removed within 30 days.',
            },
            {
              title: '8. Contact',
              body: 'For privacy questions, contact privacy@apexuniversity.com. — REPLACE with your real privacy contact',
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
