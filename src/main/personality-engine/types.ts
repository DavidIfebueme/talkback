import type { EventType, TriggerEvent } from '../trigger-engine/types'

export type SelectionStrategy = 'random' | 'deterministic'

export type ResponseSource = 'prewritten' | 'ai'

export interface PersonalitySelection {
  eventType: EventType
  text: string
  source: ResponseSource
}

export interface AiGenerateInput {
  eventType: EventType
  context: TriggerEvent
}

export type AiLineGenerator = (input: AiGenerateInput) => Promise<string>

export interface PersonalityEngineConfig {
  prewrittenResponses: Record<EventType, string[]>
  antiRepeatWindow: number
  aiAllowedEvents: EventType[]
  aiLineGenerator?: AiLineGenerator
  random: () => number
}
