import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { BRAND_NAME, BRAND_SYMBOL } from '../lib/brand'
import { AuroraBackground } from './AuroraBackground'
import { DotPattern } from './DotPattern'
import { Logo } from './Logo'

export function StarkLoadingScreen() {
  return (
    <div className="relative isolate flex min-h-svh w-full flex-col items-center justify-center overflow-hidden bg-[#08080a] px-4 text-foreground">
      <AuroraBackground />
      <DotPattern className="-z-10 [mask-image:radial-gradient(650px_circle_at_50%_40%,white,transparent)]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center text-center"
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Logo size={56} showText={false} />
        </motion.div>

        <h1 className="mt-4 font-display text-2xl font-black tracking-tight sm:text-3xl">
          {BRAND_NAME}{' '}
          <span className="text-accent" aria-hidden>
            {BRAND_SYMBOL}
          </span>
        </h1>

        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-semibold tracking-wider text-accent uppercase">
          <Loader2 className="size-3.5 animate-spin" />
          <span>Verifying Security Clearance...</span>
        </div>
      </motion.div>
    </div>
  )
}
