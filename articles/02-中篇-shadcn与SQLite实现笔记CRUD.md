# TypeScript 全栈实录（中）：一个编辑框背后，藏着一整个「后端」

> 上篇回顾：我们搞懂了 Electron「主进程 = Node 后端、渲染进程 = 前端、preload = 网关」的三层结构，用 electron-vite 脚手架跑通了第一个窗口。
>
> 本篇是整个系列技术含量最高的一篇：**接入 shadcn/ui 与 better-sqlite3，把记事本的增删改查和自动保存全部做完。**

先看目标——本篇完成后的效果：

📷 **【截图占位 1：成品界面。左侧笔记列表（标题+相对时间），右侧大标题输入框 + 正文编辑区，右上角「已保存 21:36」状态和删除按钮】**

## 一、先看全景：一次「自动保存」的完整旅程

在动手之前，把整个数据流走一遍。当你在编辑器里停止输入 600 毫秒后，会发生这些事：

```
React (renderer)                preload                 主进程 (main)
─────────────────            ─────────────           ─────────────────
Editor 防抖触发
   │
window.api.notes.update() ──▶ contextBridge 转交
                                 │
                                 ipcRenderer.invoke ──▶ ipcMain.handle('notes:update')
                                                            │
                                                        updateNote()  (db.ts)
                                                            │
                                                        better-sqlite3 写入
                                                            │
                                                        UPDATE notes SET ...
                                 ◀──────── Promise 携带最新数据 ─────────┘
   setNotes(权威数据)  ◀──────┘
列表重排、时间刷新
```

注意这条链路上的每个箭头，都是**强类型**的：从 `window.api.notes.update` 的参数，到 IPC 通道的载荷，再到 SQLite 的行数据。这就是本篇的灵魂——**用一套共享类型，把三个进程焊成一个 TS 项目。**

## 二、第一步：类型先行，定义「前后端契约」

Web 开发里，前后端靠一份接口文档（或 OpenAPI）对齐。而在 Electron 里，两端本来就在同一个仓库里——没理由不共享同一份类型定义。

新建 `src/shared/types.ts`：

```ts
export interface Note {
  id: number
  title: string
  content: string
  /** 创建时间（毫秒时间戳） */
  createdAt: number
  /** 最后修改时间（毫秒时间戳） */
  updatedAt: number
}

export interface CreateNoteInput {
  title?: string
  content?: string
}

export interface UpdateNoteInput {
  id: number
  title?: string
  content?: string
}

/** 渲染进程可以调用的 API 形状，由 preload 挂到 window.api 上 */
export interface NotesApi {
  list(): Promise<Note[]>
  create(input?: CreateNoteInput): Promise<Note>
  update(input: UpdateNoteInput): Promise<Note | null>
  remove(id: number): Promise<boolean>
}
```

一个 `Note` 实体、两个输入类型、一个 `NotesApi` 接口。它同时被三处引用：主进程（实现它）、preload（转发它）、渲染进程（调用它）。

为了让 `import type { Note } from '@shared/types'` 在所有地方生效，需要小改两个 tsconfig，把 `src/shared` 纳入两侧的编译范围，并加上 `@shared` 别名：

```jsonc
// tsconfig.node.json —— 只列出改动
{
  "include": ["electron.vite.config.*", "src/main/**/*", "src/preload/**/*", "src/shared/**/*"]
}

// tsconfig.web.json —— include 里加入 "src/shared/**/*"，paths 里加入：
{
  "paths": {
    "@renderer/*": ["src/renderer/src/*"],
    "@shared/*": ["src/shared/*"]
  }
}
```

同时在 `electron.vite.config.ts` 的 renderer 配置里补上同一个别名（构建时解析用）：

```ts
resolve: {
  alias: {
    '@renderer': resolve('src/renderer/src'),
    '@shared': resolve('src/shared')
  }
}
```

💡 一句话理解这套配置：**tsconfig 管「类型检查时认不认」，vite alias 管「打包时找不找得到」**，两边都要指路。

## 三、第二步：主进程里放一个真数据库

### 3.1 为什么数据库必须放主进程？

better-sqlite3 是**原生模块**（C++ 编译的 `.node` 文件），它只能跑在 Node 环境里。而渲染进程出于安全考虑没有 Node 能力——所以数据库天生属于主进程。

这其实是好事：**数据库连接天然单例**。渲染进程就算开十个窗口，也都走 IPC 汇到主进程这一个连接上，不存在多连接写坏数据的问题。

### 3.2 安装它（2026 年的好消息）

```bash
pnpm add better-sqlite3
pnpm add -D @types/better-sqlite3
```

如果你用的是 v12 及以下的旧版本，会看到 pnpm 的一个警告：

```text
Ignored build scripts: better-sqlite3@12.x
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

这是 pnpm v10 的安全策略：**默认拦截依赖的安装脚本**，防止包在安装时执行任意代码。而 v13 已经不需要任何安装脚本（预编译二进制随包分发），这条警告压根不会出现。另外，官方脚手架在 `postinstall` 钩子里留了兜底（`install-electron && electron-builder install-app-deps`，自动把原生依赖处理成 Electron 能用的形态），新旧版本都覆盖到了。

💡 **划重点：好消息**。老教程会告诉你「better-sqlite3 必须用 electron-rebuild 重编译，否则和 Electron 的 ABI 对不上」，还要装 Visual Studio Build Tools——在 2026 年这页可以翻篇了。better-sqlite3 从 v13 起改用 **N-API** 方案，把全平台预编译二进制直接打进了 npm 包里，而 N-API 是跨 Node/Electron 版本稳定的 ABI。也就是说：**装完即用，不需要任何重编译。** 我在 Electron 44（ABI 149）里实测增删查全部正常。

只有当你用的是 v12 及以下的老版本时，才需要走 `pnpm add -D @electron/rebuild` + `pnpm exec electron-rebuild` 的老路。

### 3.3 写数据访问层

新建 `src/main/db.ts`，这是我们的「DAO 层」：

```ts
import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'
import type { CreateNoteInput, Note, UpdateNoteInput } from '../shared/types'

let db: Database.Database

/** 数据库里的原始行（snake_case），与对外的 Note（camelCase）区分开 */
interface NoteRow {
  id: number
  title: string
  content: string
  created_at: number
  updated_at: number
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/** 初始化数据库连接并建表，必须在 app.whenReady 之后调用 */
export function initDb(): void {
  // 用户数据目录：Windows 下是 %AppData%\MiniNote，macOS 下是
  // ~/Library/Application Support/MiniNote
  const dbPath = join(app.getPath('userData'), 'mininote.db')
  db = new Database(dbPath)

  // WAL 模式：读写更快，进程意外退出也不容易损坏数据
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT    NOT NULL DEFAULT '',
      content    TEXT    NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
}

export function listNotes(): Note[] {
  const rows = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all() as NoteRow[]
  return rows.map(toNote)
}

export function createNote(input: CreateNoteInput = {}): Note {
  const now = Date.now()
  const title = input.title ?? ''
  const content = input.content ?? ''

  const info = db
    .prepare('INSERT INTO notes (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(title, content, now, now)

  return { id: Number(info.lastInsertRowid), title, content, createdAt: now, updatedAt: now }
}

export function updateNote(input: UpdateNoteInput): Note | null {
  const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(input.id) as NoteRow | undefined
  if (!row) return null

  const now = Date.now()
  db.prepare('UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?').run(
    input.title ?? row.title,
    input.content ?? row.content,
    now,
    input.id
  )

  return {
    id: row.id,
    title: input.title ?? row.title,
    content: input.content ?? row.content,
    createdAt: row.created_at,
    updatedAt: now
  }
}

export function deleteNote(id: number): boolean {
  const info = db.prepare('DELETE FROM notes WHERE id = ?').run(id)
  return info.changes > 0
}
```

几个值得展开的细节：

**① 数据文件放 `app.getPath('userData')`。** 这是系统分配给每个应用的数据目录（Windows 在 `%AppData%\应用名`，macOS 在 `~/Library/Application Support/应用名`），用户卸载重装都不会丢，也是 Electron 官方推荐、跨平台正确的持久化位置。**千万别把数据写在安装目录里**——装进 Program Files 后那里面是只读的（下篇会展开这个坑）。

目录里的「应用名」由 Electron 运行时从 **package.json 的 `productName` 字段**读取（没有就退回 `name`）。给 `package.json` 补上一行：

```json
"productName": "MiniNote"
```

这样数据才会落在 `%AppData%\MiniNote\`，而不是 `%AppData%\notepad-app\`。注意它和 electron-builder.yml 里的 `productName` 是两回事——后者管安装包显示名，前者管运行时数据目录，两处都设上。

**② `prepare` + `?` 占位符 = 预编译语句。** 编译一次的语句可以反复换参执行（本文为求简洁每次都重新 prepare，追求极致可以把语句提成模块级常量），同时天然防 SQL 注入。它的 API 是同步的——对本地 SQLite 来说同步反而是优点：没有网络往返，一次查询就是微秒级，写同步代码比 Promise 链清爽得多。

**③ 行映射。** 数据库习惯 snake_case（`created_at`），TS 侧习惯 camelCase（`createdAt`），在 DAO 边界做一次转换，别让数据库方言泄漏到业务层。

## 四、第三步：把 IPC 线接好

### 4.1 主进程：注册「接口」

打开 `src/main/index.ts`，在 `app.whenReady()` 里初始化数据库并注册四个通道：

```ts
import { initDb, listNotes, createNote, updateNote, deleteNote } from './db'
import type { CreateNoteInput, UpdateNoteInput } from '../shared/types'

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.mininote.app')

  // 初始化数据库，然后注册 IPC 通道
  // 渲染进程通过 ipcRenderer.invoke('notes:xxx') 调到这里
  initDb()
  ipcMain.handle('notes:list', () => listNotes())
  ipcMain.handle('notes:create', (_event, input?: CreateNoteInput) => createNote(input))
  ipcMain.handle('notes:update', (_event, input: UpdateNoteInput) => updateNote(input))
  ipcMain.handle('notes:delete', (_event, id: number) => deleteNote(id))

  createWindow()
  // ……
})
```

`ipcMain.handle(通道名, 处理函数)` 的模式和 Web 框架里注册路由一模一样，通道名用 `域:动作` 的命名习惯（`notes:create`），参数类型直接引用 `shared/types` 里的定义——主进程这侧的「接口实现」完成。

### 4.2 preload：只暴露该暴露的

改写 `src/preload/index.ts`：

```ts
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
}
```

`contextBridge.exposeInMainWorld('api', api)` 做的事：把上面的对象挂到渲染进程的 `window.api` 上。关键在于安全模型——渲染进程拿到的**只是这几个函数**，它能调 `notes.list()`，但它摸不到 `ipcRenderer` 本体、摸不到 Node、摸不到数据库。暴露面越小，XSS 攻击者就算攻破了页面，能做的破坏也极其有限。

💡 源码里还有一段模板自带的「非隔离环境」回退分支（直接挂 `window`），Electron 12+ 恒为隔离模式走不到那里，为省篇幅未展示。

最后一步，改 `src/preload/index.d.ts`，让 TS 认识 `window.api`：

```ts
import { ElectronAPI } from '@electron-toolkit/preload'
import type { NotesApi } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: { notes: NotesApi }
  }
}
```

从这一刻起，在渲染进程里敲下 `window.api.notes.` ——编辑器会自动补全 `list / create / update / remove`，参数类型、返回类型全部就位。**前后端的类型链，到此完全打通。**

## 五、第四步：接入 shadcn/ui

界面方面我们用 shadcn/ui：它不是传统意义的组件库，而是把组件**源码直接生成到你的项目里**（基于 Tailwind CSS v4），可改可删，特别适合桌面应用这种需要深度定制的场景。

### 5.1 装 Tailwind v4

```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

Tailwind v4 已经不需要 `tailwind.config.js` 了，Vite 插件一把梭。修改 `electron.vite.config.ts` 的 renderer 配置：

```ts
import tailwindcss from '@tailwindcss/vite'
// ……
renderer: {
  // ……
  plugins: [react(), tailwindcss()]
}
```

### 5.2 一个真实的坑：CLI 不认识 electron-vite

按官方文档，此时应该跑 `pnpm dlx shadcn@latest init`。但你会撞上这个提示：

```text
✖ Verifying framework.
We could not detect a supported framework at xxx\notepad-app.
```

shadcn 的 CLI 靠嗅探 `vite.config.ts` / `next.config.ts` 这类文件来识别框架，而 electron-vite 的配置文件叫 `electron.vite.config.ts`——它不认识。

解法是官方文档提供的**手动配置路线**，总共三步：

**第一步**，安装配套依赖（渲染层代码会被 Vite 打包，放 devDependencies 即可）：

```bash
pnpm add -D shadcn class-variance-authority cn radix-ui lucide-react tw-animate-css @fontsource-variable/geist
```

**第二步**，在项目根目录手写 `components.json`（把组件指到渲染进程的目录里）：

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/renderer/src/assets/main.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@renderer/components",
    "utils": "@renderer/lib/utils",
    "ui": "@renderer/components/ui",
    "lib": "@renderer/lib",
    "hooks": "@renderer/hooks"
  },
  "menuColor": "default",
  "menuAccent": "subtle",
  "registries": {}
}
```

核心就是 `aliases`：把 shadcn 默认的 `@/` 前缀替换成 electron-vite 模板自带的 `@renderer/`，生成的组件就自然落在渲染进程里。

**第三步**，替换主题 CSS。把 `src/renderer/src/assets/main.css` 整个换成（可在 shadcn 文档的主题页复制完整 token，这里展示骨架）：

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import 'shadcn/tailwind.css';
@import '@fontsource-variable/geist';

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: 'Geist Variable', system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --color-background: var(--background);
  /* ……background/foreground/primary/muted/border/sidebar 等全套变量映射…… */
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  /* ……浅色主题全套 oklch 变量…… */
}

.dark {
  /* ……深色主题…… */
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

📦 *完整 CSS 太长，文章里放不下，大家在配套源码的 `src/renderer/src/assets/main.css` 里直接复制即可。*

### 5.3 生成组件

配置就绪后，shadcn CLI 就能正常工作了，把我们需要的六个组件一次生成：

```bash
pnpm dlx shadcn@latest add button input textarea scroll-area separator alert-dialog
```

📷 **【截图占位 2：终端执行 add 命令后输出 "Created 6 files" 的截图】**

再看 `src/renderer/src/components/ui/`，六个组件的源码已经躺在里面了——这就是 shadcn 的哲学：**代码是你的，不是 npm 包的**。

## 六、第五步：渲染进程，把界面拼起来

### 6.1 状态中枢：useNotes Hook

把「笔记列表」的所有状态和操作收进一个自定义 Hook，UI 组件只管渲染（新建 `src/renderer/src/hooks/use-notes.ts`）：

```ts
import { useCallback, useEffect, useState } from 'react'
import type { Note } from '@shared/types'

export interface NotePatch {
  title?: string
  content?: string
}

export interface UseNotesResult {
  notes: Note[]
  selectedId: number | null
  selectNote: (id: number) => void
  createNote: () => Promise<void>
  updateNote: (id: number, patch: NotePatch) => Promise<void>
  deleteNote: (id: number) => Promise<void>
}

/** 笔记列表的全部状态与操作，App 只跟这个 hook 打交道 */
export function useNotes(): UseNotesResult {
  const [notes, setNotes] = useState<Note[]>([])
  // null 表示「跟随列表第一篇」，比如刚启动、或选中的笔记被删除之后
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // 启动时从主进程拉取列表，默认选中最近修改的一篇
  useEffect(() => {
    window.api.notes.list().then((list) => {
      setNotes(list)
      if (list.length > 0) setSelectedId(list[0].id)
    })
  }, [])

  const createNote = useCallback(async () => {
    const note = await window.api.notes.create()
    setNotes((prev) => [note, ...prev])
    setSelectedId(note.id)
  }, [])

  // 把数据库返回的权威数据（含新的 updatedAt）替换进列表，并按「最近修改」重新排序
  const updateNote = useCallback(async (id: number, patch: NotePatch) => {
    const saved = await window.api.notes.update({ id, ...patch })
    if (!saved) return
    setNotes((prev) =>
      [saved, ...prev.filter((n) => n.id !== id)].sort((a, b) => b.updatedAt - a.updatedAt)
    )
  }, [])

  const deleteNote = useCallback(async (id: number) => {
    await window.api.notes.remove(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
    // 被删掉的正好是当前选中的笔记时，置空让 UI 回退到列表第一篇
    setSelectedId((cur) => (cur === id ? null : cur))
  }, [])

  // ……selectNote 略……

  return { notes, selectedId, selectNote, createNote, updateNote, deleteNote }
}
```

注意 `updateNote` 的设计：保存成功后不是简单覆盖字段，而是**用数据库返回的权威数据（带新的 `updatedAt`）替换整个条目并重新排序**。这样「最近编辑的笔记永远排在最上面」这件事就不需要前端额外维护状态，数据库说了算。

### 6.2 编辑器：防抖自动保存是重头戏

自动保存看似只是「输入后存一下」，做对它需要考虑三个问题。看 `src/renderer/src/components/editor.tsx` 的核心逻辑：

```tsx
/** 停止输入多久后自动保存（毫秒） */
const SAVE_DELAY = 600

const [title, setTitle] = useState(note.title)
const [content, setContent] = useState(note.content)
const [status, setStatus] = useState<'saved' | 'editing' | 'saving'>('saved')

const timerRef = useRef<number | null>(null)
const pendingRef = useRef<{ title?: string; content?: string }>({})

const doSave = (patch: { title?: string; content?: string }): void => {
  setStatus('saving')
  void onChange(note.id, patch).then(() => {
    // 保存期间如果又有新输入，保持「编辑中」状态
    if (Object.keys(pendingRef.current).length === 0) setStatus('saved')
  })
}

/** 立即把攒下的改动存盘，切换笔记 / 卸载前调用 */
const flush = (): void => {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }
  const patch = pendingRef.current
  if (Object.keys(patch).length === 0) return
  pendingRef.current = {}
  doSave(patch)
}

/** 防抖保存：每次输入都重置计时器，停止输入 SAVE_DELAY 毫秒后才真正写库 */
const scheduleSave = (patch: { title?: string; content?: string }): void => {
  pendingRef.current = { ...pendingRef.current, ...patch }
  setStatus('editing')
  if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  timerRef.current = window.setTimeout(flush, SAVE_DELAY)
}
```

**问题一：不能每敲一个字就写一次库。** 所以要防抖——每次输入重置 600ms 计时器，连打带输时只有停下来才触发保存，攒下的改动存在 `pendingRef` 里。

**问题二：用户打完字立刻切换笔记怎么办？** 防抖计时器还没走完，改动还在攒。所以需要 `flush`（冲刷）：组件卸载前立即保存。而组件卸载恰好有个天然触发点——在 App 里给编辑器加 `key`：

```tsx
<Editor key={selected.id} note={selected} onChange={updateNote} onDelete={...} />
```

切换笔记时 React 会销毁旧组件、创建新组件，于是旧编辑器的清理函数里做一次冲刷，草稿一字不丢：

```tsx
// 切走时把没来得及保存的草稿冲刷出去
useEffect(() => {
  return () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    const patch = pendingRef.current
    if (Object.keys(patch).length > 0) {
      pendingRef.current = {}
      void onChange(note.id, patch)
    }
  }
}, [onChange, note.id])
```

**问题三：用户怎么知道存没存？** 给一个三态指示器——输入时显示「编辑中…」，请求在途显示「保存中…」，成功后显示「已保存 21:36」。一颗定心丸，桌面应用的精致感就是这么来的。

### 6.3 组装界面

**先看 App 里的组装**，两个关键语义都藏在这几行里——hook 把 `selectedId` 置 `null` 只是一个信号，「跟随列表第一篇」的回退放在 App 这一层做；列表拿到的是**解析后**的选中 id：

```tsx
// App.tsx 里最关键的三行
const selected = notes.find((n) => n.id === selectedId) ?? notes[0] ?? null

<NoteList notes={notes} selectedId={selected?.id ?? null} onSelect={selectNote} />
<Editor key={selected.id} note={selected} onChange={updateNote} onDelete={(id) => void deleteNote(id)} />
```

`key={selected.id}` 的作用马上讲到。其余部分就是常规 React 了，挑关键的说：

**笔记列表项**（`note-list.tsx`）显示标题截断 + 相对时间（「刚刚 / 5 分钟前 / 3 小时前 / 10月31日」，一个十几行的 `formatRelative` 工具函数搞定）：

📷 **【截图占位 3：侧边栏笔记列表特写】**

**删除用 AlertDialog 做二次确认**（桌面应用要有桌面应用的严谨，Ctrl+Z 级别的后悔药我们不依赖）：

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="icon" aria-label="删除笔记">
      <Trash2 />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>删除这条笔记？</AlertDialogTitle>
      <AlertDialogDescription>
        「{note.title || '无标题笔记'}」将被永久删除，此操作无法撤销。
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>取消</AlertDialogCancel>
      <AlertDialogAction onClick={() => onDelete(note.id)}>删除</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**标题和正文输入框全部「无边框化」**（`border-none shadow-none focus-visible:ring-0`），让编辑区成为主角——极简记事本的气质，一半靠布局，一半靠「藏起」那些默认的框线。

## 七、验收：跑起来试一遍

```bash
pnpm dev
```

按这个清单玩一遍：

- [ ] 点右上角 **+**，新笔记出现并自动聚焦标题
- [ ] 输入内容，右上角状态在「编辑中…」→「保存中…」→「已保存 xx:xx」之间流转
- [ ] 停止输入立刻切到另一篇，再切回来——刚才的内容一字不丢（flush 生效）
- [ ] 重启应用，笔记还在（SQLite 落盘生效，文件就在 `%AppData%\MiniNote\mininote.db`）
- [ ] 删除笔记有确认弹窗，删完自动回退到列表第一篇（最近修改的那篇）

📷 **【截图占位 4：删除确认弹窗 GIF 或截图】**

## 八、中篇小结

回顾本篇的关键决策：

| 决策 | 理由 |
| --- | --- |
| 数据库放主进程 | 原生模块只能跑在 Node 侧，且连接天然单例 |
| `shared/types.ts` 共享类型 | IPC 两端契约合一，类型链从前端直达 SQL |
| preload 只暴露窄接口 | contextIsolation 安全模型，攻击面最小化 |
| shadcn 手动接入 | CLI 不识别 electron-vite，手写 `components.json` 一劳永逸 |
| 防抖 + flush 双保险 | 自动保存既要省写入，又不能丢草稿 |

还剩最后一步：把这个只能在命令行里跑的工程，变成**可以发给任何人双击安装的软件**。下篇我们用 electron-builder 打出 Windows 安装包和 macOS dmg，把这一路上踩过的坑做个了结。

> 下篇见 👋 觉得有帮助，转给那个「一直想做桌面应用」的朋友。
