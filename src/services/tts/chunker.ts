import type { TtsChunk } from '../../types/tts'

/**
 * Splits text into readable chunks respecting Devanagari verse punctuation (।, ॥)
 * and sentence boundaries (. ? !) without breaking words, ligatures, or conjuncts.
 */
export function chunkTextForSpeech(
  content: string | string[],
  options: { maxChunkChars?: number } = {}
): TtsChunk[] {
  const maxChars = options.maxChunkChars || 220
  const paragraphs: string[] = Array.isArray(content)
    ? content
    : content.split(/\r?\n\r?\n|\n{2,}/)

  const chunks: TtsChunk[] = []
  let globalIndex = 0

  paragraphs.forEach((para, pIdx) => {
    const trimmedPara = (para || '').trim()
    if (!trimmedPara) return

    // Skip Markdown heading markers at start of paragraph if present
    const cleanPara = trimmedPara.replace(/^#{1,6}\s+/, '')

    // Split on sentence and verse boundaries:
    // Devanagari danda (।), double danda (॥), period (.), exclamation (!), question (?), newline (\n)
    const rawSegments = cleanPara
      .split(/(?<=[।॥.?!;:\n])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    for (const segment of rawSegments) {
      if (segment.length <= maxChars) {
        chunks.push({
          index: globalIndex++,
          text: segment,
          paragraphIndex: pIdx,
          isVerseEnding: segment.includes('॥') || segment.includes('।'),
        })
      } else {
        // If segment is very long (run-on passage), safely split on phrase boundary (comma, semicolon, or whitespace)
        // without breaking conjunct characters or words
        const subSegments = splitLongPassage(segment, maxChars)
        for (const sub of subSegments) {
          chunks.push({
            index: globalIndex++,
            text: sub,
            paragraphIndex: pIdx,
            isVerseEnding: sub.includes('॥') || sub.includes('।'),
          })
        }
      }
    }
  })

  return chunks
}

/**
 * Splits a long passage without cutting into Devanagari ligatures (virama + consonant) or words.
 */
function splitLongPassage(text: string, maxLen: number): string[] {
  const words = text.split(/\s+/)
  const result: string[] = []
  let current = ''

  for (const word of words) {
    if (!word) continue
    if ((current + ' ' + word).trim().length <= maxLen) {
      current = current ? `${current} ${word}` : word
    } else {
      if (current) result.push(current)
      current = word
    }
  }

  if (current) result.push(current)
  return result
}
