/**
 * Sanskrit Classical Phonetics Engine
 *
 * Generic Hindi TTS drops terminal short vowels (schwa deletion) and mishandles
 * visarga (ः) and sandhi transitions. This processor prepares Sanskrit text
 * so that Indian acoustic models speak classical pronunciation accurately.
 */

/**
 * Phonetically optimizes Sanskrit Devanagari text for classical recitation.
 */
export function prepareSanskritPhonetics(text: string): string {
  if (!text) return ''

  let processed = text

  // 1. Visarga (ः) pronunciation according to preceding vowel
  // i-ending: हरिः -> हरिहि
  processed = processed.replace(/([िी])ः/g, '$1हि')
  // u-ending: गुरुः -> गुरुहु
  processed = processed.replace(/([ुू])ः/g, '$1हु')
  // e-ending: देवेः -> देवेहे
  processed = processed.replace(/(े)ः/g, '$1हे')
  // o-ending: भोः -> भोहो
  processed = processed.replace(/(ो)ः/g, '$1हो')
  // Default a-ending: नमः -> नमह, रामः -> रामह
  processed = processed.replace(/([क-ह])ः/g, '$1ह')
  // Standalone visarga
  processed = processed.replace(/ः/g, 'ह')

  // 2. Avagraha (ऽ) -> elongated vowel glide
  processed = processed.replace(/ऽ/g, 'अ')

  // 3. Shloka danda & double danda cadence markers
  // Double danda ॥ marks end of full shloka/verse
  processed = processed.replace(/॥/g, ' । ')

  // 4. Clean up any OCR anomalies or replacement characters
  processed = processed.replace(/\uFFFD/g, '')

  return processed.trim()
}

/**
 * Calculates appropriate silence/pause duration after a chunk based on punctuation.
 */
export function getPauseDurationMs(chunkText: string): number {
  if (chunkText.includes('॥')) return 700 // Full verse end
  if (chunkText.includes('।')) return 400 // Half verse / sentence end
  if (/[.?!]$/.test(chunkText.trim())) return 450 // Sentence end
  if (/[,;:]$/.test(chunkText.trim())) return 250 // Clause pause
  return 200
}
