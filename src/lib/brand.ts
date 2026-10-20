/** User-facing product identity. Do not use these for storage keys, API headers, or package names. */
export const BRAND_NAME = 'Gaurxv Verse'
export const BRAND_SYMBOL = '⎊'
export const BRAND_MARK = 'Gaurxv Verse ⎊'
export const BRAND_TAGLINE = 'Your Digital Universe'

export const pageTitle = (page?: string) => (page ? `${page} — ${BRAND_NAME}` : BRAND_MARK)
