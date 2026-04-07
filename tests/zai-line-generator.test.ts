import { describe, expect, it, vi } from 'vitest'

import { createZaiLineGenerator } from '../src/main/personality-engine/zai-line-generator'

describe('createZaiLineGenerator', () => {
  it('returns completion text from first choice', async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'One witty line.' } }]
        })
      } as Response
    })

    const generator = createZaiLineGenerator({
      apiKey: 'key',
      model: 'glm-test',
      baseUrl: 'https://api.z.ai/api/paas/v4',
      fetchImpl
    })

    const text = await generator({
      eventType: 'idle',
      context: {
        eventType: 'idle',
        timestamp: 1,
        payload: { idleSeconds: 90 }
      }
    })

    expect(text).toBe('One witty line.')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('throws on empty response content', async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [] })
      } as Response
    })

    const generator = createZaiLineGenerator({
      apiKey: 'key',
      model: 'glm-test',
      baseUrl: 'https://api.z.ai/api/paas/v4',
      fetchImpl
    })

    await expect(
      generator({
        eventType: 'idle',
        context: {
          eventType: 'idle',
          timestamp: 1,
          payload: {}
        }
      })
    ).rejects.toThrow('ZAI_EMPTY_RESPONSE')
  })
})