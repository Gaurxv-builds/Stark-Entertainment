import { useState } from 'react'

const AUTH_STORAGE_KEY = 'gaurxv_verse_auth'
const AUTH_EXPIRY_KEY = 'gaurxv_verse_auth_exp'

// Built-in authorized master keys
const DEFAULT_KEYS = [
  'GAURXV-VERSE-2026',
  'STARK-2026',
  'STARK-⎊',
  'GAURXV-⎊',
]

/** Verify if an access key, passcode, or authorized email matches */
export function verifyAccessKey(input: string): boolean {
  const clean = input.trim()
  if (!clean) return false

  // Check custom environment key if defined
  const envKey = (import.meta.env.VITE_ACCESS_KEY as string | undefined)?.trim()
  if (envKey && clean.toLowerCase() === envKey.toLowerCase()) {
    return true
  }

  // Check built-in master keys
  if (DEFAULT_KEYS.some((k) => k.toLowerCase() === clean.toLowerCase())) {
    return true
  }

  // Check authorized email domains
  const lower = clean.toLowerCase()
  if (lower.endsWith('@gaurxv.eu.org') || lower.endsWith('@pepperonyx.dpdns.org')) {
    return true
  }

  return false
}

export function saveAuthSession(key: string, remember: boolean = true) {
  try {
    const expiresAt = remember ? Date.now() + 30 * 24 * 60 * 60 * 1000 : 0
    localStorage.setItem(AUTH_STORAGE_KEY, key)
    localStorage.setItem(AUTH_EXPIRY_KEY, String(expiresAt))
  } catch {}
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(AUTH_EXPIRY_KEY)
  } catch {}
}

export function isSessionValid(): boolean {
  try {
    const key = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!key) return false
    const exp = Number(localStorage.getItem(AUTH_EXPIRY_KEY) || 0)
    if (exp > 0 && Date.now() > exp) {
      clearAuthSession()
      return false
    }
    return verifyAccessKey(key)
  } catch {
    return false
  }
}

export function useStarkAuth() {
  const [authenticated, setAuthenticated] = useState<boolean>(() => isSessionValid())
  const [sessionKey, setSessionKey] = useState<string | null>(() => {
    try {
      return localStorage.getItem(AUTH_STORAGE_KEY)
    } catch {
      return null
    }
  })

  const unlock = (key: string, remember: boolean = true): boolean => {
    if (verifyAccessKey(key)) {
      saveAuthSession(key, remember)
      setSessionKey(key)
      setAuthenticated(true)
      return true
    }
    return false
  }

  const lock = () => {
    clearAuthSession()
    setSessionKey(null)
    setAuthenticated(false)
  }

  return { authenticated, sessionKey, unlock, lock }
}
