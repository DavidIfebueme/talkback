import type { TtsGenerationRequest, TtsProvider } from './types'

interface FetchLike {
  (input: string, init?: RequestInit): Promise<Response>
}

export interface DeepgramTtsProviderConfig {
  apiKey: string
  baseUrl: string
  fetchImpl?: FetchLike
}

export class DeepgramTtsProvider implements TtsProvider {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly fetchImpl: FetchLike

  constructor(config: DeepgramTtsProviderConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.fetchImpl = config.fetchImpl ?? fetch
  }

  async synthesize(request: TtsGenerationRequest): Promise<Buffer> {
    const model = encodeURIComponent(request.modelId)
    const endpoint = `${this.baseUrl}/speak?model=${model}`

    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg'
      },
      body: JSON.stringify({
        text: request.text
      })
    })

    if (!response.ok) {
      const failureBody = await response.text().catch(() => '')
      const detail = failureBody.slice(0, 200)
      const suffix = detail.length > 0 ? `:${detail}` : ''
      throw new Error(`DEEPGRAM_REQUEST_FAILED_${response.status}${suffix}`)
    }

    const audioBytes = await response.arrayBuffer()
    return Buffer.from(audioBytes)
  }
}