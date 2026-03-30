import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('talkback', {
  version: '0.1.0'
})
