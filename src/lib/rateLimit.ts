// Server-only rate limiting via Upstash Redis.
//
// Falls back to a no-op (allow all) when env vars are missing — safe for local
// dev without an Upstash account. Set UPSTASH_REDIS_REST_URL +
// UPSTASH_REDIS_REST_TOKEN in .env.local (and Vercel env) to activate.
//
// Usage in a route handler:
//   const rl = await signupLimit(req)
//   if (!rl.ok) return rateLimitResponse(rl)

import { NextRequest, NextResponse } from 'next/server'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  ok:        boolean
  remaining: number
  reset:     number   // unix seconds
  limit:     number
}

// ── Redis singleton ───────────────────────────────────────────────────────────

let redis: import('@upstash/redis').Redis | null = null
let redisAvailable = true

async function getRedis() {
  if (!redisAvailable) return null
  if (redis) return redis

  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token || url.includes('your-db')) {
    redisAvailable = false
    return null
  }

  try {
    const { Redis } = await import('@upstash/redis')
    redis = new Redis({ url, token })
    return redis
  } catch {
    redisAvailable = false
    return null
  }
}

// ── Sliding window counter (manual — no Ratelimit class needed) ───────────────
// Implements the standard sliding-window algorithm with a sorted set.
// Each call atomically records a timestamp and removes expired entries.

async function slidingWindow(
  key:    string,
  limit:  number,
  window: number, // seconds
): Promise<RateLimitResult> {
  const client = await getRedis()
  const now    = Date.now()                   // ms
  const windowMs = window * 1000

  if (!client) {
    // Upstash not configured — fail open
    return { ok: true, remaining: limit, reset: Math.floor(now / 1000) + window, limit }
  }

  try {
    // Remove entries older than the window, add current, count
    const clearBefore = now - windowMs
    await client.zremrangebyscore(key, '-inf', clearBefore)
    await client.zadd(key, { score: now, member: `${now}-${Math.random()}` })
    await client.expire(key, window + 1)
    const count = await client.zcard(key)

    const remaining = Math.max(0, limit - count)
    const reset     = Math.floor((now + windowMs) / 1000)
    return { ok: count <= limit, remaining, reset, limit }
  } catch {
    // Redis error — fail open
    return { ok: true, remaining: limit, reset: Math.floor(now / 1000) + window, limit }
  }
}

// ── IP extraction ─────────────────────────────────────────────────────────────

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

// ── Response builder ──────────────────────────────────────────────────────────

export function rateLimitResponse(result: RateLimitResult, message?: string): NextResponse {
  const retryAfter = Math.max(1, result.reset - Math.floor(Date.now() / 1000))
  return NextResponse.json(
    { error: message ?? 'Too many requests. Please slow down and try again.' },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit':     String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset':     String(result.reset),
        'Retry-After':           String(retryAfter),
      },
    },
  )
}

// ── Named limiters ────────────────────────────────────────────────────────────

/** 5 per IP per minute — student signup, workspace join */
export function signupLimit(req: NextRequest) {
  return slidingWindow(`rl:signup:${getIp(req)}`, 5, 60)
}

/** 3 per user per minute — Stripe checkout session creation */
export function checkoutLimit(_req: NextRequest, userId: string) {
  return slidingWindow(`rl:checkout:${userId}`, 3, 60)
}

/** 10 per user per minute — enrollment / revoke actions */
export function enrollmentLimit(_req: NextRequest, userId: string) {
  return slidingWindow(`rl:enroll:${userId}`, 10, 60)
}

/** 5 per workspace per hour — refund issuance */
export function refundLimit(_req: NextRequest, workspaceId: string) {
  return slidingWindow(`rl:refund:${workspaceId}`, 5, 3600)
}

/** 20 per workspace per hour — asset uploads */
export function uploadLimit(_req: NextRequest, workspaceId: string) {
  return slidingWindow(`rl:upload:${workspaceId}`, 20, 3600)
}

/** 60 per user per minute — lesson progress writes */
export function progressLimit(_req: NextRequest, userId: string) {
  return slidingWindow(`rl:progress:${userId}`, 60, 60)
}

/** 20 per user per hour — quiz attempt submissions */
export function quizLimit(_req: NextRequest, userId: string) {
  return slidingWindow(`rl:quiz:${userId}`, 20, 3600)
}
