export interface ResilienceConfig {
  timeoutMs: number
  maxRetries: number
  failureThreshold: number
  circuitOpenMs: number
}

const defaultConfig: ResilienceConfig = {
  timeoutMs: 3000,
  maxRetries: 1,
  failureThreshold: 3,
  circuitOpenMs: 10000
}

export class CircuitOpenError extends Error {
  constructor() {
    super('CIRCUIT_OPEN')
  }
}

export class ResilientExecutor {
  private readonly config: ResilienceConfig
  private failureCount = 0
  private circuitOpenedAt: number | undefined

  constructor(config?: Partial<ResilienceConfig>) {
    this.config = {
      ...defaultConfig,
      ...(config ?? {})
    }
  }

  async execute<T>(operation: () => Promise<T>, now = Date.now()): Promise<T> {
    if (this.isCircuitOpen(now)) {
      throw new CircuitOpenError()
    }

    let lastError: unknown

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      try {
        const result = await this.withTimeout(operation())
        this.recordSuccess()
        return result
      } catch (error) {
        lastError = error
        this.recordFailure(now)

        if (attempt === this.config.maxRetries) {
          break
        }
      }
    }

    throw lastError
  }

  snapshot(now = Date.now()): { state: 'open' | 'closed'; failureCount: number } {
    return {
      state: this.isCircuitOpen(now) ? 'open' : 'closed',
      failureCount: this.failureCount
    }
  }

  private isCircuitOpen(now: number): boolean {
    if (this.circuitOpenedAt === undefined) {
      return false
    }

    if (now - this.circuitOpenedAt >= this.config.circuitOpenMs) {
      this.circuitOpenedAt = undefined
      this.failureCount = 0
      return false
    }

    return true
  }

  private recordSuccess(): void {
    this.failureCount = 0
    this.circuitOpenedAt = undefined
  }

  private recordFailure(now: number): void {
    this.failureCount += 1

    if (this.failureCount >= this.config.failureThreshold) {
      this.circuitOpenedAt = now
    }
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    const timeoutPromise = new Promise<T>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error('TIMEOUT'))
      }, this.config.timeoutMs)
    })

    return Promise.race([promise, timeoutPromise])
  }
}
