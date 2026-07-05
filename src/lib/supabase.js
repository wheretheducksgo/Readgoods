import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Module-level user ID — updated via onAuthStateChange so lib functions
// can check auth status synchronously before making async Supabase calls.
let _userId = null

supabase.auth.getSession().then(({ data: { session } }) => {
  _userId = session?.user?.id || null
})

supabase.auth.onAuthStateChange((_, session) => {
  _userId = session?.user?.id || null
})

export function getUserId() { return _userId }
