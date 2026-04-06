import { KnockDetector } from './detector'
import type { KnockDetectionConfig, KnockSignal } from './types'
import { TriggerEngine } from '../trigger-engine/engine'

export class KnockTriggerBridge {
  private readonly detector: KnockDetector

  constructor(triggerEngine: TriggerEngine, config?: Partial<KnockDetectionConfig>) {
    this.detector = new KnockDetector((signal: KnockSignal) => {
      triggerEngine.process(
        {
          eventType: 'knock',
          timestamp: signal.timestamp,
          payload: {
            amplitude: signal.amplitude,
            threshold: signal.threshold,
            baseline: signal.baseline
          }
        },
        signal.timestamp
      )
    }, config)
  }

  getDetector(): KnockDetector {
    return this.detector
  }
}
