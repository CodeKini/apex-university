// SECURITY: Auth + role checks on every request.
// Multi-tenant workspace routing via subdomain → path rewrite.
// Defense-in-depth: middleware check + page-level check.

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse }           from 'next/server'
import type { NextRequest }       from 'next/server'
import type { Database }          from '@/types/database'
import { extractSlugFromHost }    from '@/lib/workspace/resolve'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'

const PROTECTED_ROUTES  = ['/dashboard', '/my-courses', '/profile', '/course-player', '/lesson']
const INSTRUCTOR_ROUTES = ['/instructor']
const ADMIN_ROUTES      = ['/admin']
const AUTH_ROUTES       = ['/login', '/signup', '/forgot-password']
const PLATFORM_ROUTES   = ['/platform']

const REFERRAL_COOKIE = 'apex_ref'

export async function middleware(req: NextRequest) {
  const res      = NextResponse.next()
  const supabase = createMiddlewareClient<Database>({ req, res })
  const pathname = req.nextUrl.pathname

  // ── Referral code capture ──────────────────────────────────────────────────
  // ?ref=CODE sets a cookie for the configured cookie duration (default 30 days).
  // The cookie is read at signup and purchase to attribute the referral.
  const refCode = req.nextUrl.searchParams.get('ref')
  if (refCode && /^[A-Z0-9]{6,16}$/.test(refCode)) {
    res.cookies.set(REFERRAL_COOKIE, refCode, {
      path:     '/',
      maxAge:   30 * 24 * 60 * 60, // 30 days default; override not needed at middleware level
      sameSite: 'lax',
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
    })
  }

  // ──────────────────────────────────────────────────────────
  // WORKSPACE SUBDOMAIN ROUTING
  // Production:  myacademy.apex-university.com
  //   → rewrite to /w/myacademy internally
  //   → URL bar still shows myacademy.apex-university.com ✓
  //
  // Development: localhost:3000/w/myacademy (path-based, no rewrite needed)
  // ──────────────────────────────────────────────────────────
  const host = req.headers.get('host') ?? ''
  const slug = extractSlugFromHost(host, ROOT_DOMAIN)

  if (slug) {
    const url      = req.nextUrl.clone()
    const restPath = pathname === '/' ? '' : pathname
    url.pathname   = `/w/${slug}${restPath}`
    const rewritten = NextResponse.rewrite(url)
    rewritten.headers.set('x-workspace-slug', slug)
    return rewritten
  }

  // ── Custom domain routing ─────────────────────────────────────────────────
  // If hostname is not the root platform domain, check workspace_domains table.
  // This allows academy.mysite.com → resolve to /w/{slug}.
  const hostname  = host.split(':')[0]
  const rootHost  = ROOT_DOMAIN.split(':')[0]
  const isRoot    = hostname === rootHost || hostname === `www.${rootHost}`
  const isSubPath = pathname.startsWith('/api/') || pathname.startsWith('/_next/')

  if (!isRoot && !isSubPath && !hostname.endsWith(`.${rootHost}`)) {
    try {
      const { data: domainRecord } = await (supabase as any)
        .from('workspace_domains')
        .select('workspace_id, workspaces!inner(slug)')
        .eq('domain', hostname)
        .eq('verified', true)
        .maybeSingle()

      const wsSlug: string | undefined = (domainRecord as any)?.workspaces?.slug
      if (wsSlug) {
        const url      = req.nextUrl.clone()
        const restPath = pathname === '/' ? '' : pathname
        url.pathname   = `/w/${wsSlug}${restPath}`
        const rewritten = NextResponse.rewrite(url)
        rewritten.headers.set('x-workspace-slug', wsSlug)
        rewritten.headers.set('x-custom-domain', hostname)
        return rewritten
      }
    } catch {
      // Fail open — let the request continue normally
    }
  }

  // ──────────────────────────────────────────────────────────
  // AUTH SESSION
  // ──────────────────────────────────────────────────────────
  const { data: { session } } = await supabase.auth.getSession()

  // Redirect logged-in users away from auth pages
  if (session && AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL('/platform/dashboard', req.url))
  }

  // ──────────────────────────────────────────────────────────
  // PLATFORM ROUTES (creator dashboard)
  // ──────────────────────────────────────────────────────────
  if (PLATFORM_ROUTES.some((r) => pathname.startsWith(r))) {
    if (pathname.startsWith('/platform/auth')) return res
    if (!session) {
      const url = new URL('/platform/auth/login', req.url)
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
    return res
  }

  // ──────────────────────────────────────────────────────────
  // LEGACY SINGLE-TENANT ROUTES
  // ──────────────────────────────────────────────────────────

  if (!session && PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
    const url = new URL('/login', req.url)
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (INSTRUCTOR_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!session) {
      const url = new URL('/login', req.url)
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
    const { data: profile } = await (supabase as any)
      .from('profiles').select('role').eq('id', session.user.id).single()
    if (!profile || !['instructor', 'admin'].includes(profile.role)) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!session) {
      const url = new URL('/platform/auth/login', req.url)
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
    const { data: pu } = await (supabase as any)
      .from('platform_users').select('platform_role').eq('id', session.user.id).maybeSingle()
    if (!pu || pu.platform_role !== 'platform_admin') {
      return NextResponse.redirect(new URL('/platform/dashboard', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|api/stripe/webhook).*)'],
}
