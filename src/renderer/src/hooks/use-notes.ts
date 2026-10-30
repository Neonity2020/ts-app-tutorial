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

  const selectNote = useCallback((id: number) => {
    setSelectedId(id)
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

  return { notes, selectedId, selectNote, createNote, updateNote, deleteNote }
}
