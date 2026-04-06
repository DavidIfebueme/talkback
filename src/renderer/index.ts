type DemoOutputResult = {
  textDisplayed: boolean
  audioPlayed: boolean
  fallbackReason?: string
}

export {}

type TalkbackApi = {
  version: string
  runDemoOutput: () => Promise<DemoOutputResult>
  onPopup: (handler: (message: string) => void) => () => void
  onAudioPlay: (handler: (audioPath: string) => void) => () => void
  notifyAudioEnded: () => void
}

declare global {
  interface Window {
    talkback: TalkbackApi
  }
}

const popup = document.getElementById('popup')
const demoButton = document.getElementById('demo') as HTMLButtonElement | null

window.talkback.onPopup((message: string) => {
  if (popup) {
    popup.textContent = message
  }
})

window.talkback.onAudioPlay(async (audioPath: string) => {
  try {
    const audio = new Audio(`file://${audioPath}`)
    audio.addEventListener('ended', () => {
      window.talkback.notifyAudioEnded()
    })
    await audio.play()
  } catch {
    window.talkback.notifyAudioEnded()
  }
})

demoButton?.addEventListener('click', async () => {
  const result = await window.talkback.runDemoOutput()

  if (!result.audioPlayed && popup) {
    popup.textContent = `${popup.textContent ?? ''} (${result.fallbackReason ?? 'TEXT_ONLY'})`
  }
})
