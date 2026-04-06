import type { KnockDetectionConfig, KnockSignal } from './types'

const defaultConfig: KnockDetectionConfig = {
  calibrationSampleCount: 300,
  thresholdMultiplier: 3.5,
  minThreshold: 0.08,
  transientDelta: 0.03,
  refractoryPeriodMs: 400
}

export class KnockDetector {
  private readonly config: KnockDetectionConfig
  private readonly onKnock: (signal: KnockSignal) => void
  private readonly calibrationSamples: number[] = []
  private calibrated = false
  private baseline = 0
  private lastAmplitude = 0
  private lastKnockAt = Number.NEGATIVE_INFINITY

  constructor(onKnock: (signal: KnockSignal) => void, config?: Partial<KnockDetectionConfig>) {
    this.onKnock = onKnock
    this.config = {
      ...defaultConfig,
      ...(config ?? {})
    }
  }

  ingestAmplitude(amplitude: number, now = Date.now()): boolean {
    if (!this.calibrated) {
      this.consumeCalibration(amplitude)
      this.lastAmplitude = amplitude
      return false
    }

    const threshold = Math.max(this.config.minThreshold, this.baseline * this.config.thresholdMultiplier)
    const isTransient = amplitude - this.lastAmplitude >= this.config.transientDelta
    const cooldownElapsed = now - this.lastKnockAt >= this.config.refractoryPeriodMs
    const isKnock = amplitude >= threshold && isTransient && cooldownElapsed

    if (isKnock) {
      this.lastKnockAt = now
      this.onKnock({
        timestamp: now,
        amplitude,
        threshold,
        baseline: this.baseline
      })
    }

    this.lastAmplitude = amplitude
    return isKnock
  }

  isCalibrated(): boolean {
    return this.calibrated
  }

  getBaseline(): number {
    return this.baseline
  }

  private consumeCalibration(amplitude: number): void {
    this.calibrationSamples.push(amplitude)

    if (this.calibrationSamples.length < this.config.calibrationSampleCount) {
      return
    }

    const sum = this.calibrationSamples.reduce((total, value) => total + value, 0)
    this.baseline = sum / this.calibrationSamples.length
    this.calibrated = true
  }
}
