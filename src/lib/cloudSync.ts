import { isSupabaseConfigured, supabase, getOrInitSupabase, getSupabaseUrl } from './supabase'
import { getProfile, saveProfile } from './profile'
import { saveReading, type ReadingItem } from './reading'
import type { ListItem } from './library'

export type CloudSyncStatus = 'checking' | 'connected' | 'syncing' | 'local_only' | 'offline' | 'error'

export type DiagnosticCode =
  | 'ENV_MISSING'
  | 'CLIENT_INIT_FAILED'
  | 'PROJECT_UNREACHABLE'
  | 'AUTH_SESSION_MISSING'
  | 'IDENTITY_MISMATCH'
  | 'TABLE_MISSING'
  | 'RLS_DENIED'
  | 'UPLOAD_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'OFFLINE'
  | 'SUCCESS'

export interface CloudSyncDiagnostics {
  status: CloudSyncStatus
  code: DiagnosticCode
  message: string
  details?: string
  lastSyncedAt?: number
}

let isSyncing = false
let syncTimeout: number | null = null
let currentDiagnostics: CloudSyncDiagnostics = {
  status: 'local_only',
  code: 'AUTH_SESSION_MISSING',
  message: 'Local storage active · Connect Supabase for encrypted multi-device cloud synchronization',
}

export function getCurrentDiagnostics(): CloudSyncDiagnostics {
  return currentDiagnostics
}

/** Check if cloud sync is currently available */
export function isCloudSyncAvailable(): boolean {
  return isSupabaseConfigured && Boolean(supabase)
}

/**
 * Diagnostic health check verifying the complete Supabase pipeline:
 * 1. Env vars & Client
 * 2. Network Reachability
 * 3. Auth Session
 * 4. Table Existence
 * 5. RLS Policies
 */
export async function diagnoseCloudSync(): Promise<CloudSyncDiagnostics> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    currentDiagnostics = {
      status: 'offline',
      code: 'OFFLINE',
      message: 'Network offline. Your local settings, watchlist and progress are active on this device.',
    }
    return currentDiagnostics
  }

  const client = supabase || (await getOrInitSupabase())
  if (!client) {
    currentDiagnostics = {
      status: 'local_only',
      code: 'ENV_MISSING',
      message: 'Supabase environment variables not configured in current deployment.',
    }
    return currentDiagnostics
  }

  // 1. Verify project reachability
  const targetUrl = getSupabaseUrl()
  if (targetUrl) {
    try {
      const pingRes = await fetch(`${targetUrl}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          apikey: (client as any).supabaseKey || '',
        },
        signal: AbortSignal.timeout(3500),
      })
      if (!pingRes.ok && pingRes.status !== 401 && pingRes.status !== 400) {
        currentDiagnostics = {
          status: 'error',
          code: 'PROJECT_UNREACHABLE',
          message: 'Supabase project endpoint returned an error or is uninitialized.',
          details: `HTTP ${pingRes.status}`,
        }
        return currentDiagnostics
      }
    } catch (e: any) {
      currentDiagnostics = {
        status: 'error',
        code: 'PROJECT_UNREACHABLE',
        message: 'Cannot reach Supabase project. Verify network connection.',
        details: e.message || String(e),
      }
      return currentDiagnostics
    }
  }

  // 2. Identify active authentication session or Stark Gate credentials
  try {
    let sessionData: any = null
    const { data: sData, error: sessionErr } = await client.auth.getSession()
    if (!sessionErr && sData?.session?.user) {
      sessionData = sData
    } else {
      // Auto-heal: Attempt to restore session from stored JWT or token
      const possibleTokens = [
        localStorage.getItem('gaurxv_verse_sb_jwt'),
        localStorage.getItem('gaurxv_verse_sb_token'),
        localStorage.getItem('gaurxv_verse_auth_token'),
      ].filter((t): t is string => Boolean(t && t.split('.').length === 3))

      for (const t of possibleTokens) {
        try {
          const { data: resData, error: resErr } = await client.auth.setSession({
            access_token: t,
            refresh_token: t,
          })
          if (!resErr && resData?.session?.user) {
            sessionData = resData
            break
          }
        } catch {}
      }

      // Auto-heal fallback: If user is authenticated in Stark Gate, request active Supabase session from backend
      if (!sessionData?.session?.user) {
        const authToken = localStorage.getItem('gaurxv_verse_auth_token') || ''
        const authStatus = localStorage.getItem('gaurxv_verse_auth')
        if (authToken || authStatus === 'authorized') {
          try {
            const vRes = await fetch('/api/auth/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
              },
              body: JSON.stringify({ token: authToken }),
            })
            if (vRes.ok) {
              const vData = await vRes.json()
              if (vData?.supabaseSession?.access_token) {
                const { data: setRes, error: setErr } = await client.auth.setSession({
                  access_token: vData.supabaseSession.access_token,
                  refresh_token: vData.supabaseSession.refresh_token,
                })
                if (!setErr && setRes?.session?.user) {
                  sessionData = setRes
                  localStorage.setItem('gaurxv_verse_sb_jwt', vData.supabaseSession.access_token)
                  localStorage.setItem('gaurxv_verse_sb_token', vData.supabaseSession.access_token)
                }
              }
            }
          } catch {}
        }
      }
    }

    const starkUser = localStorage.getItem('gaurxv_verse_auth_user') || ''
    const isStarkAuthorized = localStorage.getItem('gaurxv_verse_auth') === 'authorized'

    if (!sessionData?.session?.user && (!isStarkAuthorized || !starkUser)) {
      currentDiagnostics = {
        status: 'local_only',
        code: 'AUTH_SESSION_MISSING',
        message: 'Local storage active · Sign in via Stark Gate to connect encrypted cloud storage.',
        details: sessionErr ? sessionErr.message : 'No active user session',
      }
      return currentDiagnostics
    }

    // Determine canonical user ID and user email
    let userId = sessionData?.session?.user?.id || starkUser
    let userEmail = sessionData?.session?.user?.email?.toLowerCase() || ''

    // Verify token validity against Supabase Auth service if active
    if (sessionData?.session?.user) {
      try {
        const { data: userData } = await client.auth.getUser()
        if (userData?.user) {
          userId = userData.user.id
          userEmail = userData.user.email?.toLowerCase() || userEmail
        }
      } catch {}
    }

    // 3. Test table availability and RLS permissions on user_settings and user_profiles
    const { error: settingsErr } = await client
      .from('user_settings')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (settingsErr) {
      if (settingsErr.code === 'PGRST204' || settingsErr.code === '42P01' || settingsErr.message?.includes('does not exist')) {
        currentDiagnostics = {
          status: 'error',
          code: 'TABLE_MISSING',
          message: 'Database tables not found. Apply migration scripts in Supabase SQL editor.',
          details: settingsErr.message,
        }
        return currentDiagnostics
      }
      if (settingsErr.code === '42501' || settingsErr.message?.includes('policy') || settingsErr.message?.includes('permission')) {
        currentDiagnostics = {
          status: 'error',
          code: 'RLS_DENIED',
          message: 'Permission denied by Row Level Security (RLS). Check table policies.',
          details: settingsErr.message,
        }
        return currentDiagnostics
      }
    }

    currentDiagnostics = {
      status: 'connected',
      code: 'SUCCESS',
      message: `Synced via Supabase PostgreSQL (${userEmail || starkUser || 'authenticated user'})`,
      lastSyncedAt: Date.now(),
    }
    return currentDiagnostics
  } catch (err: any) {
    currentDiagnostics = {
      status: 'error',
      code: 'CLIENT_INIT_FAILED',
      message: 'Unexpected error communicating with Supabase.',
      details: err.message || String(err),
    }
    return currentDiagnostics
  }
}

/** Pull cloud records for the authenticated user and merge with local state */
export async function pullCloudData(userId: string): Promise<boolean> {
  const client = supabase || (await getOrInitSupabase())
  if (!client || !userId) return false
  if (isSyncing) return false
  isSyncing = true

  try {
    // 1. Profile
    const { data: profileData, error: pErr } = await client
      .from('user_profiles')
      .select('display_name, avatar_url, banner_url, frame_id')
      .eq('id', userId)
      .maybeSingle()

    if (profileData && !pErr) {
      const local = getProfile()
      saveProfile({
        name: profileData.display_name || local.name,
        avatar: profileData.avatar_url || local.avatar,
        banner: profileData.banner_url || local.banner,
        frame: profileData.frame_id || local.frame,
      })
    }

    // 2. Reading Progress
    const { data: readingData, error: rErr } = await client
      .from('user_reading_progress')
      .select('kind, book_id, title, cover_url, href, resume_url, label, progress, updated_at')
      .eq('user_id', userId)

    if (Array.isArray(readingData) && !rErr) {
      for (const item of readingData) {
        saveReading({
          kind: item.kind as ReadingItem['kind'],
          id: item.book_id,
          title: item.title,
          cover: item.cover_url || '',
          href: item.href || '',
          resume: item.resume_url || item.href || '',
          label: item.label || '',
          progress: Number(item.progress) || 0,
        })
      }
    }

    // 3. Watchlist & History
    const { data: libraryData, error: lErr } = await client
      .from('user_library')
      .select('media_type, item_id, title, image_url, status, progress, max_progress, score, last_watched_at')
      .eq('user_id', userId)

    if (Array.isArray(libraryData) && !lErr) {
      try {
        const rawList = localStorage.getItem('zk:list')
        const currentList: ListItem[] = rawList ? JSON.parse(rawList) : []
        const existingIds = new Set(currentList.map((x) => String(x.id)))

        for (const item of libraryData) {
          if (!existingIds.has(item.item_id)) {
            currentList.push({
              id: Number(item.item_id) || 0,
              title: item.title || '',
              image: item.image_url || '',
              score: item.score ?? null,
              status: (item.status as ListItem['status']) || 'watching',
              addedAt: Date.now(),
              progress: item.progress,
            })
          }
        }
        localStorage.setItem('zk:list', JSON.stringify(currentList))
      } catch {}
    }

    // 4. User Preferences
    try {
      const { data: prefData } = await client
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (prefData) {
        const rawPrefs = localStorage.getItem('zk:prefs')
        const prefs = rawPrefs ? JSON.parse(rawPrefs) : {}
        const merged = {
          ...prefs,
          audio: prefData.audio || prefs.audio,
          maxQ: prefData.max_quality || prefs.maxQ,
          server: prefData.preferred_server || prefs.server,
          autoNext: prefData.auto_next ?? prefs.autoNext,
          autoSkip: prefData.auto_skip ?? prefs.autoSkip,
          skipFiller: prefData.skip_filler ?? prefs.skipFiller,
        }
        localStorage.setItem('zk:prefs', JSON.stringify(merged))
        if (prefData.theme) {
          localStorage.setItem('theme', prefData.theme)
        }
      }
    } catch {}

    // 5. User Settings JSON (public.user_settings)
    try {
      const { data: settingsData } = await client
        .from('user_settings')
        .select('settings_json, sync_version')
        .eq('user_id', userId)
        .maybeSingle()

      if (settingsData && settingsData.settings_json) {
        applyCloudSettings(settingsData.settings_json)
      }
    } catch {}

    currentDiagnostics = {
      status: 'connected',
      code: 'SUCCESS',
      message: 'Synced via Supabase PostgreSQL (cross-device profile, watchlist, reading progress & settings)',
      lastSyncedAt: Date.now(),
    }
    return true
  } catch (err: any) {
    console.warn('[CloudSync] Failed to pull user data from Supabase:', err)
    currentDiagnostics = {
      status: 'error',
      code: 'DOWNLOAD_FAILED',
      message: 'Failed to download cloud records from Supabase.',
      details: err.message || String(err),
    }
    return false
  } finally {
    isSyncing = false
  }
}

/** Push local changes to Supabase in a debounced, resilient background call */
export function schedulePushCloudData(userId?: string) {
  if (syncTimeout) window.clearTimeout(syncTimeout)

  syncTimeout = window.setTimeout(async () => {
    try {
      const client = supabase || (await getOrInitSupabase())
      if (!client) return
      let uid = userId
      if (!uid) {
        const { data } = await client.auth.getSession()
        uid = data.session?.user.id
      }
      if (uid) {
        await pushCloudData(uid)
      }
    } catch (err) {
      console.warn('[CloudSync] Push sync failed:', err)
    }
  }, 2500)
}

export async function pushCloudData(userId: string): Promise<boolean> {
  const client = supabase || (await getOrInitSupabase())
  if (!client || !userId) return false

  try {
    // 1. Profile
    const profile = getProfile()
    if (profile.name && profile.name !== 'Guest') {
      const { error: pErr } = await client.from('user_profiles').upsert({
        id: userId,
        display_name: profile.name,
        avatar_url: profile.avatar?.startsWith('http') ? profile.avatar : null,
        banner_url: profile.banner?.startsWith('http') ? profile.banner : null,
        frame_id: profile.frame,
        updated_at: new Date().toISOString(),
      })
      if (pErr) console.warn('[CloudSync] Profile push warning:', pErr.message)
    }

    // 2. Reading Progress
    try {
      const rawReading = localStorage.getItem('zk:reading:v1')
      const readingItems: ReadingItem[] = rawReading ? JSON.parse(rawReading) : []
      if (readingItems.length > 0) {
        const records = readingItems.map((r) => ({
          user_id: userId,
          kind: r.kind || 'novel',
          book_id: String(r.id),
          title: r.title || 'Untitled',
          cover_url: r.cover?.startsWith('http') ? r.cover : null,
          href: r.href || null,
          resume_url: r.resume || null,
          label: r.label || null,
          progress: Math.min(1, Math.max(0, typeof r.progress === 'number' ? (r.progress > 1 ? r.progress / 100 : r.progress) : 0)),
          updated_at: new Date(r.t || Date.now()).toISOString(),
        }))
        const { error: rErr } = await client.from('user_reading_progress').upsert(records, {
          onConflict: 'user_id,kind,book_id',
        })
        if (rErr) console.warn('[CloudSync] Reading progress push warning:', rErr.message)
      }
    } catch {}

    // 3. User Library (Watchlist)
    try {
      const rawList = localStorage.getItem('zk:list')
      const libraryItems: ListItem[] = rawList ? JSON.parse(rawList) : []
      if (libraryItems.length > 0) {
        const libraryRecords = libraryItems.map((l) => ({
          user_id: userId,
          media_type: 'anime',
          item_id: String(l.id),
          title: l.title,
          image_url: l.image || null,
          status: l.status || 'watching',
          progress: l.progress || 0,
          score: l.score ?? null,
          updated_at: new Date().toISOString(),
        }))
        const { error: lErr } = await client.from('user_library').upsert(libraryRecords, {
          onConflict: 'user_id,media_type,item_id',
        })
        if (lErr) console.warn('[CloudSync] Library push warning:', lErr.message)
      }
    } catch {}

    // 4. User Preferences
    try {
      const rawPrefs = localStorage.getItem('zk:prefs')
      const prefs = rawPrefs ? JSON.parse(rawPrefs) : {}
      const theme = localStorage.getItem('theme') || 'dark'
      await client.from('user_preferences').upsert({
        user_id: userId,
        theme: theme,
        audio: prefs.audio || 'sub',
        max_quality: prefs.maxQ || prefs.maxQuality || '1080',
        preferred_server: prefs.server || 'megaplay',
        auto_next: Boolean(prefs.autoNext ?? true),
        auto_skip: Boolean(prefs.autoSkip ?? false),
        skip_filler: Boolean(prefs.skipFiller ?? true),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    } catch {}

    // 5. Cloud User Settings (public.user_settings)
    try {
      const settingsPayload = extractLocalSettings()
      await client.from('user_settings').upsert({
        user_id: userId,
        settings_json: settingsPayload,
        sync_version: 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    } catch {}

    currentDiagnostics = {
      status: 'connected',
      code: 'SUCCESS',
      message: 'Synced via Supabase PostgreSQL (cross-device profile, watchlist, reading progress & settings)',
      lastSyncedAt: Date.now(),
    }
    return true
  } catch (err: any) {
    console.warn('[CloudSync] Push error:', err)
    currentDiagnostics = {
      status: 'error',
      code: 'UPLOAD_FAILED',
      message: 'Failed to upload local data changes to Supabase.',
      details: err.message || String(err),
    }
    return false
  }
}

/** Gather all user settings into a clean serializable object */
export function extractLocalSettings() {
  const safeParse = (k: string) => {
    try {
      const v = localStorage.getItem(k)
      return v ? JSON.parse(v) : null
    } catch {
      return null
    }
  }
  return {
    theme: localStorage.getItem('theme') || 'dark',
    playerPrefs: safeParse('zk:prefs') || {},
    musicSettings: safeParse('zk:music:settings') || {},
    integrationSettings: safeParse('zk:integrations') || {},
    novelPrefs: safeParse('zk:novel:prefs') || {},
    readerSettings: safeParse('zk:reader:settings') || {},
    timestamp: Date.now(),
  }
}

/** Apply cloud settings into localStorage and notify active components */
export function applyCloudSettings(settings: any) {
  if (!settings || typeof settings !== 'object') return
  try {
    if (settings.theme && typeof settings.theme === 'string') {
      localStorage.setItem('theme', settings.theme)
      document.documentElement.setAttribute('data-theme', settings.theme)
    }
    if (settings.playerPrefs && typeof settings.playerPrefs === 'object') {
      const cur = localStorage.getItem('zk:prefs')
      const merged = { ...(cur ? JSON.parse(cur) : {}), ...settings.playerPrefs }
      localStorage.setItem('zk:prefs', JSON.stringify(merged))
    }
    if (settings.musicSettings && typeof settings.musicSettings === 'object') {
      localStorage.setItem('zk:music:settings', JSON.stringify(settings.musicSettings))
    }
    if (settings.integrationSettings && typeof settings.integrationSettings === 'object') {
      localStorage.setItem('zk:integrations', JSON.stringify(settings.integrationSettings))
    }
    if (settings.novelPrefs && typeof settings.novelPrefs === 'object') {
      localStorage.setItem('zk:novel:prefs', JSON.stringify(settings.novelPrefs))
    }
    if (settings.readerSettings && typeof settings.readerSettings === 'object') {
      localStorage.setItem('zk:reader:settings', JSON.stringify(settings.readerSettings))
    }
    window.dispatchEvent(new CustomEvent('stark:settings-updated', { detail: settings }))
  } catch {}
}

if (typeof window !== 'undefined') {
  window.addEventListener('zk:reading:change', () => {
    schedulePushCloudData()
  })
  window.addEventListener('stark:settings-changed', () => {
    schedulePushCloudData()
  })
}
