/**
 * 共享类型定义
 *
 * 主进程、预加载脚本、渲染进程三方引用同一份类型，
 * 保证 IPC 两端的「接口契约」始终一致。
 */

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

/**
 * 渲染进程可以调用的 API 形状。
 * 由 preload 通过 contextBridge 挂到 window.api 上。
 */
export interface NotesApi {
  list(): Promise<Note[]>
  create(input?: CreateNoteInput): Promise<Note>
  update(input: UpdateNoteInput): Promise<Note | null>
  remove(id: number): Promise<boolean>
}
