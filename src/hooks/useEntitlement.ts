import { useEffect, useState, useCallback } from 'react'
import { useStarkAuth } from '../lib/starkAuth'

export interface EntitlementData {
  hasAccess: boolean
  policy: 'trial' | 'lifetime' | 'custom' | 'subscription' | 'subscription_required'
  isExpired: boolean
  isSuspended: boolean
  remainingSeconds: number
  trialStartedAt?: string
  trialExpiresAt?: string
  expiresAt?: string
  subscriptionId?: string
  username?: string
  message?: string
}

export function useEntitlement() {
  const { user, authenticated, isAdmin } = useStarkAuth()
  const [entitlement, setEntitlement] = useState<EntitlementData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchEntitlement = useCallback(async () => {
    if (!authenticated || !user) {
      setEntitlement(null)
      setLoading(false)
      return
    }

    // Admins always have lifetime clearance
    if (isAdmin) {
      setEntitlement({
        hasAccess: true,
        policy: 'lifetime',
        isExpired: false,
        isSuspended: false,
        remainingSeconds: 999999999,
        username: user,
        message: 'Administrator clearance active',
      })
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/subscription/entitlement?user=${encodeURIComponent(user)}`)
      if (res.ok) {
        const data = await res.json()
        setEntitlement(data)
      } else {
        // Fallback default
        setEntitlement({
          hasAccess: true,
          policy: 'trial',
          isExpired: false,
          isSuspended: false,
          remainingSeconds: 1800,
          username: user,
        })
      }
    } catch {
      // In offline/dev mode without server
      setEntitlement({
        hasAccess: true,
        policy: 'trial',
        isExpired: false,
        isSuspended: false,
        remainingSeconds: 1800,
        username: user,
      })
    } finally {
      setLoading(false)
    }
  }, [authenticated, user, isAdmin])

  useEffect(() => {
    fetchEntitlement()
  }, [fetchEntitlement])

  // Live countdown timer for active trials or custom limits
  useEffect(() => {
    if (!entitlement || entitlement.isExpired || entitlement.policy === 'lifetime') return

    const timer = setInterval(() => {
      setEntitlement((prev) => {
        if (!prev) return null
        const nextSec = Math.max(0, prev.remainingSeconds - 1)
        const isExp = nextSec <= 0
        return {
          ...prev,
          remainingSeconds: nextSec,
          isExpired: isExp,
          hasAccess: !isExp && !prev.isSuspended,
        }
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [entitlement?.policy, entitlement?.isExpired])

  // Format countdown
  const formatTimeRemaining = (): string => {
    if (!entitlement) return 'Checking...'
    if (entitlement.policy === 'lifetime') return 'Lifetime Access'
    if (entitlement.isSuspended) return 'Suspended'
    if (entitlement.isExpired) return 'Access Expired'

    const sec = entitlement.remainingSeconds
    if (sec > 86400) {
      const days = Math.floor(sec / 86400)
      const hours = Math.floor((sec % 86400) / 3600)
      return `${days}d ${hours}h left`
    }
    const mins = Math.floor(sec / 60)
    const s = sec % 60
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return {
    entitlement,
    loading,
    refresh: fetchEntitlement,
    formatTimeRemaining,
  }
}
