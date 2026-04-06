import { TriggerEngine } from '../trigger-engine/engine'
import { KeyboardMoodDetector } from './mood-detector'
import type { KeyboardMoodConfig } from './types'

export class KeyboardMoodTriggerBridge {
  private readonly detector: KeyboardMoodDetector

  constructor(triggerEngine: TriggerEngine, config?: Partial<KeyboardMoodConfig>) {
    this.detector = new KeyboardMoodDetector((signal) => {
      triggerEngine.process(
        {
          eventType: 'keyboard_state_change',
          timestamp: signal.timestamp,
          payload: {
            state: signal.state,
            kps: signal.kps,
            reason: signal.reason
          }
        },
        signal.timestamp
      )
    }, config)
  }

  getDetector(): KeyboardMoodDetector {
    return this.detector
  }
}
