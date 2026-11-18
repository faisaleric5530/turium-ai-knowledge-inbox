import { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, FileText, Link2 } from 'lucide-react'
import type { QuerySource } from '@/api/types'
import { Button } from '@/components/ui/button'
import { hostname } from '@/lib/url'
import { useIsClamped } from '@/lib/useIsClamped'
import { cn } from '@/lib/utils'
import { SOURCE_DETAIL_ID, sourceTabId } from './citations'

interface SourceDetailProps {
  source: QuerySource
  onOpenItem: (source: QuerySource) => void
}

/**
 * The selected source: title, where it came from, the matching passage (clamped, with
 * Show more in place), and a button that opens the full saved item. Keyed by source so
 * each one starts collapsed.
 */
export function SourceDetail({ source, onOpenItem }: SourceDetailProps) {
  const [expanded, setExpanded] = useState(false)
  const [snippetRef, clamped] = useIsClamped<HTMLParagraphElement>(!expanded, source.snippet)
  const title = source.title ?? (source.source_url ? hostname(source.source_url) : 'Untitled note')

  return (
    <div
      id={SOURCE_DETAIL_ID}
      role="tabpanel"
      aria-labelledby={sourceTabId(source.index)}
      className="flex min-w-0 flex-col gap-2 rounded-xl border-[1.5px] border-border-subtle bg-surface-hover p-4 sm:min-h-[14.5rem]"
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className="min-w-0 break-words font-sans text-[0.9375rem] font-semibold leading-snug">{title}</h4>
        <span className="shrink-0 font-sans text-xs tabular-nums text-muted-foreground">
          Match {Math.round(source.score * 100)}%
        </span>
      </div>

      {source.source_url ? (
        <a
          href={source.source_url}
          target="_blank"
          rel="noopener noreferrer"
          title={source.source_url}
          className="inline-flex min-h-8 max-w-full items-center gap-1.5 self-start font-sans text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          <Link2 className="size-3.5 shrink-0" strokeWidth={1.85} aria-hidden />
          <span className="truncate">{hostname(source.source_url)}</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <p className="inline-flex items-center gap-1.5 font-sans text-xs font-medium text-muted-foreground">
          <FileText className="size-3.5 shrink-0" strokeWidth={1.85} aria-hidden /> Saved note
        </p>
      )}

      <p
        ref={snippetRef}
        id={`${SOURCE_DETAIL_ID}-snippet`}
        className={cn(
          'whitespace-pre-wrap font-body text-[0.8125rem] leading-relaxed',
          !expanded && 'line-clamp-4',
        )}
      >
        {source.snippet}
      </p>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3">
        {clamped || expanded ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={`${SOURCE_DETAIL_ID}-snippet`}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1 font-sans text-xs font-semibold text-primary underline-offset-4 hover:underline sm:min-h-8"
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="size-3.5" aria-hidden />
              </>
            ) : (
              <>
                Show more <ChevronDown className="size-3.5" aria-hidden />
              </>
            )}
          </button>
        ) : (
          <span />
        )}
        <Button
          variant="outline"
          className="text-[0.8125rem]"
          onClick={() => onOpenItem(source)}
          aria-label={`Open full item: ${title}`}
        >
          <Eye aria-hidden /> Open full item
        </Button>
      </div>
    </div>
  )
}
