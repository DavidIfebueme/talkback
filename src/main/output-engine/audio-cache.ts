import { createHash } from 'node:crypto'
import { mkdir, access, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'

export class AudioCache {
  private readonly cacheDir: string

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir
  }

  key(voiceId: string, modelId: string, text: string): string {
    return createHash('sha256').update(`${voiceId}:${modelId}:${text}`).digest('hex')
  }

  async getPathIfExists(key: string): Promise<string | undefined> {
    const filePath = this.pathFor(key)

    try {
      await access(filePath, constants.F_OK)
      return filePath
    } catch {
      return undefined
    }
  }

  async store(key: string, bytes: Buffer): Promise<string> {
    await mkdir(this.cacheDir, { recursive: true })
    const filePath = this.pathFor(key)
    await writeFile(filePath, bytes)
    return filePath
  }

  pathFor(key: string): string {
    return join(this.cacheDir, `${key}.mp3`)
  }
}
