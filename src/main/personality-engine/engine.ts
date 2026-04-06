import type { EventType, TriggerEvent } from '../trigger-engine/types'
import type { PersonalityEngineConfig, PersonalitySelection, SelectionStrategy } from './types'

const defaultPrewrittenResponses: Record<EventType, string[]> = {
  knock: ['I felt that.', 'Was that your hand or your frustration?', 'Easy. I bruise emotionally.'],
  keyboard_state_change: [
    'You type like the deadline is armed.',
    'That keyboard did not consent to this speed.',
    'Calm down, I can only process so much panic.'
  ],
  battery_threshold: [
    'Battery is dropping faster than your optimism.',
    'Power me or prepare for blackout theater.',
    'I am not dying, I am making a statement.'
  ],
  idle: ['You there, or did you rage-quit life?', 'I miss your chaotic typing.', 'Wake up, I am bored.']
}

const defaultConfig: PersonalityEngineConfig = {
  prewrittenResponses: defaultPrewrittenResponses,
  antiRepeatWindow: 2,
  aiAllowedEvents: ['battery_threshold', 'idle'],
  random: () => Math.random()
}

export class PersonalityEngine {
  private readonly config: PersonalityEngineConfig
  private readonly historyByType = new Map<EventType, string[]>()

  constructor(config?: Partial<PersonalityEngineConfig>) {
    this.config = {
      ...defaultConfig,
      ...config,
      prewrittenResponses: {
        ...defaultConfig.prewrittenResponses,
        ...(config?.prewrittenResponses ?? {})
      },
      aiAllowedEvents: config?.aiAllowedEvents ?? defaultConfig.aiAllowedEvents,
      random: config?.random ?? defaultConfig.random
    }
  }

  async select(
    event: TriggerEvent,
    strategy: SelectionStrategy = 'random',
    allowAiVariation = true
  ): Promise<PersonalitySelection> {
    if (allowAiVariation && this.canUseAi(event.eventType) && this.config.aiLineGenerator) {
      const generated = await this.config.aiLineGenerator({ eventType: event.eventType, context: event })
      const sanitized = this.sanitizeToOneSentence(generated)

      if (sanitized.length > 0) {
        return {
          eventType: event.eventType,
          text: sanitized,
          source: 'ai'
        }
      }
    }

    return {
      eventType: event.eventType,
      text: this.pickPrewritten(event, strategy),
      source: 'prewritten'
    }
  }

  sanitizeToOneSentence(input: string): string {
    const normalized = input.replace(/\s+/g, ' ').trim()

    if (normalized.length === 0) {
      return ''
    }

    const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0] ?? ''
    return firstSentence.trim()
  }

  private canUseAi(eventType: EventType): boolean {
    return this.config.aiAllowedEvents.includes(eventType)
  }

  private pickPrewritten(event: TriggerEvent, strategy: SelectionStrategy): string {
    const lines = this.config.prewrittenResponses[event.eventType] ?? []

    if (lines.length === 0) {
      throw new Error(`No prewritten responses configured for event type: ${event.eventType}`)
    }

    const recentHistory = this.historyByType.get(event.eventType) ?? []
    const useAntiRepeat = strategy === 'random'
    const candidates = useAntiRepeat ? lines.filter((line) => !recentHistory.includes(line)) : lines
    const available = candidates.length > 0 ? candidates : lines

    const index =
      strategy === 'deterministic'
        ? this.deterministicIndex(event.eventType, event.timestamp, available.length)
        : Math.floor(this.config.random() * available.length)

    const selected = available[index] ?? available[0]
    const updatedHistory = [...recentHistory, selected].slice(-this.config.antiRepeatWindow)
    this.historyByType.set(event.eventType, updatedHistory)

    return selected
  }

  private deterministicIndex(eventType: EventType, timestamp: number, length: number): number {
    const seed = `${eventType}:${timestamp}`
    let hash = 0

    for (let index = 0; index < seed.length; index += 1) {
      hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
    }

    return hash % length
  }
}
