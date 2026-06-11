import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('badgeAPI', {
  clickBadge: () => ipcRenderer.send('badge:click'),
  onCount: (cb: (count: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, count: number) => cb(count)
    ipcRenderer.on('badge:count', listener)
  },
})
