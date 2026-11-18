import type { KeyboardEvent, Ref } from 'react'
import type { QuerySource } from '@/api/types'
import { SectionLabel } from '@/components/SectionLabel'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { sourceTabId } from './citations'
import { SourceDetail } from './SourceDetail'
import { SourceTile } from './SourceTile'

interface SourcesPanelProps {
  sources: readonly QuerySource[]
  selected: number
  onSelect: (index: number) => void
  onOpenItem: (source: QuerySource) => void
  ref?: Ref<HTMLElement>
}

/**
 * Master-detail sources: a column of compact tiles (a swipeable row on phones) beside one
 * detail panel, instead of a long stack of tall cards. Arrow keys move between tiles.
 */
export function SourcesPanel({ sources, selected, onSelect, onOpenItem, ref }: SourcesPanelProps) {
  const sideBySide = useMediaQuery('(min-width: 640px)')
  const current = sources.find((source) => source.index === selected) ?? sources[0]

  function handleKeyDown(event: KeyboardEvent) {
    const position = sources.findIndex((source) => source.index === current.index)
    let next: number | undefined
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (position + 1) % sources.length
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (position - 1 + sources.length) % sources.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = sources.length - 1
    if (next === undefined) return
    event.preventDefault()
    const target = sources[next]
    onSelect(target.index)
    document.getElementById(sourceTabId(target.index))?.focus()
  }

  return (
    <section ref={ref} aria-labelledby="sources-heading" className="space-y-2.5">
      <SectionLabel id="sources-heading" aside={`${sources.length} cited`}>
        Sources
      </SectionLabel>

      <div className="sm:grid sm:grid-cols-[13.5rem_minmax(0,1fr)] sm:gap-4">
        <div
          role="tablist"
          aria-label="Sources"
          aria-orientation={sideBySide ? 'vertical' : 'horizontal'}
          onKeyDown={handleKeyDown}
          className="relative -mx-4 mb-2 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:mx-0 sm:mb-0 sm:flex-col sm:gap-1 sm:overflow-visible sm:px-0 sm:pb-0"
        >
          {sources.map((source) => (
            <SourceTile
              key={source.index}
              source={source}
              selected={source.index === current.index}
              onSelect={() => onSelect(source.index)}
            />
          ))}
        </div>

        <SourceDetail key={current.index} source={current} onOpenItem={onOpenItem} />
      </div>
    </section>
  )
}
