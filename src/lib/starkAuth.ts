import { useState } from 'react'
import { saveProfile, getProfile } from './profile'

const AUTH_STORAGE_KEY = 'gaurxv_verse_auth'
const AUTH_USER_KEY = 'gaurxv_verse_auth_user'
const AUTH_IS_ADMIN_KEY = 'gaurxv_verse_is_admin'
const AUTH_EXPIRY_KEY = 'gaurxv_verse_auth_exp'
const CREATED_CREDENTIALS_KEY = 'gaurxv_created_credentials'
const REVOKED_CREDENTIALS_KEY = 'gaurxv_revoked_credentials'

export interface Credential {
  username: string
  password: string
  displayName?: string
  createdAt?: string
}

// Built-in created credentials (can be deleted/revoked by admin)
export const BUILTIN_CREDENTIALS: Credential[] = []

// Built-in master passcodes
const MASTER_PASSCODES = [
  'GAURXV-VERSE-2026',
  'STARK-2026',
  'STARK-⎊',
  'GAURXV-⎊',
]

/** Get revoked/deleted usernames */
export function getRevokedUsernames(): string[] {
  try {
    const raw = localStorage.getItem(REVOKED_CREDENTIALS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).toLowerCase())
    }
  } catch {}
  return []
}

/** Delete / revoke any user (including built-ins) */
export function deleteAnyUser(username: string) {
  const u = username.toLowerCase().trim()
  deleteCreatedCredential(u)

  const revoked = getRevokedUsernames()
  if (!revoked.includes(u)) {
    revoked.push(u)
    localStorage.setItem(REVOKED_CREDENTIALS_KEY, JSON.stringify(revoked))
  }

  pushCredentialsToCloud(getCreatedCredentials())
}

/** Reset revoked users */
export function resetRevokedUsers() {
  localStorage.removeItem(REVOKED_CREDENTIALS_KEY)
}

/** Parse extra credentials from VITE_AUTH_CREDENTIALS or VITE_ADMIN_USER / VITE_ADMIN_PASS */
export function getCustomCredentials(): Credential[] {
  const list: Credential[] = []

  const envRaw = (import.meta.env.VITE_AUTH_CREDENTIALS as string | undefined)?.trim()
  if (envRaw) {
    try {
      let parsed = JSON.parse(envRaw)
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed)
      }
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && item.username && item.password) {
            list.push({
              username: String(item.username).trim(),
              password: String(item.password).trim(),
              displayName: item.displayName ? String(item.displayName).trim() : undefined,
            })
          }
        }
      }
    } catch {
      const entries = envRaw.split(/[;\n]/)
      for (const entry of entries) {
        const parts = entry.split(':')
        if (parts.length >= 2) {
          const u = parts[0].trim()
          const p = parts.slice(1).join(':').trim()
          if (u && p) {
            list.push({ username: u, password: p, displayName: u })
          }
        }
      }
    }
  }

  return list
}

export function getCreatedCredentials(): Credential[] {
  try {
    const raw = localStorage.getItem(CREATED_CREDENTIALS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  return []
}

export function addCreatedCredential(cred: Credential, syncToCloud = true) {
  const current = getCreatedCredentials()
  const u = cred.username.toLowerCase().trim()

  // Un-revoke if it was previously revoked
  const revoked = getRevokedUsernames().filter((r) => r !== u)
  localStorage.setItem(REVOKED_CREDENTIALS_KEY, JSON.stringify(revoked))

  const filtered = current.filter((c) => c.username.toLowerCase() !== u)
  filtered.push({
    ...cred,
    createdAt: cred.createdAt || new Date().toISOString(),
  })
  localStorage.setItem(CREATED_CREDENTIALS_KEY, JSON.stringify(filtered))

  if (syncToCloud) {
    pushCredentialsToCloud(filtered)
  }
}

export function deleteCreatedCredential(username: string) {
  const current = getCreatedCredentials()
  const filtered = current.filter(
    (c) => c.username.toLowerCase() !== username.toLowerCase().trim()
  )
  localStorage.setItem(CREATED_CREDENTIALS_KEY, JSON.stringify(filtered))
}

/** Get all active credentials combined (Admin only) excluding deleted/revoked users */
export function getAllCredentials(): Credential[] {
  const map = new Map<string, Credential>()
  const revoked = getRevokedUsernames()

  // Built-in
  BUILTIN_CREDENTIALS.forEach((c) => {
    if (!revoked.includes(c.username.toLowerCase())) {
      map.set(c.username.toLowerCase(), c)
    }
  })

  // From environment
  getCustomCredentials().forEach((c) => {
    if (!revoked.includes(c.username.toLowerCase())) {
      map.set(c.username.toLowerCase(), c)
    }
  })

  // Created locally by Admin
  getCreatedCredentials().forEach((c) => {
    if (!revoked.includes(c.username.toLowerCase())) {
      map.set(c.username.toLowerCase(), c)
    }
  })

  return Array.from(map.values())
}

/** Verify username & password or standalone master passcode */
export function verifyCredentials(
  username: string,
  password: string
): { ok: boolean; user: string; isAdmin: boolean } {
  const u = username.trim()
  const p = password.trim()
  const uLower = u.toLowerCase()
  const revoked = getRevokedUsernames()

  // Block any deleted / revoked user
  if (u && revoked.includes(uLower)) {
    return { ok: false, user: '', isAdmin: false }
  }

  const envAdminUser = (import.meta.env.VITE_ADMIN_USER as string | undefined)?.trim() || 'admin'
  const envAdminPass = (import.meta.env.VITE_ADMIN_PASS as string | undefined)?.trim() || 'GAURXV-VERSE-2026'

  // 1. Direct Admin Match
  const isDirectAdmin =
    (uLower === envAdminUser.toLowerCase() && (p === envAdminPass || p === 'GAURXV-VERSE-2026' || p === 'STARK-2026')) ||
    (uLower === 'gaurav' && (p === 'GAURXV-VERSE-2026' || p === envAdminPass))

  if (isDirectAdmin) {
    return { ok: true, user: u || 'Administrator', isAdmin: true }
  }

  // 2. Direct Master Passcode or VITE_ACCESS_KEY
  const envKey = (import.meta.env.VITE_ACCESS_KEY as string | undefined)?.trim()
  if (p && envKey && p.toLowerCase() === envKey.toLowerCase()) {
    return { ok: true, user: u || 'Administrator', isAdmin: true }
  }
  if (p && MASTER_PASSCODES.some((k) => k.toLowerCase() === p.toLowerCase())) {
    return { ok: true, user: u || 'Administrator', isAdmin: true }
  }

  // 3. Check Credentials created by Admin
  const created = getCreatedCredentials()
  const matchCreated = created.find(
    (c) => c.username.toLowerCase() === uLower && c.password === p
  )
  if (matchCreated) {
    return { ok: true, user: matchCreated.displayName || matchCreated.username, isAdmin: false }
  }

  // 4. Check Custom Credentials (from Env)
  const custom = getCustomCredentials()
  const matchCustom = custom.find(
    (c) => c.username.toLowerCase() === uLower && c.password === p
  )
  if (matchCustom) {
    return { ok: true, user: matchCustom.displayName || matchCustom.username, isAdmin: false }
  }

  // 5. Check Built-in Credentials
  const matchBuiltin = BUILTIN_CREDENTIALS.find(
    (c) => c.username.toLowerCase() === uLower && c.password === p
  )
  if (matchBuiltin) {
    return { ok: true, user: matchBuiltin.displayName || matchBuiltin.username, isAdmin: false }
  }

  // 6. Check Authorized Email domain with non-empty password
  if ((uLower.endsWith('@gaurxv.eu.org') || uLower.endsWith('@pepperonyx.dpdns.org')) && p) {
    return { ok: true, user: u, isAdmin: false }
  }

  return { ok: false, user: '', isAdmin: false }
}

export function saveAuthSession(user: string, isAdmin: boolean, remember: boolean = true) {
  try {
    const expiresAt = remember ? Date.now() + 30 * 24 * 60 * 60 * 1000 : 0
    localStorage.setItem(AUTH_STORAGE_KEY, 'authorized')
    localStorage.setItem(AUTH_USER_KEY, user)
    localStorage.setItem(AUTH_IS_ADMIN_KEY, isAdmin ? 'true' : 'false')
    localStorage.setItem(AUTH_EXPIRY_KEY, String(expiresAt))

    // Automatically synchronize display name into profile if unset or default
    const p = getProfile()
    if (!p.name || p.name === 'Guest') {
      saveProfile({ name: user })
    }
  } catch {}
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    localStorage.removeItem(AUTH_IS_ADMIN_KEY)
    localStorage.removeItem(AUTH_EXPIRY_KEY)
  } catch {}
}

export function isSessionValid(): boolean {
  try {
    const token = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!token) return false
    const exp = Number(localStorage.getItem(AUTH_EXPIRY_KEY) || 0)
    if (exp > 0 && Date.now() > exp) {
      clearAuthSession()
      return false
    }
    return true
  } catch {
    return false
  }
}

export function isCurrentAdmin(): boolean {
  try {
    return localStorage.getItem(AUTH_IS_ADMIN_KEY) === 'true'
  } catch {
    return false
  }
}


/** Generate 1-click device sync link */
export function generateDeviceSyncUrl(): string {
  const users = getCreatedCredentials()
  const minified = users.map((u) => ({
    username: u.username,
    password: u.password,
    displayName: u.displayName,
  }))
  const json = JSON.stringify(minified)
  let b64 = ''
  try {
    b64 = btoa(unescape(encodeURIComponent(json)))
  } catch {
    b64 = btoa(json)
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://verse.gaurxv.eu.org'
  return `${origin}/admin?sync=${encodeURIComponent(b64)}`
}

/** Check URL for incoming sync payload (?sync=...) and import credentials */
export function checkAndImportSyncPayload(): number {
  if (typeof window === 'undefined') return 0
  try {
    const params = new URLSearchParams(window.location.search)
    const syncData = params.get('sync')
    if (!syncData) return 0

    let jsonStr = ''
    try {
      jsonStr = decodeURIComponent(escape(atob(decodeURIComponent(syncData))))
    } catch {
      try {
        jsonStr = atob(decodeURIComponent(syncData))
      } catch {
        jsonStr = syncData
      }
    }

    let parsed = JSON.parse(jsonStr)
    if (typeof parsed === 'string') parsed = JSON.parse(parsed)
    if (Array.isArray(parsed) && parsed.length > 0) {
      let count = 0
      for (const item of parsed) {
        if (item && item.username && item.password) {
          addCreatedCredential(
            {
              username: String(item.username).trim(),
              password: String(item.password).trim(),
              displayName: item.displayName ? String(item.displayName).trim() : undefined,
            },
            false
          )
          count++
        }
      }

      // Clean sync param from URL without reload
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('sync')
      window.history.replaceState({}, '', newUrl.pathname + (newUrl.search ? newUrl.search : ''))

      return count
    }
  } catch (err) {
    console.warn('Failed to import sync credentials:', err)
  }
  return 0
}

/** Check if Cloudflare KV is connected and sync cloud credentials */
export async function syncCredentialsWithCloud(): Promise<{ kvConnected: boolean; count: number }> {
  try {
    const res = await fetch('/api/auth/credentials')
    if (res.ok) {
      const data = await res.json()
      if (data && data.success) {
        if (data.kvConnected && Array.isArray(data.users)) {
          // Cloudflare KV is authoritative master
          localStorage.setItem(CREATED_CREDENTIALS_KEY, JSON.stringify(data.users))
          return { kvConnected: true, count: data.users.length }
        } else if (Array.isArray(data.users) && data.users.length > 0) {
          const current = getCreatedCredentials()
          const currentUsers = new Set(current.map((c) => c.username.toLowerCase()))
          let imported = 0
          for (const u of data.users) {
            if (u && u.username && u.password && !currentUsers.has(String(u.username).toLowerCase())) {
              addCreatedCredential(u, false)
              imported++
            }
          }
          return { kvConnected: false, count: imported }
        }
      }
    }
  } catch {}
  return { kvConnected: false, count: 0 }
}

/** Push credentials to Cloudflare KV */
export async function pushCredentialsToCloud(users: Credential[]): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users }),
    })
    if (res.ok) {
      const data = await res.json()
      return Boolean(data.success)
    }
  } catch {}
  return false
}

export function getAuthenticatedUser(): string {
  try {
    return localStorage.getItem(AUTH_USER_KEY) || (isCurrentAdmin() ? 'Administrator' : '')
  } catch {
    return ''
  }
}

export function useStarkAuth() {
  const [authenticated, setAuthenticated] = useState<boolean>(() => isSessionValid())
  const [user, setUser] = useState<string>(() => getAuthenticatedUser())
  const [isAdmin, setIsAdmin] = useState<boolean>(() => isCurrentAdmin())

  const unlock = (username: string, password: string, remember: boolean = true): boolean => {
    const res = verifyCredentials(username, password)
    if (res.ok) {
      saveAuthSession(res.user, res.isAdmin, remember)
      setUser(res.user)
      setIsAdmin(res.isAdmin)
      setAuthenticated(true)
      return true
    }
    return false
  }

  const lock = () => {
    clearAuthSession()
    setUser('')
    setIsAdmin(false)
    setAuthenticated(false)
  }

  return { authenticated, user, isAdmin, unlock, lock }
}
