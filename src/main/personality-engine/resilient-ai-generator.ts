import { ResilientExecutor, type ResilienceConfig } from '../reliability/resilient-executor'
import type { AiGenerateInput, AiLineGenerator } from './types'

export const createResilientAiLineGenerator = (
  inner: AiLineGenerator,
  config?: Partial<ResilienceConfig>
): AiLineGenerator => {
  const executor = new ResilientExecutor(config)

  return async (input: AiGenerateInput) => {
    return executor.execute(async () => inner(input))
  }
}
