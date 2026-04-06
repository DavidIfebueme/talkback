import type { AudioPlaybackTask, AudioPlayer } from './types'

interface PendingTask {
  task: AudioPlaybackTask
  resolve: () => void
  reject: (error: unknown) => void
}

export class AudioPlaybackManager {
  private readonly player: AudioPlayer
  private readonly queue: PendingTask[] = []
  private playing = false

  constructor(player: AudioPlayer) {
    this.player = player
  }

  enqueue(task: AudioPlaybackTask): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.queue.push({ task, resolve, reject })
      this.drain()
    })
  }

  queueSize(): number {
    return this.queue.length
  }

  isPlaying(): boolean {
    return this.playing
  }

  private async drain(): Promise<void> {
    if (this.playing) {
      return
    }

    const next = this.queue.shift()

    if (!next) {
      return
    }

    this.playing = true

    try {
      await this.player(next.task)
      next.resolve()
    } catch (error) {
      next.reject(error)
    } finally {
      this.playing = false
      void this.drain()
    }
  }
}
