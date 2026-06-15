// GET /api/health — public liveness probe
// Returns only enough for a load balancer or uptime monitor to act on.

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { status: 'ok', timestamp: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
