import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import { Separator } from '@renderer/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@renderer/components/ui/alert-dialog'
import { formatClock } from '@renderer/lib/time'
import type { Note } from '@shared/types'

interface EditorProps {
  note: Note
  onChange: (id: number, patch: { title?: string; content?: string }) => Promise<void>
  onDelete: (id: number) => void
}

/** 停止输入多久后自动保存（毫秒） */
const SAVE_DELAY = 600

type SaveStatus = 'saved' | 'editing' | 'saving'

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: '',
  editing: '编辑中…',
  saving: '保存中…'
}

/**
 * 编辑器组件。
 * 注意：App 里用 key={note.id} 渲染它 —— 切换笔记时整个组件重建，
 * 本地草稿状态天然隔离，也顺便触发一次「卸载前冲刷」。
 */
export function Editor({ note, onChange, onDelete }: EditorProps): React.JSX.Element {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [status, setStatus] = useState<SaveStatus>('saved')

  const titleRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<number | null>(null)
  const pendingRef = useRef<{ title?: string; content?: string }>({})
  const blankRef = useRef<boolean>(!note.title && !note.content)

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

  // 新建的空笔记自动聚焦标题输入框
  useEffect(() => {
    if (blankRef.current) titleRef.current?.focus()
  }, [note.id])

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex items-start gap-3 px-6 pt-5">
        <Input
          ref={titleRef}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            scheduleSave({ title: e.target.value })
          }}
          placeholder="无标题笔记"
          className="h-auto border-none bg-transparent px-0 py-1 text-xl font-semibold shadow-none focus-visible:ring-0"
        />
        <span className="shrink-0 pt-2 text-xs text-muted-foreground" data-testid="save-status">
          {status === 'saved' ? `已保存 ${formatClock(note.updatedAt)}` : STATUS_TEXT[status]}
        </span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0" aria-label="删除笔记">
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
      </div>

      <Separator className="mx-6 mt-3 w-auto" />

      <Textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value)
          scheduleSave({ content: e.target.value })
        }}
        placeholder="开始输入…"
        className="flex-1 resize-none border-none px-6 py-4 text-base shadow-none focus-visible:ring-0"
      />
    </div>
  )
}
