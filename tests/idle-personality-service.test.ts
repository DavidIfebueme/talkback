import { describe, expect, it } from 'vitest'

import { IdlePersonalityService } from '../src/main/idle-detection/service'
import { PersonalityEngine } from '../src/main/personality-engine/engine'
import { TriggerEngine } from '../src/main/trigger-engine/engine'

describe('IdlePersonalityService', () => {
  it('triggers when idle threshold is reached and respects cooldown until reset by activity', async () => {
    let idleSeconds = 0
    const emittedTexts: string[] = []

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

    const personalityEngine = new PersonalityEngine({
      aiLineGenerator: async () => 'You idle, I spiral.'
    })

    const output = {
      emit: async (request: { text: string }) => {
        emittedTexts.push(request.text)
      }
    }

    const service = new IdlePersonalityService(
      () => idleSeconds,
      triggerEngine,
      personalityEngine,
      output,
      {
        idleThresholdSec: 60,
        cooldownMs: 10000,
        pollIntervalMs: 5000,
        voiceId: 'voice',
        modelId: 'model'
      }
    )

    idleSeconds = 59
    const belowThreshold = await service.pollOnce(1000)

    idleSeconds = 61
    const firstTrigger = await service.pollOnce(2000)
    const cooldownBlocked = await service.pollOnce(5000)

    idleSeconds = 20
    const reset = await service.pollOnce(8000)

    idleSeconds = 65
    const secondTrigger = await service.pollOnce(9000)

    expect(belowThreshold).toBe(false)
    expect(firstTrigger).toBe(true)
    expect(cooldownBlocked).toBe(false)
    expect(reset).toBe(false)
    expect(secondTrigger).toBe(true)
    expect(emittedTexts).toEqual(['You idle, I spiral.', 'You idle, I spiral.'])
  })
})
