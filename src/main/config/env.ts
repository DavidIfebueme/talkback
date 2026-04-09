export interface AppEnvironment {
  zaiApiKey?: string
  zaiModel: string
  zaiBaseUrl: string
  deepgramApiKey?: string
  deepgramBaseUrl: string
  deepgramDefaultVoiceId: string
  deepgramDefaultModelId: string
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
    deepgramApiKey: read('DEEPGRAM_API_KEY'),
    deepgramBaseUrl: read('DEEPGRAM_BASE_URL') ?? 'https://api.deepgram.com/v1',
    deepgramDefaultVoiceId: read('DEEPGRAM_VOICE_ID') ?? 'deepgram-aura',
    deepgramDefaultModelId: read('DEEPGRAM_TTS_MODEL') ?? 'aura-2-helena-en'
  }
}