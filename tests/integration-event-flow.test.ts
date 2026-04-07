import { rm } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import { AudioCache } from '../src/main/output-engine/audio-cache'
import { CacheMetrics } from '../src/main/output-engine/cache-metrics'
import { OutputEngine } from '../src/main/output-engine/output-engine'
import { AudioPlaybackManager } from '../src/main/output-engine/playback-manager'
import { TextPopupChannel } from '../src/main/output-engine/popup-channel'
import { TtsGenerationWorker } from '../src/main/output-engine/tts-worker'
import { PersonalityEngine } from '../src/main/personality-engine/engine'
import { TriggerEngine } from '../src/main/trigger-engine/engine'
import type { TriggerEvent } from '../src/main/trigger-engine/types'
import { MockElevenLabsProvider, MockZaiGenerator } from './mocks/providers'

describe('Integration event flow', () => {
  it('flows battery event through trigger, personality AI path, and output audio', async () => {
    await rm('/tmp/talkback-integration-cache-1', { recursive: true, force: true })

    const trigger = new TriggerEngine({
      globalCooldownMs: 0,
      highPrioritySuppressMs: 0,
      eventCooldownMs: {
        knock: 0,
        keyboard_state_change: 0,
        battery_threshold: 0,
        idle: 0
      }
    })

    const zai = new MockZaiGenerator()
    const personality = new PersonalityEngine({ aiLineGenerator: zai.generate })

    const metrics = new CacheMetrics()
    const eleven = new MockElevenLabsProvider()
    const audioCache = new AudioCache('/tmp/talkback-integration-cache-1', metrics)
    const worker = new TtsGenerationWorker(audioCache, eleven, metrics)

    const shown: string[] = []
    const output = new OutputEngine(
      new TextPopupChannel((message) => shown.push(message)),
      new AudioPlaybackManager(async () => {}),
      worker
    )

    const event: TriggerEvent = {
      eventType: 'battery_threshold',
      timestamp: 1000,
      payload: { threshold: 10, percent: 9 }
    }

    const decision = trigger.process(event, 1000)
    expect(decision.accepted).toBe(true)

    const accepted = trigger.dequeueAccepted()
    expect(accepted).toBeDefined()

    const selection = await personality.select(accepted as TriggerEvent, 'random', true)
    const result = await output.emit({
      eventType: selection.eventType,
      text: selection.text,
      useVoice: true,
      voiceId: 'voice',
      modelId: 'model'
    })

    expect(selection.source).toBe('ai')
    expect(shown.length).toBe(1)
    expect(result.audioPlayed).toBe(true)
    expect(zai.calls.length).toBe(1)
    expect(eleven.requests.length).toBe(1)
  })

  it('flows knock event through trigger, prewritten personality path, and output text/audio', async () => {
    await rm('/tmp/talkback-integration-cache-2', { recursive: true, force: true })

    const trigger = new TriggerEngine({
      globalCooldownMs: 0,
      highPrioritySuppressMs: 0,
      eventCooldownMs: {
        knock: 0,
        keyboard_state_change: 0,
        battery_threshold: 0,
        idle: 0
      }
    })

    const personality = new PersonalityEngine({
      prewrittenResponses: {
        knock: ['Knock acknowledged.'],
        keyboard_state_change: ['kb'],
        battery_threshold: ['b'],
        idle: ['i']
      }
    })

    const metrics = new CacheMetrics()
    const eleven = new MockElevenLabsProvider()
    const audioCache = new AudioCache('/tmp/talkback-integration-cache-2', metrics)
    const worker = new TtsGenerationWorker(audioCache, eleven, metrics)
    const shown: string[] = []
    const output = new OutputEngine(
      new TextPopupChannel((message) => shown.push(message)),
      new AudioPlaybackManager(async () => {}),
      worker
    )

    const event: TriggerEvent = { eventType: 'knock', timestamp: 2000, payload: {} }
    trigger.process(event, 2000)

    const accepted = trigger.dequeueAccepted() as TriggerEvent
    const selection = await personality.select(accepted, 'random', true)
    const result = await output.emit({
      eventType: selection.eventType,
      text: selection.text,
      useVoice: true,
      voiceId: 'voice',
      modelId: 'model'
    })

    expect(selection.source).toBe('prewritten')
    expect(selection.text).toBe('Knock acknowledged.')
    expect(shown).toEqual(['Knock acknowledged.'])
    expect(result.audioPlayed).toBe(true)
    expect(eleven.requests.length).toBe(1)
  })
})
