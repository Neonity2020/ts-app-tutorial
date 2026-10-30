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
  // 用户数据目录：Windows 下是 %AppData%\MiniNote，macOS 下是 ~/Library/Application Support/MiniNote
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
