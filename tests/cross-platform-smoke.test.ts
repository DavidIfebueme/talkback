import { describe, expect, it } from 'vitest'

import { resolveKeyboardSourceMode } from '../src/main/keyboard-detection/platform'
import { MockTtsProvider, MockZaiGenerator } from './mocks/providers'

describe('Cross-platform smoke', () => {
  it('resolves keyboard mode across linux/windows/macos sessions', () => {
    const matrix: Array<{ platform: NodeJS.Platform; sessionType?: string; expected: string }> = [
      { platform: 'linux', sessionType: 'wayland', expected: 'FOCUSED_WINDOW' },
      { platform: 'linux', sessionType: 'x11', expected: 'GLOBAL_HOOK' },
      { platform: 'win32', sessionType: 'wayland', expected: 'GLOBAL_HOOK' },
      { platform: 'darwin', sessionType: 'wayland', expected: 'GLOBAL_HOOK' }
    ]

    for (const entry of matrix) {
      expect(resolveKeyboardSourceMode(entry.platform, entry.sessionType)).toBe(entry.expected)
    }
  })

  it('provider mocks behave consistently for test usage', async () => {
    const zai = new MockZaiGenerator()
    const ttsProvider = new MockTtsProvider()

    const text = await zai.generate({
      eventType: 'battery_threshold',
      context: {
        eventType: 'battery_threshold',
        timestamp: 1000,
        payload: { threshold: 5 }
      }
    })

    const bytes = await ttsProvider.synthesize({ text, voiceId: 'voice', modelId: 'model' })

    expect(text).toContain('Battery at 5%')
    expect(bytes.length).toBeGreaterThan(0)
  })
})
