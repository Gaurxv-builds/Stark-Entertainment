import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND_MARK, BRAND_NAME, BRAND_SYMBOL } from '../lib/brand'
import { LOGO_URL } from '../lib/constants'
import { cn } from '../lib/utils'

export function Logo({ size = 36, showText = true, className, to = '/' }: { size?: number; showText?: boolean; className?: string; to?: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <Link to={to} aria-label={`${BRAND_MARK} home`} className={cn('group inline-flex min-w-0 items-center gap-2.5', className)}>
      {failed ? (
        <span
          className="grid place-items-center rounded-xl bg-background font-display text-lg font-black text-accent ring-1 ring-accent/40"
          style={{ width: size, height: size }}
        >
          {BRAND_SYMBOL}
        </span>
      ) : (
        <img
          src={LOGO_URL}
          alt=""
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="rounded-xl object-cover ring-1 ring-border transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105"
          style={{ width: size, height: size }}
        />
      )}
      {showText && (
        <span className="font-display truncate text-base font-extrabold tracking-tight sm:text-xl">
          {BRAND_NAME}{' '}
          <span className="text-accent" aria-hidden>
            {BRAND_SYMBOL}
          </span>
        </span>
      )}
    </Link>
  )
}
