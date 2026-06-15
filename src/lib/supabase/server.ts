// Server-side Supabase client (Server Components, API Routes, Server Actions)
// SECURITY: reads cookies for auth but never exposes service role key to client
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export function createServerSupabaseClient() {
  return createServerComponentClient<Database>({ cookies })
}

// SECURITY: Service role client bypasses RLS — only use in trusted server contexts
// (Stripe webhook, admin operations). Never import on the client.
import { createClient } from '@supabase/supabase-js'

export function createServiceRoleClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
