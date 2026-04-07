export interface CacheMetricsSnapshot {
  textHits: number
  textMisses: number
  audioHits: number
  audioMisses: number
  generations: number
  averageGenerationLatencyMs: number
}

export class CacheMetrics {
  private textHits = 0
  private textMisses = 0
  private audioHits = 0
  private audioMisses = 0
  private generations = 0
  private generationLatencyTotalMs = 0

  markTextHit(): void {
    this.textHits += 1
  }

  markTextMiss(): void {
    this.textMisses += 1
  }

  markAudioHit(): void {
    this.audioHits += 1
  }

  markAudioMiss(): void {
    this.audioMisses += 1
  }

  markGenerationLatency(latencyMs: number): void {
    this.generations += 1
    this.generationLatencyTotalMs += latencyMs
  }

  snapshot(): CacheMetricsSnapshot {
    return {
      textHits: this.textHits,
      textMisses: this.textMisses,
      audioHits: this.audioHits,
      audioMisses: this.audioMisses,
      generations: this.generations,
      averageGenerationLatencyMs:
        this.generations === 0 ? 0 : this.generationLatencyTotalMs / this.generations
    }
  }
}
