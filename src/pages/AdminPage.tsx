import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  Smartphone,
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  History,
  Ban,
  Maximize2,
} from 'lucide-react'
import {
  useStarkAuth,
  getAllCredentials,
  addCreatedCredential,
  deleteAnyUser,
  generateDeviceSyncUrl,
  checkAndImportSyncPayload,
  syncCredentialsWithCloud,
  type Credential,
} from '../lib/starkAuth'
import { toast } from '../lib/toast'
import { AuroraBackground } from '../components/AuroraBackground'
import { BorderBeam } from './../components/BorderBeam'
import { DotPattern } from './../components/DotPattern'

interface PaymentProof {
  id: string
  order_reference: string
  username: string
  email: string
  amount: number
  utr_reference: string
  screenshot_url?: string
  verification_status: 'pending' | 'approved' | 'rejected'
  rejection_reason?: string
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
}

interface UserAccessRecord {
  id: string
  user_id: string
  username: string
  email?: string
  access_policy: 'trial' | 'lifetime' | 'custom' | 'subscription_required'
  trial_started_at?: string
  trial_expires_at?: string
  custom_expires_at?: string
  is_lifetime: boolean
  is_exempt: boolean
  is_suspended: boolean
  created_at: string
}

interface AuditLog {
  id: string
  admin_user: string
  target_user?: string
  action: string
  details?: any
  created_at: string
}

interface AccountRequest {
  id: string
  username: string
  email: string
  full_name?: string
  note?: string
  status: string
  created_at: string
}

export default function AdminPage() {
  const { isAdmin, user } = useStarkAuth()

  // Tabs
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'credentials'>('subscriptions')

  // Form inputs (Credentials Tab)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [showFormPassword, setShowFormPassword] = useState(false)
  const [usersList, setUsersList] = useState<Credential[]>(() => getAllCredentials())
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Subscriptions Management State
  const [subLoading, setSubLoading] = useState(false)
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    pendingProofs: 0,
    approvedProofs: 0,
    lifetimeUsers: 0,
    trialUsers: 0,
    totalRevenue: 0,
  })
  const [pendingProofs, setPendingProofs] = useState<PaymentProof[]>([])
  const [allUsersAccess, setAllUsersAccess] = useState<UserAccessRecord[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [accountRequests, setAccountRequests] = useState<AccountRequest[]>([])

  // Action states
  const [processingProofId, setProcessingProofId] = useState<string | null>(null)

  // Fetch Subscriptions Dashboard Data
  const fetchSubscriptionData = async () => {
    setSubLoading(true)
    try {
      const token = localStorage.getItem('gaurxv_verse_auth_token') || ''
      const res = await fetch('/api/admin/subscriptions', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setMetrics(data.metrics || metrics)
          setPendingProofs(data.pendingProofs || [])
          setAllUsersAccess(data.users || [])
          setAuditLogs(data.auditLogs || [])
          setAccountRequests(data.accountRequests || [])
        }
      }
    } catch (e) {
      console.warn('Failed to fetch subscription data:', e)
    } finally {
      setSubLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchSubscriptionData()
    }
  }, [isAdmin])

  // Sync credentials on mount
  useEffect(() => {
    const imported = checkAndImportSyncPayload()
    if (imported > 0) {
      toast(`Synced ${imported} user(s) to this device!`)
      setUsersList(getAllCredentials())
    }

    syncCredentialsWithCloud().then(({ count }) => {
      if (count > 0) {
        setUsersList(getAllCredentials())
      }
    })
  }, [])

  // If not admin, access denied
  if (!isAdmin) {
    return (
      <main className="relative isolate flex min-h-[85svh] items-center justify-center overflow-hidden px-4 pt-24 text-center">
        <AuroraBackground />
        <div className="relative z-10 w-full max-w-md rounded-3xl border border-red-500/30 bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
          <ShieldAlert className="mx-auto mb-4 size-16 text-red-500 animate-pulse" />
          <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            Admin Clearance Required
          </h1>
          <p className="mt-3 text-sm text-muted">
            This area is restricted to Gaurxv Verse administrators. Regular accounts do not have clearance to manage subscriptions.
          </p>
          <div className="mt-8">
            <Link
              to="/"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-bold text-background transition hover:opacity-90 active:scale-95"
            >
              <ArrowLeft className="size-4" />
              Return to Universe
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // Handle Approve Payment Proof
  const handleApprovePayment = async (proof: PaymentProof) => {
    if (!confirm(`Approve ₹29 payment for @${proof.username}? This will activate 30 days of access and dispatch an activation email via Brevo.`)) return

    setProcessingProofId(proof.id)
    try {
      const token = localStorage.getItem('gaurxv_verse_auth_token') || ''
      const res = await fetch('/api/admin/subscription/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'approve_payment',
          proofId: proof.id,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast(`Access approved for @${proof.username} (30 Days Active)!`, 'success')
        fetchSubscriptionData()
      } else {
        toast(data.error || 'Failed to approve payment.', 'error')
      }
    } catch {
      toast('Network error during approval.', 'error')
    } finally {
      setProcessingProofId(null)
    }
  }

  // Handle Reject Payment Proof
  const handleRejectPayment = async (proof: PaymentProof) => {
    const reason = prompt(`Enter rejection reason for @${proof.username}:`, 'UTR not found in bank statement')
    if (reason === null) return

    setProcessingProofId(proof.id)
    try {
      const token = localStorage.getItem('gaurxv_verse_auth_token') || ''
      const res = await fetch('/api/admin/subscription/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'reject_payment',
          proofId: proof.id,
          reason,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast(`Payment rejected for @${proof.username}. User notified.`, 'info')
        fetchSubscriptionData()
      } else {
        toast(data.error || 'Failed to reject payment.', 'error')
      }
    } catch {
      toast('Network error during rejection.', 'error')
    } finally {
      setProcessingProofId(null)
    }
  }

  // Set User Policy
  const handleSetUserPolicy = async (targetUsername: string, policy: string, days = 30) => {
    try {
      const token = localStorage.getItem('gaurxv_verse_auth_token') || ''
      const res = await fetch('/api/admin/subscription/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'set_policy',
          targetUser: targetUsername,
          policy,
          days,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast(`Updated policy for @${targetUsername} to ${policy}!`, 'success')
        fetchSubscriptionData()
      } else {
        toast(data.error || 'Failed to update policy.', 'error')
      }
    } catch {
      toast('Network error updating policy.', 'error')
    }
  }

  // Toggle Suspend User
  const handleToggleSuspend = async (targetUsername: string, currentlySuspended: boolean) => {
    const nextAction = currentlySuspended ? 'restore_user' : 'suspend_user'
    if (!confirm(`${currentlySuspended ? 'Restore' : 'Suspend'} access for @${targetUsername}?`)) return

    try {
      const token = localStorage.getItem('gaurxv_verse_auth_token') || ''
      const res = await fetch('/api/admin/subscription/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: nextAction,
          targetUser: targetUsername,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast(`User @${targetUsername} ${currentlySuspended ? 'restored' : 'suspended'}!`, 'info')
        fetchSubscriptionData()
      } else {
        toast(data.error || 'Action failed.', 'error')
      }
    } catch {
      toast('Network error.', 'error')
    }
  }

  // Credentials Tab Helpers
  const generateRandomKey = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000)
    const prefixes = ['STARK', 'VERSE', 'JARVIS', 'REACTOR']
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const key = `${prefix}-${randomNum}`
    setNewPassword(key)
    toast(`Generated passcode: ${key}`)
  }

  const handleCreateUser = (e: FormEvent) => {
    e.preventDefault()
    const u = newUsername.trim()
    const p = newPassword.trim()
    if (!u || !p) {
      toast('Please enter both a username and password')
      return
    }

    addCreatedCredential({
      username: u,
      password: p,
      displayName: newDisplayName.trim() || u,
    })

    setUsersList(getAllCredentials())
    setNewUsername('')
    setNewPassword('')
    setNewDisplayName('')
    toast(`Created user clearance for @${u} ⎊`)
  }

  const handleDeleteUser = (username: string) => {
    deleteAnyUser(username)
    setUsersList(getAllCredentials())
    toast(`Revoked clearance for @${username}`)
  }

  const copyLoginDetails = (c: Credential) => {
    const text = `Gaurxv Verse Access Credentials ⎊\nURL: https://verse.gaurxv.eu.org\nUsername: ${c.username}\nPassword: ${c.password}`
    navigator.clipboard.writeText(text)
    setCopiedKey(c.username)
    toast(`Copied login credentials for @${c.username}`)
    setTimeout(() => setCopiedKey(null), 2500)
  }

  const copyDeviceSyncLink = () => {
    const url = generateDeviceSyncUrl()
    navigator.clipboard.writeText(url)
    toast('Copied Instant Device Sync Link to Clipboard!')
  }

  return (
    <main className="relative isolate min-h-svh overflow-hidden px-4 pb-28 pt-24 sm:px-6">
      <AuroraBackground />
      <DotPattern className="-z-10 [mask-image:radial-gradient(800px_circle_at_50%_30%,white,transparent)]" />

      <div className="relative z-10 mx-auto max-w-5xl space-y-8">
        
        {/* Header with Administrator Clearance Banner */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-accent uppercase">
              <ShieldCheck className="size-4" />
              <span>Stark Protocol // Central Control Console</span>
            </div>
            <h1 className="mt-1 font-display text-3xl font-black tracking-tight sm:text-4xl">
              Subscription &amp; Access Center
            </h1>
            <p className="mt-1 text-sm text-muted">
              Verify ₹29 payment submissions, approve 30-day passes, and manage user access policies.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchSubscriptionData}
              disabled={subLoading}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-muted transition hover:text-foreground active:scale-95"
            >
              <RefreshCw className={`size-3.5 ${subLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3.5 py-1 text-xs font-bold text-accent">
              <span>Admin: @{user} ⎊</span>
            </span>
          </div>
        </div>

        {/* Tab Navigation Switcher */}
        <div className="flex items-center gap-2 border-b border-border/80 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('subscriptions')}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold transition ${
              activeTab === 'subscriptions'
                ? 'bg-accent text-accent-fg shadow-lg shadow-accent/20'
                : 'text-muted hover:bg-card hover:text-foreground'
            }`}
          >
            <CreditCard className="size-4" />
            <span>Subscription Management</span>
            {pendingProofs.length > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-amber-400 text-black font-mono text-[10px] font-black animate-pulse">
                {pendingProofs.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold transition ${
              activeTab === 'credentials'
                ? 'bg-accent text-accent-fg shadow-lg shadow-accent/20'
                : 'text-muted hover:bg-card hover:text-foreground'
            }`}
          >
            <Users className="size-4" />
            <span>Credentials Directory</span>
            <span className="rounded-full bg-foreground/10 px-2 py-0.5 font-mono text-[10px]">
              {usersList.length}
            </span>
          </button>
        </div>

        {/* ====================================================================
         * TAB 1: SUBSCRIPTION MANAGEMENT & PAYMENT VERIFICATION
         * ==================================================================== */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-8">
            
            {/* 1. Overview Metrics Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <span className="text-[10px] font-mono uppercase text-muted">Pending Proofs</span>
                <p className="mt-1 font-display text-2xl font-black text-amber-400">{pendingProofs.length}</p>
                <span className="text-[10px] text-muted">Needs verification</span>
              </div>

              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <span className="text-[10px] font-mono uppercase text-muted">Active Subs</span>
                <p className="mt-1 font-display text-2xl font-black text-emerald-400">{metrics.activeSubscriptions}</p>
                <span className="text-[10px] text-muted">30-day active</span>
              </div>

              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <span className="text-[10px] font-mono uppercase text-muted">Trial Users</span>
                <p className="mt-1 font-display text-2xl font-black text-stark-400">{metrics.trialUsers}</p>
                <span className="text-[10px] text-muted">30-min trial policy</span>
              </div>

              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <span className="text-[10px] font-mono uppercase text-muted">Lifetime Pass</span>
                <p className="mt-1 font-display text-2xl font-black text-purple-400">{metrics.lifetimeUsers}</p>
                <span className="text-[10px] text-muted">Permanent access</span>
              </div>

              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <span className="text-[10px] font-mono uppercase text-muted">Approved</span>
                <p className="mt-1 font-display text-2xl font-black text-white">{metrics.approvedProofs}</p>
                <span className="text-[10px] text-muted">Total verified</span>
              </div>

              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <span className="text-[10px] font-mono uppercase text-muted">Total Revenue</span>
                <p className="mt-1 font-display text-2xl font-black text-reactor-400">₹{metrics.totalRevenue}</p>
                <span className="text-[10px] text-muted">Verified ₹29 passes</span>
              </div>
            </div>

            {/* 2. Pending Payment Review Queue */}
            <section className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-card/90 p-6 shadow-xl backdrop-blur-xl sm:p-8">
              <BorderBeam size={260} duration={7} />
              
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40">
                    <Clock className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold text-white">Pending Payment Queue</h2>
                    <p className="text-xs text-muted">Verify UPI receipt screenshot and approve 30-day access</p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-500/20 px-3 py-1 font-mono text-xs font-bold text-amber-400">
                  {pendingProofs.length} Pending
                </span>
              </div>

              {pendingProofs.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <CheckCircle2 className="mx-auto size-10 text-emerald-400" />
                  <p className="text-sm font-semibold text-white">All caught up!</p>
                  <p className="text-xs text-muted">No pending payment proofs awaiting verification.</p>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {pendingProofs.map((proof) => (
                    <div
                      key={proof.id}
                      className="flex flex-col gap-4 rounded-2xl border border-border bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      {/* Left: User details & UTR */}
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">@{proof.username}</span>
                          <span className="text-muted">({proof.email})</span>
                          <span className="rounded-md bg-accent/20 px-2 py-0.5 font-mono text-[10px] font-bold text-accent">
                            {proof.order_reference}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 font-mono text-gray-300">
                          <span>UTR: <strong className="text-white select-all">{proof.utr_reference}</strong></span>
                          <span>&bull;</span>
                          <span>Amount: <strong className="text-emerald-400">₹{proof.amount}</strong></span>
                          <span>&bull;</span>
                          <span className="text-muted">{new Date(proof.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                        </div>
                      </div>

                      {/* Right: Actions & Screenshot Button */}
                      <div className="flex items-center gap-2">
                        <a
                          href="https://t.me/JarvisXPay_Bot"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-muted hover:text-foreground"
                          title="Open Telegram Bot to view full photo"
                        >
                          <Maximize2 className="size-3.5" />
                          <span>View on Bot</span>
                        </a>

                        <button
                          type="button"
                          disabled={processingProofId === proof.id}
                          onClick={() => handleApprovePayment(proof)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-black transition hover:bg-emerald-400 active:scale-95 disabled:opacity-50"
                        >
                          <Check className="size-4" />
                          <span>Approve (+30 Days)</span>
                        </button>

                        <button
                          type="button"
                          disabled={processingProofId === proof.id}
                          onClick={() => handleRejectPayment(proof)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 px-3 text-xs font-bold text-red-400 hover:bg-red-500/20 active:scale-95 disabled:opacity-50"
                        >
                          <XCircle className="size-4" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. User Access Management Table */}
            <section className="rounded-3xl border border-border bg-card/80 p-6 shadow-xl backdrop-blur-xl sm:p-8">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold">User Access Policies</h2>
                  <p className="text-xs text-muted">Configurable 30-min trial, lifetime free, custom duration, or ₹29 subscription</p>
                </div>
                <span className="font-mono text-xs text-muted">{allUsersAccess.length} Users</span>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted font-mono uppercase">
                      <th className="pb-3 font-semibold">User</th>
                      <th className="pb-3 font-semibold">Access Policy</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Expiry / Duration</th>
                      <th className="pb-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {allUsersAccess.map((acc) => (
                      <tr key={acc.id} className="hover:bg-foreground/[0.02]">
                        <td className="py-3 font-semibold text-white">
                          <div>@{acc.username}</div>
                          <div className="text-[10px] text-muted font-mono">{acc.email || 'No email'}</div>
                        </td>

                        <td className="py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold uppercase text-[10px] ${
                              acc.is_lifetime || acc.access_policy === 'lifetime'
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                : acc.access_policy === 'trial'
                                ? 'bg-stark-400/20 text-stark-300 border border-stark-400/30'
                                : acc.access_policy === 'custom'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {acc.is_lifetime ? 'Lifetime Access' : acc.access_policy}
                          </span>
                        </td>

                        <td className="py-3">
                          {acc.is_suspended ? (
                            <span className="inline-flex items-center gap-1 text-red-400 font-bold">
                              <Ban className="size-3" /> Suspended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                              <CheckCircle2 className="size-3" /> Active
                            </span>
                          )}
                        </td>

                        <td className="py-3 font-mono text-muted text-[11px]">
                          {acc.is_lifetime
                            ? 'Permanent (Never)'
                            : acc.trial_expires_at
                            ? `Trial: ${new Date(acc.trial_expires_at).toLocaleTimeString()}`
                            : acc.custom_expires_at
                            ? `Custom: ${new Date(acc.custom_expires_at).toLocaleDateString()}`
                            : 'Standard Subscription'}
                        </td>

                        <td className="py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Grant Lifetime */}
                            <button
                              type="button"
                              onClick={() => handleSetUserPolicy(acc.username, 'lifetime')}
                              title="Grant Lifetime Free Access"
                              className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold text-purple-400 hover:border-purple-400"
                            >
                              Lifetime
                            </button>

                            {/* Set 30-Min Trial */}
                            <button
                              type="button"
                              onClick={() => handleSetUserPolicy(acc.username, 'trial')}
                              title="Assign 30-Minute Trial"
                              className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold text-stark-300 hover:border-stark-400"
                            >
                              Trial
                            </button>

                            {/* Require Subscription */}
                            <button
                              type="button"
                              onClick={() => handleSetUserPolicy(acc.username, 'subscription_required')}
                              title="Require Subscription"
                              className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold text-emerald-400 hover:border-emerald-400"
                            >
                              Sub
                            </button>

                            {/* Suspend / Restore */}
                            <button
                              type="button"
                              onClick={() => handleToggleSuspend(acc.username, acc.is_suspended)}
                              className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                                acc.is_suspended
                                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                              }`}
                            >
                              {acc.is_suspended ? 'Restore' : 'Suspend'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 4. Account Requests Queue */}
            {accountRequests.length > 0 && (
              <section className="rounded-3xl border border-border bg-card/80 p-6 shadow-xl backdrop-blur-xl sm:p-8">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h2 className="font-display text-xl font-bold">Account Access Requests</h2>
                    <p className="text-xs text-muted">Users who submitted request through the login gate</p>
                  </div>
                  <span className="font-mono text-xs font-bold text-accent">{accountRequests.length} Requests</span>
                </div>
                <div className="mt-4 space-y-3">
                  {accountRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white text-sm">@{req.username} <span className="text-muted font-normal">({req.email})</span></div>
                        {req.note && <p className="text-muted mt-1 italic">&ldquo;{req.note}&rdquo;</p>}
                        <span className="text-[10px] font-mono text-gray-500">{new Date(req.created_at).toLocaleString()}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNewUsername(req.username)
                          setNewDisplayName(req.full_name || req.username)
                          setActiveTab('credentials')
                          generateRandomKey()
                        }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-4 font-bold text-accent-fg active:scale-95"
                      >
                        <UserPlus className="size-3.5" />
                        <span>Issue Passcode</span>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 5. Immutable Audit Log */}
            {auditLogs.length > 0 && (
              <section className="rounded-3xl border border-border bg-card/60 p-6 shadow-xl backdrop-blur-xl sm:p-8">
                <div className="flex items-center gap-2 border-b border-border pb-3 text-xs font-bold text-muted uppercase tracking-wider">
                  <History className="size-4" />
                  <span>Administrative Audit Log</span>
                </div>
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto font-mono text-xs">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start justify-between rounded-xl border border-border/40 bg-background/40 p-2.5">
                      <div>
                        <span className="text-accent font-bold">[{log.admin_user}]</span>{' '}
                        <span className="text-white">{log.action}</span>{' '}
                        {log.target_user && <span className="text-muted">➔ @{log.target_user}</span>}
                      </div>
                      <span className="text-[10px] text-muted">{new Date(log.created_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        )}

        {/* ====================================================================
         * TAB 2: CREDENTIALS DIRECTORY (Original Account Creator & Sync)
         * ==================================================================== */}
        {activeTab === 'credentials' && (
          <div className="space-y-8">
            {/* Create New Credentials Form */}
            <section className="relative overflow-hidden rounded-3xl border border-border bg-card/80 p-6 shadow-xl backdrop-blur-xl sm:p-8">
              <BorderBeam size={220} duration={9} />
              <div className="flex items-center gap-2.5">
                <div className="grid size-10 place-items-center rounded-2xl bg-accent text-accent-fg">
                  <UserPlus className="size-5" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold">Create New Credentials</h2>
                  <p className="text-xs text-muted">Grant access to a new user or viewer</p>
                </div>
              </div>

              <form onSubmit={handleCreateUser} className="mt-6 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                      Username <span className="text-accent">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="e.g. alex"
                      className="h-11 w-full rounded-2xl border border-border bg-background/60 px-3.5 text-sm font-medium outline-none transition focus:border-accent"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                      Display Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      placeholder="e.g. Alex Stark"
                      className="h-11 w-full rounded-2xl border border-border bg-background/60 px-3.5 text-sm font-medium outline-none transition focus:border-accent"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                      Passcode or Password <span className="text-accent">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={generateRandomKey}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                    >
                      <Sparkles className="size-3" />
                      Generate Random Passcode
                    </button>
                  </div>
                  <div className="relative flex items-center rounded-2xl border border-border bg-background/60">
                    <input
                      type={showFormPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter a secure password or passcode"
                      className="h-11 w-full bg-transparent px-3.5 pr-20 text-sm font-medium outline-none"
                    />
                    <div className="absolute right-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowFormPassword(!showFormPassword)}
                        className="grid size-8 place-items-center rounded-lg text-muted hover:text-foreground"
                      >
                        {showFormPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-accent px-6 font-display text-sm font-bold text-accent-fg shadow-lg shadow-accent/20 transition hover:brightness-110 active:scale-95"
                  >
                    <UserPlus className="size-4" />
                    <span>Authorize &amp; Save Credentials ⎊</span>
                  </button>
                </div>
              </form>
            </section>

            {/* Directory of Authorized Accounts */}
            <section className="rounded-3xl border border-border bg-card/80 p-6 shadow-xl backdrop-blur-xl sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-2xl bg-foreground/10 text-foreground">
                    <Users className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold">Authorized Accounts Directory</h2>
                    <p className="text-xs text-muted">All active logins on this device</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyDeviceSyncLink}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-bold text-accent-fg transition active:scale-95"
                  >
                    <Smartphone className="size-3.5" />
                    <span>1-Click Device Sync</span>
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {usersList.map((c) => (
                  <div
                    key={c.username}
                    className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-xl bg-foreground/5 font-mono text-xs font-bold text-accent">
                        @{c.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">@{c.username}</span>
                          {c.displayName && (
                            <span className="text-xs text-muted">({c.displayName})</span>
                          )}
                        </div>
                        <div className="font-mono text-xs text-muted">
                          Passcode:{' '}
                          <span className="font-semibold text-foreground">
                            {revealedPasswords[c.username] ? c.password : '••••••••••••'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedPasswords((prev) => ({
                            ...prev,
                            [c.username]: !prev[c.username],
                          }))
                        }
                        className="grid size-8 place-items-center rounded-lg border border-border text-muted hover:text-foreground"
                        title={revealedPasswords[c.username] ? 'Hide' : 'Reveal'}
                      >
                        {revealedPasswords[c.username] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => copyLoginDetails(c)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-muted hover:border-accent hover:text-accent"
                      >
                        {copiedKey === c.username ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                        <span>{copiedKey === c.username ? 'Copied' : 'Copy'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteUser(c.username)}
                        className="grid size-8 place-items-center rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
                        title="Delete user"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

      </div>
    </main>
  )
}
