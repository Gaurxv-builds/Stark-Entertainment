import { useEffect, useState } from 'react'
import { DEFAULT_SHOWCASE, fetchShowcase, type ShowcaseImage, type ShowcasePools } from '../services/showcase'

/** Artwork pools for the rotating images. Defaults to curated art immediately, updated when live feeds arrive. */
export function useShowcase(): ShowcasePools {
  const [pools, setPools] = useState<ShowcasePools>(DEFAULT_SHOWCASE)
  useEffect(() => {
    let live = true
    fetchShowcase().then((p) => live && setPools(p))
    return () => {
      live = false
    }
  }, [])
  return pools
}

/** True below the Tailwind `lg` breakpoint; used to pick landscape banners for the full-width mobile cards. */
export function useCompact(query = '(max-width: 1023px)'): boolean {
  const [on, setOn] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches))
  useEffect(() => {
    const mq = window.matchMedia(query)
    const fn = () => setOn(mq.matches)
    mq.addEventListener('change', fn)
    fn()
    return () => mq.removeEventListener('change', fn)
  }, [query])
  return on
}

export type { ShowcaseImage, ShowcasePools }
