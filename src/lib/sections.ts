export type Section = 'anime' | 'novel' | 'manga' | 'movies' | 'ebooks' | 'music'

export const SECTIONS: { id: Section; label: string; to: string }[] = [
  { id: 'anime', label: 'Anime', to: '/anime' },
  { id: 'novel', label: 'Novels', to: '/novel' },
  { id: 'manga', label: 'Manga', to: '/manga' },
  { id: 'movies', label: 'Movies', to: '/movies' },
  { id: 'ebooks', label: 'Ebooks', to: '/ebooks' },
  { id: 'music', label: 'Music', to: '/music' },
]

/** Which part of the site a pathname belongs to (null on opening page, profile, admin, or non-media pages). */
export function sectionOf(pathname: string): Section | null {
  if (
    !pathname ||
    pathname === '/' ||
    pathname === '/home' ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth')
  ) {
    return null
  }
  if (pathname.startsWith('/novel')) return 'novel'
  if (pathname.startsWith('/manga')) return 'manga'
  if (pathname.startsWith('/movies')) return 'movies'
  if (pathname.startsWith('/ebooks')) return 'ebooks'
  if (pathname.startsWith('/music')) return 'music'
  if (
    pathname === '/anime' ||
    pathname.startsWith('/anime/') ||
    pathname === '/trending' ||
    pathname === '/popular' ||
    pathname === '/top' ||
    pathname === '/browse' ||
    pathname === '/list' ||
    pathname === '/schedule' ||
    pathname.startsWith('/watch/') ||
    pathname.startsWith('/mal/')
  ) {
    return 'anime'
  }
  return null
}

/** Full-screen readers hide the site chrome. */
export const isReaderPath = (pathname: string) =>
  /^\/(novel|manga)\/[^/]+(\/[^/]+)?\/read\//.test(pathname) || /^\/ebooks\/read\//.test(pathname)

/** The anime watch page is a full-bleed player: no navbar, dock or footer. */
export const isWatchPath = (pathname: string) => /^\/watch\/\d+/.test(pathname)

/** Details pages drop the navbar and keep their own Back button. */
export const isDetailsPath = (pathname: string) =>
  /^\/(anime|mal)\/[^/]+\/?$|^\/manga\/(?!browse$|find$)[^/]+\/?$|^\/novel\/(?!find$)[^/]+\/[^/]+\/?$|^\/movies\/(movie|tv)\/[^/]+\/?$/.test(pathname)

/** Any full-screen player or reader. Details pages must never "go back" into one of these. */
export const isPlayerPath = (pathname: string) => isReaderPath(pathname) || isWatchPath(pathname) || /^\/movies\/watch\//.test(pathname)
