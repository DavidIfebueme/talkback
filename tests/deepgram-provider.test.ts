import { describe, expect, it, vi } from 'vitest'

import { DeepgramTtsProvider } from '../src/main/output-engine/deepgram-provider'

describe('DeepgramTtsProvider', () => {
  it('returns audio bytes for successful synthesis', async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new TextEncoder().encode('audio-bytes').buffer
      } as Response
    })

    const provider = new DeepgramTtsProvider({
      apiKey: 'key',
      baseUrl: 'https://api.deepgram.com/v1',
      fetchImpl
    })

    const buffer = await provider.synthesize({
      text: 'hello',
      voiceId: 'voice-id',
      modelId: 'aura-2-helena-en'
    })

    expect(buffer.length).toBeGreaterThan(0)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('throws when Deepgram request fails', async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        ok: false,
        status: 401,
        text: async () => '{"err_msg":"invalid api key"}',
        arrayBuffer: async () => new ArrayBuffer(0)
      } as Response
    })

    const provider = new DeepgramTtsProvider({
      apiKey: 'key',
      baseUrl: 'https://api.deepgram.com/v1',
      fetchImpl
    })

    await expect(
      provider.synthesize({
        text: 'hello',
        voiceId: 'voice-id',
        modelId: 'aura-2-helena-en'
      })
    ).rejects.toThrow('DEEPGRAM_REQUEST_FAILED_401')
  })
})
