import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Compass, Download, Search } from 'lucide-react'
import { MOVIE_LINKS, NAV_LINKS } from '../lib/constants'
import { sectionOf } from '../lib/sections'
import { cn } from '../lib/utils'
import { useSearch } from '../context/SearchContext'
import { Logo } from './Logo'
import { NavbarActions } from './NavbarActions'

/** Floating glass navbar with unified button design system across all navigation links & actions */
export function Navbar() {
  const { openSearch } = useSearch()
  const { pathname, search } = useLocation()
  const section = sectionOf(pathname)
  const anime = section === 'anime'
  const movies = section === 'movies'
  const links = anime ? NAV_LINKS : movies ? MOVIE_LINKS : null
  const browseTo = movies ? '/movies/browse' : '/manga/browse'
  const [scrolled, setScrolled] = useState(false)
  // Movies home / details open on a dark full-bleed backdrop: keep the bar light-on-dark until it turns into glass
  const overHero = movies && !scrolled && (pathname === '/movies' || /^\/movies\/(movie|tv)\/\d+$/.test(pathname))
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
        <Logo size={34} to="/" className="shrink-0" />

        {links && (
          <ul className="hidden items-center gap-1 sm:gap-1.5 md:flex shrink-0">
            {links.map((l) => {
              const currentPath = pathname + (l.to.includes('?') ? search : '')
              const isActive =
                currentPath === l.to ||
                (l.to === '/anime' && (pathname === '/anime' || pathname === '/anime/')) ||
                (l.to !== '/' && l.to !== '/anime' && !l.to.includes('?') && pathname.startsWith(l.to))

              const linkClasses = cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 sm:px-3 text-xs font-semibold backdrop-blur transition active:scale-95 shrink-0 whitespace-nowrap',
                isActive
                  ? 'border-accent/50 bg-accent/10 text-accent font-bold shadow-xs'
                  : 'border-border bg-card/60 text-muted-foreground hover:border-accent/40 hover:bg-card hover:text-accent'
              )

              return (
                <li key={l.to} className="shrink-0">
                  {l.to.startsWith('http') ? (
                    <a
                      href={l.to}
                      className={linkClasses}
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link
                      to={l.to}
                      className={linkClasses}
                    >
                      {l.label}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {Boolean(section && section !== 'anime' && section !== 'movies') && (
            <Link
              to={`/${section}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 text-xs font-semibold backdrop-blur transition hover:border-accent/40 hover:bg-card hover:text-accent active:scale-95 shrink-0 whitespace-nowrap"
            >
              <span className="font-display font-semibold text-accent">
                {section === 'novel' ? 'Novels' : section === 'ebooks' ? 'Ebooks' : section === 'music' ? 'Music' : 'Manga'}
              </span>
            </Link>
          )}
          {(section === 'manga' || movies) && (
            <Link
              to={browseTo}
              aria-label={movies ? 'Browse movies' : 'Browse manga'}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold backdrop-blur transition active:scale-95 shrink-0 whitespace-nowrap',
                pathname === browseTo
                  ? 'border-accent/50 bg-accent/10 text-accent font-bold shadow-xs'
                  : 'border-border bg-card/60 text-muted-foreground hover:border-accent/40 hover:bg-card hover:text-accent'
              )}
            >
              <Compass className="size-3.5 text-accent" />
              <span className="hidden sm:inline">Browse</span>
            </Link>
          )}
          {(anime || movies) && (
            <>
              <button
                type="button"
                onClick={() => openSearch()}
                aria-label={movies ? 'Search movies' : 'Search anime'}
                className="hidden h-9 items-center gap-2 rounded-full border border-border bg-card/60 px-3 text-xs font-semibold text-muted-foreground backdrop-blur transition hover:border-accent/40 hover:bg-card hover:text-accent active:scale-95 sm:inline-flex shrink-0 whitespace-nowrap"
              >
                <Search className="size-3.5 text-accent" />
                <span>{movies ? 'Search movies' : 'Search anime'}</span>
                <kbd className="rounded-md border border-border/80 bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {isMac ? '⌘' : 'Ctrl'} K
                </kbd>
              </button>
              <button
                type="button"
                aria-label="Search"
                onClick={() => openSearch()}
                className="grid size-9 place-items-center rounded-full border border-border bg-card/60 text-muted-foreground backdrop-blur transition hover:border-accent/40 hover:bg-card hover:text-accent active:scale-90 sm:hidden shrink-0"
              >
                <Search className="size-3.5 text-accent" />
              </button>
              {anime && (
                <Link
                  to="/app"
                  title="Get Desktop & Mobile App"
                  aria-label="Get app"
                  className={cn(
                    'hidden h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold backdrop-blur transition active:scale-95 shrink-0 whitespace-nowrap xl:inline-flex',
                    pathname === '/app'
                      ? 'border-accent/50 bg-accent/10 text-accent font-bold shadow-xs'
                      : 'border-border bg-card/60 text-muted-foreground hover:border-accent/40 hover:bg-card hover:text-accent'
                  )}
                >
                  <Download className="size-3.5 text-accent" />
                  <span>Get app</span>
                </Link>
              )}
            </>
          )}

          {/* Consistent Common Action Group: Home → Admin → Theme → Logout → Profile */}
          <NavbarActions />
        </div>
      </nav>
    </header>
  )
}
