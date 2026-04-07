import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('talkback', {
  version: '0.1.0',
  runDemoOutput: () => ipcRenderer.invoke('talkback:demo-output'),
  runDemoMoment: () => ipcRenderer.invoke('talkback:demo-moment'),
  onPopup: (handler: (message: string) => void) => {
    const listener = (_event: unknown, message: string) => handler(message)
    ipcRenderer.on('talkback:popup', listener)
    return () => ipcRenderer.removeListener('talkback:popup', listener)
  },
  onAudioPlay: (handler: (audioPath: string) => void) => {
    const listener = (_event: unknown, audioPath: string) => handler(audioPath)
    ipcRenderer.on('talkback:audio-play', listener)
    return () => ipcRenderer.removeListener('talkback:audio-play', listener)
  },
  notifyAudioEnded: () => ipcRenderer.send('talkback:audio-ended')
})
