import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

let _userId = null

export function getUserId() { return _userId }
export function setUserId(id) { _userId = id }
