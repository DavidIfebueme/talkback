import type { OutputRequest } from '../output-engine/types'

type OutputEmitter = {
  emit: (request: OutputRequest) => Promise<unknown>
}

interface StartupGreetingConfig {
  greetings: string[]
  voiceId: string
  modelId: string
  random: () => number
}

const defaultConfig: StartupGreetingConfig = {
  greetings: [
    'I booted before your motivation did.',
    'Good morning. Try not to stress-type me today.',
    'I am awake and ready to judge your workflow.'
  ],
  voiceId: 'default-voice',
  modelId: 'default-model',
  random: () => Math.random()
}

export class StartupGreetingService {
  private readonly output: OutputEmitter
  private readonly config: StartupGreetingConfig
  private fired = false

  constructor(output: OutputEmitter, config?: Partial<StartupGreetingConfig>) {
    this.output = output
    this.config = {
      ...defaultConfig,
      ...(config ?? {}),
      greetings: config?.greetings ?? defaultConfig.greetings,
      random: config?.random ?? defaultConfig.random
    }
  }

  async runOnce(): Promise<boolean> {
    if (this.fired) {
      return false
    }

    this.fired = true
    const greeting = this.pickGreeting()

    await this.output.emit({
      eventType: 'idle',
      text: greeting,
      useVoice: true,
      voiceId: this.config.voiceId,
      modelId: this.config.modelId
    })

    return true
  }

  private pickGreeting(): string {
    const index = Math.floor(this.config.random() * this.config.greetings.length)
    return this.config.greetings[index] ?? this.config.greetings[0] ?? 'I am online.'
  }
}
