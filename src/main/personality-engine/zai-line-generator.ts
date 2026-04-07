import type { AiGenerateInput, AiLineGenerator } from './types'

interface FetchLike {
  (input: string, init?: RequestInit): Promise<Response>
}

export interface ZaiLineGeneratorConfig {
  apiKey: string
  model: string
  baseUrl: string
  fetchImpl?: FetchLike
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

const eventSummary = (input: AiGenerateInput): string => {
  return JSON.stringify({ eventType: input.eventType, payload: input.context.payload })
}

export const createZaiLineGenerator = (config: ZaiLineGeneratorConfig): AiLineGenerator => {
  const fetchImpl = config.fetchImpl ?? fetch
  const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`

  return async (input: AiGenerateInput): Promise<string> => {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.85,
        max_tokens: 48,
        messages: [
          {
            role: 'system',
            content:
              'You are TalkBack. Return one witty sentence only, no markdown, no lists, no extra context.'
          },
          {
            role: 'user',
            content: `Generate one short personality line for this event: ${eventSummary(input)}`
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`ZAI_REQUEST_FAILED_${response.status}`)
    }

    const data = (await response.json()) as ChatCompletionResponse
    const content = data.choices?.[0]?.message?.content?.trim()

    if (!content) {
      throw new Error('ZAI_EMPTY_RESPONSE')
    }

    return content
  }
}