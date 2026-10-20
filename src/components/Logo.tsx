import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND_MARK, BRAND_NAME, BRAND_SYMBOL } from '../lib/brand'
import { LOGO_URL } from '../lib/constants'
import { cn } from '../lib/utils'

export function Logo({
  size = 36,
  showText = true,
  className,
  to = 'https://verse.gaurxv.eu.org/',
}: {
  size?: number
  showText?: boolean
  className?: string
  to?: string
}) {
  const [failed, setFailed] = useState(false)
  const isExternal = to.startsWith('http')

  const content = (
    <>
      {failed ? (
        <span
          className="grid place-items-center rounded-xl bg-background font-display text-lg font-black text-accent ring-1 ring-accent/40"
          style={{ width: size, height: size }}
        >
          {BRAND_SYMBOL}
        </span>
      ) : (
        <span
          className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-foreground/5 p-1 ring-1 ring-border backdrop-blur-sm transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105 dark:bg-white/10 dark:ring-white/20"
          style={{ width: size, height: size }}
        >
          <img
            src={LOGO_URL}
            alt=""
            width={size - 8}
            height={size - 8}
            onError={() => setFailed(true)}
            className="size-full object-contain transition-all duration-300 dark:invert"
          />
        </span>
      )}
      {showText && (
        <span className="truncate font-display text-base font-extrabold tracking-tight sm:text-xl">
          {BRAND_NAME}{' '}
          <span className="text-accent" aria-hidden>
            {BRAND_SYMBOL}
          </span>
        </span>
      )}
    </>
  )

  const classes = cn('group inline-flex min-w-0 items-center gap-2.5', className)

  if (isExternal) {
    return (
      <a href={to} aria-label={`${BRAND_MARK} home`} className={classes}>
        {content}
      </a>
    )
  }

  return (
    <Link to={to} aria-label={`${BRAND_MARK} home`} className={classes}>
      {content}
    </Link>
  )
}
