import { describe, expect, it } from 'vitest'

import { KeyboardMoodDetector } from '../src/main/keyboard-detection/mood-detector'
import { resolveKeyboardSourceMode } from '../src/main/keyboard-detection/platform'
import { KeyboardMoodTriggerBridge } from '../src/main/keyboard-detection/trigger-bridge'
import { TriggerEngine } from '../src/main/trigger-engine/engine'

describe('KeyboardMoodDetector', () => {
  it('transitions to FAST_TYPING when kps exceeds threshold', () => {
    const states: string[] = []
    const detector = new KeyboardMoodDetector(
      (signal) => {
        states.push(signal.state)
      },
      {
        activeWindowMs: 2000,
        fastTypingKpsThreshold: 2,
        sustainedBehaviorMs: 5000,
        cooldownMs: 0
      }
    )

    detector.ingestKeydown(1000)
    detector.ingestKeydown(1200)
    detector.ingestKeydown(1400)
    detector.ingestKeydown(1500)
    detector.ingestKeydown(1600)

    expect(detector.getState()).toBe('FAST_TYPING')
    expect(states).toContain('FAST_TYPING')
  })

  it('transitions to IDLE when activity window expires', () => {
    const states: string[] = []
    const detector = new KeyboardMoodDetector(
      (signal) => {
        states.push(signal.state)
      },
      {
        activeWindowMs: 1000,
        fastTypingKpsThreshold: 4,
        sustainedBehaviorMs: 5000,
        cooldownMs: 0
      }
    )

    detector.ingestKeydown(1000)
    detector.evaluate(1500)
    detector.evaluate(2501)

    expect(detector.getState()).toBe('IDLE')
    expect(states).toContain('IDLE')
  })

  it('emits sustained behavior signal only after configured duration and cooldown', () => {
    const reasons: string[] = []
    const detector = new KeyboardMoodDetector(
      (signal) => {
        reasons.push(signal.reason)
      },
      {
        activeWindowMs: 2000,
        fastTypingKpsThreshold: 1,
        sustainedBehaviorMs: 3000,
        cooldownMs: 2000
      }
    )

    detector.ingestKeydown(1000)
    detector.ingestKeydown(1200)
    detector.evaluate(3500)
    detector.evaluate(4200)
    detector.evaluate(7000)

    expect(reasons[0]).toBe('STATE_CHANGE')
    expect(reasons.includes('SUSTAINED')).toBe(true)
  })

  it('emits keyboard trigger events into arbiter via bridge', () => {
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

    const bridge = new KeyboardMoodTriggerBridge(triggerEngine, {
      activeWindowMs: 2000,
      fastTypingKpsThreshold: 1,
      sustainedBehaviorMs: 5000,
      cooldownMs: 0
    })

    const detector = bridge.getDetector()
    detector.ingestKeydown(1000)
    detector.ingestKeydown(1200)

    const accepted = triggerEngine.dequeueAccepted()

    expect(accepted?.eventType).toBe('keyboard_state_change')
    expect((accepted?.payload as { state: string }).state).toBe('SLOW_TYPING')
  })
})

describe('KeyboardSourceModeResolver', () => {
  it('uses focused-window mode on linux wayland', () => {
    const mode = resolveKeyboardSourceMode('linux', 'wayland')
    expect(mode).toBe('FOCUSED_WINDOW')
  })

  it('uses global hook on linux x11 and non-linux platforms', () => {
    expect(resolveKeyboardSourceMode('linux', 'x11')).toBe('GLOBAL_HOOK')
    expect(resolveKeyboardSourceMode('darwin', undefined)).toBe('GLOBAL_HOOK')
    expect(resolveKeyboardSourceMode('win32', 'wayland')).toBe('GLOBAL_HOOK')
  })
})
