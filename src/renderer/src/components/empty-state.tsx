import { Plus, StickyNote } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

interface EmptyStateProps {
  onCreate: () => void
}

export function EmptyState({ onCreate }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <StickyNote className="size-10 opacity-40" strokeWidth={1.5} />
      <p className="text-sm">还没有笔记，从第一条开始吧</p>
      <Button variant="outline" size="sm" onClick={onCreate}>
        <Plus />
        新建笔记
      </Button>
    </div>
  )
}
