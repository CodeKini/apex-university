// Browser-side Supabase client
// SECURITY: only uses the anon key — safe to use in client components
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/database'

export function createClient() {
  return createClientComponentClient<Database>()
}
