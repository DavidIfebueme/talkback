import type { EventType } from '../trigger-engine/types'

export interface OutputRequest {
  eventType: EventType
  text: string
  useVoice: boolean
  voiceId?: string
  modelId?: string
}

export type OutputFallbackReason =
  | 'VOICE_DISABLED'
  | 'VOICE_GENERATION_FAILED'
  | 'PLAYBACK_FAILED'

export interface OutputResult {
  textDisplayed: boolean
  audioPlayed: boolean
  fallbackReason?: OutputFallbackReason
}

export interface AudioPlaybackTask {
  id: string
  text: string
  audioFilePath: string
}

export type AudioPlayer = (task: AudioPlaybackTask) => Promise<void>

export interface TtsGenerationRequest {
  text: string
  voiceId: string
  modelId: string
}

export type TtsGenerationResult =
  | { status: 'ready'; audioFilePath: string }
  | { status: 'fallback_text_only' }

export interface TtsProvider {
  synthesize(request: TtsGenerationRequest): Promise<Buffer>
}
