import { describe, expect, it } from 'vitest'

import { KnockDetector } from '../src/main/knock-detection/detector'
import { MicIngestor } from '../src/main/knock-detection/mic-ingestor'
import { KnockTriggerBridge } from '../src/main/knock-detection/trigger-bridge'
import { TriggerEngine } from '../src/main/trigger-engine/engine'

describe('KnockDetection', () => {
  it('calibrates from ambient noise before detecting knocks', () => {
    const signals: number[] = []
    const detector = new KnockDetector(
      (signal) => {
        signals.push(signal.amplitude)
      },
      {
        calibrationSampleCount: 3,
        thresholdMultiplier: 3,
        minThreshold: 0.08,
        transientDelta: 0.02,
        refractoryPeriodMs: 400
      }
    )

    detector.ingestAmplitude(0.01, 100)
    detector.ingestAmplitude(0.02, 200)
    detector.ingestAmplitude(0.02, 300)

    expect(detector.isCalibrated()).toBe(true)
    expect(detector.getBaseline()).toBeCloseTo(0.0166, 3)

    detector.ingestAmplitude(0.2, 1000)

    expect(signals).toEqual([0.2])
  })

  it('enforces refractory period between knocks', () => {
    const signals: number[] = []
    const detector = new KnockDetector(
      (signal) => {
        signals.push(signal.timestamp)
      },
      {
        calibrationSampleCount: 1,
        thresholdMultiplier: 3,
        minThreshold: 0.05,
        transientDelta: 0.03,
        refractoryPeriodMs: 500
      }
    )

    detector.ingestAmplitude(0.01, 10)
    detector.ingestAmplitude(0.06, 1000)
    detector.ingestAmplitude(0.01, 1200)
    detector.ingestAmplitude(0.07, 1300)
    detector.ingestAmplitude(0.01, 1700)
    detector.ingestAmplitude(0.08, 1800)

    expect(signals).toEqual([1000, 1800])
  })

  it('requires transient jump, not only sustained loud amplitude', () => {
    const signals: number[] = []
    const detector = new KnockDetector(
      (signal) => {
        signals.push(signal.amplitude)
      },
      {
        calibrationSampleCount: 1,
        thresholdMultiplier: 2,
        minThreshold: 0.05,
        transientDelta: 0.04,
        refractoryPeriodMs: 400
      }
    )

    detector.ingestAmplitude(0.02, 1)
    detector.ingestAmplitude(0.065, 1000)
    detector.ingestAmplitude(0.07, 1100)

    expect(signals).toEqual([0.065])
  })

  it('ingests microphone chunk by peak amplitude', () => {
    const detected: number[] = []
    const detector = new KnockDetector(
      (signal) => {
        detected.push(signal.amplitude)
      },
      {
        calibrationSampleCount: 1,
        thresholdMultiplier: 2,
        minThreshold: 0.05,
        transientDelta: 0.03,
        refractoryPeriodMs: 300
      }
    )

    const ingestor = new MicIngestor(detector)

    ingestor.ingestChunk(new Float32Array([0.01, -0.02, 0.015]), 10)
    ingestor.ingestChunk(new Float32Array([0.01, 0.2, 0.03]), 1000)

    expect(detected.length).toBe(1)
    expect(detected[0]).toBeCloseTo(0.2, 5)
  })

  it('emits knock events into trigger engine arbiter', () => {
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

    const bridge = new KnockTriggerBridge(triggerEngine, {
      calibrationSampleCount: 1,
      thresholdMultiplier: 2,
      minThreshold: 0.05,
      transientDelta: 0.03,
      refractoryPeriodMs: 300
    })

    const detector = bridge.getDetector()
    detector.ingestAmplitude(0.01, 10)
    detector.ingestAmplitude(0.12, 1000)

    const accepted = triggerEngine.dequeueAccepted()

    expect(accepted?.eventType).toBe('knock')
    expect((accepted?.payload as { amplitude: number }).amplitude).toBeCloseTo(0.12, 5)
  })
})
