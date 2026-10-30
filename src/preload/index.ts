import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { CreateNoteInput, NotesApi, UpdateNoteInput } from '../shared/types'

/**
 * 暴露给渲染进程的 API。
 * 只开放这几个方法，渲染进程接触不到 fs、better-sqlite3 等任何 Node 能力。
 */
const api: { notes: NotesApi } = {
  notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    create: (input?: CreateNoteInput) => ipcRenderer.invoke('notes:create', input),
    update: (input: UpdateNoteInput) => ipcRenderer.invoke('notes:update', input),
    remove: (id: number) => ipcRenderer.invoke('notes:delete', id)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
