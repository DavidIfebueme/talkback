import 'dotenv/config'

import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { SystemInformationBatteryProvider } from './battery-detection/provider'
import { BatteryPersonalityService } from './battery-detection/service'
import { loadAppEnvironment } from './config/env'
import { IdlePersonalityService } from './idle-detection/service'
import { resolveKeyboardSourceMode } from './keyboard-detection/platform'
import { UiohookKeyboardSource, FocusedWindowKeyboardSource } from './keyboard-detection/sources'
import { KeyboardMoodTriggerBridge } from './keyboard-detection/trigger-bridge'
import { AudioCache } from './output-engine/audio-cache'
import { CacheMetrics } from './output-engine/cache-metrics'
import { ElevenLabsTtsProvider } from './output-engine/elevenlabs-provider'
import { OutputEngine } from './output-engine/output-engine'
import { AudioPlaybackManager } from './output-engine/playback-manager'
import { PrefetchQueue } from './output-engine/prefetch-queue'
import { TextPopupChannel } from './output-engine/popup-channel'
import { ResilientTtsProvider } from './output-engine/resilient-tts-provider'
import { TextCache } from './output-engine/text-cache'
import { TtsGenerationWorker } from './output-engine/tts-worker'
import type { AudioPlaybackTask, TtsGenerationRequest, TtsProvider } from './output-engine/types'
import { PersonalityEngine } from './personality-engine/engine'
import { createResilientAiLineGenerator } from './personality-engine/resilient-ai-generator'
import { createZaiLineGenerator } from './personality-engine/zai-line-generator'
import { StartupGreetingService } from './startup-personality/service'
import { TriggerEngine } from './trigger-engine/engine'

let outputEngine: OutputEngine | undefined
let cacheMetrics: CacheMetrics | undefined
let stopKeyboardSource: (() => Promise<void>) | undefined
let stopBatteryService: (() => void) | undefined
let stopIdleService: (() => void) | undefined
let stopTextCacheCleanup: (() => void) | undefined
let demoMomentCursor = 0

const demoMomentLines = [
  'I felt that knock. Confidence level: theatrical.',
  'Keyboard mood update: deadline thunderstorm approaching.',
  'Battery warning simulation: power me before I start monologuing.',
  'Idle alert simulation: silence this loud is suspicious.',
  'System banter ready. Give me chaos and I will narrate it.'
]

const appEnvironment = loadAppEnvironment()

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
  cacheMetrics = new CacheMetrics()
  const audioCache = new AudioCache(cacheDir, cacheMetrics, {
    maxSizeBytes: 200 * 1024 * 1024
  })
  const textCache = new TextCache(join(app.getPath('userData'), 'text-cache.json'), cacheMetrics)

  const fallbackTtsProvider: TtsProvider = {
    async synthesize(request: TtsGenerationRequest): Promise<Buffer> {
      await mkdir(cacheDir, { recursive: true })
      return Buffer.from(request.text, 'utf8')
    }
  }

  const baseTtsProvider: TtsProvider = appEnvironment.elevenLabsApiKey
    ? new ElevenLabsTtsProvider({
        apiKey: appEnvironment.elevenLabsApiKey,
        baseUrl: appEnvironment.elevenLabsBaseUrl
      })
    : fallbackTtsProvider

  const resilientTtsProvider = new ResilientTtsProvider(baseTtsProvider, {
    timeoutMs: 3000,
    maxRetries: 2,
    failureThreshold: 4,
    circuitOpenMs: 15000
  })

  const ttsWorker = new TtsGenerationWorker(audioCache, resilientTtsProvider, cacheMetrics)
  const prefetchQueue = new PrefetchQueue(async (request) => {
    await ttsWorker.prefetch(request)
  })

  outputEngine = new OutputEngine(popupChannel, playbackManager, ttsWorker)

  const triggerEngine = new TriggerEngine()
  const aiGenerator = appEnvironment.zaiApiKey
    ? createResilientAiLineGenerator(
        createZaiLineGenerator({
          apiKey: appEnvironment.zaiApiKey,
          model: appEnvironment.zaiModel,
          baseUrl: appEnvironment.zaiBaseUrl
        }),
        {
          timeoutMs: 2000,
          maxRetries: 1,
          failureThreshold: 4,
          circuitOpenMs: 10000
        }
      )
    : undefined

  const personalityEngine = new PersonalityEngine({
    aiLineGenerator: aiGenerator
  })
  const startupGreeting = new StartupGreetingService(outputEngine, {
    voiceId: appEnvironment.elevenLabsDefaultVoiceId,
    modelId: appEnvironment.elevenLabsDefaultModelId
  })
  const keyboardBridge = new KeyboardMoodTriggerBridge(triggerEngine)
  const keyboardMode = resolveKeyboardSourceMode(process.platform, process.env.XDG_SESSION_TYPE)
  const batteryProvider = new SystemInformationBatteryProvider()
  const batteryService = new BatteryPersonalityService(
    batteryProvider,
    triggerEngine,
    personalityEngine,
    outputEngine,
    ttsWorker,
    textCache,
    prefetchQueue,
    {
      thresholds: [50, 20, 10, 5],
      pollIntervalMs: 30000,
      pregenSourceThreshold: 10,
      pregenTargetThreshold: 5,
      voiceId: appEnvironment.elevenLabsDefaultVoiceId,
      modelId: appEnvironment.elevenLabsDefaultModelId
    }
  )

  batteryService.start()
  stopBatteryService = () => {
    batteryService.stop()
  }

  const warmTexts = [
    'Easy. I bruise emotionally.',
    'You type like the deadline is armed.',
    'Battery is dropping faster than your optimism.'
  ]

  for (const text of warmTexts) {
    prefetchQueue.enqueue({
      text,
      voiceId: 'default-voice',
      modelId: 'default-model'
    })
  }

  const textCleanupInterval = setInterval(() => {
    void textCache.cleanup()
  }, 60000)

  stopTextCacheCleanup = () => {
    clearInterval(textCleanupInterval)
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
      voiceId: appEnvironment.elevenLabsDefaultVoiceId,
      modelId: appEnvironment.elevenLabsDefaultModelId
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
      const fallbackStarted = await fallbackSource.start((timestamp) => {
        keyboardBridge.getDetector().ingestKeydown(timestamp)
      })

      if (!fallbackStarted) {
        popupChannel.show('Keyboard hooks unavailable on this session.')
        stopKeyboardSource = undefined
        return
      }

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

  ipcMain.handle('talkback:cache-metrics', async () => {
    if (!cacheMetrics) {
      return null
    }

    return cacheMetrics.snapshot()
  })

  ipcMain.handle('talkback:demo-output', async () => {
    if (!outputEngine) {
      return { textDisplayed: false, audioPlayed: false, fallbackReason: 'VOICE_GENERATION_FAILED' }
    }

    return outputEngine.emit({
      eventType: 'knock',
      text: 'Easy. I bruise emotionally.',
      useVoice: true,
      voiceId: appEnvironment.elevenLabsDefaultVoiceId,
      modelId: appEnvironment.elevenLabsDefaultModelId
    })
  })

  ipcMain.handle('talkback:demo-moment', async () => {
    if (!outputEngine) {
      return { textDisplayed: false, audioPlayed: false, fallbackReason: 'VOICE_GENERATION_FAILED' }
    }

    const line = demoMomentLines[demoMomentCursor % demoMomentLines.length] ?? 'Demo moment ready.'
    demoMomentCursor += 1

    return outputEngine.emit({
      eventType: 'idle',
      text: line,
      useVoice: true,
      voiceId: appEnvironment.elevenLabsDefaultVoiceId,
      modelId: appEnvironment.elevenLabsDefaultModelId
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

  if (stopTextCacheCleanup) {
    stopTextCacheCleanup()
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
