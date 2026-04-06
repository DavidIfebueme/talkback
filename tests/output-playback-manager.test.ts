import { describe, expect, it } from 'vitest'

import { AudioPlaybackManager } from '../src/main/output-engine/playback-manager'

describe('AudioPlaybackManager', () => {
  it('plays queued items sequentially with a single active playback', async () => {
    const order: string[] = []
    let active = 0
    let peak = 0

    const manager = new AudioPlaybackManager(async (task) => {
      active += 1
      peak = Math.max(peak, active)
      order.push(`${task.id}:start`)
      await new Promise((resolve) => setTimeout(resolve, 15))
      order.push(`${task.id}:end`)
      active -= 1
    })

    const first = manager.enqueue({ id: 'a', text: 'A', audioFilePath: '/tmp/a.mp3' })
    const second = manager.enqueue({ id: 'b', text: 'B', audioFilePath: '/tmp/b.mp3' })
    const third = manager.enqueue({ id: 'c', text: 'C', audioFilePath: '/tmp/c.mp3' })

    await Promise.all([first, second, third])

    expect(peak).toBe(1)
    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end'])
    expect(manager.queueSize()).toBe(0)
    expect(manager.isPlaying()).toBe(false)
  })
})
