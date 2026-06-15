# Security Checklist — Apex University

## Authentication & Authorization

- [x] Supabase Auth handles password hashing (bcrypt) — no passwords stored in plaintext
- [x] JWT tokens managed by Supabase Auth — short-lived with auto-refresh
- [x] Middleware (`src/middleware.ts`) enforces route protection on every request
- [x] Admin role checked in BOTH middleware AND individual page/API handlers (defense-in-depth)
- [x] Password reset uses Supabase's built-in secure token flow
- [x] Auth errors return generic messages to prevent email enumeration

## Stripe Payments

- [x] Stripe secret key is server-only — never imported in client components
- [x] Stripe publishable key is safe for browser use
- [x] Webhook signature verified on every webhook request (prevents forgery)
- [x] Checkout session creates enrollment via metadata — user cannot self-enroll without payment
- [x] Webhook handler is excluded from auth middleware (Stripe can't send session cookies)
- [x] Purchase records stored for audit trail

## Database / Supabase

- [x] Row Level Security (RLS) enabled on all tables
- [x] Least-privilege policies — users can only read/write their own data
- [x] Admin operations use `is_admin()` security-definer function (prevents RLS recursion)
- [x] Service role key only used server-side (webhook, never in client code)
- [x] Enrollments can only be created by the webhook (service role) — not by the client
- [x] Profile role cannot be self-escalated (RLS policy prevents users changing their own role)
- [x] Lesson progress requires enrollment check before write

## Input Validation

- [x] Zod schemas validate all API request bodies
- [x] Admin API routes validate input before database writes
- [x] UUIDs validated in progress route
- [x] Form fields use HTML input constraints (minLength, type=email, etc.)
- [x] `sanitizeText` utility available for user-generated content display

## HTTP Security

- [x] Security headers set in `next.config.js`:
  - `X-Frame-Options: DENY` (clickjacking protection)
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` (disables unused browser APIs)
- [x] All secrets in environment variables — never hardcoded
- [x] `.gitignore` includes `.env.local`

## Recommended Additions (not included — require external services)

- [ ] Rate limiting on `/api/stripe/checkout` and auth endpoints
  - Use Upstash Redis + `@upstash/ratelimit` for edge-compatible rate limiting
  - Recommended: 5 checkout attempts per IP per 10 minutes
  - Recommended: 10 login attempts per IP per 15 minutes

- [ ] CAPTCHA on signup and login (e.g., Cloudflare Turnstile — free)

- [ ] Content Security Policy (CSP) header — add when you know your CDN/font URLs

- [ ] Logging & alerting for suspicious activity (multiple failed logins, etc.)

- [ ] Email verification enforcement — currently optional; enable in Supabase Auth settings

- [ ] Signed Supabase Storage URLs for video delivery (prevents direct URL sharing)
  - Use `supabase.storage.from('course-videos').createSignedUrl(path, expiresIn)`
  - Generate on-demand when a student requests a lesson

## Environment Variables Security

NEVER commit these to version control:
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses all RLS
- `STRIPE_SECRET_KEY` — full Stripe account access
- `STRIPE_WEBHOOK_SECRET` — webhook forgery prevention

Use different keys for development (test mode) and production.
