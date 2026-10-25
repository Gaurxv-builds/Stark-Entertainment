import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Compass, Download, House, Search, ShieldAlert } from 'lucide-react'
import { MOVIE_LINKS, NAV_LINKS } from '../lib/constants'
import { sectionOf } from '../lib/sections'
import { cn } from '../lib/utils'
import { useSearch } from '../context/SearchContext'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { useStarkAuth } from '../lib/starkAuth'
import { Avatar } from './Avatar'
import { useProfile } from '../lib/profile'

/** Floating glass navbar (Aceternity "Floating Navbar") with an animated hover pill. */
export function Navbar() {
  const { openSearch } = useSearch()
  const me = useProfile()
  const { isAdmin } = useStarkAuth()
  const { pathname, search } = useLocation()
  const section = sectionOf(pathname)
  const anime = section === 'anime'
  const movies = section === 'movies'
  const links = anime ? NAV_LINKS : movies ? MOVIE_LINKS : null
  const browseTo = movies ? '/movies/browse' : '/manga/browse'
  const [scrolled, setScrolled] = useState(false)
  // Movies home / details open on a dark full-bleed backdrop: keep the bar light-on-dark until it turns into glass
  const overHero = movies && !scrolled && (pathname === '/movies' || /^\/movies\/(movie|tv)\/\d+$/.test(pathname))
  const [hovered, setHovered] = useState<string | null>(null)
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={cn('fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6', overHero && 'dark text-foreground')} data-section={overHero ? 'movies' : undefined}>
      <nav
        aria-label="Main"
        className={cn(
          'mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full border px-3 transition-all duration-300 sm:px-4',
          scrolled ? 'border-border bg-glass shadow-xl shadow-black/10 md:backdrop-blur-xl' : 'border-transparent bg-transparent',
        )}
      >
        <Logo size={34} to="/" />

        {links && (
        <ul className="hidden items-center md:flex" onMouseLeave={() => setHovered(null)}>
          {links.map((l) => (
            <li key={l.to} className="relative" onMouseEnter={() => setHovered(l.to)}>
              {hovered === l.to && (
                <motion.span
                  layoutId="nav-hover"
                  className="absolute inset-0 rounded-full bg-foreground/10"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              {l.to.startsWith('http') ? (
                <a
                  href={l.to}
                  className="relative z-10 block px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  to={l.to}
                  className={cn(
                    'relative z-10 block px-4 py-2 text-sm font-medium transition-colors hover:text-foreground',
                    pathname + (l.to.includes('?') ? search : '') === l.to ? 'text-foreground' : 'text-muted',
                  )}
                >
                  {l.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
        )}

        <div className="flex items-center gap-2">
          {/* Universal Home Button */}
          <Link
            to="/"
            title="Return to Home Hub"
            aria-label="Home"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold backdrop-blur transition hover:bg-card hover:text-accent active:scale-95"
          >
            <House className="size-4 text-accent" />
            <span className="hidden sm:inline">Home</span>
          </Link>

          {!anime && (
            <Link to={`/${section}`} className={cn('items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-sm font-semibold backdrop-blur transition active:scale-95', movies ? 'hidden sm:inline-flex' : 'inline-flex')}>
              <span className="font-display font-semibold text-accent">{section === 'novel' ? 'Novels' : movies ? 'Movies' : section === 'ebooks' ? 'Ebooks' : 'Manga'}</span>
            </Link>
          )}
          {(section === 'manga' || movies) && (
            <Link
              to={browseTo}
              aria-label={movies ? 'Browse movies' : 'Browse manga'}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition active:scale-95 sm:px-4',
                pathname === browseTo ? 'bg-foreground text-background' : 'bg-accent text-accent-fg hover:brightness-110',
              )}
            >
              <Compass className="size-4" />
              <span className="hidden sm:inline">Browse</span>
            </Link>
          )}
          {(anime || movies) && (
            <>
          <button
            type="button"
            onClick={() => openSearch()}
            className="hidden h-9 items-center gap-2 rounded-full border border-border bg-card/60 pl-3 pr-2 text-sm text-muted transition hover:text-foreground sm:flex"
          >
            <Search className="size-4" />
            <span>{movies ? 'Search movies' : 'Search anime'}</span>
            <kbd className="rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium">
              {isMac ? '⌘' : 'Ctrl'} K
            </kbd>
          </button>
          <button
            type="button"
            aria-label="Search"
            onClick={() => openSearch()}
            className="grid size-9 place-items-center rounded-full border border-border bg-card/60 transition active:scale-90 sm:hidden"
          >
            <Search className="size-4" />
          </button>
          {anime && <Link
            to="/app"
            className={cn(
              'hidden h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-95 lg:inline-flex',
              pathname === '/app' ? 'bg-foreground text-background' : 'bg-accent text-accent-fg hover:brightness-110',
            )}
          >
            <Download className="size-4" />
            Get app
          </Link>}
            </>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3 text-xs font-bold text-accent transition hover:bg-accent hover:text-accent-fg active:scale-95',
                pathname === '/admin' && 'bg-accent text-accent-fg'
              )}
              title="Stark Admin Console"
            >
              <ShieldAlert className="size-3.5" />
              <span className="hidden sm:inline">Admin ⎊</span>
            </Link>
          )}
          <ThemeToggle />
          <Link to="/profile" aria-label="Your profile" title={me.name || 'Profile'} className="ml-1 rounded-full transition active:scale-90">
            <Avatar size={34} src={me.avatar} frame={me.frame} name={me.name} />
          </Link>
        </div>
      </nav>
    </header>
  )
}
