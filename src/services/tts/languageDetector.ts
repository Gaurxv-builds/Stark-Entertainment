import type { IndianLanguage, IndianVoiceId } from '../../types/tts'
import { DEFAULT_VOICES_BY_LANGUAGE } from './voices'

export interface DetectionResult {
  language: IndianLanguage
  defaultVoiceId: IndianVoiceId
  confidence: number
  script: 'devanagari' | 'latin' | 'mixed'
  reason: string
}

const SANSKRIT_MARKERS = [
  '॥',
  'उवाच',
  'सर्गः',
  'काण्डम्',
  'काण्डः',
  'इत्यार्षे',
  'श्लोक',
  'नमः',
  'स्वाहा',
  'ऋषि',
  'परिपप्रच्छ',
  'मुनिपुङ्गवम्',
  'धर्मक्षेत्रे',
  'कुरुक्षेत्रे',
  'श्रीमद्',
  'वाल्मीकि',
  'रामायण',
  'महाभारत',
  'उपनिषद्',
]

const HINDI_MARKERS = [
  ' है ',
  ' हैं ',
  ' था ',
  ' थी ',
  ' थे ',
  ' के ',
  ' की ',
  ' को ',
  ' ने ',
  ' से ',
  ' में ',
  ' पर ',
  ' और ',
  ' किया ',
  ' दिया ',
  ' रहा ',
  ' रहे ',
  ' इस ',
  ' उस ',
  ' एक ',
  ' यह ',
  ' वह ',
  'किन्तु',
  'परन्तु',
]

/**
 * Automatically detects the ebook language and picks the default Indian voice.
 * Defaults:
 *   Hindi ebook    -> Hindi (India) — Female
 *   English ebook  -> English (India) — Female
 *   Sanskrit ebook -> Sanskrit (India) — Female
 */
export function detectEbookLanguage(
  sampleText: string,
  metadata?: { language?: string; title?: string }
): DetectionResult {
  const metaLang = (metadata?.language || '').toLowerCase().trim()
  const title = (metadata?.title || '').toLowerCase()

  // 1. Check direct metadata language code if provided
  if (metaLang.startsWith('sa') || metaLang === 'san' || metaLang.includes('sanskrit')) {
    return {
      language: 'sa-IN',
      defaultVoiceId: DEFAULT_VOICES_BY_LANGUAGE['sa-IN'],
      confidence: 0.95,
      script: 'devanagari',
      reason: `Metadata specified Sanskrit language (${metaLang})`,
    }
  }

  if (metaLang.startsWith('hi') || metaLang === 'hin' || metaLang.includes('hindi')) {
    return {
      language: 'hi-IN',
      defaultVoiceId: DEFAULT_VOICES_BY_LANGUAGE['hi-IN'],
      confidence: 0.95,
      script: 'devanagari',
      reason: `Metadata specified Hindi language (${metaLang})`,
    }
  }

  if (metaLang.startsWith('en') || metaLang === 'eng' || metaLang.includes('english')) {
    // Check if title or sample overrides (e.g. Sanskrit book tagged with English description)
    if (!hasStrongDevanagari(sampleText, title)) {
      return {
        language: 'en-IN',
        defaultVoiceId: DEFAULT_VOICES_BY_LANGUAGE['en-IN'],
        confidence: 0.9,
        script: 'latin',
        reason: `Metadata specified English language (${metaLang})`,
      }
    }
  }

  // 2. Inspect text content and script
  const text = (sampleText || '').slice(0, 5000)
  const devanagariMatches = text.match(/[\u0900-\u097F]/g) || []
  const latinMatches = text.match(/[a-zA-Z]/g) || []

  const devanagariCount = devanagariMatches.length
  const latinCount = latinMatches.length

  // Predominantly Latin text -> English (India)
  if (latinCount > devanagariCount * 2 || devanagariCount < 15) {
    // Check if title specifically indicates Sanskrit or Hindi
    if (title.includes('valmiki') || title.includes('ramayan') || title.includes('gita press') || title.includes('sanskrit')) {
      return {
        language: 'sa-IN',
        defaultVoiceId: DEFAULT_VOICES_BY_LANGUAGE['sa-IN'],
        confidence: 0.85,
        script: 'devanagari',
        reason: 'Book title indicates classical Sanskrit work',
      }
    }

    return {
      language: 'en-IN',
      defaultVoiceId: DEFAULT_VOICES_BY_LANGUAGE['en-IN'],
      confidence: 0.88,
      script: 'latin',
      reason: 'Content is predominantly Latin script',
    }
  }

  // Devanagari script: Differentiate Sanskrit vs Hindi
  let sanskritScore = 0
  let hindiScore = 0

  for (const marker of SANSKRIT_MARKERS) {
    if (text.includes(marker)) sanskritScore += 2
  }

  for (const marker of HINDI_MARKERS) {
    if (text.includes(marker)) hindiScore += 1
  }

  // Visargas (ः) and double dandas (॥) are very strong Sanskrit markers
  const visargaCount = (text.match(/ः/g) || []).length
  const doubleDandaCount = (text.match(/॥/g) || []).length

  if (doubleDandaCount > 0) sanskritScore += doubleDandaCount * 3
  if (visargaCount > 2) sanskritScore += visargaCount * 1.5

  if (title.includes('ramayan') || title.includes('valmiki') || title.includes('gita') || title.includes('sanskrit')) {
    sanskritScore += 4
  }

  if (sanskritScore > hindiScore || (doubleDandaCount > 0 && hindiScore < 8)) {
    return {
      language: 'sa-IN',
      defaultVoiceId: DEFAULT_VOICES_BY_LANGUAGE['sa-IN'],
      confidence: 0.92,
      script: 'devanagari',
      reason: `Devanagari script with classical Sanskrit markers (visargas: ${visargaCount}, verses: ${doubleDandaCount})`,
    }
  }

  return {
    language: 'hi-IN',
    defaultVoiceId: DEFAULT_VOICES_BY_LANGUAGE['hi-IN'],
    confidence: 0.85,
    script: 'devanagari',
    reason: 'Devanagari script with modern Hindi linguistic markers',
  }
}

function hasStrongDevanagari(text: string, title: string): boolean {
  if (title.includes('valmiki') || title.includes('ramayan') || title.includes('gita')) return true
  const dev = (text.match(/[\u0900-\u097F]/g) || []).length
  return dev > 50
}
