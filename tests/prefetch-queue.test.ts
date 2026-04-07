import { describe, expect, it } from 'vitest'

import { PrefetchQueue } from '../src/main/output-engine/prefetch-queue'

describe('PrefetchQueue', () => {
  it('deduplicates identical requests', async () => {
    const seen: string[] = []
    const queue = new PrefetchQueue(async (request) => {
      seen.push(request.text)
    })

    const first = queue.enqueue({ text: 'a', voiceId: 'v', modelId: 'm' })
    const second = queue.enqueue({ text: 'a', voiceId: 'v', modelId: 'm' })

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(first).toBe(true)
    expect(second).toBe(false)
    expect(seen).toEqual(['a'])
  })

  it('respects queue limit', () => {
    const queue = new PrefetchQueue(async () => {}, 1)
    const first = queue.enqueue({ text: 'a', voiceId: 'v', modelId: 'm' })
    const second = queue.enqueue({ text: 'b', voiceId: 'v', modelId: 'm' })

    expect(first).toBe(true)
    expect(second).toBe(false)
  })
})
