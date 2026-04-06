import {
  type EventType,
  type TriggerDecision,
  type TriggerEngineConfig,
  type TriggerEvent
} from './types'

const defaultConfig: TriggerEngineConfig = {
  globalCooldownMs: 2500,
  highPrioritySuppressMs: 3000,
  eventCooldownMs: {
    knock: 400,
    keyboard_state_change: 12000,
    battery_threshold: 30000,
    idle: 60000
  },
  priorityByEventType: {
    knock: 1,
    keyboard_state_change: 2,
    battery_threshold: 3,
    idle: 4
  }
}

export class TriggerEngine {
  private readonly config: TriggerEngineConfig
  private readonly lastAcceptedByType = new Map<EventType, number>()
  private readonly lastAcceptedByPriority = new Map<number, number>()
  private readonly acceptedQueue: TriggerEvent[] = []
  private lastAcceptedAt = Number.NEGATIVE_INFINITY
  private lastAcceptedPriority = Number.POSITIVE_INFINITY

  constructor(config?: Partial<TriggerEngineConfig>) {
    this.config = {
      ...defaultConfig,
      ...config,
      eventCooldownMs: {
        ...defaultConfig.eventCooldownMs,
        ...(config?.eventCooldownMs ?? {})
      },
      priorityByEventType: {
        ...defaultConfig.priorityByEventType,
        ...(config?.priorityByEventType ?? {})
      }
    }
  }

  process(event: TriggerEvent, now = Date.now()): TriggerDecision {
    const priority = this.config.priorityByEventType[event.eventType]
    const eventCooldownMs = this.config.eventCooldownMs[event.eventType]
    const lastForType = this.lastAcceptedByType.get(event.eventType) ?? Number.NEGATIVE_INFINITY

    if (now - lastForType < eventCooldownMs) {
      return { accepted: false, reason: 'EVENT_COOLDOWN', event }
    }

    for (let currentPriority = 1; currentPriority < priority; currentPriority += 1) {
      const lastForHigherPriority =
        this.lastAcceptedByPriority.get(currentPriority) ?? Number.NEGATIVE_INFINITY

      if (now - lastForHigherPriority < this.config.highPrioritySuppressMs) {
        return { accepted: false, reason: 'RECENT_HIGHER_PRIORITY', event }
      }
    }

    if (now - this.lastAcceptedAt < this.config.globalCooldownMs && priority >= this.lastAcceptedPriority) {
      return { accepted: false, reason: 'GLOBAL_COOLDOWN', event }
    }

    this.lastAcceptedAt = now
    this.lastAcceptedPriority = priority
    this.lastAcceptedByType.set(event.eventType, now)
    this.lastAcceptedByPriority.set(priority, now)
    this.acceptedQueue.push(event)

    return { accepted: true, event }
  }

  dequeueAccepted(): TriggerEvent | undefined {
    return this.acceptedQueue.shift()
  }

  queueSize(): number {
    return this.acceptedQueue.length
  }
}
