import { useRef, useState } from 'react'
import { ArrowRight, Info } from 'lucide-react'
import type { QueryResponse, QuerySource } from '@/api/types'
import { Button } from '@/components/ui/button'
import { ItemViewModal } from '@/features/items/ItemViewModal'
import type { ItemViewTarget } from '@/features/items/ItemViewModal'
import { scrollBehavior } from '@/lib/motion'
import { AnswerPanel } from './AnswerPanel'
import { sourceTabId } from './citations'
import { SourcesPanel } from './SourcesPanel'

const NO_CONTEXT_TITLE = 'No relevant context found in your saved items'

interface AnswerViewProps {
  result: QueryResponse
  onGoToAdd: () => void
  onGoToSaved: () => void
}

/**
 * One result: the answer, then its sources as master-detail. Clicking a [n] chip or a
 * source tile selects that source; "Open full item" shows the saved item in the view dialog.
 * Render with a key per result so the selection starts on the first source each time.
 */
export function AnswerView({ result, onGoToAdd, onGoToSaved }: AnswerViewProps) {
  const [selected, setSelected] = useState(result.sources[0]?.index ?? 0)
  const [viewing, setViewing] = useState<ItemViewTarget>()
  const sourcesRef = useRef<HTMLElement>(null)

  if (!result.answered) {
    return (
      <div className="flex gap-3 rounded-[10px] border-[1.5px] border-navy-100 bg-navy-50 p-4">
        <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <p className="font-sans text-sm font-semibold">{NO_CONTEXT_TITLE}</p>
            <p className="font-body text-[0.8125rem] text-muted-foreground">
              Try rephrasing the question, or add a note or web page that covers this topic.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onGoToAdd}>
              Go to Add <ArrowRight aria-hidden />
            </Button>
            <Button variant="outline" onClick={onGoToSaved}>
              View Saved
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const sourceIndexes = new Set(result.sources.map((source) => source.index))

  // From a [n] chip: select the source, move focus to its tile, and only scroll if it is off-screen.
  function citeSource(index: number) {
    setSelected(index)
    requestAnimationFrame(() => {
      const tile = document.getElementById(sourceTabId(index))
      tile?.focus({ preventScroll: true })
      const behavior = scrollBehavior()
      tile?.scrollIntoView({ behavior, block: 'nearest', inline: 'nearest' })
      sourcesRef.current?.scrollIntoView({ behavior, block: 'nearest' })
    })
  }

  function openItem(source: QuerySource) {
    setViewing({ id: source.item_id, title: source.title, source_url: source.source_url })
  }

  return (
    <div className="space-y-5">
      <AnswerPanel
        answer={result.answer}
        model={result.model}
        sourceIndexes={sourceIndexes}
        selected={result.sources.length > 0 ? selected : undefined}
        onCite={citeSource}
      />

      {result.sources.length > 0 && (
        <SourcesPanel
          ref={sourcesRef}
          sources={result.sources}
          selected={selected}
          onSelect={setSelected}
          onOpenItem={openItem}
        />
      )}

      <ItemViewModal target={viewing} onClose={() => setViewing(undefined)} />
    </div>
  )
}
