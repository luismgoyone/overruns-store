import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Anonymous, cookie-free client for public catalog reads, so pages can be statically cached.
export function createPublicClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
