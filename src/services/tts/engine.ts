import type {
  IndianLanguage,
  IndianVoiceId,
  TtsChunk,
  TtsPlaybackState,
  TtsSpeed,
  TtsStatus,
} from '../../types/tts'
import { getPauseDurationMs, prepareSanskritPhonetics } from './phonetics'
import {
  DEFAULT_VOICES_BY_LANGUAGE,
  INDIAN_VOICES,
  resolveBrowserVoice,
} from './voices'

export interface TtsEngineOptions {
  onChunkChange?: (chunk: TtsChunk | null, index: number, total: number) => void
  onStatusChange?: (status: TtsStatus) => void
  onSequenceComplete?: () => void
}

export class TtsEngine {
  private chunks: TtsChunk[] = []
  private currentIndex: number = 0
  private state: TtsPlaybackState = 'idle'
  private currentVoiceId: IndianVoiceId = 'hi-IN-female'
  private speed: TtsSpeed = 1.0
  private options: TtsEngineOptions
  private pauseTimer: number | null = null
  private voices: SpeechSynthesisVoice[] = []
  private activeUtterance: SpeechSynthesisUtterance | null = null
  private isDestroyed: boolean = false

  constructor(options: TtsEngineOptions = {}) {
    this.options = options
    this.initVoices()
  }

  private initVoices(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    const load = () => {
      this.voices = window.speechSynthesis.getVoices()
      this.emitStatus()
    }

    load()
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = load
    }
  }

  public setChunks(chunks: TtsChunk[], startIndex: number = 0): void {
    const wasPlaying = this.state === 'playing'
    this.stop()
    this.chunks = chunks
    this.currentIndex = Math.max(0, Math.min(startIndex, Math.max(0, chunks.length - 1)))
    this.emitStatus()
    if (wasPlaying && chunks.length > 0) {
      this.play()
    }
  }

  public setVoice(voiceId: IndianVoiceId): void {
    if (this.currentVoiceId === voiceId) return
    const wasPlaying = this.state === 'playing'
    this.currentVoiceId = voiceId
    if (wasPlaying) {
      this.pause()
      this.speakCurrentChunk()
    } else {
      this.emitStatus()
    }
  }

  public setSpeed(speed: TtsSpeed): void {
    if (this.speed === speed) return
    this.speed = speed
    if (this.state === 'playing') {
      this.pause()
      this.speakCurrentChunk()
    } else {
      this.emitStatus()
    }
  }

  public setDefaultVoiceForLanguage(lang: IndianLanguage): void {
    const defaultVoice = DEFAULT_VOICES_BY_LANGUAGE[lang]
    if (defaultVoice && this.currentVoiceId !== defaultVoice) {
      this.setVoice(defaultVoice)
    }
  }

  public play(): void {
    if (this.chunks.length === 0) return
    if (this.state === 'paused') {
      this.resume()
      return
    }

    this.state = 'playing'
    this.emitStatus()
    this.speakCurrentChunk()
  }

  public pause(): void {
    if (this.pauseTimer) {
      window.clearTimeout(this.pauseTimer)
      this.pauseTimer = null
    }

    this.activeUtterance = null

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    this.state = 'paused'
    this.emitStatus()
  }

  public resume(): void {
    if (this.chunks.length === 0) return
    this.state = 'playing'
    this.emitStatus()
    this.speakCurrentChunk()
  }

  public stop(): void {
    if (this.pauseTimer) {
      window.clearTimeout(this.pauseTimer)
      this.pauseTimer = null
    }

    this.activeUtterance = null

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    this.state = 'stopped'
    this.emitStatus()
    this.options.onChunkChange?.(null, this.currentIndex, this.chunks.length)
  }

  public seekChunk(index: number): void {
    const safeIdx = Math.max(0, Math.min(index, this.chunks.length - 1))
    this.currentIndex = safeIdx
    if (this.state === 'playing') {
      if (this.pauseTimer) window.clearTimeout(this.pauseTimer)
      if (window.speechSynthesis) window.speechSynthesis.cancel()
      this.speakCurrentChunk()
    } else {
      const chunk = this.chunks[safeIdx] || null
      this.options.onChunkChange?.(chunk, safeIdx, this.chunks.length)
      this.emitStatus()
    }
  }

  private speakCurrentChunk(): void {
    if (this.isDestroyed || this.state !== 'playing') return
    if (this.currentIndex >= this.chunks.length) {
      this.state = 'idle'
      this.emitStatus()
      this.options.onSequenceComplete?.()
      return
    }

    const chunk = this.chunks[this.currentIndex]
    if (!chunk || !chunk.text.trim()) {
      this.advanceToNextChunk()
      return
    }

    this.options.onChunkChange?.(chunk, this.currentIndex, this.chunks.length)

    const voiceMeta = INDIAN_VOICES.find((v) => v.id === this.currentVoiceId)
    const isSanskrit = voiceMeta?.languageCode === 'sa-IN'

    // Format text: Sanskrit phonetics or direct text
    const textToSpeak = isSanskrit
      ? prepareSanskritPhonetics(chunk.text)
      : chunk.text

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('SpeechSynthesis is unavailable in this environment')
      this.state = 'idle'
      this.emitStatus()
      return
    }

    // Cancel any stale utterance
    window.speechSynthesis.cancel()

    const resolved = resolveBrowserVoice(this.currentVoiceId, this.voices)
    const utterance = new SpeechSynthesisUtterance(textToSpeak)

    if (resolved.voice) {
      utterance.voice = resolved.voice
      utterance.lang = resolved.voice.lang
    } else {
      utterance.lang = voiceMeta?.languageCode || 'hi-IN'
    }

    utterance.pitch = Math.max(0.5, Math.min(2.0, resolved.pitchModulation))
    utterance.rate = Math.max(0.5, Math.min(2.0, this.speed * resolved.rateModulation))

    utterance.onend = () => {
      if (this.isDestroyed || this.state !== 'playing') return
      const pauseDuration = getPauseDurationMs(chunk.text)
      this.pauseTimer = window.setTimeout(() => {
        this.advanceToNextChunk()
      }, pauseDuration / this.speed)
    }

    utterance.onerror = (e) => {
      if (e.error === 'canceled' || e.error === 'interrupted') return
      console.warn('Speech synthesis utterance error:', e)
      if (this.state === 'playing') {
        this.advanceToNextChunk()
      }
    }

    this.activeUtterance = utterance
    window.speechSynthesis.speak(utterance)
  }

  private advanceToNextChunk(): void {
    if (this.currentIndex < this.chunks.length - 1) {
      this.currentIndex++
      this.speakCurrentChunk()
    } else {
      this.state = 'idle'
      this.emitStatus()
      this.options.onSequenceComplete?.()
    }
  }

  public getStatus(): TtsStatus {
    const voiceMeta = INDIAN_VOICES.find((v) => v.id === this.currentVoiceId)
    const resolved = resolveBrowserVoice(this.currentVoiceId, this.voices)
    const chunk = this.chunks[this.currentIndex] || null

    return {
      state: this.state,
      currentVoiceId: this.currentVoiceId,
      currentLanguage: voiceMeta?.languageCode || 'hi-IN',
      speed: this.speed,
      currentChunkIndex: this.currentIndex,
      totalChunks: this.chunks.length,
      currentText: chunk?.text || '',
      activeVoiceAvailable: !!resolved.voice,
      providerType: resolved.providerType,
    }
  }

  private emitStatus(): void {
    this.options.onStatusChange?.(this.getStatus())
  }

  public getActiveUtterance(): SpeechSynthesisUtterance | null {
    return this.activeUtterance
  }

  public destroy(): void {
    this.isDestroyed = true
    this.stop()
  }
}
