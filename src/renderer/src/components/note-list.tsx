import { ScrollArea, ScrollBar } from '@renderer/components/ui/scroll-area'
import { formatRelative } from '@renderer/lib/time'
import type { Note } from '@shared/types'

interface NoteListProps {
  notes: Note[]
  selectedId: number | null
  onSelect: (id: number) => void
}

export function NoteList({ notes, selectedId, onSelect }: NoteListProps): React.JSX.Element {
  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-1 px-2 py-1">
        {notes.map((note) => {
          const active = note.id === selectedId
          return (
            <button
              key={note.id}
              type="button"
              onClick={() => onSelect(note.id)}
              className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-colors ${
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent/50'
              }`}
            >
              <span className="w-full truncate text-sm font-medium">
                {note.title || '无标题笔记'}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatRelative(note.updatedAt)}
              </span>
            </button>
          )
        })}
      </div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  )
}
