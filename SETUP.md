# Apex University — Setup Guide

## Prerequisites

- Node.js 18+ and npm/pnpm installed
- A Supabase account (free tier works to start)
- A Stripe account (test mode is free)
- A Vercel account for deployment (optional)

---

## Step 1 — Install Dependencies

```bash
cd /path/to/your/project
npm install
```

---

## Step 2 — Set Up Supabase

1. Go to https://supabase.com and create a new project.
2. Wait for the project to finish initializing (~1 min).
3. In your Supabase dashboard, go to **SQL Editor**.
4. Run the contents of `supabase/schema.sql` — this creates all tables and triggers.
5. Run `supabase/rls.sql` — this enables Row Level Security policies.
6. Run `supabase/seed.sql` — this creates the 5 sample courses.

### Get your Supabase keys

Go to **Settings → API** in your Supabase dashboard:
- `NEXT_PUBLIC_SUPABASE_URL` = "Project URL"
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = "anon public" key
- `SUPABASE_SERVICE_ROLE_KEY` = "service_role" key (keep this secret!)

### Configure Supabase Auth

Go to **Authentication → Settings**:
- Set "Site URL" to `http://localhost:3000` (for local dev)
- Add `http://localhost:3000/**` to "Redirect URLs"
- Enable email confirmations if you want (or disable for easier testing)

### Create your admin account

1. Sign up through the app at `/signup`
2. In Supabase dashboard → Table Editor → `profiles`
3. Find your user row and change `role` from `student` to `admin`

---

## Step 3 — Set Up Stripe

1. Go to https://stripe.com and create an account.
2. Go to **Developers → API Keys**.
3. Copy your **Publishable key** and **Secret key** (use test keys for development).

### Set up the Stripe webhook (for local development)

1. Install the Stripe CLI: https://stripe.com/docs/stripe-cli
2. Run: `stripe login`
3. Run: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
4. Copy the webhook signing secret (starts with `whsec_`) — this is your `STRIPE_WEBHOOK_SECRET`

### For production webhook

1. Go to Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. Endpoint URL: `https://your-domain.com/api/stripe/webhook`
3. Select event: `checkout.session.completed`
4. Copy the signing secret for `STRIPE_WEBHOOK_SECRET`

---

## Step 4 — Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Step 5 — Run Locally

```bash
npm run dev
```

Open http://localhost:3000

### Test the purchase flow

1. Sign up for a new account
2. Browse to any course → click "Enroll Now"
3. Use Stripe test card: `4242 4242 4242 4242` / any future date / any CVC
4. After payment, you should be redirected to `/checkout/success`
5. Check Supabase `enrollments` table — your enrollment should appear

---

## Step 6 — Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel
```

**Or use the Vercel dashboard:**
1. Push your code to GitHub
2. Go to https://vercel.com → New Project → Import from GitHub
3. Add all environment variables from `.env.local` in the Vercel dashboard
4. Change `NEXT_PUBLIC_APP_URL` to your actual Vercel domain
5. Update Supabase Auth "Site URL" and "Redirect URLs" to your production domain
6. Update the Stripe webhook endpoint to your production URL

---

## Replacing Sample Content

### REPLACE markers in the code
Search the codebase for `// REPLACE:` to find every place where you should swap in your own content:

```bash
grep -r "REPLACE" src/ --include="*.tsx" --include="*.ts"
```

Key things to replace:
- `src/app/page.tsx` — headline, subheadline, stats, testimonials, CTA copy
- `src/app/about/page.tsx` — your real mission, story, and team
- `src/components/layout/Navbar.tsx` — your brand name and logo
- `src/components/layout/Footer.tsx` — your brand name, tagline, contact email
- `src/app/contact/page.tsx` — your real contact details
- `src/app/terms-of-service/page.tsx` — your actual legal terms (have a lawyer review)
- `src/app/privacy-policy/page.tsx` — your actual privacy policy
- `supabase/seed.sql` — your real course content

---

## Adding a Supabase Storage Bucket for Videos

1. Go to Supabase → **Storage → New bucket**
2. Name it `course-videos`
3. Set to **private** (only enrolled students should access videos)
4. Upload videos and copy the signed URL to use as `video_url` in lessons
5. For public thumbnails, create a `thumbnails` bucket set to **public**

---

## Security Checklist

See `SECURITY.md` for the complete security review.
