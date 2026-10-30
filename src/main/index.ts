import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDb, listNotes, createNote, updateNote, deleteNote } from './db'
import type { CreateNoteInput, UpdateNoteInput } from '../shared/types'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 680,
    minHeight: 440,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 开发环境加载 Vite dev server，生产环境加载打包后的静态文件
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Windows 任务栏需要 AppUserModelID 才能正确显示应用名和图标
  electronApp.setAppUserModelId('com.mininote.app')

  // 开发环境支持 F12 打开 DevTools，生产环境屏蔽 Ctrl/Cmd+R 刷新
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 初始化数据库，然后注册 IPC 通道
  // 渲染进程通过 ipcRenderer.invoke('notes:xxx') 调到这里
  initDb()
  ipcMain.handle('notes:list', () => listNotes())
  ipcMain.handle('notes:create', (_event, input?: CreateNoteInput) => createNote(input))
  ipcMain.handle('notes:update', (_event, input: UpdateNoteInput) => updateNote(input))
  ipcMain.handle('notes:delete', (_event, id: number) => deleteNote(id))

  createWindow()

  // macOS：点击 Dock 图标且没有窗口时，重新创建一个窗口
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 除了 macOS，其他平台关闭所有窗口就退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
