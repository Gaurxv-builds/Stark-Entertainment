import { createElement, useEffect, useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  KeyRound,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Mail,
  UserPlus,
  HelpCircle,
  X,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react'
import { BRAND_NAME, BRAND_SYMBOL } from '../lib/brand'
import { checkAndImportSyncPayload, syncCredentialsWithCloud } from '../lib/starkAuth'
import { AuroraBackground } from './AuroraBackground'
import { BorderBeam } from './BorderBeam'
import { DotPattern } from './DotPattern'
import { Logo } from './Logo'
import { AppTourModal } from './AppTourModal'
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
  const [showTourModal, setShowTourModal] = useState(false)

  // Request form state
  const [reqUsername, setReqUsername] = useState('')
  const [reqEmail, setReqEmail] = useState('')
  const [reqFullName, setReqFullName] = useState('')
  const [reqNote, setReqNote] = useState('')
  const [reqSubmitting, setReqSubmitting] = useState(false)
  const [reqSuccess, setReqSuccess] = useState(false)
  const [reqReference, setReqReference] = useState('')
  const [copiedRef, setCopiedRef] = useState(false)

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
    const cleanU = reqUsername.trim()
    const cleanE = reqEmail.trim().toLowerCase()
    const cleanName = reqFullName.trim()

    if (!cleanU || !cleanE || !cleanName) {
      toast('Full Name, Preferred Username, and Email Address are required.')
      return
    }

    if (!/^[a-zA-Z0-9_]{3,24}$/.test(cleanU)) {
      toast('Username must be 3-24 characters containing only letters, numbers, or underscores.')
      return
    }

    if (!cleanE.includes('@') || !cleanE.includes('.')) {
      toast('Please enter a valid email address.')
      return
    }

    setReqSubmitting(true)

    try {
      const res = await fetch('/api/auth/request-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanU,
          email: cleanE,
          fullName: cleanName,
          note: reqNote.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setReqReference(data.requestReference || '')
        setReqSuccess(true)
        toast('Account request dispatched to Administrator Bot!')
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

        {/* New User Clearance: Request Account CTA, Centered Portal & Tour CTA */}
        <div className="mt-6 border-t border-border/60 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">New user or need access?</span>
            <button
              type="button"
              onClick={() => {
                setReqSuccess(false)
                setShowRequestModal(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent transition hover:border-accent hover:bg-accent hover:text-accent-fg active:scale-95 shadow-sm shadow-accent/10"
            >
              <UserPlus className="size-3.5" />
              <span>Request Account</span>
            </button>
          </div>

          {/* Centered Subscription & Payment Portal Button */}
          <a
            href="https://payments.gaurxv.eu.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border/80 bg-card/60 p-3 text-xs font-semibold text-muted transition hover:border-accent/40 hover:bg-card hover:text-foreground active:scale-[0.99]"
            title="Open Subscription & Payment Portal"
          >
            <ShieldCheck className="size-4 shrink-0 text-accent" />
            <span className="text-center font-medium">
              Subscription &amp; Payment Portal <span className="text-[11px] text-muted font-normal">(payments.gaurxv.eu.org)</span>
            </span>
          </a>

          <div className="flex justify-center pt-0.5">
            <button
              type="button"
              onClick={() => setShowTourModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-accent transition"
            >
              <Sparkles className="size-3 text-accent" />
              <span>Explore Application / Take an Interactive Tour</span>
            </button>
          </div>
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
                Submit your details to request an administrator-approved account on Gaurxv Verse. Your account type will be assigned after administrator review.
              </p>

              {reqSuccess ? (
                /* SECTION 12: MANDATORY CONFIRMATION POPUP & GUIDANCE */
                <div className="my-5 space-y-3.5">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10">
                    <CheckCircle2 className="size-7" />
                  </div>

                  <div className="text-center space-y-0.5">
                    <h3 className="font-display font-black text-white text-base tracking-wide sm:text-lg">
                      REQUEST SUBMITTED SUCCESSFULLY!
                    </h3>
                    <p className="font-mono text-xs font-bold text-accent tracking-wider uppercase">
                      PLEASE CHECK YOUR EMAIL REGULARLY.
                    </p>
                  </div>

                  {/* Unique Request Reference */}
                  <div className="flex items-center justify-between rounded-2xl border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-xs">
                    <span className="text-muted">
                      Request Reference:{' '}
                      <strong className="font-mono text-accent text-sm ml-1">
                        {reqReference || 'REQ-PENDING'}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (reqReference) {
                          navigator.clipboard.writeText(reqReference)
                          setCopiedRef(true)
                          setTimeout(() => setCopiedRef(false), 2000)
                          toast('Request Reference copied to clipboard')
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-card/60 px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent hover:text-accent-fg transition"
                    >
                      {copiedRef ? <Check className="size-3" /> : <Copy className="size-3" />}
                      <span>{copiedRef ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <p className="text-xs text-muted leading-relaxed">
                    Your request has been submitted to the administrator. If approved, you will receive an account invitation link at your registered personal email address (<strong className="text-white">{reqEmail}</strong>) to set your password and access Gaurxv Verse.
                  </p>

                  {/* 6-Hour Delivery Guarantee */}
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-300">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      <span>6-Hour Response Window</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-100/80">
                      If you do not receive an email within 6 hours, please contact the administrator on Telegram (<a href="https://t.me/pepperonyx" target="_blank" rel="noreferrer" className="text-accent underline font-semibold">@pepperonyx</a>) or email <a href="mailto:work@gaurxv.eu.org" className="text-accent underline font-semibold">work@gaurxv.eu.org</a> with your request reference.
                    </p>
                  </div>

                  {/* Spam Folder Guidance */}
                  <div className="rounded-2xl border border-border/80 bg-background/70 p-3 text-xs text-muted space-y-1.5">
                    <p className="font-bold text-white text-[11px] uppercase font-mono tracking-wider">
                      📬 Important Spam Folder Guidance:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                      <li>Check your <strong>Spam / Junk</strong> folder if not seen in your Primary inbox.</li>
                      <li>If the invitation lands in Spam, mark it as <strong>&lsquo;Not Spam&rsquo;</strong>.</li>
                      <li>Add <strong className="text-white">updates@gaurxv.eu.org</strong> to your contacts or safe senders list.</li>
                    </ul>
                  </div>

                  {/* Warning Banner */}
                  <div className="rounded-xl border border-red-500/40 bg-red-500/15 p-2 text-center text-[11px] font-bold text-red-300 flex items-center justify-center gap-2">
                    <AlertTriangle className="size-3.5 shrink-0 text-red-400" />
                    <span>PLEASE DO NOT MISS THE ACCOUNT INVITATION EMAIL. Setup links expire in 48h.</span>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRequestModal(false)}
                      className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-accent text-xs font-bold text-accent-fg shadow-lg shadow-accent/20 transition hover:brightness-110 active:scale-95"
                    >
                      Got It
                    </button>

                    <a
                      href="https://t.me/pepperonyx"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-semibold text-muted hover:text-white transition"
                    >
                      <span>Contact Support on Telegram (@pepperonyx)</span>
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRequestSubmit} className="mt-4 space-y-3">
                  {/* Pricing and Access Tier Information */}
                  <div className="rounded-2xl border border-border/80 bg-background/60 p-3 text-xs space-y-2">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                      Available Access Clearance Types
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <div className="rounded-xl border border-border/60 bg-card/60 p-2">
                        <span className="font-bold text-stark-300 block">⏱️ Free Trial</span>
                        <span className="text-[10px] text-muted">20 min (if approved)</span>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-card/60 p-2">
                        <span className="font-bold text-purple-400 block">⚡ Lifetime Free</span>
                        <span className="text-[10px] text-muted">Free (if approved)</span>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-card/60 p-2">
                        <span className="font-bold text-emerald-400 block">👑 Premium Pass</span>
                        <span className="text-[10px] text-muted">₹29 / 30 Days</span>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-card/60 p-2">
                        <span className="font-bold text-amber-400 block">⏳ Custom Pass</span>
                        <span className="text-[10px] text-muted">Assigned by admin</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted leading-tight">
                      Administrator reviews and assigns clearance. Passwords are never requested here.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted">Preferred Username *</label>
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
                    <label className="text-xs font-semibold text-muted">Personal Email Address *</label>
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
                    <label className="text-xs font-semibold text-muted">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={reqFullName}
                      onChange={(e) => setReqFullName(e.target.value)}
                      placeholder="Tony Stark"
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs outline-none focus:border-accent"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted">Note or Message (Optional)</label>
                    <textarea
                      rows={2}
                      value={reqNote}
                      onChange={(e) => setReqNote(e.target.value)}
                      placeholder="Reason for access, payment details, or referral..."
                      className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-accent resize-none"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={reqSubmitting}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent font-bold text-xs text-accent-fg hover:brightness-110 active:scale-95 disabled:opacity-50 shadow-md shadow-accent/20"
                    >
                      {reqSubmitting ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="size-4 rounded-full border-2 border-accent-fg/30 border-t-accent-fg"
                          />
                          <span>Transmitting to Admin...</span>
                        </>
                      ) : (
                        <span>Transmit Account Request ⎊</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INTERACTIVE TOUR MODAL */}
      <AppTourModal
        isOpen={showTourModal}
        onClose={() => setShowTourModal(false)}
        onRequestAccount={() => {
          setShowTourModal(false)
          setReqSuccess(false)
          setShowRequestModal(true)
        }}
      />

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
