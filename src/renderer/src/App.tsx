import { Plus } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { NoteList } from './components/note-list'
import { Editor } from './components/editor'
import { EmptyState } from './components/empty-state'
import { useNotes } from './hooks/use-notes'

function App(): React.JSX.Element {
  const { notes, selectedId, selectNote, createNote, updateNote, deleteNote } = useNotes()
  // selectedId 为 null 时回退到列表第一篇（最近修改的）
  const selected = notes.find((n) => n.id === selectedId) ?? notes[0] ?? null

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <header className="flex items-center justify-between px-4 pb-2 pt-4">
          <h1 className="text-sm font-semibold text-sidebar-foreground/80">极简记事本</h1>
          <Button
            size="icon"
            variant="ghost"
            aria-label="新建笔记"
            onClick={() => void createNote()}
          >
            <Plus />
          </Button>
        </header>

        <NoteList notes={notes} selectedId={selected?.id ?? null} onSelect={selectNote} />

        <footer className="border-t border-sidebar-border px-4 py-2 text-xs text-muted-foreground">
          共 {notes.length} 条笔记
        </footer>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <Editor
            key={selected.id}
            note={selected}
            onChange={updateNote}
            onDelete={(id) => void deleteNote(id)}
          />
        ) : (
          <EmptyState onCreate={() => void createNote()} />
        )}
      </main>
    </div>
  )
}

export default App
