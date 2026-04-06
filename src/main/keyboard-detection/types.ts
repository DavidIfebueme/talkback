export type KeyboardMoodState = 'FAST_TYPING' | 'SLOW_TYPING' | 'IDLE'

export interface KeyboardMoodConfig {
  activeWindowMs: number
  fastTypingKpsThreshold: number
  sustainedBehaviorMs: number
  cooldownMs: number
}

export interface KeyboardMoodSignal {
  state: KeyboardMoodState
  kps: number
  timestamp: number
  reason: 'STATE_CHANGE' | 'SUSTAINED'
}

export type KeyboardSourceMode = 'GLOBAL_HOOK' | 'FOCUSED_WINDOW'

export interface KeyboardEventSource {
  start(onKeydown: (timestamp: number) => void): Promise<boolean>
  stop(): Promise<void>
}
