import { describe, expect, it } from 'vitest'

import { OutputEngine } from '../src/main/output-engine/output-engine'
import { AudioPlaybackManager } from '../src/main/output-engine/playback-manager'
import { TextPopupChannel } from '../src/main/output-engine/popup-channel'
import { TtsGenerationWorker } from '../src/main/output-engine/tts-worker'
import { AudioCache } from '../src/main/output-engine/audio-cache'
import { CacheMetrics } from '../src/main/output-engine/cache-metrics'
import type { TtsGenerationRequest, TtsProvider } from '../src/main/output-engine/types'

class FailingProvider implements TtsProvider {
  async synthesize(_request: TtsGenerationRequest): Promise<Buffer> {
    throw new Error('provider failure')
  }
}

class SuccessProvider implements TtsProvider {
  async synthesize(request: TtsGenerationRequest): Promise<Buffer> {
    return Buffer.from(request.text, 'utf8')
  }
}

describe('OutputEngine', () => {
  it('keeps text output when voice generation fails', async () => {
    const shown: string[] = []
    const popup = new TextPopupChannel((message) => shown.push(message))
    const playback = new AudioPlaybackManager(async () => {})
    const metrics = new CacheMetrics()
    const cache = new AudioCache('/tmp/talkback-test-audio-cache-1', metrics)
    const worker = new TtsGenerationWorker(cache, new FailingProvider(), metrics)
    const engine = new OutputEngine(popup, playback, worker)

    const result = await engine.emit({
      eventType: 'idle',
      text: 'You still there?',
      useVoice: true,
      voiceId: 'voice',
      modelId: 'model'
    })

    expect(shown).toEqual(['You still there?'])
    expect(result.textDisplayed).toBe(true)
    expect(result.audioPlayed).toBe(false)
    expect(result.fallbackReason).toBe('VOICE_GENERATION_FAILED')
  })

  it('returns playback fallback when playback fails', async () => {
    const shown: string[] = []
    const popup = new TextPopupChannel((message) => shown.push(message))
    const playback = new AudioPlaybackManager(async () => {
      throw new Error('playback failed')
    })
    const metrics = new CacheMetrics()
    const cache = new AudioCache('/tmp/talkback-test-audio-cache-2', metrics)
    const worker = new TtsGenerationWorker(cache, new SuccessProvider(), metrics)
    const engine = new OutputEngine(popup, playback, worker)

    const result = await engine.emit({
      eventType: 'knock',
      text: 'Easy there.',
      useVoice: true,
      voiceId: 'voice',
      modelId: 'model'
    })

    expect(shown).toEqual(['Easy there.'])
    expect(result.textDisplayed).toBe(true)
    expect(result.audioPlayed).toBe(false)
    expect(result.fallbackReason).toBe('PLAYBACK_FAILED')
  })
})
