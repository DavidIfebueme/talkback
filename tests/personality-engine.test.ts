import { describe, expect, it } from 'vitest'

import { PersonalityEngine } from '../src/main/personality-engine/engine'
import type { TriggerEvent } from '../src/main/trigger-engine/types'

const baseEvent = (eventType: TriggerEvent['eventType'], timestamp = 1000): TriggerEvent => ({
  eventType,
  timestamp,
  payload: {}
})

describe('PersonalityEngine', () => {
  it('returns prewritten response for knock events', async () => {
    const engine = new PersonalityEngine({
      prewrittenResponses: {
        knock: ['k1'],
        keyboard_state_change: ['kb1'],
        battery_threshold: ['b1'],
        idle: ['i1']
      }
    })

    const selection = await engine.select(baseEvent('knock'))

    expect(selection.source).toBe('prewritten')
    expect(selection.text).toBe('k1')
  })

  it('avoids immediate repeats within anti-repeat window', async () => {
    const engine = new PersonalityEngine({
      antiRepeatWindow: 1,
      random: () => 0,
      prewrittenResponses: {
        knock: ['k1', 'k2'],
        keyboard_state_change: ['kb1'],
        battery_threshold: ['b1'],
        idle: ['i1']
      }
    })

    const first = await engine.select(baseEvent('knock', 1001))
    const second = await engine.select(baseEvent('knock', 1002))

    expect(first.text).toBe('k1')
    expect(second.text).toBe('k2')
  })

  it('clamps anti-repeat window to at least one', async () => {
    const engine = new PersonalityEngine({
      antiRepeatWindow: 0,
      random: () => 0,
      prewrittenResponses: {
        knock: ['k1', 'k2'],
        keyboard_state_change: ['kb1'],
        battery_threshold: ['b1'],
        idle: ['i1']
      }
    })

    const first = await engine.select(baseEvent('knock', 1010))
    const second = await engine.select(baseEvent('knock', 1011))

    expect(first.text).toBe('k1')
    expect(second.text).toBe('k2')
  })

  it('limits anti-repeat window to available line diversity', async () => {
    const engine = new PersonalityEngine({
      antiRepeatWindow: 10,
      random: () => 0,
      prewrittenResponses: {
        knock: ['k1', 'k2'],
        keyboard_state_change: ['kb1'],
        battery_threshold: ['b1'],
        idle: ['i1']
      }
    })

    const first = await engine.select(baseEvent('knock', 1020))
    const second = await engine.select(baseEvent('knock', 1021))

    expect(first.text).toBe('k1')
    expect(second.text).toBe('k2')
  })

  it('uses deterministic strategy when requested', async () => {
    const engine = new PersonalityEngine({
      prewrittenResponses: {
        knock: ['k1', 'k2', 'k3'],
        keyboard_state_change: ['kb1'],
        battery_threshold: ['b1'],
        idle: ['i1']
      }
    })

    const event = baseEvent('knock', 9000)

    const first = await engine.select(event, 'deterministic', false)
    const second = await engine.select(event, 'deterministic', false)

    expect(first.text).toBe(second.text)
  })

  it('uses ai only for allowed events and sanitizes to one sentence', async () => {
    const engine = new PersonalityEngine({
      aiLineGenerator: async () => 'Battery is at 10%. Plug me in. Or don\'t.',
      prewrittenResponses: {
        knock: ['k1'],
        keyboard_state_change: ['kb1'],
        battery_threshold: ['b1'],
        idle: ['i1']
      }
    })

    const batterySelection = await engine.select(baseEvent('battery_threshold'))
    const keyboardSelection = await engine.select(baseEvent('keyboard_state_change'))

    expect(batterySelection.source).toBe('ai')
    expect(batterySelection.text).toBe('Battery is at 10%.')
    expect(keyboardSelection.source).toBe('prewritten')
    expect(keyboardSelection.text).toBe('kb1')
  })

  it('falls back to prewritten response if ai output is empty after sanitization', async () => {
    const engine = new PersonalityEngine({
      aiLineGenerator: async () => '   ',
      prewrittenResponses: {
        knock: ['k1'],
        keyboard_state_change: ['kb1'],
        battery_threshold: ['b1'],
        idle: ['i1']
      }
    })

    const selection = await engine.select(baseEvent('idle'))

    expect(selection.source).toBe('prewritten')
    expect(selection.text).toBe('i1')
  })

  it('falls back to prewritten response when ai generator fails', async () => {
    const engine = new PersonalityEngine({
      aiLineGenerator: async () => {
        throw new Error('ai down')
      },
      prewrittenResponses: {
        knock: ['k1'],
        keyboard_state_change: ['kb1'],
        battery_threshold: ['b1'],
        idle: ['i1']
      }
    })

    const selection = await engine.select(baseEvent('battery_threshold'))

    expect(selection.source).toBe('prewritten')
    expect(selection.text).toBe('b1')
  })
})
