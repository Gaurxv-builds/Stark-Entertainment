import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, Zap, ExternalLink, LogOut, CheckCircle2 } from 'lucide-react'
import { BorderBeam } from './BorderBeam'
import { useStarkAuth } from '../lib/starkAuth'
import type { EntitlementData } from '../hooks/useEntitlement'

interface SubscriptionModalProps {
  isOpen: boolean
  entitlement: EntitlementData | null
  onRefresh?: () => void
}

export function SubscriptionModal({ isOpen, entitlement, onRefresh }: SubscriptionModalProps) {
  const { user, logout } = useStarkAuth()
  if (!isOpen) return null

  const isTrial = entitlement?.policy === 'trial'
  const isSuspended = entitlement?.isSuspended
  const title = isSuspended
    ? 'Access Suspended'
    : isTrial
    ? 'Free Trial Expired'
    : 'Subscription Required'

  const description = isSuspended
    ? 'Your access to Gaurxv Verse has been suspended by the administrator.'
    : isTrial
    ? 'Your 30-minute complimentary free trial has concluded. Renew with a 30-day Stark Premium Pass (₹29) to continue streaming.'
    : 'An active ₹29 / 30-day pass is required to access Stark Entertainment.'

  const paymentUrl = `https://payments.gaurxv.eu.org/?user=${encodeURIComponent(user || '')}`

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          className="relative w-full max-w-lg overflow-hidden rounded-[2.5rem] border border-stark-400/30 bg-[#0c0d16] p-7 sm:p-9 shadow-[0_0_60px_rgba(6,182,212,0.18)]"
        >
          <BorderBeam size={300} duration={6} />

          <div className="flex flex-col items-center text-center">
            {/* Holographic Alert Badge */}
            <div className="flex size-16 items-center justify-center rounded-2xl bg-stark-400/10 text-stark-400 ring-2 ring-stark-400/30 shadow-xl shadow-stark-400/20">
              <ShieldAlert className="size-8" />
            </div>

            <div className="mt-4 flex items-center gap-1.5 rounded-full border border-stark-400/30 bg-stark-400/10 px-3.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-stark-300">
              <Zap className="size-3.5 animate-pulse" />
              <span>Stark Access Protocol</span>
            </div>

            <h2 className="mt-3 font-display text-2xl font-black tracking-tight text-white sm:text-3xl">
              {title}
            </h2>
            <p className="mt-2 text-xs text-gray-300 leading-relaxed sm:text-sm">
              {description}
            </p>

            {/* Premium Plan Highlight Box */}
            <div className="my-5 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-stark-300">Stark 30-Day Premium</span>
                <span className="font-display text-xl font-black text-white">₹29 <span className="font-mono text-xs text-gray-400 font-normal">/ 30 Days</span></span>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs text-gray-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                  <span>Unlimited ad-free multi-server streaming with Dual Audio</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                  <span>Anime, Movies, Manga, Novels, Ebooks &amp; Music pillars</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                  <span>Manual renewal only &bull; Zero recurring auto-debit</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex w-full flex-col gap-2.5 sm:flex-row">
              <a
                href={paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-stark-400 to-stark-500 font-display text-xs font-black tracking-wider text-black shadow-lg shadow-stark-400/30 transition hover:brightness-110 active:scale-95"
              >
                <span>UPGRADE NOW (₹29)</span>
                <ExternalLink className="size-4" />
              </a>

              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="flex h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 text-xs font-bold text-white transition hover:bg-white/10 active:scale-95"
                >
                  Verify Access
                </button>
              )}
            </div>

            {/* Logout link */}
            <button
              type="button"
              onClick={logout}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition"
            >
              <LogOut className="size-3.5" />
              <span>Sign out of @{user}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
