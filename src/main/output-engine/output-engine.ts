import { randomUUID } from 'node:crypto'

import { AudioPlaybackManager } from './playback-manager'
import { TextPopupChannel } from './popup-channel'
import { TtsGenerationWorker } from './tts-worker'
import type { OutputRequest, OutputResult } from './types'

export class OutputEngine {
  private readonly popupChannel: TextPopupChannel
  private readonly playbackManager: AudioPlaybackManager
  private readonly ttsWorker: TtsGenerationWorker

  constructor(
    popupChannel: TextPopupChannel,
    playbackManager: AudioPlaybackManager,
    ttsWorker: TtsGenerationWorker
  ) {
    this.popupChannel = popupChannel
    this.playbackManager = playbackManager
    this.ttsWorker = ttsWorker
  }

  async emit(request: OutputRequest): Promise<OutputResult> {
    this.popupChannel.show(request.text)

    if (!request.useVoice) {
      return {
        textDisplayed: true,
        audioPlayed: false,
        fallbackReason: 'VOICE_DISABLED'
      }
    }

    if (!request.voiceId || !request.modelId) {
      return {
        textDisplayed: true,
        audioPlayed: false,
        fallbackReason: 'VOICE_GENERATION_FAILED',
        fallbackDetail: 'MISSING_VOICE_OR_MODEL'
      }
    }

    const generated = await this.ttsWorker.enqueue({
      text: request.text,
      voiceId: request.voiceId,
      modelId: request.modelId
    })

    if (generated.status !== 'ready') {
      return {
        textDisplayed: true,
        audioPlayed: false,
        fallbackReason: 'VOICE_GENERATION_FAILED',
        fallbackDetail: generated.reason
      }
    }

    try {
      await this.playbackManager.enqueue({
        id: randomUUID(),
        text: request.text,
        audioFilePath: generated.audioFilePath
      })

      return {
        textDisplayed: true,
        audioPlayed: true
      }
    } catch {
      return {
        textDisplayed: true,
        audioPlayed: false,
        fallbackReason: 'PLAYBACK_FAILED',
        fallbackDetail: 'AUDIO_PLAYBACK_EXCEPTION'
      }
    }
  }
}
