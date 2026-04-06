export type EventType = 'knock' | 'keyboard_state_change' | 'battery_threshold' | 'idle'

export interface TriggerEvent<TPayload = Record<string, unknown>> {
  eventType: EventType
  timestamp: number
  payload: TPayload
}

export type TriggerRejectReason =
  | 'EVENT_COOLDOWN'
  | 'GLOBAL_COOLDOWN'
  | 'RECENT_HIGHER_PRIORITY'

export interface TriggerDecisionAccepted {
  accepted: true
  event: TriggerEvent
}

export interface TriggerDecisionRejected {
  accepted: false
  reason: TriggerRejectReason
  event: TriggerEvent
}

export type TriggerDecision = TriggerDecisionAccepted | TriggerDecisionRejected

export interface TriggerEngineConfig {
  globalCooldownMs: number
  highPrioritySuppressMs: number
  eventCooldownMs: Record<EventType, number>
  priorityByEventType: Record<EventType, number>
}
