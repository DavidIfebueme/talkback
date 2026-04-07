import { createHash } from 'node:crypto'
import { mkdir, access, writeFile, readFile, stat, unlink } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join, dirname } from 'node:path'

import { CacheMetrics } from './cache-metrics'

interface AudioCacheMetaEntry {
  key: string
  filePath: string
  sizeBytes: number
  createdAt: number
  lastAccessedAt: number
}

interface AudioCacheConfig {
  maxSizeBytes: number
}

export class AudioCache {
  private readonly cacheDir: string
  private readonly metadataPath: string
  private readonly config: AudioCacheConfig
  private readonly metrics: CacheMetrics
  private readonly metadata = new Map<string, AudioCacheMetaEntry>()
  private loaded = false

  constructor(cacheDir: string, metrics: CacheMetrics, config?: Partial<AudioCacheConfig>) {
    this.cacheDir = cacheDir
    this.metadataPath = join(cacheDir, 'index.json')
    this.metrics = metrics
    this.config = {
      maxSizeBytes: 200 * 1024 * 1024,
      ...(config ?? {})
    }
  }

  key(voiceId: string, modelId: string, text: string): string {
    return createHash('sha256').update(`${voiceId}:${modelId}:${text}`).digest('hex')
  }

  async getPathIfExists(key: string): Promise<string | undefined> {
    await this.ensureLoaded()
    const filePath = this.pathFor(key)

    try {
      await access(filePath, constants.F_OK)
      const entry = this.metadata.get(key)

      if (entry) {
        entry.lastAccessedAt = Date.now()
        this.metadata.set(key, entry)
        await this.persistMetadata()
      }

      this.metrics.markAudioHit()
      return filePath
    } catch {
      this.metrics.markAudioMiss()
      return undefined
    }
  }

  async store(key: string, bytes: Buffer): Promise<string> {
    await this.ensureLoaded()
    await mkdir(this.cacheDir, { recursive: true })
    const filePath = this.pathFor(key)
    await writeFile(filePath, bytes)
    const fileStat = await stat(filePath)
    const now = Date.now()

    this.metadata.set(key, {
      key,
      filePath,
      sizeBytes: fileStat.size,
      createdAt: now,
      lastAccessedAt: now
    })

    await this.cleanupToSizeCap()
    await this.persistMetadata()

    return filePath
  }

  async warm(keys: string[]): Promise<number> {
    await this.ensureLoaded()
    let warmed = 0

    for (const key of keys) {
      const path = await this.getPathIfExists(key)

      if (path) {
        warmed += 1
      }
    }

    return warmed
  }

  async totalSizeBytes(): Promise<number> {
    await this.ensureLoaded()
    return Array.from(this.metadata.values()).reduce((total, entry) => total + entry.sizeBytes, 0)
  }

  pathFor(key: string): string {
    return join(this.cacheDir, `${key}.mp3`)
  }

  private async cleanupToSizeCap(): Promise<void> {
    let total = await this.totalSizeBytes()

    if (total <= this.config.maxSizeBytes) {
      return
    }

    const sorted = Array.from(this.metadata.values()).sort(
      (left, right) => left.lastAccessedAt - right.lastAccessedAt
    )

    for (const entry of sorted) {
      if (total <= this.config.maxSizeBytes) {
        break
      }

      try {
        await unlink(entry.filePath)
      } catch {
      }

      this.metadata.delete(entry.key)
      total -= entry.sizeBytes
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return
    }

    this.loaded = true
    await mkdir(this.cacheDir, { recursive: true })

    try {
      const raw = await readFile(this.metadataPath, 'utf8')
      const parsed = JSON.parse(raw) as AudioCacheMetaEntry[]

      for (const entry of parsed) {
        this.metadata.set(entry.key, entry)
      }
    } catch {
      await this.persistMetadata()
    }
  }

  private async persistMetadata(): Promise<void> {
    await mkdir(dirname(this.metadataPath), { recursive: true })
    const serialized = JSON.stringify(Array.from(this.metadata.values()))
    await writeFile(this.metadataPath, serialized, 'utf8')
  }
}
