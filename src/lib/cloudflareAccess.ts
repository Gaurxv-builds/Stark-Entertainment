import { useEffect, useState } from 'react'

export interface CloudflareAccessUser {
  email: string
  name?: string
  user_uuid?: string
}

/**
 * Checks for an active Cloudflare Zero Trust Access session.
 * Cloudflare automatically responds to /cdn-cgi/access/get-identity with the authenticated identity.
 */
export async function fetchAccessIdentity(): Promise<CloudflareAccessUser | null> {
  try {
    const res = await fetch('/cdn-cgi/access/get-identity', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data && typeof data.email === 'string') {
      return {
        email: data.email,
        name: data.name,
        user_uuid: data.user_uuid,
      }
    }
    return null
  } catch {
    return null
  }
}

export function useAccessUser() {
  const [user, setUser] = useState<CloudflareAccessUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAccessIdentity().then((u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  return { user, loading }
}
