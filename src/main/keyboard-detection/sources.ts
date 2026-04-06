import type { BrowserWindow } from 'electron'

import type { KeyboardEventSource } from './types'

type UiohookApi = {
  on(event: 'keydown', handler: () => void): void
  off(event: 'keydown', handler: () => void): void
  start(): void
  stop(): void
}

export class UiohookKeyboardSource implements KeyboardEventSource {
  private hook: UiohookApi | undefined
  private keydownHandler: (() => void) | undefined

  async start(onKeydown: (timestamp: number) => void): Promise<boolean> {
    try {
      const moduleRef = await import('uiohook-napi')
      const hook = (moduleRef.uIOhook ?? moduleRef.default?.uIOhook) as UiohookApi | undefined

      if (!hook) {
        return false
      }

      this.hook = hook
      this.keydownHandler = () => onKeydown(Date.now())
      hook.on('keydown', this.keydownHandler)
      hook.start()
      return true
    } catch {
      return false
    }
  }

  async stop(): Promise<void> {
    if (!this.hook || !this.keydownHandler) {
      return
    }

    this.hook.off('keydown', this.keydownHandler)
    this.hook.stop()
    this.keydownHandler = undefined
    this.hook = undefined
  }
}

export class FocusedWindowKeyboardSource implements KeyboardEventSource {
  private readonly window: BrowserWindow
  private listener: ((event: unknown, input: { type: string }) => void) | undefined

  constructor(window: BrowserWindow) {
    this.window = window
  }

  async start(onKeydown: (timestamp: number) => void): Promise<boolean> {
    this.listener = (_event: unknown, input: { type: string }) => {
      if (input.type === 'keyDown') {
        onKeydown(Date.now())
      }
    }

    this.window.webContents.on('before-input-event', this.listener)
    return true
  }

  async stop(): Promise<void> {
    if (!this.listener) {
      return
    }

    this.window.webContents.removeListener('before-input-event', this.listener)
    this.listener = undefined
  }
}
