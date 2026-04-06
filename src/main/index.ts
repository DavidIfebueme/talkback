import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { SystemInformationBatteryProvider } from './battery-detection/provider'
import { BatteryPersonalityService } from './battery-detection/service'
import { IdlePersonalityService } from './idle-detection/service'
import { resolveKeyboardSourceMode } from './keyboard-detection/platform'
import { UiohookKeyboardSource, FocusedWindowKeyboardSource } from './keyboard-detection/sources'
import { KeyboardMoodTriggerBridge } from './keyboard-detection/trigger-bridge'
import { AudioCache } from './output-engine/audio-cache'
import { OutputEngine } from './output-engine/output-engine'
import { AudioPlaybackManager } from './output-engine/playback-manager'
import { TextPopupChannel } from './output-engine/popup-channel'
import { TtsGenerationWorker } from './output-engine/tts-worker'
import type { AudioPlaybackTask, TtsGenerationRequest, TtsProvider } from './output-engine/types'
import { PersonalityEngine } from './personality-engine/engine'
import { StartupGreetingService } from './startup-personality/service'
import { TriggerEngine } from './trigger-engine/engine'

let outputEngine: OutputEngine | undefined
let stopKeyboardSource: (() => Promise<void>) | undefined
let stopBatteryService: (() => void) | undefined
let stopIdleService: (() => void) | undefined

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 240,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  mainWindow.loadFile(join(app.getAppPath(), 'src/renderer/index.html'))

  const popupChannel = new TextPopupChannel((message) => {
    mainWindow.webContents.send('talkback:popup', message)
  })

  const playbackManager = new AudioPlaybackManager(async (task: AudioPlaybackTask) => {
    mainWindow.webContents.send('talkback:audio-play', task.audioFilePath)
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        resolve()
      }, 1200)

      ipcMain.once('talkback:audio-ended', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  })

  const cacheDir = join(app.getPath('userData'), 'audio-cache')
  const audioCache = new AudioCache(cacheDir)

  const provider: TtsProvider = {
    async synthesize(request: TtsGenerationRequest): Promise<Buffer> {
      await mkdir(cacheDir, { recursive: true })
      return Buffer.from(request.text, 'utf8')
    }
  }

  const ttsWorker = new TtsGenerationWorker(audioCache, provider)

  outputEngine = new OutputEngine(popupChannel, playbackManager, ttsWorker)

  const triggerEngine = new TriggerEngine()
  const personalityEngine = new PersonalityEngine()
  const startupGreeting = new StartupGreetingService(outputEngine)
  const keyboardBridge = new KeyboardMoodTriggerBridge(triggerEngine)
  const keyboardMode = resolveKeyboardSourceMode(process.platform, process.env.XDG_SESSION_TYPE)
  const batteryProvider = new SystemInformationBatteryProvider()
  const batteryService = new BatteryPersonalityService(
    batteryProvider,
    triggerEngine,
    personalityEngine,
    outputEngine,
    ttsWorker,
    {
      thresholds: [50, 20, 10, 5],
      pollIntervalMs: 30000,
      pregenSourceThreshold: 10,
      pregenTargetThreshold: 5,
      voiceId: 'default-voice',
      modelId: 'default-model'
    }
  )

  batteryService.start()
  stopBatteryService = () => {
    batteryService.stop()
  }

  const idleService = new IdlePersonalityService(
    () => powerMonitor.getSystemIdleTime(),
    triggerEngine,
    personalityEngine,
    outputEngine,
    {
      idleThresholdSec: 90,
      pollIntervalMs: 5000,
      cooldownMs: 60000,
      voiceId: 'default-voice',
      modelId: 'default-model'
    }
  )

  idleService.start()
  stopIdleService = () => {
    idleService.stop()
  }

  void startupGreeting.runOnce()

  const primarySource =
    keyboardMode === 'GLOBAL_HOOK'
      ? new UiohookKeyboardSource()
      : new FocusedWindowKeyboardSource(mainWindow)

  const fallbackSource =
    keyboardMode === 'GLOBAL_HOOK'
      ? new FocusedWindowKeyboardSource(mainWindow)
      : new UiohookKeyboardSource()

  void (async () => {
    const started = await primarySource.start((timestamp) => {
      keyboardBridge.getDetector().ingestKeydown(timestamp)
      const accepted = triggerEngine.dequeueAccepted()

      if (accepted?.eventType === 'keyboard_state_change') {
        const payload = accepted.payload as { state: string }
        popupChannel.show(`Keyboard mood: ${payload.state}`)
      }
    })

    if (!started) {
      await fallbackSource.start((timestamp) => {
        keyboardBridge.getDetector().ingestKeydown(timestamp)
      })
      stopKeyboardSource = async () => {
        await fallbackSource.stop()
      }
      return
    }

    stopKeyboardSource = async () => {
      await primarySource.stop()
    }
  })()
}

app.whenReady().then(() => {
  createWindow()

  ipcMain.handle('talkback:demo-output', async () => {
    if (!outputEngine) {
      return { textDisplayed: false, audioPlayed: false, fallbackReason: 'VOICE_GENERATION_FAILED' }
    }

    return outputEngine.emit({
      eventType: 'knock',
      text: 'Easy. I bruise emotionally.',
      useVoice: true,
      voiceId: 'default-voice',
      modelId: 'default-model'
    })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (stopKeyboardSource) {
    void stopKeyboardSource()
  }

  if (stopBatteryService) {
    stopBatteryService()
  }

  if (stopIdleService) {
    stopIdleService()
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
