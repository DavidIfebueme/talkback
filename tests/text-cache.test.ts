import { rm } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import { CacheMetrics } from '../src/main/output-engine/cache-metrics'
import { TextCache } from '../src/main/output-engine/text-cache'

describe('TextCache', () => {
  it('stores and retrieves cache entries with provider:event:context hash key format', async () => {
    const metrics = new CacheMetrics()
    const filePath = '/tmp/talkback-text-cache-test/index.json'
    await rm('/tmp/talkback-text-cache-test', { recursive: true, force: true })
    const cache = new TextCache(filePath, metrics)

    const contextHash = cache.contextHash('threshold=5')
    const key = cache.key('zai', 'battery_threshold', contextHash)

    await cache.set(key, 'Battery at 5%.', 1000, 100)
    const value = await cache.get(key, 500)

    expect(key.startsWith('zai:battery_threshold:')).toBe(true)
    expect(value).toBe('Battery at 5%.')
    expect(metrics.snapshot().textHits).toBe(1)
  })

  it('expires and cleans up stale entries', async () => {
    const metrics = new CacheMetrics()
    const filePath = '/tmp/talkback-text-cache-test-2/index.json'
    await rm('/tmp/talkback-text-cache-test-2', { recursive: true, force: true })
    const cache = new TextCache(filePath, metrics)

    const key = cache.key('zai', 'idle', cache.contextHash('idle=90'))

    await cache.set(key, 'Wake up.', 100, 1000)
    const first = await cache.get(key, 1050)
    const second = await cache.get(key, 1200)
    const removed = await cache.cleanup(1200)

    expect(first).toBe('Wake up.')
    expect(second).toBeUndefined()
    expect(removed).toBe(0)
    expect(metrics.snapshot().textMisses).toBe(1)
  })
})
