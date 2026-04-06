import type { OutputRequest } from '../output-engine/types'
import type { PersonalityEngine } from '../personality-engine/engine'
import type { TriggerEngine } from '../trigger-engine/engine'
import type { TriggerEvent } from '../trigger-engine/types'
import type { IdlePersonalityConfig } from './types'

type OutputEmitter = {
  emit: (request: OutputRequest) => Promise<unknown>
}

const defaultConfig: IdlePersonalityConfig = {
  idleThresholdSec: 90,
  pollIntervalMs: 5000,
  cooldownMs: 60000,
  voiceId: 'default-voice',
  modelId: 'default-model'
}

export class IdlePersonalityService {
  private readonly readIdleSeconds: () => number
  private readonly triggerEngine: TriggerEngine
  private readonly personalityEngine: PersonalityEngine
  private readonly output: OutputEmitter
  private readonly config: IdlePersonalityConfig
  private intervalRef: NodeJS.Timeout | undefined
  private lastTriggerAt = Number.NEGATIVE_INFINITY
  private idleSessionTriggered = false

  constructor(
    readIdleSeconds: () => number,
    triggerEngine: TriggerEngine,
    personalityEngine: PersonalityEngine,
    output: OutputEmitter,
    config?: Partial<IdlePersonalityConfig>
  ) {
    this.readIdleSeconds = readIdleSeconds
    this.triggerEngine = triggerEngine
    this.personalityEngine = personalityEngine
    this.output = output
    this.config = {
      ...defaultConfig,
      ...(config ?? {})
    }
  }

  start(): void {
    this.intervalRef = setInterval(() => {
      void this.pollOnce()
    }, this.config.pollIntervalMs)
  }

  stop(): void {
    if (!this.intervalRef) {
      return
    }

    clearInterval(this.intervalRef)
    this.intervalRef = undefined
  }

  async pollOnce(now = Date.now()): Promise<boolean> {
    const idleSeconds = this.readIdleSeconds()

    if (idleSeconds < this.config.idleThresholdSec) {
      this.idleSessionTriggered = false
      return false
    }

    if (!this.idleSessionTriggered || now - this.lastTriggerAt >= this.config.cooldownMs) {
      const emitted = await this.emitIdleEvent(idleSeconds, now)

      if (emitted) {
        this.idleSessionTriggered = true
        this.lastTriggerAt = now
      }

      return emitted
    }

    return false
  }

  private async emitIdleEvent(idleSeconds: number, now: number): Promise<boolean> {
    const event: TriggerEvent = {
      eventType: 'idle',
      timestamp: now,
      payload: {
        idleSeconds
      }
    }

    const decision = this.triggerEngine.process(event, now)

    if (!decision.accepted) {
      return false
    }

    const selection = await this.personalityEngine.select(event, 'random', true)

    await this.output.emit({
      eventType: 'idle',
      text: selection.text,
      useVoice: true,
      voiceId: this.config.voiceId,
      modelId: this.config.modelId
    })

    return true
  }
}
