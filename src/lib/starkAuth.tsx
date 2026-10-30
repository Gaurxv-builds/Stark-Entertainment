import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { saveProfile, getProfile, resetProfile } from './profile'
import { toast } from './toast'
import { supabase, getOrInitSupabase } from './supabase'
import {
  pullCloudData,
  pushCloudData,
  diagnoseCloudSync,
  getCurrentDiagnostics,
  type CloudSyncDiagnostics,
} from './cloudSync'

const AUTH_STORAGE_KEY = 'gaurxv_verse_auth'
const AUTH_TOKEN_KEY = 'gaurxv_verse_auth_token'
const AUTH_USER_KEY = 'gaurxv_verse_auth_user'
const AUTH_IS_ADMIN_KEY = 'gaurxv_verse_is_admin'
const AUTH_EXPIRY_KEY = 'gaurxv_verse_auth_exp'
const CREATED_CREDENTIALS_KEY = 'gaurxv_created_credentials'
const REVOKED_CREDENTIALS_KEY = 'gaurxv_revoked_credentials'

const CLIENT_AUTH_SECRET = 'stark-protocol-jwt-2026'

export interface Credential {
  username: string
  password: string
  displayName?: string
  createdAt?: string
}

export const BUILTIN_CREDENTIALS: Credential[] = []

export function resolveStarkUserToEmail(username: string): string {
  const u = (username || '').trim().toLowerCase();
  if (u === 'gaurxv' || u === 'admin' || u === 'gaurav') {
    return 'gaurav@pepperonyx.dpdns.org';
  }
  if (u.includes('@')) {
    return u;
  }
  return `${u.replace(/[^a-z0-9_]/g, '')}@pepperonyx.dpdns.org`;
}

/* ---------------- Web Crypto HMAC Helpers ---------------- */
const enc = new TextEncoder()

async function hmacSign(data: string, secret: string = CLIENT_AUTH_SECRET): Promise<string> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return ''
  }
}

function safeEq(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export async function createClientToken(user: string, isAdmin: boolean, exp: number): Promise<string> {
  const payload = JSON.stringify({ u: user, a: Boolean(isAdmin), exp, iat: Date.now() })
  const b64 = btoa(payload)
  const sig = await hmacSign(b64)
  return `${b64}.${sig}`
}

export async function verifyClientToken(token: string): Promise<{ u: string; a: boolean; exp: number } | null> {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [b64, sig] = token.split('.')
  if (!b64 || !sig) return null
  const expectedSig = await hmacSign(b64)
  if (!safeEq(sig, expectedSig)) return null
  try {
    const payload = JSON.parse(atob(b64))
    if (!payload || !payload.u || !payload.exp) return null
    if (Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

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

export function getAllCredentials(): Credential[] {
  const map = new Map<string, Credential>()
  const revoked = getRevokedUsernames()

  BUILTIN_CREDENTIALS.forEach((c) => {
    if (!revoked.includes(c.username.toLowerCase())) {
      map.set(c.username.toLowerCase(), c)
    }
  })

  getCustomCredentials().forEach((c) => {
    if (!revoked.includes(c.username.toLowerCase())) {
      map.set(c.username.toLowerCase(), c)
    }
  })

  getCreatedCredentials().forEach((c) => {
    if (!revoked.includes(c.username.toLowerCase())) {
      map.set(c.username.toLowerCase(), c)
    }
  })

  return Array.from(map.values())
}

export function verifyCredentials(
  username: string,
  password: string
): { ok: boolean; user: string; isAdmin: boolean } {
  const u = username.trim()
  const p = password.trim()
  const uLower = u.toLowerCase()
  const revoked = getRevokedUsernames()

  if (u && revoked.includes(uLower)) {
    return { ok: false, user: '', isAdmin: false }
  }

  // 1. Check viewer credentials created by Admin
  const created = getCreatedCredentials()
  const matchCreated = created.find(
    (c) => c.username.toLowerCase() === uLower && c.password === p
  )
  if (matchCreated) {
    return { ok: true, user: matchCreated.displayName || matchCreated.username, isAdmin: false }
  }

  // 2. Check Custom Credentials (from VITE_AUTH_CREDENTIALS)
  const custom = getCustomCredentials()
  const matchCustom = custom.find(
    (c) => c.username.toLowerCase() === uLower && c.password === p
  )
  if (matchCustom) {
    return { ok: true, user: matchCustom.displayName || matchCustom.username, isAdmin: false }
  }

  // 3. Check Built-in Credentials
  const matchBuiltin = BUILTIN_CREDENTIALS.find(
    (c) => c.username.toLowerCase() === uLower && c.password === p
  )
  if (matchBuiltin) {
    return { ok: true, user: matchBuiltin.displayName || matchBuiltin.username, isAdmin: false }
  }

  return { ok: false, user: '', isAdmin: false }
}

export function saveAuthSession(user: string, isAdmin: boolean, remember: boolean = true, token?: string) {
  try {
    const expiresAt = remember ? Date.now() + 30 * 24 * 60 * 60 * 1000 : Date.now() + 24 * 60 * 60 * 1000
    localStorage.setItem(AUTH_STORAGE_KEY, 'authorized')
    localStorage.setItem(AUTH_USER_KEY, user)
    localStorage.setItem(AUTH_IS_ADMIN_KEY, isAdmin ? 'true' : 'false')
    localStorage.setItem(AUTH_EXPIRY_KEY, String(expiresAt))
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token)
    }

    const p = getProfile()
    if (!p.name || p.name === 'Guest' || p.name !== user) {
      saveProfile({ name: user, username: user })
    }
  } catch {}
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    localStorage.removeItem(AUTH_IS_ADMIN_KEY)
    localStorage.removeItem(AUTH_EXPIRY_KEY)
  } catch {}
}

export function getAuthToken(): string {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function isSessionValid(): boolean {
  try {
    const authFlag = localStorage.getItem(AUTH_STORAGE_KEY)
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (!authFlag && !token) return false
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
    return localStorage.getItem(AUTH_USER_KEY) || (isCurrentAdmin() ? 'Administrator' : '')
  } catch {
    return ''
  }
}

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

export async function syncCredentialsWithCloud(): Promise<{ kvConnected: boolean; count: number }> {
  try {
    const res = await fetch('/api/auth/credentials')
    if (res.ok) {
      const data = await res.json()
      if (data && data.success) {
        if (data.kvConnected && Array.isArray(data.users)) {
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

export async function pushCredentialsToCloud(users: Credential[]): Promise<boolean> {
  try {
    let token = getAuthToken()
    if (!token && isCurrentAdmin()) {
      token = await createClientToken('gaurxv', true, Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
    const sbToken = localStorage.getItem('gaurxv_verse_sb_token') || ''
    const res = await fetch('/api/auth/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}`, 'X-Stark-Token': token } : {}),
        ...(sbToken ? { 'X-Supabase-Auth': sbToken } : {}),
      },
      body: JSON.stringify({ users }),
    })
    if (res.ok) {
      const data = await res.json()
      return Boolean(data.success)
    }
  } catch {}
  return false
}

/* ---------------- Centralized React Auth Context ---------------- */
export interface StarkAuthContextType {
  authenticated: boolean
  loading: boolean
  user: string
  userId: string | null
  isAdmin: boolean
  token: string
  isCloudSynced: boolean
  syncDiagnostics: CloudSyncDiagnostics
  unlock: (username: string, password: string, remember?: boolean) => Promise<boolean>
  linkCloudAccount: (passcode?: string) => Promise<{ ok: boolean; message: string }>
  lock: () => void
  logout: () => Promise<void>
  triggerSync: () => Promise<boolean>
}

const StarkAuthContext = createContext<StarkAuthContextType | null>(null)

export function StarkAuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [user, setUser] = useState<string>('')
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [token, setToken] = useState<string>('')
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false)
  const [syncDiagnostics, setSyncDiagnostics] = useState<CloudSyncDiagnostics>(getCurrentDiagnostics())

  // Listen to Supabase auth state changes if configured
  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null

    const attachListener = (client: any) => {
      if (!client || sub) return
      try {
        const {
          data: { subscription },
        } = client.auth.onAuthStateChange(async (event: string, session: any) => {
          if (session?.user) {
            const emailLower = session.user.email?.toLowerCase() || ''
            const uName =
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              (emailLower === 'gaurav@pepperonyx.dpdns.org' ? 'gaurxv' : session.user.email?.split('@')[0]) ||
              'Member'
            const adminFlag = Boolean(
              session.user.app_metadata?.is_admin ||
              session.user.user_metadata?.is_admin ||
              emailLower === 'gaurav@pepperonyx.dpdns.org'
            )
            setUserId(session.user.id)
            setUser(uName)
            setIsAdmin(adminFlag)
            setAuthenticated(true)
            setIsCloudSynced(true)

            try {
              localStorage.setItem('gaurxv_verse_sb_token', session.access_token)
              const exp = Date.now() + 30 * 24 * 60 * 60 * 1000
              const hmacTok = await createClientToken(uName, adminFlag, exp)
              setToken(hmacTok)
              saveAuthSession(uName, adminFlag, true, hmacTok)
            } catch {
              setToken(session.access_token)
              saveAuthSession(uName, adminFlag, true, session.access_token)
            }
            pullCloudData(session.user.id).catch(() => {})
          } else if (event === 'SIGNED_OUT') {
            setUserId(null)
            setIsCloudSynced(false)
          }
        })
        sub = subscription
      } catch {}
    }

    if (supabase) {
      attachListener(supabase)
    } else {
      getOrInitSupabase().then((client) => {
        if (client) attachListener(client)
      })
    }

    const onReady = (e: any) => {
      if (e?.detail?.supabase) attachListener(e.detail.supabase)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('stark:supabase-ready', onReady)
    }

    return () => {
      if (sub) sub.unsubscribe()
      if (typeof window !== 'undefined') {
        window.removeEventListener('stark:supabase-ready', onReady)
      }
    }
  }, [])

  // Startup verification: verify session before rendering protected content
  useEffect(() => {
    let cancelled = false

    async function verifyStartupSession() {
      // 1. Ensure runtime Supabase is loaded and check active session
      const sbClient = supabase || (await getOrInitSupabase())
      if (sbClient) {
        try {
          const { data, error } = await sbClient.auth.getSession()
          if (!error && data?.session?.user) {
            const { data: userData, error: userErr } = await sbClient.auth.getUser()
            const sbUser = userData?.user || data.session.user
            if (!userErr && sbUser) {
              const emailLower = sbUser.email?.toLowerCase() || ''
              const uName =
                sbUser.user_metadata?.full_name ||
                sbUser.user_metadata?.name ||
                (emailLower === 'gaurav@pepperonyx.dpdns.org' ? 'gaurxv' : sbUser.email?.split('@')[0]) ||
                'Member'
              const adminFlag = Boolean(
                sbUser.app_metadata?.is_admin ||
                sbUser.user_metadata?.is_admin ||
                emailLower === 'gaurav@pepperonyx.dpdns.org'
              )
              const exp = Date.now() + 30 * 24 * 60 * 60 * 1000
              let activeToken = data.session.access_token
              try {
                localStorage.setItem('gaurxv_verse_sb_token', data.session.access_token)
                activeToken = await createClientToken(uName, adminFlag, exp)
                saveAuthSession(uName, adminFlag, true, activeToken)
              } catch {
                saveAuthSession(uName, adminFlag, true, data.session.access_token)
              }
              if (!cancelled) {
                setUserId(sbUser.id)
                setUser(uName)
                setIsAdmin(adminFlag)
                setToken(activeToken)
                setAuthenticated(true)
                setIsCloudSynced(true)
                setLoading(false)
              }
              pullCloudData(sbUser.id).catch(() => {})
              diagnoseCloudSync().then((d) => !cancelled && setSyncDiagnostics(d))
              return
            }
          }
        } catch {
          // Supabase session lookup non-blocking fallback
        }
      }

      // 2. Local session validation
      if (!isSessionValid()) {
        clearAuthSession()
        if (!cancelled) {
          setAuthenticated(false)
          setUserId(null)
          setUser('')
          setIsAdmin(false)
          setToken('')
          setIsCloudSynced(false)
          setLoading(false)
        }
        return
      }

      const storedToken = getAuthToken()
      const storedUser = getAuthenticatedUser()
      const storedAdmin = isCurrentAdmin()

      // 3. If server token exists, verify with backend endpoint
      if (storedToken) {
        try {
          const res = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${storedToken}`,
            },
            body: JSON.stringify({ token: storedToken }),
          })

          if (res.ok) {
            const data = await res.json()
            if (data && data.ok) {
              if (!cancelled) {
                setUser(data.user || storedUser)
                setIsAdmin(Boolean(data.isAdmin ?? storedAdmin))
                setToken(storedToken)
                setAuthenticated(true)
                setLoading(false)
              }
              return
            }
          } else if (res.status === 401 || res.status === 403) {
            clearAuthSession()
            if (!cancelled) {
              setAuthenticated(false)
              setUser('')
              setIsAdmin(false)
              setToken('')
              setLoading(false)
            }
            return
          }
        } catch {
          // Server offline; fallback to client verification
        }

        // Local token verification fallback
        const verifiedLocal = await verifyClientToken(storedToken)
        if (verifiedLocal) {
          if (!cancelled) {
            setUser(verifiedLocal.u || storedUser)
            setIsAdmin(verifiedLocal.a ?? storedAdmin)
            setToken(storedToken)
            setAuthenticated(true)
            setLoading(false)
          }
          return
        }
      }

      // 4. Legacy session flag fallback
      if (localStorage.getItem(AUTH_STORAGE_KEY) === 'authorized' && storedUser) {
        const exp = Number(localStorage.getItem(AUTH_EXPIRY_KEY) || 0) || Date.now() + 30 * 24 * 60 * 60 * 1000
        const newToken = await createClientToken(storedUser, storedAdmin, exp)
        saveAuthSession(storedUser, storedAdmin, true, newToken)
        if (!cancelled) {
          setUser(storedUser)
          setIsAdmin(storedAdmin)
          setToken(newToken)
          setAuthenticated(true)
          setLoading(false)
        }
        return
      }

      diagnoseCloudSync().then((d) => !cancelled && setSyncDiagnostics(d))
      clearAuthSession()
      if (!cancelled) {
        setAuthenticated(false)
        setUser('')
        setIsAdmin(false)
        setToken('')
        setLoading(false)
      }
    }

    verifyStartupSession()
    return () => {
      cancelled = true
    }
  }, [])

  const unlock = async (username: string, password: string, remember: boolean = true): Promise<boolean> => {
    const u = username.trim()
    const p = password.trim()
    if (!p) return false

    const email = resolveStarkUserToEmail(u)
    const client = supabase || (await getOrInitSupabase())

    // 1. Direct Supabase Auth attempt
    if (client) {
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password: p,
        })

        if (!error && data?.session?.user) {
          const authUser =
            data.user.user_metadata?.full_name ||
            data.user.user_metadata?.name ||
            (email === 'gaurav@pepperonyx.dpdns.org' ? 'gaurxv' : u)
          const adminFlag = Boolean(
            data.user.app_metadata?.is_admin ||
            data.user.user_metadata?.is_admin ||
            email === 'gaurav@pepperonyx.dpdns.org'
          )
          const exp = remember ? Date.now() + 30 * 24 * 60 * 60 * 1000 : Date.now() + 24 * 60 * 60 * 1000
          let activeToken = data.session.access_token
          try {
            localStorage.setItem('gaurxv_verse_sb_token', data.session.access_token)
            activeToken = await createClientToken(authUser, adminFlag, exp)
            saveAuthSession(authUser, adminFlag, remember, activeToken)
          } catch {
            saveAuthSession(authUser, adminFlag, remember, data.session.access_token)
          }
          saveProfile({
            name: authUser,
            username: u,
            avatar: data.user.user_metadata?.avatar_url || null,
          })
          setUserId(data.user.id)
          setUser(authUser)
          setIsAdmin(adminFlag)
          setToken(activeToken)
          setIsCloudSynced(true)
          setAuthenticated(true)
          await pullCloudData(data.user.id)
          pushCloudData(data.user.id).catch(() => {})
          diagnoseCloudSync().then((d) => setSyncDiagnostics(d))
          return true
        }
      } catch (err) {
        console.warn('[StarkAuth] Supabase direct auth attempt failed:', err)
      }
    }

    // 2. Try server-side authentication endpoint (/api/auth/login)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p, remember }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data && data.ok) {
          const authUser = data.user || u
          const adminFlag = Boolean(data.isAdmin)
          const sessionToken = data.token || (await createClientToken(authUser, adminFlag, data.exp))
          saveAuthSession(authUser, adminFlag, remember, sessionToken)
          saveProfile({ name: authUser, username: u })
          setUser(authUser)
          setIsAdmin(adminFlag)
          setToken(sessionToken)
          setAuthenticated(true)

          // If server established Supabase session, sync client
          if (data.supabaseSession?.access_token && client) {
            try {
              await client.auth.setSession({
                access_token: data.supabaseSession.access_token,
                refresh_token: data.supabaseSession.refresh_token,
              })
              const { data: suData } = await client.auth.getUser()
              if (suData?.user) {
                setUserId(suData.user.id)
                setIsCloudSynced(true)
                await pullCloudData(suData.user.id)
                pushCloudData(suData.user.id).catch(() => {})
                diagnoseCloudSync().then((d) => setSyncDiagnostics(d))
                return true
              }
            } catch {}
          }

          diagnoseCloudSync().then((d) => setSyncDiagnostics(d))
          return true
        }
      }
    } catch {
      // Backend not running or offline; proceed to verified local credentials check
    }

    // 3. Fallback for viewer accounts created in AdminPage
    const localRes = verifyCredentials(u, p)
    if (localRes.ok) {
      const exp = remember ? Date.now() + 30 * 24 * 60 * 60 * 1000 : Date.now() + 24 * 60 * 60 * 1000
      const sessionToken = await createClientToken(localRes.user, localRes.isAdmin, exp)
      saveAuthSession(localRes.user, localRes.isAdmin, remember, sessionToken)
      saveProfile({ name: localRes.user, username: u })
      setUser(localRes.user)
      setIsAdmin(localRes.isAdmin)
      setToken(sessionToken)
      setAuthenticated(true)
      diagnoseCloudSync().then((d) => setSyncDiagnostics(d))
      return true
    }

    return false
  }

  const linkCloudAccount = async (passcode?: string): Promise<{ ok: boolean; message: string }> => {
    const sb = supabase || (await getOrInitSupabase())
    if (!sb) {
      const diag = await diagnoseCloudSync()
      setSyncDiagnostics(diag)
      return { ok: false, message: 'Supabase client unavailable. Check environment variables.' }
    }

    // 1. Check if session is already active and verified
    try {
      const { data: userData } = await sb.auth.getUser()
      if (userData?.user) {
        setUserId(userData.user.id)
        setIsCloudSynced(true)
        await pullCloudData(userData.user.id)
        await pushCloudData(userData.user.id)
        const diag = await diagnoseCloudSync()
        setSyncDiagnostics(diag)
        return { ok: true, message: `Cloud account verified (${userData.user.email}) and synchronized.` }
      }
    } catch {}

    const p = passcode?.trim()
    if (!p) {
      return { ok: false, message: 'Passcode required to link cloud account.' }
    }

    const currentU = user || getAuthenticatedUser() || 'gaurxv'
    const email = resolveStarkUserToEmail(currentU)

    try {
      const { data: inData, error: inErr } = await sb.auth.signInWithPassword({
        email,
        password: p,
      })

      if (!inErr && inData?.session?.user) {
        setUserId(inData.user.id)
        setIsCloudSynced(true)
        saveAuthSession(currentU, isAdmin, true, inData.session.access_token)
        await pullCloudData(inData.user.id)
        await pushCloudData(inData.user.id)
        const diag = await diagnoseCloudSync()
        setSyncDiagnostics(diag)
        return { ok: true, message: 'Cloud account connected and synchronized successfully!' }
      }

      return { ok: false, message: inErr ? inErr.message : 'Invalid Supabase credentials.' }
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Connection failed' }
    }
  }

  const lock = () => {
    const sb = supabase
    if (sb) {
      sb.auth.signOut().catch(() => {})
    }
    clearAuthSession()
    resetProfile()
    setUserId(null)
    setUser('')
    setIsAdmin(false)
    setToken('')
    setIsCloudSynced(false)
    setAuthenticated(false)
    setSyncDiagnostics(getCurrentDiagnostics())
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  }

  const logout = async () => {
    try {
      lock()
      toast('Signed out of Gaurxv Verse', 'info')
    } catch {
      toast('Logout encountered an issue, session cleared', 'error')
    }
  }

  const triggerSync = async (): Promise<boolean> => {
    let targetUid = userId
    const sb = supabase || (await getOrInitSupabase())
    if (!targetUid && sb) {
      try {
        const { data } = await sb.auth.getSession()
        if (data?.session?.user?.id) {
          targetUid = data.session.user.id
          setUserId(targetUid)
          setIsCloudSynced(true)
        }
      } catch {}
    }
    if (targetUid) {
      await pushCloudData(targetUid)
      const ok = await pullCloudData(targetUid)
      const diag = await diagnoseCloudSync()
      setSyncDiagnostics(diag)
      return ok
    }
    const diag = await diagnoseCloudSync()
    setSyncDiagnostics(diag)
    return diag.status === 'connected'
  }

  return (
    <StarkAuthContext.Provider
      value={{
        authenticated,
        loading,
        user,
        userId,
        isAdmin,
        token,
        isCloudSynced,
        syncDiagnostics,
        unlock,
        linkCloudAccount,
        lock,
        logout,
        triggerSync,
      }}
    >
      {children}
    </StarkAuthContext.Provider>
  )
}

/** Hook to access centralized Stark authentication state and methods */
export function useStarkAuth(): StarkAuthContextType {
  const ctx = useContext(StarkAuthContext)
  if (ctx) return ctx

  // Fallback if accessed outside Provider
  return {
    authenticated: isSessionValid(),
    loading: false,
    user: getAuthenticatedUser(),
    userId: null,
    isAdmin: isCurrentAdmin(),
    token: getAuthToken(),
    isCloudSynced: false,
    syncDiagnostics: getCurrentDiagnostics(),
    unlock: async (u, p, r) => {
      const res = verifyCredentials(u, p)
      if (res.ok) {
        saveAuthSession(res.user, res.isAdmin, r)
        return true
      }
      return false
    },
    linkCloudAccount: async () => ({ ok: false, message: 'Auth context unavailable' }),
    lock: () => clearAuthSession(),
    logout: async () => clearAuthSession(),
    triggerSync: async () => false,
  }
}
