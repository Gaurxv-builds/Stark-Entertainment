import type { ReactNode } from 'react'
import { GITHUB_PROFILE_URL, PORTFOLIO_URL, TELEGRAM_URL } from '../lib/app'
import { GithubIcon, GlobeIcon, TelegramIcon } from './BrandIcons'

const LINKS: { name: string; href: string; brand: string; icon: ReactNode }[] = [
  { name: 'Portfolio', href: PORTFOLIO_URL, brand: '#06b6d4', icon: <GlobeIcon className="size-[18px]" /> },
  { name: 'GitHub', href: GITHUB_PROFILE_URL, brand: '#8b949e', icon: <GithubIcon className="size-[18px]" /> },
  { name: 'Telegram', href: TELEGRAM_URL, brand: '#27A7E9', icon: <TelegramIcon className="size-[18px]" /> },
]

/** Compact "find us" row for the footer: three small round brand icons. */
export function CommunitySection() {
  return (
    <div className="relative mx-auto mt-10 flex w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">Community</p>
      <ul className="flex items-center gap-2.5">
        {LINKS.map((l) => (
          <li key={l.name}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={l.name}
              title={l.name}
              style={{ '--brand': l.brand } as React.CSSProperties}
              className="grid size-10 place-items-center rounded-full border border-border bg-card/60 text-muted transition duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:bg-[var(--brand)] hover:text-white focus-visible:ring-2 focus-visible:ring-accent active:scale-90"
            >
              {l.icon}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
