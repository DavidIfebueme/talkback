import { describe, expect, it } from 'vitest'

import { CircuitOpenError, ResilientExecutor } from '../src/main/reliability/resilient-executor'

describe('ResilientExecutor', () => {
  it('retries failing operations and eventually succeeds', async () => {
    const executor = new ResilientExecutor({ maxRetries: 2, failureThreshold: 5, timeoutMs: 500 })
    let attempts = 0

    const result = await executor.execute(async () => {
      attempts += 1

      if (attempts < 3) {
        throw new Error('fail')
      }

      return 'ok'
    })

    expect(result).toBe('ok')
    expect(attempts).toBe(3)
  })

  it('opens circuit after failure threshold and rejects immediately', async () => {
    const executor = new ResilientExecutor({
      maxRetries: 0,
      failureThreshold: 2,
      timeoutMs: 200,
      circuitOpenMs: 10000
    })

    await expect(executor.execute(async () => Promise.reject(new Error('x')), 1000)).rejects.toThrow()
    await expect(executor.execute(async () => Promise.reject(new Error('x')), 1001)).rejects.toThrow()

    await expect(executor.execute(async () => 'never', 1002)).rejects.toBeInstanceOf(CircuitOpenError)
    expect(executor.snapshot(1002).state).toBe('open')
  })
})
