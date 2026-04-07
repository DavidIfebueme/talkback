export interface AppEnvironment {
  zaiApiKey?: string
  zaiModel: string
  zaiBaseUrl: string
  elevenLabsApiKey?: string
  elevenLabsBaseUrl: string
  elevenLabsDefaultVoiceId: string
  elevenLabsDefaultModelId: string
}

const read = (name: string): string | undefined => {
  const value = process.env[name]

  if (!value) {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

export const loadAppEnvironment = (): AppEnvironment => {
  return {
    zaiApiKey: read('ZAI_API_KEY'),
    zaiModel: read('ZAI_MODEL') ?? 'glm-4.5-air',
    zaiBaseUrl: read('ZAI_BASE_URL') ?? 'https://api.z.ai/api/paas/v4',
    elevenLabsApiKey: read('ELEVENLABS_API_KEY'),
    elevenLabsBaseUrl: read('ELEVENLABS_BASE_URL') ?? 'https://api.elevenlabs.io/v1',
    elevenLabsDefaultVoiceId: read('ELEVENLABS_VOICE_ID') ?? 'JBFqnCBsd6RMkjVDRZzb',
    elevenLabsDefaultModelId: read('ELEVENLABS_MODEL_ID') ?? 'eleven_multilingual_v2'
  }
}