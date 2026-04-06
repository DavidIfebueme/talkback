import { KnockDetector } from './detector'

export class MicIngestor {
  private readonly detector: KnockDetector

  constructor(detector: KnockDetector) {
    this.detector = detector
  }

  ingestChunk(samples: Float32Array, now = Date.now()): boolean {
    if (samples.length === 0) {
      return false
    }

    let peak = 0

    for (let index = 0; index < samples.length; index += 1) {
      const amplitude = Math.abs(samples[index] ?? 0)

      if (amplitude > peak) {
        peak = amplitude
      }
    }

    return this.detector.ingestAmplitude(peak, now)
  }
}
