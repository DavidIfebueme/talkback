import type { AiGenerateInput, AiLineGenerator } from '../../src/main/personality-engine/types'
import type { TtsGenerationRequest, TtsProvider } from '../../src/main/output-engine/types'

export class MockZaiGenerator {
  calls: AiGenerateInput[] = []

  readonly generate: AiLineGenerator = async (input) => {
    this.calls.push(input)
    const threshold = (input.context.payload as { threshold?: number }).threshold

    if (threshold !== undefined) {
      return `Battery at ${threshold}%. Plug me in.`
    }

    return `${input.eventType} detected.`
  }
}

export class MockTtsProvider implements TtsProvider {
  requests: TtsGenerationRequest[] = []

  async synthesize(request: TtsGenerationRequest): Promise<Buffer> {
    this.requests.push(request)
    return Buffer.from(`audio:${request.voiceId}:${request.modelId}:${request.text}`, 'utf8')
  }
}
