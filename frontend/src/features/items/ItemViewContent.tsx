import { useState } from 'react'
import type { ReactNode } from 'react'
import { AlignLeft, AlertCircle, ExternalLink, FileText, Layers, Link2, X } from 'lucide-react'
import { useItem } from '@/api/hooks'
import { ErrorNotice } from '@/components/ErrorNotice'
import { PillTabs } from '@/components/PillTabs'
import type { PillTab } from '@/components/PillTabs'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatRelative } from '@/lib/time'
import { hostname } from '@/lib/url'
import { cn } from '@/lib/utils'
import { displayTitle } from './displayTitle'
import { ItemChunksPanel } from './ItemChunksPanel'
import type { ItemViewTarget } from './ItemViewModal'
import { ItemTextPanel } from './ItemTextPanel'
import { StatusBadge } from './StatusBadge'

export const ITEM_VIEW_TITLE_ID = 'item-view-title'

type ViewTab = 'text' | 'chunks'

function BodySkeleton() {
  return (
    <div aria-busy data-item-skeleton className="space-y-5">
      <div aria-hidden className="space-y-3">
        <div className="skeleton h-3.5 w-24" />
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-11/12" />
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-2/3" />
      </div>
      <span className="sr-only">Loading the saved text…</span>
    </div>
  )
}

function ViewPanel({ id, active, children }: { id: ViewTab; active: boolean; children: ReactNode }) {
  return (
    <div
      id={`item-panel-${id}`}
      role="tabpanel"
      aria-labelledby={`item-tab-${id}`}
      hidden={!active}
      className={cn('min-h-0 flex-1 flex-col', active ? 'flex' : 'hidden')}
    >
      {children}
    </div>
  )
}

interface ItemViewContentProps {
  /** What the opener knows (a list row, or just id/title/url); drives the header while loading. */
  target: ItemViewTarget
  onClose: () => void
}

/**
 * Pinned header and tabs, then one panel at a time. The panel area has a stable size and
 * scrolls internally, so the dialog neither jumps between tabs nor scrolls as a whole.
 * Keyed by item id by the caller, so each newly opened item starts on the Text tab.
 */
export function ItemViewContent({ target, onClose }: ItemViewContentProps) {
  const { data, error, isPending, refetch, isFetching } = useItem(target.id)
  const [tab, setTab] = useState<ViewTab>('text')
  const [chunksOpened, setChunksOpened] = useState(false)

  // Until the full item arrives, fall back to whatever the opener already knew.
  const item = data ?? target.summary
  const title = item ? displayTitle(item) : target.title || target.source_url || 'Saved item'
  const sourceUrl = item ? item.source_url : (target.source_url ?? null)
  const TypeIcon = (item ? item.type === 'url' : Boolean(sourceUrl)) ? Link2 : FileText
  const chunkCount = data ? data.chunks.length : (item?.chunk_count ?? 0)

  function select(next: ViewTab) {
    setTab(next)
    if (next === 'chunks') setChunksOpened(true)
  }

  const tabs: PillTab<ViewTab>[] = [
    { id: 'text', label: 'Text', icon: AlignLeft },
    { id: 'chunks', label: item ? `Chunks (${chunkCount})` : 'Chunks', icon: Layers },
  ]

  // Loading and error states stand in for the active panel's content (shown once, not twice).
  const placeholder =
    error && !data ? (
      <ErrorNotice error={error} onRetry={() => refetch()} retrying={isFetching} />
    ) : isPending ? (
      <BodySkeleton />
    ) : null
  const stateFor = (id: ViewTab) => (tab === id ? placeholder : null)

  return (
    <>
      <header className="shrink-0 space-y-3 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
        <div className="flex items-start justify-between gap-3">
          <h2
            id={ITEM_VIEW_TITLE_ID}
            className="min-w-0 break-words pt-1.5 font-heading text-lg font-bold leading-snug"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-primary-light hover:text-foreground"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {item ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-sans text-xs text-muted-foreground">
            <Badge className="border-navy-100 bg-navy-50 text-primary">
              <TypeIcon aria-hidden />
              {item.type === 'url' ? 'Web page' : 'Note'}
            </Badge>
            <StatusBadge status={item.status} />
            {chunkCount > 0 && (
              <span className="tabular-nums">
                {chunkCount} {chunkCount === 1 ? 'chunk' : 'chunks'}
              </span>
            )}
            <time dateTime={item.created_at}>
              {formatDateTime(item.created_at)} · {formatRelative(item.created_at)}
            </time>
          </div>
        ) : (
          <div aria-hidden className="skeleton h-5 w-56" />
        )}

        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={sourceUrl}
            className="inline-flex min-h-6 max-w-full items-center gap-1.5 font-sans text-[0.8125rem] font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
          >
            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{hostname(sourceUrl)}</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}

        {item?.status === 'failed' && (
          <div className="flex items-start gap-2 font-body text-[0.8125rem] text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{item.error ?? 'Processing failed.'}</p>
          </div>
        )}
      </header>

      <div className="shrink-0 border-b border-border-subtle px-4 pb-3 sm:px-6">
        <PillTabs
          tabs={tabs}
          active={tab}
          onSelect={select}
          ariaLabel="Item details"
          idPrefix="item-tab"
          panelIdPrefix="item-panel"
          activation="auto"
          className="flex gap-1.5"
          tabClassName="px-3.5 sm:min-h-9"
        />
      </div>

      <div
        data-item-body
        className="flex min-h-0 flex-col px-4 py-4 max-sm:flex-1 sm:px-6 sm:py-5 sm:[flex:0_1_clamp(16rem,46dvh,30rem)]"
      >
        <ViewPanel id="text" active={tab === 'text'}>
          {placeholder ? stateFor('text') : data && <ItemTextPanel text={data.raw_content} status={data.status} />}
        </ViewPanel>
        <ViewPanel id="chunks" active={tab === 'chunks'}>
          {placeholder ? stateFor('chunks') : data && chunksOpened && <ItemChunksPanel chunks={data.chunks} />}
        </ViewPanel>
      </div>
    </>
  )
}
