import Link from 'next/link'
import {
  ArrowRight, Zap, CheckCircle, BarChart2, Globe, Shield,
  Users, BookOpen, CreditCard, Palette, Star,
} from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-navy-950 text-white">
      {/* ── NAV ──────────────────────────────────────────────────── */}
      <header className="border-b border-navy-800/60 sticky top-0 z-50 bg-navy-950/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-display font-bold text-lg tracking-tight">
            Apex <span className="text-gold-400">University</span>
          </span>
          <nav className="flex items-center gap-3">
            <Link href="/platform/auth/login"
              className="text-slate-400 hover:text-white text-sm transition-colors px-3 py-1.5">
              Sign in
            </Link>
            <Link href="/platform/auth/signup"
              className="btn-primary text-sm px-4 py-2">
              Start free trial
            </Link>
          </nav>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-28 pb-24 px-6 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gold-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-navy-800/60 border border-gold-500/30 rounded-full px-4 py-1.5 mb-8 text-xs text-gold-300 font-medium tracking-wide uppercase">
            <Zap className="w-3.5 h-3.5 text-gold-400" />
            The Kajabi alternative built for serious creators
          </div>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
            Launch your online academy.{' '}
            <span className="text-gold-400">Keep what you earn.</span>
          </h1>
          <p className="text-slate-300 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
            Apex University gives course creators a fully branded academy — courses, payments,
            student management, and analytics — without the Kajabi price tag.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/platform/auth/signup"
              className="btn-primary text-base px-8 py-4 inline-flex items-center gap-2">
              Create your academy free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="#features"
              className="btn-outline text-base px-8 py-4">
              See how it works
            </Link>
          </div>
          <p className="text-slate-500 text-xs mt-5">14-day free trial · No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ─────────────────────────────────────── */}
      <div className="border-y border-navy-800/60 bg-navy-900/30 py-5 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8 text-sm text-slate-400">
          {[
            { icon: Users,    text: 'Multi-tenant workspace per creator' },
            { icon: CreditCard, text: 'Stripe payments built in' },
            { icon: Globe,    text: 'Custom subdomain routing' },
            { icon: Shield,   text: 'Row-level security on every table' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-gold-500" /> {text}
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ─────────────────────────────────────────────── */}
      <section id="features" className="py-24 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl font-bold mb-4">
            Everything a creator needs. <span className="text-gold-400">Nothing they don't.</span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Each workspace is a fully isolated academy — with its own branding, students, courses, and revenue.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6 hover:border-gold-500/30 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-gold-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="py-24 bg-navy-900/30 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-4xl font-bold text-center mb-16">
            From signup to first sale <span className="text-gold-400">in minutes</span>
          </h2>
          <div className="space-y-10">
            {STEPS.map((s, i) => (
              <div key={s.title} className="flex gap-6 items-start">
                <div className="w-10 h-10 rounded-full bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400 font-bold text-sm shrink-0">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{s.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────── */}
      <section className="py-24 max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl font-bold mb-4">
            Simple pricing. <span className="text-gold-400">No surprises.</span>
          </h2>
          <p className="text-slate-400">Start free for 14 days. Upgrade when you're ready to sell.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((p) => (
            <div key={p.name}
              className={`card p-7 flex flex-col ${p.popular ? 'border-gold-500/50 bg-gold-500/5 relative' : ''}`}>
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold-500 text-navy-950 text-xs font-bold px-4 py-1 rounded-full">
                  Most popular
                </div>
              )}
              <div className="text-slate-400 text-sm mb-2">{p.name}</div>
              <div className="font-display text-4xl font-bold text-white mb-1">${p.price}</div>
              <div className="text-slate-500 text-xs mb-6">/ month</div>
              <ul className="space-y-3 mb-8 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/platform/auth/signup"
                className={p.popular ? 'btn-primary text-center' : 'btn-outline text-center'}>
                Start free trial
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,160,23,0.08)_0%,transparent_70%)]" />
        <div className="relative max-w-2xl mx-auto">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
            Ready to launch your academy?
          </h2>
          <p className="text-slate-300 text-lg mb-10">
            Join creators who chose Apex over overpriced platforms. Your first 14 days are on us.
          </p>
          <Link href="/platform/auth/signup"
            className="btn-primary text-base px-10 py-4 inline-flex items-center gap-2">
            Create your free academy <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="border-t border-navy-800 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500 text-sm">
          <span className="font-display font-bold text-slate-400">
            Apex <span className="text-gold-400">University</span>
          </span>
          <div className="flex gap-6">
            <Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms-of-service" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/platform/auth/login" className="hover:text-white transition-colors">Creator login</Link>
          </div>
          <span>© {new Date().getFullYear()} Apex University</span>
        </div>
      </footer>
    </div>
  )
}

const FEATURES = [
  {
    icon: Globe,
    title: 'Branded workspace',
    desc: 'Every creator gets their own academy with a custom subdomain, logo, colors, and domain routing.',
  },
  {
    icon: BookOpen,
    title: 'Full course builder',
    desc: 'Drag-and-drop modules, 7 lesson types (video, text, quiz, live session, file, Canva, iframe), and publish controls.',
  },
  {
    icon: CreditCard,
    title: 'Stripe payments',
    desc: 'Sell courses with one-time pricing. Stripe handles checkout — payments land directly in your account.',
  },
  {
    icon: Users,
    title: 'Student management',
    desc: 'See who enrolled, manually add students, manage access, and track completions per course.',
  },
  {
    icon: BarChart2,
    title: 'Creator analytics',
    desc: 'Revenue, enrollment trends, course completion rates, and recent activity — all in one dashboard.',
  },
  {
    icon: Palette,
    title: 'White-label branding',
    desc: "Upload your logo and favicon, pick brand colors, and write your academy's name and tagline.",
  },
  {
    icon: Shield,
    title: 'Secure by default',
    desc: 'Row-level security isolates every workspace. Students only ever see courses in their workspace.',
  },
  {
    icon: Star,
    title: 'Free + paid courses',
    desc: 'Mix free lead-magnet courses with paid products. Locks lessons automatically based on enrollment status.',
  },
  {
    icon: Zap,
    title: '14-day free trial',
    desc: "Start building immediately. No credit card required until you're ready to go live.",
  },
]

const STEPS = [
  {
    title: 'Create your account',
    desc: 'Sign up at /platform/auth/signup. No credit card required. Your creator profile is set up instantly.',
  },
  {
    title: 'Set up your workspace',
    desc: 'Name your academy, pick a slug, upload your logo and colors. Your branded workspace is live in seconds.',
  },
  {
    title: 'Build your first course',
    desc: 'Add modules and lessons, set a price (or make it free), and publish. The course is immediately available to students.',
  },
  {
    title: 'Share your academy link',
    desc: 'Send students to /w/your-slug. They sign up, browse, and enroll — Stripe handles payment, Apex handles enrollment.',
  },
  {
    title: 'Watch the analytics',
    desc: "Track revenue, student progress, and completion rates from your creator dashboard. Choose a plan when you're ready.",
  },
]

const PLANS = [
  {
    name: 'Starter',
    price: 29,
    popular: false,
    features: [
      'Unlimited courses',
      'Up to 100 students',
      'Stripe payments',
      'Basic analytics',
      'Custom branding',
    ],
  },
  {
    name: 'Growth',
    price: 79,
    popular: true,
    features: [
      'Everything in Starter',
      'Unlimited students',
      'Advanced analytics',
      'Priority support',
      'Custom domain (coming soon)',
    ],
  },
  {
    name: 'Pro',
    price: 199,
    popular: false,
    features: [
      'Everything in Growth',
      'Multiple workspaces',
      'API access (coming soon)',
      'White-label removal',
      'Dedicated onboarding',
    ],
  },
]
