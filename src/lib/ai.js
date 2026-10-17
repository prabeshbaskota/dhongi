import { supabase } from './supabase.js'

// Talks to the "ai" Edge Function. The AI key lives on the server, never here.
export async function ai(action, session, extra = {}) {
  const { data, error } = await supabase.functions.invoke('ai', {
    body: { action, player_id: session?.player_id, token: session?.token, ...extra },
  })
  if (error) {
    // functions-js wraps non-2xx replies; dig out our own error message
    let msg = error.message
    try { const b = await error.context?.json?.(); if (b?.error) msg = b.error } catch { /* ignore */ }
    throw new Error(msg || 'AI request failed')
  }
  if (data?.error) throw new Error(data.error)
  return data
}

let statusPromise = null
export function aiAvailable() {
  if (!statusPromise) statusPromise = ai('status').then(d => !!d?.ai).catch(() => false)
  return statusPromise
}
