import type { Track } from '../../types/music'

const IA_SEARCH_URL = 'https://archive.org/advancedsearch.php'

interface IaDoc {
  identifier: string
  title?: string
  creator?: string
  description?: string
  year?: number
}

function cleanTitle(str: string): string {
  return str.replace(/_/g, ' ').replace(/\.mp3$/i, '').trim()
}

/**
 * Search the Internet Archive Open Audio library (Public domain, CC, and live music recordings).
 */
export async function searchArchiveMusic(query: string, limit = 15): Promise<Track[]> {
  const q = query.trim()
  if (!q) return []

  try {
    const solrQuery = `mediatype:audio AND (format:"VBR MP3" OR format:MP3) AND (${q})`
    const url = `${IA_SEARCH_URL}?q=${encodeURIComponent(solrQuery)}&fl[]=identifier,title,creator,description,year&rows=${limit}&output=json`

    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []

    const data = await res.json()
    const docs: IaDoc[] = data.response?.docs || []

    return docs.map((doc) => {
      const id = doc.identifier
      return {
        id: `archive:${id}`,
        title: cleanTitle(doc.title || id),
        artist: doc.creator || 'Archive Contributor',
        album: doc.year ? `Recording (${doc.year})` : 'Public Audio Archive',
        artwork: `https://archive.org/services/img/${id}`,
        duration: 240, // Default estimate; refined when metadata loads
        streamUrl: `https://archive.org/download/${id}/${encodeURIComponent(id)}.mp3`,
        provider: 'archive',
        providerLabel: 'Internet Archive (Open)',
        isPreview: false,
        genre: 'Open Audio',
        permalink: `https://archive.org/details/${id}`,
        raw: { identifier: id },
      }
    })
  } catch (err) {
    console.warn('[ArchiveMusic] Search error:', err)
    return []
  }
}
