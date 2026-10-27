import type { IndianLanguage, IndianVoiceId, VoiceOption } from '../../types/tts'

/**
 * Strict Voice Registry: ONLY these six Indian voice options.
 * No US English, UK English, or non-Indian options allowed.
 */
export const INDIAN_VOICES: readonly VoiceOption[] = [
  // 1. Hindi (India)
  {
    id: 'hi-IN-female',
    languageCode: 'hi-IN',
    languageGroup: 'Hindi (India)',
    gender: 'female',
    label: 'Hindi (India) — Female',
    sublabel: 'Swara / Devanagari Natural',
  },
  {
    id: 'hi-IN-male',
    languageCode: 'hi-IN',
    languageGroup: 'Hindi (India)',
    gender: 'male',
    label: 'Hindi (India) — Male',
    sublabel: 'Madhur / Devanagari Natural',
  },

  // 2. English (India)
  {
    id: 'en-IN-female',
    languageCode: 'en-IN',
    languageGroup: 'English (India)',
    gender: 'female',
    label: 'English (India) — Female',
    sublabel: 'Neerja / Indian English Phonetics',
  },
  {
    id: 'en-IN-male',
    languageCode: 'en-IN',
    languageGroup: 'English (India)',
    gender: 'male',
    label: 'English (India) — Male',
    sublabel: 'Prabhat / Indian English Phonetics',
  },

  // 3. Sanskrit (India)
  {
    id: 'sa-IN-female',
    languageCode: 'sa-IN',
    languageGroup: 'Sanskrit (India)',
    gender: 'female',
    label: 'Sanskrit (India) — Female',
    sublabel: 'Classical Sanskrit, Chanda & Sandhi',
  },
  {
    id: 'sa-IN-male',
    languageCode: 'sa-IN',
    languageGroup: 'Sanskrit (India)',
    gender: 'male',
    label: 'Sanskrit (India) — Male',
    sublabel: 'Classical Sanskrit, Chanda & Sandhi',
  },
] as const

export const DEFAULT_VOICES_BY_LANGUAGE: Record<IndianLanguage, IndianVoiceId> = {
  'hi-IN': 'hi-IN-female',
  'en-IN': 'en-IN-female',
  'sa-IN': 'sa-IN-female',
}

/**
 * Validate that an ID is strictly one of the 6 allowed Indian voices.
 */
export function isValidIndianVoiceId(id: string): id is IndianVoiceId {
  return INDIAN_VOICES.some((v) => v.id === id)
}

/**
 * Normalizes BCP-47 language tag into our supported Indian languages.
 */
export function normalizeIndianLanguage(langTag: string): IndianLanguage | null {
  const t = (langTag || '').toLowerCase().replace(/_/g, '-').trim()
  if (t === 'sa' || t.startsWith('sa-') || t === 'san' || t.includes('sanskrit')) return 'sa-IN'
  if (t === 'hi' || t.startsWith('hi-') || t === 'hin' || t.includes('hindi')) return 'hi-IN'
  if (t === 'en-in' || t === 'en-india') return 'en-IN'
  return null
}

export interface MatchedVoiceResult {
  voice: SpeechSynthesisVoice | null
  providerType: 'native' | 'classical_phonetic'
  pitchModulation: number
  rateModulation: number
}

/**
 * Matches one of the 6 canonical Indian voice options to a browser SpeechSynthesisVoice.
 * Strictly ignores and rejects all US, UK, and foreign voices.
 */
export function resolveBrowserVoice(
  voiceId: IndianVoiceId,
  availableVoices: SpeechSynthesisVoice[]
): MatchedVoiceResult {
  const target = INDIAN_VOICES.find((v) => v.id === voiceId)
  if (!target) {
    return { voice: null, providerType: 'classical_phonetic', pitchModulation: 1.0, rateModulation: 1.0 }
  }

  const isFemale = target.gender === 'female'
  const isMale = target.gender === 'male'

  // Filter voices: STRICTLY Indian voices only
  const hindiVoices = availableVoices.filter((v) => {
    const l = v.lang.toLowerCase().replace(/_/g, '-')
    return l === 'hi' || l.startsWith('hi-')
  })

  const indianEnglishVoices = availableVoices.filter((v) => {
    const l = v.lang.toLowerCase().replace(/_/g, '-')
    // Strictly must be en-in, foreign accents are rejected
    return l === 'en-in' || (l.startsWith('en-') && v.name.toLowerCase().includes('india'))
  })

  const sanskritVoices = availableVoices.filter((v) => {
    const l = v.lang.toLowerCase().replace(/_/g, '-')
    return l === 'sa' || l.startsWith('sa-') || l === 'san' || v.name.toLowerCase().includes('sanskrit')
  })

  // 1. Sanskrit voices
  if (target.languageCode === 'sa-IN') {
    if (sanskritVoices.length > 0) {
      const match = sanskritVoices.find((v) => {
        const n = v.name.toLowerCase()
        return isFemale ? n.includes('female') || n.includes('woman') : n.includes('male') || n.includes('man')
      }) || sanskritVoices[0]

      return {
        voice: match,
        providerType: 'native',
        pitchModulation: isMale ? 0.9 : 1.05,
        rateModulation: 0.92, // Classical Sanskrit deliberate meter
      }
    }

    // Classical Sanskrit recitation engine running on Devanagari phonetics with Indian acoustic model
    const baseVoice = (isFemale
      ? hindiVoices.find((v) => isLikelyFemale(v.name)) || hindiVoices[0]
      : hindiVoices.find((v) => isLikelyMale(v.name)) || hindiVoices[0]) || null

    return {
      voice: baseVoice,
      providerType: 'classical_phonetic',
      pitchModulation: isMale ? 0.84 : 1.08,
      rateModulation: 0.88, // Metered cadence for shlokas
    }
  }

  // 2. Hindi voices
  if (target.languageCode === 'hi-IN') {
    if (hindiVoices.length > 0) {
      const match = hindiVoices.find((v) => {
        const n = v.name.toLowerCase()
        return isFemale ? isLikelyFemale(n) : isLikelyMale(n)
      }) || hindiVoices[0]

      return {
        voice: match,
        providerType: 'native',
        pitchModulation: isMale ? 0.86 : 1.02,
        rateModulation: 1.0,
      }
    }

    return { voice: null, providerType: 'classical_phonetic', pitchModulation: 1.0, rateModulation: 1.0 }
  }

  // 3. Indian English voices
  if (target.languageCode === 'en-IN') {
    if (indianEnglishVoices.length > 0) {
      const match = indianEnglishVoices.find((v) => {
        const n = v.name.toLowerCase()
        return isFemale ? isLikelyFemale(n) : isLikelyMale(n)
      }) || indianEnglishVoices[0]

      return {
        voice: match,
        providerType: 'native',
        pitchModulation: isMale ? 0.88 : 1.04,
        rateModulation: 1.0,
      }
    }

    return { voice: null, providerType: 'classical_phonetic', pitchModulation: 1.0, rateModulation: 1.0 }
  }

  return { voice: null, providerType: 'classical_phonetic', pitchModulation: 1.0, rateModulation: 1.0 }
}

function isLikelyFemale(name: string): boolean {
  const n = name.toLowerCase()
  return (
    n.includes('swara') ||
    n.includes('kalpana') ||
    n.includes('lekha') ||
    n.includes('neerja') ||
    n.includes('heera') ||
    n.includes('veena') ||
    n.includes('female') ||
    n.includes('woman') ||
    n.includes('zira')
  )
}

function isLikelyMale(name: string): boolean {
  const n = name.toLowerCase()
  return (
    n.includes('madhur') ||
    n.includes('hemant') ||
    n.includes('prabhat') ||
    n.includes('ravi') ||
    n.includes('rishi') ||
    n.includes('male') ||
    n.includes('man') ||
    n.includes('david')
  )
}
