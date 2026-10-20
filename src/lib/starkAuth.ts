import { useState } from 'react'

const AUTH_STORAGE_KEY = 'gaurxv_verse_auth'
const AUTH_USER_KEY = 'gaurxv_verse_auth_user'
const AUTH_EXPIRY_KEY = 'gaurxv_verse_auth_exp'

export interface Credential {
  username: string
  password: string
  displayName?: string
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
function getCustomCredentials(): Credential[] {
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

/** Verify username & password or standalone master passcode */
export function verifyCredentials(username: string, password: string): { ok: boolean; user: string } {
  const u = username.trim()
  const p = password.trim()

  // 1. Direct Master Passcode or VITE_ACCESS_KEY (can be entered in password field)
  const envKey = (import.meta.env.VITE_ACCESS_KEY as string | undefined)?.trim()
  if (p && envKey && p.toLowerCase() === envKey.toLowerCase()) {
    return { ok: true, user: u || 'Admin' }
  }
  if (p && MASTER_PASSCODES.some((k) => k.toLowerCase() === p.toLowerCase())) {
    return { ok: true, user: u || 'Stark Operator' }
  }

  // 2. Check Custom Credentials (from Env)
  const custom = getCustomCredentials()
  const matchCustom = custom.find(
    (c) => c.username.toLowerCase() === u.toLowerCase() && c.password === p
  )
  if (matchCustom) {
    return { ok: true, user: matchCustom.displayName || matchCustom.username }
  }

  // 3. Check Built-in Credentials
  const matchBuiltin = BUILTIN_CREDENTIALS.find(
    (c) => c.username.toLowerCase() === u.toLowerCase() && c.password === p
  )
  if (matchBuiltin) {
    return { ok: true, user: matchBuiltin.displayName || matchBuiltin.username }
  }

  // 4. Check Authorized Email domain with non-empty password
  const uLower = u.toLowerCase()
  if ((uLower.endsWith('@gaurxv.eu.org') || uLower.endsWith('@pepperonyx.dpdns.org')) && p) {
    return { ok: true, user: u }
  }

  return { ok: false, user: '' }
}

export function saveAuthSession(user: string, remember: boolean = true) {
  try {
    const expiresAt = remember ? Date.now() + 30 * 24 * 60 * 60 * 1000 : 0
    localStorage.setItem(AUTH_STORAGE_KEY, 'authorized')
    localStorage.setItem(AUTH_USER_KEY, user)
    localStorage.setItem(AUTH_EXPIRY_KEY, String(expiresAt))
  } catch {}
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
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

  const unlock = (username: string, password: string, remember: boolean = true): boolean => {
    const res = verifyCredentials(username, password)
    if (res.ok) {
      saveAuthSession(res.user, remember)
      setUser(res.user)
      setAuthenticated(true)
      return true
    }
    return false
  }

  const lock = () => {
    clearAuthSession()
    setUser('')
    setAuthenticated(false)
  }

  return { authenticated, user, unlock, lock }
}
