import { describe, expect, it } from 'vitest'

import { StartupGreetingService } from '../src/main/startup-personality/service'

describe('StartupGreetingService', () => {
  it('emits greeting once and ignores subsequent calls', async () => {
    const messages: string[] = []

    const output = {
      emit: async (request: { text: string }) => {
        messages.push(request.text)
      }
    }

    const service = new StartupGreetingService(output, {
      greetings: ['hello one', 'hello two'],
      random: () => 0
    })

    const first = await service.runOnce()
    const second = await service.runOnce()

    expect(first).toBe(true)
    expect(second).toBe(false)
    expect(messages).toEqual(['hello one'])
  })
})
