import type { KeyboardMoodConfig, KeyboardMoodSignal, KeyboardMoodState } from './types'

const defaultConfig: KeyboardMoodConfig = {
  activeWindowMs: 2000,
  fastTypingKpsThreshold: 5,
  sustainedBehaviorMs: 5000,
  cooldownMs: 12000
}

export class KeyboardMoodDetector {
  private readonly config: KeyboardMoodConfig
  private readonly onSignal: (signal: KeyboardMoodSignal) => void
  private keyTimestamps: number[] = []
  private currentState: KeyboardMoodState = 'IDLE'
  private stateEnteredAt = Number.NEGATIVE_INFINITY
  private lastSignalAt = Number.NEGATIVE_INFINITY

  constructor(onSignal: (signal: KeyboardMoodSignal) => void, config?: Partial<KeyboardMoodConfig>) {
    this.onSignal = onSignal
    this.config = {
      ...defaultConfig,
      ...(config ?? {})
    }
  }

  ingestKeydown(now = Date.now()): void {
    this.keyTimestamps.push(now)
    this.trimOld(now)
    this.evaluate(now)
  }

  evaluate(now = Date.now()): void {
    this.trimOld(now)
    const nextState = this.computeState(now)
    const kps = this.computeKps(now)

    if (nextState !== this.currentState) {
      this.currentState = nextState
      this.stateEnteredAt = now
      this.emitIfCooldownElapsed({ state: nextState, kps, timestamp: now, reason: 'STATE_CHANGE' })
      return
    }

    if (now - this.stateEnteredAt >= this.config.sustainedBehaviorMs) {
      this.emitIfCooldownElapsed({ state: nextState, kps, timestamp: now, reason: 'SUSTAINED' })
    }
  }

  getState(): KeyboardMoodState {
    return this.currentState
  }

  private emitIfCooldownElapsed(signal: KeyboardMoodSignal): void {
    if (signal.timestamp - this.lastSignalAt < this.config.cooldownMs) {
      return
    }

    this.lastSignalAt = signal.timestamp
    this.onSignal(signal)
  }

  private computeState(now: number): KeyboardMoodState {
    const kps = this.computeKps(now)
    const active = this.keyTimestamps.length > 0

    if (!active) {
      return 'IDLE'
    }

    if (kps >= this.config.fastTypingKpsThreshold) {
      return 'FAST_TYPING'
    }

    return 'SLOW_TYPING'
  }

  private computeKps(now: number): number {
    this.trimOld(now)
    return this.keyTimestamps.length / (this.config.activeWindowMs / 1000)
  }

  private trimOld(now: number): void {
    const minTimestamp = now - this.config.activeWindowMs
    this.keyTimestamps = this.keyTimestamps.filter((timestamp) => timestamp >= minTimestamp)
  }
}
