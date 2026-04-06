import { describe, expect, it } from 'vitest'

import { BatteryPersonalityService } from '../src/main/battery-detection/service'
import type { BatteryProvider } from '../src/main/battery-detection/types'
import { OutputEngine } from '../src/main/output-engine/output-engine'
import { AudioCache } from '../src/main/output-engine/audio-cache'
import { AudioPlaybackManager } from '../src/main/output-engine/playback-manager'
import { TextPopupChannel } from '../src/main/output-engine/popup-channel'
import { TtsGenerationWorker } from '../src/main/output-engine/tts-worker'
import type { TtsGenerationRequest, TtsProvider } from '../src/main/output-engine/types'
import { PersonalityEngine } from '../src/main/personality-engine/engine'
import { TriggerEngine } from '../src/main/trigger-engine/engine'

class SequenceBatteryProvider implements BatteryProvider {
  private readonly sequence: number[]
  private index = 0

  constructor(sequence: number[]) {
    this.sequence = sequence
  }

  async read() {
    const percent = this.sequence[this.index] ?? this.sequence[this.sequence.length - 1] ?? 100
    this.index += 1
    return {
      hasBattery: true,
      isCharging: false,
      percent
    }
  }
}

class MemoryTtsProvider implements TtsProvider {
  requests: TtsGenerationRequest[] = []

  async synthesize(request: TtsGenerationRequest): Promise<Buffer> {
    this.requests.push(request)
    return Buffer.from(request.text, 'utf8')
  }
}

describe('BatteryPersonalityService', () => {
  it('pre-generates at 10 percent and uses cached text on 5 percent event', async () => {
    const provider = new SequenceBatteryProvider([30, 10, 5])
    const triggerEngine = new TriggerEngine({
      globalCooldownMs: 0,
      highPrioritySuppressMs: 0,
      eventCooldownMs: {
        knock: 0,
        keyboard_state_change: 0,
        battery_threshold: 0,
        idle: 0
      }
    })

    const personality = new PersonalityEngine({
      aiLineGenerator: async ({ context }) => {
        const payload = context.payload as { threshold: number }
        return `Battery at ${payload.threshold}%. Plug me in.`
      }
    })

    const popupMessages: string[] = []
    const popup = new TextPopupChannel((message) => {
      popupMessages.push(message)
    })

    const playback = new AudioPlaybackManager(async () => {})
    const ttsProvider = new MemoryTtsProvider()
    const ttsWorker = new TtsGenerationWorker(new AudioCache('/tmp/talkback-battery-test-cache'), ttsProvider)
    const output = new OutputEngine(popup, playback, ttsWorker)

    const service = new BatteryPersonalityService(provider, triggerEngine, personality, output, ttsWorker, {
      thresholds: [20, 10, 5],
      pregenSourceThreshold: 10,
      pregenTargetThreshold: 5,
      voiceId: 'voice',
      modelId: 'model'
    })

    await service.pollOnce(1000)
    await service.pollOnce(2000)

    const pregenText = service.getPregenText(5)
    expect(pregenText).toBe('Battery at 5%.')

    await service.pollOnce(3000)

    expect(popupMessages.at(-1)).toBe('Battery at 5%.')
  })
})
