import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
let supabaseAnonKey = (
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
)?.trim()

export let isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export let supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'gaurxv_verse_sb_token',
      },
    })
  : null

let initPromise: Promise<SupabaseClient | null> | null = null

/**
 * Ensures the Supabase client is initialized, querying /api/config if build-time variables were not inlined.
 */
export async function getOrInitSupabase(): Promise<SupabaseClient | null> {
  if (supabase) return supabase
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      const res = await fetch('/api/config')
      if (res.ok) {
        const data = await res.json()
        if (data?.supabaseUrl && data?.supabaseAnonKey) {
          supabaseUrl = String(data.supabaseUrl).trim()
          supabaseAnonKey = String(data.supabaseAnonKey).trim()
          isSupabaseConfigured = true
          supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
              storageKey: 'gaurxv_verse_sb_token',
            },
          })
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('stark:supabase-ready', { detail: { supabase } }))
          }
          return supabase
        }
      }
    } catch (e) {
      console.warn('[Supabase] Runtime config initialization error:', e)
    }
    return null
  })()

  return initPromise
}
