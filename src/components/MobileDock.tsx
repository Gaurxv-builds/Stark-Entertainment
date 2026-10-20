import { Link, useLocation } from 'react-router-dom'
import { Bookmark, CalendarDays, Clapperboard, Compass, House, Search, Star, Tv, type LucideIcon } from 'lucide-react'
import { useSearch } from '../context/SearchContext'
import { sectionOf } from '../lib/sections'
import { cn } from '../lib/utils'

const items: { label: string; to: string; icon: LucideIcon }[] = [
  { label: 'Home', to: '/', icon: House },
  { label: 'My List', to: '/list', icon: Bookmark },
  { label: 'Schedule', to: '/schedule', icon: CalendarDays },
  { label: 'Browse', to: '/browse', icon: Compass },
]

const movieItems: { label: string; to: string; icon: LucideIcon }[] = [
  { label: 'Home', to: '/', icon: House },
  { label: 'Movies', to: '/movies/browse?type=movie', icon: Clapperboard },
  { label: 'TV Shows', to: '/movies/browse?type=tv', icon: Tv },
  { label: 'Top Rated', to: '/movies/browse?sort=vote_average.desc', icon: Star },
]

/** Bottom tab bar shown on phones only — thumb-friendly navigation. */
export function MobileDock() {
  const { openSearch } = useSearch()
  const { pathname, search } = useLocation()
  const section = sectionOf(pathname)
  if (section !== 'anime' && section !== 'movies') return null // Novels and Manga are separate places with their own chrome
  const list = section === 'movies' ? movieItems : items

  const render = (it: (typeof items)[number]) => {
    const active = section === 'movies' ? pathname + search === it.to : pathname === it.to
    const Icon = it.icon
    return (
      <li key={it.label}>
        <Link
          to={it.to}
          className={cn(
            'flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5 text-[10px] font-medium transition active:scale-90',
            active ? 'text-foreground' : 'text-muted',
          )}
        >
          <Icon className={cn('size-5 transition-transform', active && 'scale-110')} />
          {it.label}
        </Link>
      </li>
    )
  }

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-3 bottom-3 z-50 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-center justify-between rounded-full border border-border bg-card/95 px-3 py-1.5 shadow-2xl shadow-black/20">
        {list.slice(0, 2).map(render)}
        <li>
          <button
            type="button"
            aria-label="Search"
            onClick={() => openSearch()}
            className="-mt-7 grid size-14 place-items-center rounded-full bg-foreground text-background shadow-xl shadow-black/30 transition active:scale-90"
          >
            <Search className="size-6" />
          </button>
        </li>
        {list.slice(2).map(render)}
      </ul>
    </nav>
  )
}
