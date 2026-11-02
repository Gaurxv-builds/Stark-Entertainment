import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { AuroraBackground } from '../components/AuroraBackground'
import { DotPattern } from '../components/DotPattern'
import { BorderBeam } from '../components/BorderBeam'
import { toast } from '../lib/toast'
import { saveAuthSession } from '../lib/starkAuth'

interface InvitationInfo {
  valid: boolean
  username: string
  email: string
  fullName: string
  accessPolicy: string
  policyTitle: string
  customDays?: number | null
}

interface PasswordSetupPageProps {
  onComplete?: (username: string, password: string, remember?: boolean) => Promise<boolean>
}

export default function PasswordSetupPage({ onComplete }: PasswordSetupPageProps) {
  const [token, setToken] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // 1. Extract invitation token from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tok = params.get('token')
    if (!tok) {
      setError('Missing invitation token. Please use the secure link sent to your personal email.')
      setLoading(false)
      return
    }
    setToken(tok)

    // 2. Fetch invitation details
    fetch(`/api/auth/invitation-info?token=${encodeURIComponent(tok)}`)
      .then(async (res) => {
        const data = await res.json()
        if (res.ok && data.success && data.valid) {
          setInvitation(data)
        } else {
          setError(data.error || 'This invitation link is invalid, expired, or has already been used.')
        }
      })
      .catch((err) => {
        setError(`Unable to connect to Stark Gate verification service: ${err.message}`)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  // 3. Handle password submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    const p = password.trim()
    const cp = confirmPassword.trim()

    if (p.length < 6) {
      toast('Password must contain at least 6 characters.')
      return
    }
    if (p !== cp) {
      toast('Passwords do not match. Please verify both fields.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: p,
          confirmPassword: cp,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setIsSuccess(true)
        toast(`🎉 Account activated! Welcome to Stark Entertainment, @${data.user}.`)

        // Save session locally
        if (data.token) {
          saveAuthSession(data.user, false, true, data.token)
        }

        // Trigger onComplete or auto-redirect
        if (onComplete) {
          try {
            await onComplete(data.user, p, true)
          } catch {}
        }

        // Navigate to root after a short celebration
        setTimeout(() => {
          window.location.href = '/'
        }, 1500)
      } else {
        toast(data.error || 'Failed to complete password setup.')
      }
    } catch {
      toast('Network error during password setup. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative isolate flex min-h-svh w-full items-center justify-center overflow-hidden bg-[#08080a] px-4 py-8 text-foreground">
      <AuroraBackground />
      <DotPattern className="-z-10 [mask-image:radial-gradient(650px_circle_at_50%_40%,white,transparent)]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border border-border bg-card/85 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
      >
        <BorderBeam size={260} duration={8} />

        {/* Top Branding */}
        <div className="flex flex-col items-center text-center">
          <Logo size={42} showText={false} to="https://verse.gaurxv.eu.org/" />

          <div className="mt-3 flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wider text-accent uppercase">
            <ShieldCheck className="size-3.5" />
            <span>Stark Protocol // Identity Setup</span>
          </div>

          <h1 className="mt-4 font-display text-2xl font-black tracking-tight sm:text-3xl">
            {isSuccess ? 'Account Activated' : error ? 'Access Notice' : 'Set Your Password'}
          </h1>
          <p className="mt-1 text-xs text-muted max-w-xs">
            {isSuccess
              ? 'Your credentials are authenticated. Preparing your private session...'
              : error
              ? 'Verification status for this security token'
              : 'Choose your personal account password to enter Gaurxv Verse.'}
          </p>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="my-8 flex flex-col items-center justify-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="size-8 rounded-full border-2 border-accent/30 border-t-accent"
            />
            <span className="text-xs font-mono tracking-wider text-muted">VERIFYING INVITATION TOKEN...</span>
          </div>
        )}

        {/* ERROR STATE */}
        {!loading && error && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
              <div className="flex items-center gap-2 font-bold text-red-400">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Invalid or Expired Invitation</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-red-100/80">{error}</p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/60 p-4 text-xs space-y-2 text-muted">
              <p className="font-semibold text-white">Why am I seeing this?</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>Invitations are strictly single-use and expire after 48 hours.</li>
                <li>If you already activated this account, you can sign in directly with your password.</li>
                <li>If your link expired, you can request a fresh invitation from the administrator.</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <a
                href="/"
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-accent text-xs font-bold text-accent-fg hover:brightness-110 active:scale-95"
              >
                <span>Return to Stark Login Gate</span>
                <ArrowRight className="size-3.5" />
              </a>

              <a
                href="https://t.me/pepperonyx"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-semibold text-muted hover:text-white"
              >
                <span>Contact Administrator (@pepperonyx)</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        )}

        {/* SUCCESS CELEBRATION STATE */}
        {!loading && !error && isSuccess && (
          <div className="mt-6 space-y-4 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="size-8" />
            </div>

            <div>
              <h3 className="font-bold text-white text-base">Clearance Granted</h3>
              <p className="text-xs text-muted mt-1">
                Welcome aboard, <strong className="text-accent">@{invitation?.username}</strong>. Unlocking the 6 media pillars...
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 font-mono">
              Redirecting you to Gaurxv Verse...
            </div>
          </div>
        )}

        {/* FORM STATE */}
        {!loading && !error && !isSuccess && invitation && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Identity Info Card */}
            <div className="rounded-2xl border border-border/80 bg-background/70 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted">
                <span>Account Username</span>
                <strong className="text-accent font-mono text-sm">@{invitation.username}</strong>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Personal Email</span>
                <strong className="text-white font-mono text-[11px]">{invitation.email}</strong>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Granted Access Tier</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 border border-accent/30 px-2 py-0.5 font-bold text-accent text-[10px]">
                  <Sparkles className="size-2.5" />
                  {invitation.policyTitle}
                </span>
              </div>
            </div>

            {/* Password Inputs */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted">New Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter at least 6 characters"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 pr-10 text-xs outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted">Confirm Password *</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password to confirm"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 pr-10 text-xs outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Validation Checklist */}
            <div className="rounded-xl border border-border/50 bg-background/40 p-2.5 text-[11px] space-y-1 text-muted">
              <div className="flex items-center gap-1.5">
                <span className={password.length >= 6 ? 'text-emerald-400 font-bold' : 'text-muted'}>
                  {password.length >= 6 ? '✓' : '•'} At least 6 characters
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={password.length > 0 && password === confirmPassword ? 'text-emerald-400 font-bold' : 'text-muted'}>
                  {password.length > 0 && password === confirmPassword ? '✓' : '•'} Passwords match
                </span>
              </div>
            </div>

            <p className="text-[11px] text-muted text-center leading-relaxed">
              Your password is encrypted client-side and saved to Supabase Auth. It is never stored in plaintext or accessible to administrators.
            </p>

            <button
              type="submit"
              disabled={submitting || password.length < 6 || password !== confirmPassword}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent font-bold text-xs text-accent-fg shadow-lg shadow-accent/20 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="size-4 rounded-full border-2 border-accent-fg/30 border-t-accent-fg"
                  />
                  <span>ACTIVATING CLEARANCE...</span>
                </>
              ) : (
                <>
                  <Lock className="size-4" />
                  <span>ACTIVATE ACCOUNT &amp; ENTER ⎊</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  )
}
