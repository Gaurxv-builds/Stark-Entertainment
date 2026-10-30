import { Link, useLocation } from 'react-router-dom'
import { House, LogOut, ShieldAlert } from 'lucide-react'
import { cn } from '../lib/utils'
import { ThemeToggle } from './ThemeToggle'
import { Avatar } from './Avatar'
import { useStarkAuth } from '../lib/starkAuth'
import { useProfile } from '../lib/profile'

export interface NavbarActionsProps {
  className?: string
  showHome?: boolean
}

/**
 * Reusable, unified navigation actions used across all sections
 * (Home, Anime, Movies, Manga, Novels, Ebooks, Music).
 *
 * Enforces strictly consistent ordering, sizing, and styling:
 * 1. Home
 * 2. Admin (administrators only)
 * 3. Theme toggle
 * 4. Logout
 * 5. Profile/avatar
 */
export function NavbarActions({ className, showHome = true }: NavbarActionsProps) {
  const { pathname } = useLocation()
  const { isAdmin, logout, user } = useStarkAuth()
  const me = useProfile()
  const displayName = me.name?.trim() || user?.trim() || 'Operator'

  return (
    <div className={cn('flex items-center gap-1.5 sm:gap-2 shrink-0', className)}>
      {/* 1. Home */}
      {showHome && (
        <Link
          to="/"
          title="Return to Universe Hub"
          aria-label="Home"
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 text-xs font-semibold backdrop-blur transition hover:border-accent/40 hover:bg-card hover:text-accent active:scale-95 shrink-0',
            (pathname === '/' || pathname === '/home') && 'border-accent/50 bg-accent/10 text-accent font-bold'
          )}
        >
          <House className="size-3.5 text-accent" />
          <span className="hidden sm:inline">Home</span>
        </Link>
      )}

      {/* 2. Admin — administrators only */}
      {isAdmin && (
        <Link
          to="/admin"
          title="Stark Admin Console"
          aria-label="Admin"
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3 text-xs font-bold text-accent transition hover:bg-accent hover:text-accent-fg active:scale-95 shrink-0',
            pathname === '/admin' && 'bg-accent text-accent-fg shadow-sm'
          )}
        >
          <ShieldAlert className="size-3.5" />
          <span className="hidden sm:inline">Admin ⎊</span>
        </Link>
      )}

      {/* 3. Theme toggle */}
      <div className="shrink-0">
        <ThemeToggle />
      </div>

      {/* 4. Logout */}
      <button
        type="button"
        onClick={() => logout()}
        title="Log out of Gaurxv Verse"
        aria-label="Logout"
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 text-xs font-semibold text-red-400 backdrop-blur transition hover:bg-red-500/20 hover:text-red-300 active:scale-95 shrink-0"
      >
        <LogOut className="size-3.5" />
        <span className="hidden sm:inline">Logout</span>
      </button>

      {/* 5. Profile / Avatar */}
      <Link
        to="/profile"
        aria-label="Your profile"
        title={`Profile (${displayName})`}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-full border border-border/80 bg-card/60 p-0.5 pr-2.5 text-xs font-semibold backdrop-blur transition hover:border-accent/40 hover:bg-card hover:text-accent active:scale-95 shrink-0',
          pathname === '/profile' && 'border-accent text-accent'
        )}
      >
        <Avatar size={28} src={me.avatar} frame={me.frame} name={displayName} />
        <span className="hidden md:inline font-medium text-foreground max-w-[85px] truncate">
          {displayName}
        </span>
      </Link>
    </div>
  )
}
