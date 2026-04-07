import { rm } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import { AudioCache } from '../src/main/output-engine/audio-cache'
import { CacheMetrics } from '../src/main/output-engine/cache-metrics'

describe('AudioCache', () => {
  it('stores entries and tracks total size', async () => {
    const dir = '/tmp/talkback-audio-cache-test'
    await rm(dir, { recursive: true, force: true })

    const metrics = new CacheMetrics()
    const cache = new AudioCache(dir, metrics, { maxSizeBytes: 1024 * 1024 })
    const key = cache.key('voice', 'model', 'hello')

    await cache.store(key, Buffer.from('hello-audio', 'utf8'))

    const path = await cache.getPathIfExists(key)
    const size = await cache.totalSizeBytes()

    expect(path).toBeDefined()
    expect(size).toBeGreaterThan(0)
    expect(metrics.snapshot().audioHits).toBe(1)
  })

  it('evicts least-recently-used entries when over size cap', async () => {
    const dir = '/tmp/talkback-audio-cache-test-lru'
    await rm(dir, { recursive: true, force: true })

    const metrics = new CacheMetrics()
    const cache = new AudioCache(dir, metrics, { maxSizeBytes: 20 })
    const first = cache.key('voice', 'model', 'first')
    const second = cache.key('voice', 'model', 'second')

    await cache.store(first, Buffer.from('123456789012345', 'utf8'))
    await cache.store(second, Buffer.from('abcdefghijklmno', 'utf8'))

    const firstPath = await cache.getPathIfExists(first)
    const secondPath = await cache.getPathIfExists(second)

    expect(firstPath).toBeUndefined()
    expect(secondPath).toBeDefined()
  })
})
