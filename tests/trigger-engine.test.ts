import { describe, expect, it } from 'vitest'

import { TriggerEngine } from '../src/main/trigger-engine/engine'

describe('TriggerEngine', () => {
  it('accepts the first event and queues it', () => {
    const engine = new TriggerEngine()

    const decision = engine.process(
      { eventType: 'keyboard_state_change', timestamp: 1000, payload: { state: 'FAST_TYPING' } },
      1000
    )

    expect(decision.accepted).toBe(true)
    expect(engine.queueSize()).toBe(1)
    expect(engine.dequeueAccepted()?.eventType).toBe('keyboard_state_change')
  })

  it('rejects same event type within event cooldown window', () => {
    const engine = new TriggerEngine({
      eventCooldownMs: {
        keyboard_state_change: 15000,
        knock: 400,
        battery_threshold: 30000,
        idle: 60000
      }
    })

    const first = engine.process(
      { eventType: 'keyboard_state_change', timestamp: 1000, payload: { state: 'SLOW_TYPING' } },
      1000
    )
    const second = engine.process(
      { eventType: 'keyboard_state_change', timestamp: 5000, payload: { state: 'FAST_TYPING' } },
      5000
    )

    expect(first.accepted).toBe(true)
    expect(second.accepted).toBe(false)
    if (!second.accepted) {
      expect(second.reason).toBe('EVENT_COOLDOWN')
    }
  })

  it('rejects lower-priority event after recent higher-priority event', () => {
    const engine = new TriggerEngine({
      globalCooldownMs: 0,
      highPrioritySuppressMs: 5000
    })

    const knockDecision = engine.process(
      { eventType: 'knock', timestamp: 1000, payload: {} },
      1000
    )

    const idleDecision = engine.process(
      { eventType: 'idle', timestamp: 2000, payload: {} },
      2000
    )

    expect(knockDecision.accepted).toBe(true)
    expect(idleDecision.accepted).toBe(false)
    if (!idleDecision.accepted) {
      expect(idleDecision.reason).toBe('RECENT_HIGHER_PRIORITY')
    }
  })

  it('allows a higher-priority event during global cooldown', () => {
    const engine = new TriggerEngine({
      globalCooldownMs: 5000,
      highPrioritySuppressMs: 0
    })

    const idleDecision = engine.process(
      { eventType: 'idle', timestamp: 1000, payload: {} },
      1000
    )
    const knockDecision = engine.process(
      { eventType: 'knock', timestamp: 2000, payload: {} },
      2000
    )

    expect(idleDecision.accepted).toBe(true)
    expect(knockDecision.accepted).toBe(true)
  })

  it('rejects same-or-lower priority events during global cooldown', () => {
    const engine = new TriggerEngine({
      globalCooldownMs: 5000,
      highPrioritySuppressMs: 0,
      eventCooldownMs: {
        knock: 0,
        keyboard_state_change: 0,
        battery_threshold: 0,
        idle: 0
      }
    })

    const keyboardDecision = engine.process(
      { eventType: 'keyboard_state_change', timestamp: 1000, payload: {} },
      1000
    )
    const batteryDecision = engine.process(
      { eventType: 'battery_threshold', timestamp: 2000, payload: {} },
      2000
    )

    expect(keyboardDecision.accepted).toBe(true)
    expect(batteryDecision.accepted).toBe(false)
    if (!batteryDecision.accepted) {
      expect(batteryDecision.reason).toBe('GLOBAL_COOLDOWN')
    }
  })
})
