import { createElement, useEffect, useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, KeyRound, Lock, Unlock, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight, Mail, UserPlus, HelpCircle, X, CheckCircle2 } from 'lucide-react'
import { BRAND_NAME, BRAND_SYMBOL } from '../lib/brand'
import { checkAndImportSyncPayload, syncCredentialsWithCloud } from '../lib/starkAuth'
import { AuroraBackground } from './AuroraBackground'
import { BorderBeam } from './BorderBeam'
import { DotPattern } from './DotPattern'
import { Logo } from './Logo'
import { toast } from '../lib/toast'

interface StarkLoginGateProps {
  onUnlock: (username: string, passcode: string, remember: boolean) => Promise<boolean> | boolean
}

/** DotLottie custom element rendered via createElement to prevent JSX type collision */
function DotLottiePlayer({ src, className }: { src: string; className?: string }) {
  return createElement('dotlottie-wc', {
    src,
    autoplay: true,
    loop: true,
    style: { width: '100%', height: '100%' },
    class: className,
  })
}

export function StarkLoginGate({ onUnlock }: StarkLoginGateProps) {
  useEffect(() => {
    checkAndImportSyncPayload()
    syncCredentialsWithCloud()
  }, [])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPasscode, setShowPasscode] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [granted, setGranted] = useState(false)

  // Modals
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showRecoverModal, setShowRecoverModal] = useState(false)

  // Request form state
  const [reqUsername, setReqUsername] = useState('')
  const [reqEmail, setReqEmail] = useState('')
  const [reqFullName, setReqFullName] = useState('')
  const [reqNote, setReqNote] = useState('')
  const [reqSubmitting, setReqSubmitting] = useState(false)
  const [reqSuccess, setReqSuccess] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!password.trim() || loading || granted) return

    setLoading(true)
    setError(false)

    setTimeout(async () => {
      let ok = await Promise.resolve(onUnlock(username, password, remember))
      if (!ok) {
        await syncCredentialsWithCloud()
        ok = await Promise.resolve(onUnlock(username, password, remember))
      }
      if (ok) {
        setGranted(true)
      } else {
        setError(true)
        setLoading(false)
      }
    }, 450)
  }

  const handleRequestSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!reqUsername || !reqEmail) return
    setReqSubmitting(true)

    try {
      const res = await fetch('/api/auth/request-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: reqUsername,
          email: reqEmail,
          fullName: reqFullName,
          note: reqNote,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setReqSuccess(true)
        toast('Account request dispatched to Telegram Bot!')
      } else {
        toast(data.error || 'Failed to submit request.')
      }
    } catch {
      toast('Network error sending request.')
    } finally {
      setReqSubmitting(false)
    }
  }

  return (
    <div className="relative isolate flex min-h-svh w-full items-center justify-center overflow-hidden bg-[#08080a] px-4 py-8 text-foreground">
      <AuroraBackground />
      <DotPattern className="-z-10 [mask-image:radial-gradient(650px_circle_at_50%_40%,white,transparent)]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border border-border bg-card/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
      >
        <BorderBeam size={260} duration={8} />

        {/* Top Branding */}
        <div className="flex flex-col items-center text-center">
          <Logo size={42} showText={false} to="https://verse.gaurxv.eu.org/" />

          <div className="mt-3 flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wider text-accent uppercase">
            <ShieldCheck className="size-3.5" />
            <span>Stark Protocol // Security Gate</span>
          </div>

          {/* Lottie Animation Display */}
          <div className="relative my-2 size-40 sm:size-48">
            <DotLottiePlayer src="https://lottie.host/16e0b9f8-a741-4fb2-84bd-bca6bddbb939/tgQRFUHhy7.lottie" />
          </div>

          <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            {BRAND_NAME}{' '}
            <span className="text-accent" aria-hidden>
              {BRAND_SYMBOL}
            </span>
          </h1>
          <p className="mt-1 text-xs text-muted sm:text-sm">
            Sign in with your authorized credentials to unlock Gaurxv Verse.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Username / Identifier */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider">
              Username or Email
            </label>
            <div className="relative flex items-center rounded-2xl border border-border bg-background/60 backdrop-blur transition-all duration-200 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
              <User className="pointer-events-none ml-4 size-4 shrink-0 text-muted" />
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  if (error) setError(false)
                }}
                placeholder="Enter your username or email"
                autoFocus
                autoComplete="username"
                className="h-12 w-full bg-transparent px-3 text-sm font-medium outline-none placeholder:text-muted/60"
              />
            </div>
          </div>

          {/* Password / Access Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                Password or Security Key
              </label>
              <button
                type="button"
                onClick={() => setShowRecoverModal(true)}
                className="text-[11px] text-accent hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div
              className={`relative flex items-center rounded-2xl border bg-background/60 backdrop-blur transition-all duration-200 ${
                error
                  ? 'border-red-500/70 ring-2 ring-red-500/20'
                  : 'border-border focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20'
              }`}
            >
              <KeyRound className="pointer-events-none ml-4 size-4 shrink-0 text-muted" />
              <input
                type={showPasscode ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError(false)
                }}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="h-12 w-full bg-transparent px-3 text-sm font-medium outline-none placeholder:text-muted/60"
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                className="mr-3 grid size-8 place-items-center rounded-lg text-muted transition hover:bg-foreground/5 hover:text-foreground"
              >
                {showPasscode ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1.5 pt-1 text-xs font-medium text-red-400"
                >
                  <AlertCircle className="size-3.5" />
                  <span>Access Denied: Invalid credentials. Please try again.</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex cursor-pointer items-center gap-2 select-none text-muted transition hover:text-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-4 rounded border-border accent-accent"
              />
              <span>Remember this device (30 days)</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={!password.trim() || loading || granted}
            className={`group relative flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-display text-sm font-bold tracking-wide transition-all duration-300 ${
              granted
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/25'
                : 'bg-accent text-accent-fg shadow-lg shadow-accent/25 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'
            }`}
          >
            {granted ? (
              <>
                <Unlock className="size-4" />
                <span>ACCESS GRANTED // INITIALIZING...</span>
              </>
            ) : loading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="size-4 rounded-full border-2 border-accent-fg/30 border-t-accent-fg"
                />
                <span>VERIFYING CREDENTIALS...</span>
              </>
            ) : (
              <>
                <Lock className="size-4 transition-transform group-hover:scale-110" />
                <span>AUTHORIZE &amp; ENTER ⎊</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        {/* Account Request & Recovery Buttons */}
        <div className="mt-6 border-t border-border/60 pt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>New user or need access?</span>
            <button
              type="button"
              onClick={() => {
                setReqSuccess(false)
                setShowRequestModal(true)
              }}
              className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
            >
              <UserPlus className="size-3.5" />
              <span>Request Account</span>
            </button>
          </div>

          <a
            href="https://payments.gaurxv.eu.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-center text-xs font-semibold text-accent transition hover:border-accent hover:bg-accent hover:text-accent-fg active:scale-[0.98]"
          >
            <ShieldCheck className="size-3.5 shrink-0" />
            <span className="text-center">Subscription &amp; Payment Portal (payments.gaurxv.eu.org)</span>
          </a>
        </div>
      </motion.div>

      {/* REQUEST ACCOUNT MODAL */}
      <AnimatePresence>
        {showRequestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-muted hover:bg-foreground/10"
              >
                <X className="size-4" />
              </button>

              <div className="flex items-center gap-2 text-accent font-mono text-xs font-bold uppercase tracking-wider mb-2">
                <UserPlus className="size-4" />
                <span>Request Access Clearance</span>
              </div>
              <h2 className="font-display text-xl font-black text-white">Join Stark Entertainment</h2>
              <p className="mt-1 text-xs text-muted">
                Submit your details to request an administrator-approved account on Gaurxv Verse.
              </p>

              {reqSuccess ? (
                <div className="my-6 text-center space-y-3">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <h3 className="font-bold text-white text-base">Request Dispatched!</h3>
                  <p className="text-xs text-muted max-w-xs mx-auto">
                    Your request was sent directly to the administrator's Telegram bot. You will receive an email once your account credentials are generated.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-accent px-6 text-xs font-bold text-accent-fg"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRequestSubmit} className="mt-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted">Desired Username *</label>
                    <input
                      type="text"
                      required
                      value={reqUsername}
                      onChange={(e) => setReqUsername(e.target.value)}
                      placeholder="e.g. tony_stark"
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs outline-none focus:border-accent"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted">Your Email *</label>
                    <input
                      type="email"
                      required
                      value={reqEmail}
                      onChange={(e) => setReqEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs outline-none focus:border-accent"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted">Full Name</label>
                    <input
                      type="text"
                      value={reqFullName}
                      onChange={(e) => setReqFullName(e.target.value)}
                      placeholder="Your name"
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs outline-none focus:border-accent"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted">Note or Message (Optional)</label>
                    <textarea
                      rows={2}
                      value={reqNote}
                      onChange={(e) => setReqNote(e.target.value)}
                      placeholder="Tell the admin how you found the platform..."
                      className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-accent resize-none"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={reqSubmitting}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent font-bold text-xs text-accent-fg hover:brightness-110 active:scale-95 disabled:opacity-50"
                    >
                      {reqSubmitting ? 'Transmitting to Admin...' : 'Transmit Account Request ⎊'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FORGOT PASSWORD MODAL */}
      <AnimatePresence>
        {showRecoverModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl text-center space-y-4"
            >
              <button
                type="button"
                onClick={() => setShowRecoverModal(false)}
                className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-muted hover:bg-foreground/10"
              >
                <X className="size-4" />
              </button>

              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent/20 text-accent">
                <HelpCircle className="size-6" />
              </div>
              <h2 className="font-display text-xl font-black text-white">Account Recovery</h2>
              <p className="text-xs text-muted leading-relaxed">
                Stark Entertainment uses administrator-verified security clearance. For security, passwords are never stored in plaintext and cannot be auto-reset by email.
              </p>

              <div className="rounded-2xl border border-border bg-background/60 p-4 text-left text-xs space-y-2">
                <p className="font-semibold text-white">To reset your passcode:</p>
                <ol className="list-decimal pl-4 space-y-1 text-muted">
                  <li>Contact the administrator directly via Telegram: <a href="https://t.me/PepperonyX" target="_blank" rel="noreferrer" className="text-accent underline">@PepperonyX</a></li>
                  <li>Or send an email with your registered username to <a href="mailto:work@gaurxv.eu.org" className="text-accent underline">work@gaurxv.eu.org</a></li>
                  <li>The administrator will generate and issue you a fresh security pass.</li>
                </ol>
              </div>

              <div className="flex gap-2">
                <a
                  href="mailto:work@gaurxv.eu.org?subject=Password%20Recovery%20Request%20-%20Gaurxv%20Verse"
                  className="flex-1 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-accent text-xs font-bold text-accent-fg"
                >
                  <Mail className="size-3.5" />
                  <span>Email Admin</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowRecoverModal(false)}
                  className="rounded-xl border border-border px-4 text-xs font-semibold text-muted hover:text-white"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
