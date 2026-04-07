import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

import type { EventType } from '../trigger-engine/types'
import { CacheMetrics } from './cache-metrics'

interface TextCacheEntry {
  value: string
  createdAt: number
  expiresAt: number
}

export class TextCache {
  private readonly filePath: string
  private readonly metrics: CacheMetrics
  private readonly store = new Map<string, TextCacheEntry>()
  private loaded = false

  constructor(filePath: string, metrics: CacheMetrics) {
    this.filePath = filePath
    this.metrics = metrics
  }

  key(provider: string, eventType: EventType, contextHash: string): string {
    return `${provider}:${eventType}:${contextHash}`
  }

  contextHash(context: string): string {
    return createHash('sha256').update(context).digest('hex')
  }

  async get(cacheKey: string, now = Date.now()): Promise<string | undefined> {
    await this.ensureLoaded()
    const existing = this.store.get(cacheKey)

    if (!existing) {
      this.metrics.markTextMiss()
      return undefined
    }

    if (existing.expiresAt <= now) {
      this.store.delete(cacheKey)
      await this.persist()
      this.metrics.markTextMiss()
      return undefined
    }

    this.metrics.markTextHit()
    return existing.value
  }

  async set(cacheKey: string, value: string, ttlMs: number, now = Date.now()): Promise<void> {
    await this.ensureLoaded()
    this.store.set(cacheKey, {
      value,
      createdAt: now,
      expiresAt: now + ttlMs
    })
    await this.persist()
  }

  async cleanup(now = Date.now()): Promise<number> {
    await this.ensureLoaded()
    let removed = 0

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key)
        removed += 1
      }
    }

    if (removed > 0) {
      await this.persist()
    }

    return removed
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return
    }

    this.loaded = true

    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Array<[string, TextCacheEntry]>

      for (const [key, entry] of parsed) {
        this.store.set(key, entry)
      }
    } catch {
      await mkdir(this.filePath.replace(/\/[^/]+$/, ''), { recursive: true })
      await this.persist()
    }
  }

  private async persist(): Promise<void> {
    const entries = Array.from(this.store.entries())
    await writeFile(this.filePath, JSON.stringify(entries), 'utf8')
  }
}
