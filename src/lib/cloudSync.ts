import { isSupabaseConfigured, supabase, getOrInitSupabase } from './supabase'
import { getProfile, saveProfile } from './profile'
import { saveReading, type ReadingItem } from './reading'
import type { ListItem } from './library'

let isSyncing = false
let syncTimeout: number | null = null

/** Check if cloud sync is currently available */
export function isCloudSyncAvailable(): boolean {
  return isSupabaseConfigured && Boolean(supabase)
}

/** Pull cloud records for the authenticated user and merge with local state */
export async function pullCloudData(userId: string): Promise<boolean> {
  const client = supabase || (await getOrInitSupabase())
  if (!client || !userId) return false
  if (isSyncing) return false
  isSyncing = true

  try {
    // 1. Profile
    const { data: profileData } = await client
      .from('user_profiles')
      .select('display_name, avatar_url, banner_url, frame_id')
      .eq('id', userId)
      .maybeSingle()

    if (profileData) {
      const local = getProfile()
      saveProfile({
        name: profileData.display_name || local.name,
        avatar: profileData.avatar_url || local.avatar,
        banner: profileData.banner_url || local.banner,
        frame: profileData.frame_id || local.frame,
      })
    }

    // 2. Reading Progress
    const { data: readingData } = await client
      .from('user_reading_progress')
      .select('kind, book_id, title, cover_url, href, resume_url, label, progress, updated_at')
      .eq('user_id', userId)

    if (Array.isArray(readingData)) {
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
    const { data: libraryData } = await client
      .from('user_library')
      .select('media_type, item_id, title, image_url, status, progress, max_progress, score, last_watched_at')
      .eq('user_id', userId)

    if (Array.isArray(libraryData)) {
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

    return true
  } catch (err) {
    console.warn('[CloudSync] Failed to pull user data from Supabase:', err)
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
      await client.from('user_profiles').upsert({
        id: userId,
        display_name: profile.name,
        avatar_url: profile.avatar?.startsWith('http') ? profile.avatar : null,
        banner_url: profile.banner?.startsWith('http') ? profile.banner : null,
        frame_id: profile.frame,
        updated_at: new Date().toISOString(),
      })
    }

    // 2. Reading Progress
    try {
      const rawReading = localStorage.getItem('zk:reading:v1')
      const readingItems: ReadingItem[] = rawReading ? JSON.parse(rawReading) : []
      if (readingItems.length > 0) {
        const records = readingItems.map((r) => ({
          user_id: userId,
          kind: r.kind,
          book_id: r.id,
          title: r.title,
          cover_url: r.cover,
          href: r.href,
          resume_url: r.resume,
          label: r.label,
          progress: r.progress,
          updated_at: new Date(r.t || Date.now()).toISOString(),
        }))
        await client.from('user_reading_progress').upsert(records, {
          onConflict: 'user_id,kind,book_id',
        })
      }
    } catch {}

    return true
  } catch (err) {
    console.warn('[CloudSync] Push error:', err)
    return false
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('zk:reading:change', () => {
    schedulePushCloudData()
  })
}
