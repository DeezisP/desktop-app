import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('toastAPI', {
  onShow: (cb: (payload: unknown) => void) => {
    ipcRenderer.on('toast:show', (_ev, payload) => cb(payload))
  },
  click: (roomId: number) => ipcRenderer.send('toast:click', roomId),
  done:  ()              => ipcRenderer.send('toast:done'),
})
