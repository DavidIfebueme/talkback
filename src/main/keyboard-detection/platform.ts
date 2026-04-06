import type { KeyboardSourceMode } from './types'

export const resolveKeyboardSourceMode = (
  platform: NodeJS.Platform,
  sessionType: string | undefined
): KeyboardSourceMode => {
  if (platform === 'linux' && (sessionType ?? '').toLowerCase() === 'wayland') {
    return 'FOCUSED_WINDOW'
  }

  return 'GLOBAL_HOOK'
}
