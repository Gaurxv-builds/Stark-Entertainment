export type IndianLanguage = 'hi-IN' | 'en-IN' | 'sa-IN'

export type IndianVoiceId =
  | 'hi-IN-female'
  | 'hi-IN-male'
  | 'en-IN-female'
  | 'en-IN-male'
  | 'sa-IN-female'
  | 'sa-IN-male'

export interface VoiceOption {
  id: IndianVoiceId
  languageCode: IndianLanguage
  languageGroup: 'Hindi (India)' | 'English (India)' | 'Sanskrit (India)'
  gender: 'female' | 'male'
  label: string
  sublabel: string
}

export type TtsPlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped'

export type TtsSpeed = 0.75 | 1.0 | 1.25 | 1.5

export interface TtsChunk {
  index: number
  text: string
  phoneticText?: string
  paragraphIndex?: number
  isVerseEnding?: boolean
}

export interface TtsStatus {
  state: TtsPlaybackState
  currentVoiceId: IndianVoiceId
  currentLanguage: IndianLanguage
  speed: TtsSpeed
  currentChunkIndex: number
  totalChunks: number
  currentText: string
  activeVoiceAvailable: boolean
  providerType: 'native' | 'classical_phonetic' | 'cloud'
}
