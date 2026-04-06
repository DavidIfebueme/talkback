export interface KnockDetectionConfig {
  calibrationSampleCount: number
  thresholdMultiplier: number
  minThreshold: number
  transientDelta: number
  refractoryPeriodMs: number
}

export interface KnockSignal {
  timestamp: number
  amplitude: number
  threshold: number
  baseline: number
}
