import type { TtsGenerationRequest, TtsProvider } from './types'

interface FetchLike {
  (input: string, init?: RequestInit): Promise<Response>
}

export interface ElevenLabsProviderConfig {
  apiKey: string
  baseUrl: string
  fetchImpl?: FetchLike
}

export class ElevenLabsTtsProvider implements TtsProvider {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly fetchImpl: FetchLike

  constructor(config: ElevenLabsProviderConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.fetchImpl = config.fetchImpl ?? fetch
  }

  async synthesize(request: TtsGenerationRequest): Promise<Buffer> {
    const endpoint = `${this.baseUrl}/text-to-speech/${encodeURIComponent(request.voiceId)}`

    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg'
      },
      body: JSON.stringify({
        text: request.text,
        model_id: request.modelId,
        output_format: 'mp3_44100_128'
      })
    })

    if (!response.ok) {
      throw new Error(`ELEVENLABS_REQUEST_FAILED_${response.status}`)
    }

    const audioBytes = await response.arrayBuffer()
    return Buffer.from(audioBytes)
  }
}