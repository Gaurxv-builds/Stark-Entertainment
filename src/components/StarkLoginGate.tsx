import { createElement, useEffect, useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, KeyRound, Lock, Unlock, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight, Mail } from 'lucide-react'
import { BRAND_NAME, BRAND_SYMBOL } from '../lib/brand'
import { checkAndImportSyncPayload, syncCredentialsWithCloud } from '../lib/starkAuth'
import { AuroraBackground } from './AuroraBackground'
import { BorderBeam } from './BorderBeam'
import { DotPattern } from './DotPattern'
import { Logo } from './Logo'

interface StarkLoginGateProps {
  onUnlock: (username: string, passcode: string, remember: boolean) => boolean
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!password.trim() || loading || granted) return

    setLoading(true)
    setError(false)

    // Smooth verification feedback
    setTimeout(async () => {
      let ok = onUnlock(username, password, remember)
      if (!ok) {
        await syncCredentialsWithCloud()
        ok = onUnlock(username, password, remember)
      }
      if (ok) {
        setGranted(true)
      } else {
        setError(true)
        setLoading(false)
      }
    }, 450)
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
            <label className="text-xs font-semibold text-muted uppercase tracking-wider">
              Password or Security Key
            </label>
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

        {/* Request Credentials Link (Redirects to mailto:work@gaurxv.eu.org) */}
        <div className="mt-6 border-t border-border/60 pt-4 text-center">
          <p className="mb-2.5 text-xs text-muted">Need an account or forgotten credentials?</p>
          <a
            href="mailto:work@gaurxv.eu.org?subject=Request%20Gaurxv%20Verse%20Access%20Credentials&body=Hi%20Gaurav,%0A%0AI%20would%20like%20to%20request%20access%20credentials%20for%20Gaurxv%20Verse%20%E2%8E%8A.%0A%0AUsername%20requested:%20%0AFull%20Name:%20%0AEmail:%20"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-xs font-semibold text-accent transition hover:border-accent hover:bg-accent hover:text-accent-fg active:scale-[0.98]"
          >
            <Mail className="size-3.5" />
            <span>Request Credentials (work@gaurxv.eu.org)</span>
          </a>
        </div>
      </motion.div>
    </div>
  )
}
