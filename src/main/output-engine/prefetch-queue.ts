import type { TtsGenerationRequest } from './types'

type PrefetchRunner = (request: TtsGenerationRequest) => Promise<void>

export class PrefetchQueue {
  private readonly runner: PrefetchRunner
  private readonly queueLimit: number
  private readonly pending = new Set<string>()
  private readonly queue: TtsGenerationRequest[] = []
  private running = false

  constructor(runner: PrefetchRunner, queueLimit = 64) {
    this.runner = runner
    this.queueLimit = queueLimit
  }

  enqueue(request: TtsGenerationRequest): boolean {
    const key = `${request.voiceId}:${request.modelId}:${request.text}`

    if (this.pending.has(key)) {
      return false
    }

    if (this.pending.size >= this.queueLimit) {
      return false
    }

    this.pending.add(key)
    this.queue.push(request)
    void this.run()
    return true
  }

  size(): number {
    return this.queue.length
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
    const key = `${next.voiceId}:${next.modelId}:${next.text}`

    try {
      await this.runner(next)
    } finally {
      this.pending.delete(key)
      this.running = false
      void this.run()
    }
  }
}
