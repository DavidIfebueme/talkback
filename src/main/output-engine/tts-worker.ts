import { randomUUID } from 'node:crypto'

import { AudioCache } from './audio-cache'
import { CacheMetrics } from './cache-metrics'
import type { TtsGenerationRequest, TtsGenerationResult, TtsProvider } from './types'

interface Job {
  request: TtsGenerationRequest
  resolve: (result: TtsGenerationResult) => void
}

export class TtsGenerationWorker {
  private readonly cache: AudioCache
  private readonly provider: TtsProvider
  private readonly metrics: CacheMetrics
  private readonly queue: Job[] = []
  private running = false

  constructor(cache: AudioCache, provider: TtsProvider, metrics: CacheMetrics) {
    this.cache = cache
    this.provider = provider
    this.metrics = metrics
  }

  async enqueue(request: TtsGenerationRequest): Promise<TtsGenerationResult> {
    const cacheKey = this.cache.key(request.voiceId, request.modelId, request.text)
    const cachedPath = await this.cache.getPathIfExists(cacheKey)

    if (cachedPath) {
      return { status: 'ready', audioFilePath: cachedPath }
    }

    return new Promise<TtsGenerationResult>((resolve) => {
      this.queue.push({ request, resolve })
      void this.run()
    })
  }

  schedule(request: TtsGenerationRequest): string {
    const id = randomUUID()
    void this.enqueue(request)
    return id
  }

  async prefetch(request: TtsGenerationRequest): Promise<void> {
    await this.enqueue(request)
  }

  private async run(): Promise<void> {
    if (this.running) {
      return
    }

    const next = this.queue.shift()

    if (!next) {
      return
    }

    this.running = true

    try {
      const { request } = next
      const cacheKey = this.cache.key(request.voiceId, request.modelId, request.text)
      const startedAt = Date.now()
      const bytes = await this.provider.synthesize(request)
      const path = await this.cache.store(cacheKey, bytes)
      this.metrics.markGenerationLatency(Date.now() - startedAt)
      next.resolve({ status: 'ready', audioFilePath: path })
    } catch {
      next.resolve({ status: 'fallback_text_only' })
    } finally {
      this.running = false
      void this.run()
    }
  }
}
