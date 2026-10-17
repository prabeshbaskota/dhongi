import { createClient } from '@supabase/supabase-js'

// The publishable key is meant to be public. All game rules and secrets are
// enforced inside the database, so this key cannot read anyone's word.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://luggbkbefsjhylavqiao.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_YdTcA_lg2UHQ9eJ6NuC5jA_Lv0no5LD'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 20 } },
})

export async function rpc(fn, args = {}) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message || 'Something went wrong')
  return data
}
