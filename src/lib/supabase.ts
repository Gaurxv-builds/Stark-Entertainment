import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function deriveAndSanitizeSupabaseUrl(url?: string, key?: string): string {
  // 1. If key is a Supabase JWT anon key, extract official project ref directly from token
  if (key && typeof key === 'string' && key.includes('.')) {
    try {
      const parts = key.split('.')
      if (parts[1]) {
        let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        while (b64.length % 4) b64 += '='
        const payload = JSON.parse(atob(b64))
        if (payload?.ref && typeof payload.ref === 'string') {
          return `https://${payload.ref}.supabase.co`
        }
      }
    } catch {}
  }

  // 2. Fallback to passed URL with auto-correction of known typos
  let clean = (url || '').trim()
  if (clean.includes('tfykktkuoohjyjvrjxop')) {
    clean = clean.replace('tfykktkuoohjyjvrjxop', 'tfykttkuoohjyjvrjxop')
  }
  return clean
}

let rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
let rawKey = (
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
)?.trim()

let supabaseUrl = deriveAndSanitizeSupabaseUrl(rawUrl, rawKey)
let supabaseAnonKey = rawKey || ''

export let isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export let supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'gaurxv_verse_sb_token',
      },
    })
  : null

let initPromise: Promise<SupabaseClient | null> | null = null

export function getSupabaseUrl(): string {
  return supabaseUrl
}

export function getSupabaseAnonKey(): string {
  return supabaseAnonKey
}

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
        const fetchedUrl = data?.supabaseUrl ? String(data.supabaseUrl).trim() : ''
        const fetchedKey = data?.supabaseAnonKey ? String(data.supabaseAnonKey).trim() : ''

        if (fetchedKey || fetchedUrl) {
          supabaseAnonKey = fetchedKey || supabaseAnonKey
          supabaseUrl = deriveAndSanitizeSupabaseUrl(fetchedUrl || supabaseUrl, supabaseAnonKey)
          isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

          if (isSupabaseConfigured) {
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
      }
    } catch (e) {
      console.warn('[Supabase] Runtime config initialization error:', e)
    }
    return null
  })()

  return initPromise
}
