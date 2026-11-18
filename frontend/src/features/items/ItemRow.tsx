import { AlertCircle, Eye, FileText, Link2 } from 'lucide-react'
import type { Item } from '@/api/types'
import { Button } from '@/components/ui/button'
import { formatRelative } from '@/lib/time'
import { displayTitle } from './displayTitle'
import { StatusBadge } from './StatusBadge'

interface ItemRowProps {
  item: Item
  onView: (item: Item) => void
}

/** One flat row: round icon avatar, title, one-line preview, status + chunks + time, View. */
export function ItemRow({ item, onView }: ItemRowProps) {
  const Icon = item.type === 'url' ? Link2 : FileText
  const showPreview = item.preview && item.title !== item.preview
  const title = displayTitle(item)

  return (
    <li
      className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 py-3.5 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]"
      data-item-id={item.id}
    >
      <span className="flex size-10 shrink-0 items-center justify-center self-start rounded-full bg-navy-50 text-primary">
        <Icon className="size-4" strokeWidth={1.85} aria-hidden />
        <span className="sr-only">{item.type === 'url' ? 'Web page' : 'Note'}</span>
      </span>
      <div className="min-w-0 space-y-1.5">
        <p className="truncate font-sans text-[0.9375rem] font-semibold leading-snug" title={title}>
          {title}
        </p>
        {showPreview && (
          <p className="line-clamp-1 font-body text-[0.8125rem] text-muted-foreground">{item.preview}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-sans text-xs text-muted-foreground">
          <StatusBadge status={item.status} />
          {item.status === 'ready' && (
            <span className="tabular-nums">
              {item.chunk_count} {item.chunk_count === 1 ? 'chunk' : 'chunks'}
            </span>
          )}
          <time dateTime={item.created_at}>{formatRelative(item.created_at)}</time>
        </div>
        {item.status === 'failed' && (
          <div className="flex items-start gap-2 font-body text-[0.8125rem] text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              {item.error ?? 'Processing failed.'}
              {item.type === 'url' && (
                <span className="text-muted-foreground"> Add the address again to retry.</span>
              )}
            </p>
          </div>
        )}
      </div>
      <Button
        variant="outline"
        aria-label={`View ${title}`}
        data-view-button
        className="col-start-2 min-h-11 justify-self-start px-3 text-[0.8125rem] sm:col-start-3 sm:row-start-1 sm:self-start"
        onClick={() => onView(item)}
      >
        <Eye aria-hidden /> View
      </Button>
    </li>
  )
}
