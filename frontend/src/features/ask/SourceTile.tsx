import type { QuerySource } from '@/api/types'
import { hostname } from '@/lib/url'
import { cn } from '@/lib/utils'
import { SOURCE_DETAIL_ID, sourceTabId } from './citations'

interface SourceTileProps {
  source: QuerySource
  selected: boolean
  onSelect: () => void
}

/** One source as a compact tab: number, title on one line, where it came from, match %. */
export function SourceTile({ source, selected, onSelect }: SourceTileProps) {
  const title = source.title ?? (source.source_url ? hostname(source.source_url) : 'Untitled note')
  const origin = source.source_url ? hostname(source.source_url) : 'Note'
  const percent = Math.round(source.score * 100)

  return (
    <button
      type="button"
      role="tab"
      id={sourceTabId(source.index)}
      aria-selected={selected}
      aria-controls={SOURCE_DETAIL_ID}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={cn(
        'flex min-h-11 w-[12rem] shrink-0 cursor-pointer snap-start items-center gap-2.5 rounded-[10px] border-[1.5px] px-2.5 py-1.5 text-left transition-colors duration-200 sm:w-full',
        selected
          ? 'border-primary bg-primary-light'
          : 'border-border-subtle bg-transparent hover:border-border-hover hover:bg-surface-hover',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex size-6 shrink-0 items-center justify-center rounded-full font-sans text-xs font-semibold tabular-nums',
          selected ? 'bg-primary text-primary-foreground' : 'bg-navy-50 text-primary',
        )}
      >
        {source.index}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-sans text-[0.8125rem] font-semibold leading-4">
          <span className="sr-only">Source {source.index}: </span>
          {title}
        </span>
        <span className="flex gap-1 font-sans text-xs leading-4 text-muted-foreground">
          <span className="truncate">{origin}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0 tabular-nums">
            {percent}%<span className="sr-only"> match</span>
          </span>
        </span>
      </span>
    </button>
  )
}
