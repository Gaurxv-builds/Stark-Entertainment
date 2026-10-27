import { Link } from 'react-router-dom'
import { Pencil, Cloud, Settings } from 'lucide-react'
import { useProfile } from '../lib/profile'
import { useStarkAuth } from '../lib/starkAuth'
import { Avatar } from './Avatar'
import { cn } from '../lib/utils'

interface ProfileCardProps {
  className?: string
  compact?: boolean
}

/**
 * Rich profile strip displaying the authenticated user's avatar, banner,
 * display name, username, and security status.
 */
export function ProfileCard({ className, compact = false }: ProfileCardProps) {
  const me = useProfile()
  const { user: authUser, isAdmin, isCloudSynced } = useStarkAuth()

  const displayName = me.name?.trim() || authUser?.trim() || 'User'
  const username = me.username || authUser || ''

  return (
    <section className={cn('mx-auto w-full max-w-7xl px-3 sm:px-6', className)} aria-label="User Profile">
      <Link
        to="/profile"
        title="View and edit profile"
        className="group relative flex items-center justify-between gap-3 sm:gap-4 overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-card/60 p-3 sm:p-5 shadow-lg backdrop-blur-xl transition-all duration-300 hover:border-accent/40 hover:bg-card/80 hover:shadow-xl hover:shadow-accent/5 active:scale-[0.99]"
      >
        {/* Banner Artwork with Scrim */}
        {me.banner ? (
          <img
            src={me.banner}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-accent/10 via-purple-900/10 to-transparent" />
        )}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/30" />

        {/* Left: Avatar + Details */}
        <div className="relative z-10 flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="relative shrink-0">
            <Avatar
              size={compact ? 44 : 56}
              src={me.avatar}
              frame={me.frame}
              name={displayName}
              className="shadow-md"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h3 className="truncate font-display text-base font-bold text-foreground sm:text-xl">
                {displayName}
              </h3>

              {isAdmin && (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                  Admin ⎊
                </span>
              )}

              {isCloudSynced && (
                <span className="hidden items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 sm:inline-flex">
                  <Cloud className="size-2.5" />
                  Synced
                </span>
              )}
            </div>

            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              {username && (
                <span className="font-mono text-foreground/80">
                  @{username}
                </span>
              )}
              <span className="hidden sm:inline">•</span>
              <span className="hidden truncate text-muted sm:inline">
                Profile, Frame & Preferences
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Edit / Customize Pill */}
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          <span className="hidden rounded-full border border-border bg-background/50 px-3 py-1.5 text-xs font-semibold text-muted backdrop-blur transition group-hover:border-accent group-hover:text-foreground md:inline-flex items-center gap-1.5">
            <Settings className="size-3.5" />
            <span>Customize</span>
          </span>

          <span
            aria-label="Edit Profile"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card/80 text-muted shadow-sm backdrop-blur transition group-hover:border-accent group-hover:bg-accent group-hover:text-accent-fg sm:size-10"
          >
            <Pencil className="size-4" />
          </span>
        </div>
      </Link>
    </section>
  )
}
