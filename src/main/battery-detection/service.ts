import type { OutputEngine } from '../output-engine/output-engine'
import { PrefetchQueue } from '../output-engine/prefetch-queue'
import { TextCache } from '../output-engine/text-cache'
import type { TtsGenerationWorker } from '../output-engine/tts-worker'
import type { PersonalityEngine } from '../personality-engine/engine'
import type { TriggerEngine } from '../trigger-engine/engine'
import type { TriggerEvent } from '../trigger-engine/types'
import { BatteryThresholdTracker } from './threshold-tracker'
import type {
  BatteryPersonalityConfig,
  BatteryProvider,
  BatterySnapshot,
  BatteryThresholdEvent
} from './types'

const defaultConfig: BatteryPersonalityConfig = {
  thresholds: [50, 20, 10, 5],
  pollIntervalMs: 30000,
  pregenSourceThreshold: 10,
  pregenTargetThreshold: 5,
  voiceId: 'default-voice',
  modelId: 'default-model'
}

type PregenCacheValue = {
  text: string
  threshold: number
  createdAt: number
}

export class BatteryPersonalityService {
  private readonly provider: BatteryProvider
  private readonly triggerEngine: TriggerEngine
  private readonly personalityEngine: PersonalityEngine
  private readonly outputEngine: OutputEngine
  private readonly ttsWorker: TtsGenerationWorker
  private readonly textCache: TextCache
  private readonly prefetchQueue: PrefetchQueue
  private readonly config: BatteryPersonalityConfig
  private readonly tracker: BatteryThresholdTracker
  private readonly pregenCache = new Map<number, PregenCacheValue>()
  private intervalRef: NodeJS.Timeout | undefined

  constructor(
    provider: BatteryProvider,
    triggerEngine: TriggerEngine,
    personalityEngine: PersonalityEngine,
    outputEngine: OutputEngine,
    ttsWorker: TtsGenerationWorker,
    textCache: TextCache,
    prefetchQueue: PrefetchQueue,
    config?: Partial<BatteryPersonalityConfig>
  ) {
    this.provider = provider
    this.triggerEngine = triggerEngine
    this.personalityEngine = personalityEngine
    this.outputEngine = outputEngine
    this.ttsWorker = ttsWorker
    this.textCache = textCache
    this.prefetchQueue = prefetchQueue
    this.config = {
      ...defaultConfig,
      ...(config ?? {})
    }
    this.tracker = new BatteryThresholdTracker(this.config.thresholds)
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

  async pollOnce(now = Date.now()): Promise<BatteryThresholdEvent[]> {
    const snapshot = await this.provider.read()
    const events = this.tracker.process(snapshot, now)

    for (const event of events) {
      await this.handleThresholdEvent(event, snapshot)
    }

    return events
  }

  getPregenText(threshold: number): string | undefined {
    return this.pregenCache.get(threshold)?.text
  }

  private async handleThresholdEvent(event: BatteryThresholdEvent, snapshot: BatterySnapshot): Promise<void> {
    const triggerEvent: TriggerEvent = {
      eventType: 'battery_threshold',
      timestamp: event.timestamp,
      payload: {
        threshold: event.threshold,
        percent: event.percent,
        isCharging: snapshot.isCharging
      }
    }

    this.triggerEngine.process(triggerEvent, event.timestamp)

    if (event.threshold === this.config.pregenSourceThreshold) {
      await this.preGenerateForTargetThreshold(triggerEvent, event.timestamp)
      return
    }

    if (event.threshold === this.config.pregenTargetThreshold) {
      const cached = this.pregenCache.get(this.config.pregenTargetThreshold)

      if (cached) {
        await this.outputEngine.emit({
          eventType: 'battery_threshold',
          text: cached.text,
          useVoice: true,
          voiceId: this.config.voiceId,
          modelId: this.config.modelId
        })
        return
      }
    }

    const selected = await this.personalityEngine.select(triggerEvent, 'random', true)
    await this.outputEngine.emit({
      eventType: 'battery_threshold',
      text: selected.text,
      useVoice: true,
      voiceId: this.config.voiceId,
      modelId: this.config.modelId
    })
  }

  private async preGenerateForTargetThreshold(sourceEvent: TriggerEvent, timestamp: number): Promise<void> {
    const targetEvent: TriggerEvent = {
      eventType: 'battery_threshold',
      timestamp,
      payload: {
        ...sourceEvent.payload,
        threshold: this.config.pregenTargetThreshold
      }
    }

    const contextHash = this.textCache.contextHash(
      JSON.stringify({
        threshold: this.config.pregenTargetThreshold,
        percent: (targetEvent.payload as { percent: number }).percent
      })
    )
    const cacheKey = this.textCache.key('zai', 'battery_threshold', contextHash)
    const cachedText = await this.textCache.get(cacheKey, timestamp)

    const selectedText =
      cachedText ?? (await this.personalityEngine.select(targetEvent, 'deterministic', true)).text

    if (!cachedText) {
      await this.textCache.set(cacheKey, selectedText, 24 * 60 * 60 * 1000, timestamp)
    }

    this.pregenCache.set(this.config.pregenTargetThreshold, {
      text: selectedText,
      threshold: this.config.pregenTargetThreshold,
      createdAt: timestamp
    })

    this.prefetchQueue.enqueue({
      text: selectedText,
      voiceId: this.config.voiceId,
      modelId: this.config.modelId
    })
  }
}
