import { useEffect, useState } from 'react'
import { Download, X, Smartphone } from 'lucide-react'
import { BRAND_NAME, BRAND_SYMBOL } from '../lib/brand'
import { cn } from '../lib/utils'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

export function PwaInstallPrompt({ className }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)

  useEffect(() => {
    // Check if already in standalone display mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true

    if (isStandalone) {
      setIsInstalled(true)
      return
    }

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase()
    const ios = /iphone|ipad|ipod/.test(ua)
    setIsIos(ios)

    // Capture Chrome/Edge/Android beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
    } else if (isIos) {
      setShowIosGuide(true)
    }
  }

  if (isInstalled || dismissed) return null
  if (!deferredPrompt && !isIos) return null

  return (
    <>
      <div
        className={cn(
          'relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-accent/30 bg-card/90 p-3.5 shadow-xl backdrop-blur-xl',
          className
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/20 text-accent">
            <Smartphone className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-xs font-bold text-foreground">
              Install {BRAND_NAME} {BRAND_SYMBOL} App
            </p>
            <p className="truncate text-[11px] text-muted">
              Fast offline app shell, fullscreen reading &amp; streaming
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleInstallClick}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-bold text-accent-fg shadow-md shadow-accent/20 transition hover:brightness-110 active:scale-95"
          >
            <Download className="size-3.5" />
            <span>Install</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="grid size-8 place-items-center rounded-xl text-muted transition hover:bg-white/10 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* iOS Safari Installation Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display text-base font-bold text-foreground">
                Install on iOS Safari
              </h3>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="grid size-7 place-items-center rounded-full text-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs text-muted leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/20 font-bold text-accent">
                  1
                </span>
                <p>
                  Tap the <strong className="text-foreground">Share</strong> icon (the square with an arrow pointing up) in Safari’s bottom toolbar.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/20 font-bold text-accent">
                  2
                </span>
                <p>
                  Scroll down and select <strong className="text-foreground">Add to Home Screen</strong>.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/20 font-bold text-accent">
                  3
                </span>
                <p>
                  Tap <strong className="text-foreground">Add</strong> in the top-right corner to launch Stark Verse from your home screen.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="mt-6 flex h-10 w-full items-center justify-center rounded-xl bg-accent font-display text-xs font-bold text-accent-fg"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
