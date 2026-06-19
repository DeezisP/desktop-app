import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('toastAPI', {
  onSync: (cb: (items: unknown[]) => void) => {
    ipcRenderer.on('toast:sync', (_ev, items) => cb(items))
  },
  click:    (roomId: number)  => ipcRenderer.send('toast:click', roomId),
  itemDone: (toastId: string) => ipcRenderer.send('toast:item-done', toastId),
})
