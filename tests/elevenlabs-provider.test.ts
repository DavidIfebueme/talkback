import { describe, expect, it, vi } from 'vitest'

import { ElevenLabsTtsProvider } from '../src/main/output-engine/elevenlabs-provider'

describe('ElevenLabsTtsProvider', () => {
  it('returns audio bytes for successful synthesis', async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new TextEncoder().encode('audio-bytes').buffer
      } as Response
    })

    const provider = new ElevenLabsTtsProvider({
      apiKey: 'key',
      baseUrl: 'https://api.elevenlabs.io/v1',
      fetchImpl
    })

    const buffer = await provider.synthesize({
      text: 'hello',
      voiceId: 'voice-id',
      modelId: 'model-id'
    })

    expect(buffer.length).toBeGreaterThan(0)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('throws when ElevenLabs request fails', async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        ok: false,
        status: 401,
        arrayBuffer: async () => new ArrayBuffer(0)
      } as Response
    })

    const provider = new ElevenLabsTtsProvider({
      apiKey: 'key',
      baseUrl: 'https://api.elevenlabs.io/v1',
      fetchImpl
    })

    await expect(
      provider.synthesize({
        text: 'hello',
        voiceId: 'voice-id',
        modelId: 'model-id'
      })
    ).rejects.toThrow('ELEVENLABS_REQUEST_FAILED_401')
  })
})