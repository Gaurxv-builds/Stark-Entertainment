import { useState } from 'react'

const AUTH_STORAGE_KEY = 'gaurxv_verse_auth'
const AUTH_USER_KEY = 'gaurxv_verse_auth_user'
const AUTH_IS_ADMIN_KEY = 'gaurxv_verse_is_admin'
const AUTH_EXPIRY_KEY = 'gaurxv_verse_auth_exp'
const CREATED_CREDENTIALS_KEY = 'gaurxv_created_credentials'

export interface Credential {
  username: string
  password: string
  displayName?: string
  createdAt?: string
}

// Built-in created credentials (can be added here or configured via environment variables)
export const BUILTIN_CREDENTIALS: Credential[] = [
  { username: 'admin', password: 'GAURXV-VERSE-2026', displayName: 'Administrator' },
  { username: 'stark', password: 'STARK-2026', displayName: 'Tony Stark' },
  { username: 'gaurav', password: 'GAURXV-VERSE-2026', displayName: 'Gaurav' },
]

// Built-in master passcodes that unlock regardless of username
const MASTER_PASSCODES = [
  'GAURXV-VERSE-2026',
  'STARK-2026',
  'STARK-⎊',
  'GAURXV-⎊',
]

/** Parse extra credentials from VITE_AUTH_CREDENTIALS or VITE_ADMIN_USER / VITE_ADMIN_PASS */
export function getCustomCredentials(): Credential[] {
  const list: Credential[] = []

  // Check single admin user from env
  const envUser = (import.meta.env.VITE_ADMIN_USER as string | undefined)?.trim()
  const envPass = (import.meta.env.VITE_ADMIN_PASS as string | undefined)?.trim()
  if (envUser && envPass) {
    list.push({ username: envUser, password: envPass, displayName: envUser })
  }

  // Check JSON credentials from VITE_AUTH_CREDENTIALS: '[{"username":"user1","password":"pw1"}]'
  const envJson = (import.meta.env.VITE_AUTH_CREDENTIALS as string | undefined)?.trim()
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson)
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
    } catch {}
  }

  return list
}

/** Get credentials dynamically created by Admin in the Admin Console */
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

/** Save a new credential created by Admin */
export function addCreatedCredential(cred: Credential) {
  const current = getCreatedCredentials()
  const filtered = current.filter(
    (c) => c.username.toLowerCase() !== cred.username.toLowerCase()
  )
  filtered.push({
    ...cred,
    createdAt: cred.createdAt || new Date().toISOString(),
  })
  localStorage.setItem(CREATED_CREDENTIALS_KEY, JSON.stringify(filtered))
}

/** Delete / revoke a credential created by Admin */
export function deleteCreatedCredential(username: string) {
  const current = getCreatedCredentials()
  const filtered = current.filter(
    (c) => c.username.toLowerCase() !== username.toLowerCase()
  )
  localStorage.setItem(CREATED_CREDENTIALS_KEY, JSON.stringify(filtered))
}

/** Get all active credentials combined (Admin only) */
export function getAllCredentials(): Credential[] {
  const map = new Map<string, Credential>()

  // Built-in
  BUILTIN_CREDENTIALS.forEach((c) => map.set(c.username.toLowerCase(), c))

  // From environment
  getCustomCredentials().forEach((c) => map.set(c.username.toLowerCase(), c))

  // Created locally by Admin
  getCreatedCredentials().forEach((c) => map.set(c.username.toLowerCase(), c))

  return Array.from(map.values())
}

/** Verify username & password or standalone master passcode */
export function verifyCredentials(
  username: string,
  password: string
): { ok: boolean; user: string; isAdmin: boolean } {
  const u = username.trim()
  const p = password.trim()
  const envAdminUser = (import.meta.env.VITE_ADMIN_USER as string | undefined)?.trim() || 'admin'
  const envAdminPass = (import.meta.env.VITE_ADMIN_PASS as string | undefined)?.trim() || 'GAURXV-VERSE-2026'

  // 1. Direct Admin Match
  const isDirectAdmin =
    (u.toLowerCase() === envAdminUser.toLowerCase() && (p === envAdminPass || p === 'GAURXV-VERSE-2026' || p === 'STARK-2026')) ||
    (u.toLowerCase() === 'gaurav' && (p === 'GAURXV-VERSE-2026' || p === envAdminPass))

  if (isDirectAdmin) {
    return { ok: true, user: u || 'Admin', isAdmin: true }
  }

  // 2. Direct Master Passcode or VITE_ACCESS_KEY
  const envKey = (import.meta.env.VITE_ACCESS_KEY as string | undefined)?.trim()
  if (p && envKey && p.toLowerCase() === envKey.toLowerCase()) {
    return { ok: true, user: u || 'Admin', isAdmin: true }
  }
  if (p && MASTER_PASSCODES.some((k) => k.toLowerCase() === p.toLowerCase())) {
    return { ok: true, user: u || 'Stark Operator', isAdmin: true }
  }

  // 3. Check Credentials created by Admin in Admin Console
  const created = getCreatedCredentials()
  const matchCreated = created.find(
    (c) => c.username.toLowerCase() === u.toLowerCase() && c.password === p
  )
  if (matchCreated) {
    return { ok: true, user: matchCreated.displayName || matchCreated.username, isAdmin: false }
  }

  // 4. Check Custom Credentials (from Env)
  const custom = getCustomCredentials()
  const matchCustom = custom.find(
    (c) => c.username.toLowerCase() === u.toLowerCase() && c.password === p
  )
  if (matchCustom) {
    return { ok: true, user: matchCustom.displayName || matchCustom.username, isAdmin: false }
  }

  // 5. Check Built-in Credentials
  const matchBuiltin = BUILTIN_CREDENTIALS.find(
    (c) => c.username.toLowerCase() === u.toLowerCase() && c.password === p
  )
  if (matchBuiltin) {
    return { ok: true, user: matchBuiltin.displayName || matchBuiltin.username, isAdmin: false }
  }

  // 6. Check Authorized Email domain with non-empty password
  const uLower = u.toLowerCase()
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

export function getAuthenticatedUser(): string {
  try {
    return localStorage.getItem(AUTH_USER_KEY) || 'Stark Operator'
  } catch {
    return 'Stark Operator'
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
