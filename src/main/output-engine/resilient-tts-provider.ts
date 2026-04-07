import { ResilientExecutor, type ResilienceConfig } from '../reliability/resilient-executor'
import type { TtsGenerationRequest, TtsProvider } from './types'

export class ResilientTtsProvider implements TtsProvider {
  private readonly inner: TtsProvider
  private readonly executor: ResilientExecutor

  constructor(inner: TtsProvider, config?: Partial<ResilienceConfig>) {
    this.inner = inner
    this.executor = new ResilientExecutor(config)
  }

  async synthesize(request: TtsGenerationRequest): Promise<Buffer> {
    return this.executor.execute(async () => this.inner.synthesize(request))
  }

  state(): { state: 'open' | 'closed'; failureCount: number } {
    return this.executor.snapshot()
  }
}
