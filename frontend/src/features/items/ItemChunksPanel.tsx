import type { ItemChunk } from '@/api/types'

/**
 * The Chunks tab: the pieces the text was split into, i.e. exactly what is searched.
 * Mounted only after the tab is first opened, so long pages cost nothing up front.
 */
export function ItemChunksPanel({ chunks }: { chunks: ItemChunk[] }) {
  if (chunks.length === 0) {
    return (
      <p className="rounded-[10px] border-[1.5px] border-border bg-input-bg p-4 font-body text-sm text-muted-foreground">
        No chunks yet — they appear once the item is ready.
      </p>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="shrink-0 font-body text-[0.8125rem] text-muted-foreground">
        Each chunk is searched on its own when you ask a question.
      </p>
      <div
        tabIndex={0}
        role="region"
        aria-label="Chunks of this item"
        data-chunk-list
        className="min-h-0 flex-1 overflow-y-auto rounded-[10px] border-[1.5px] border-border px-4"
      >
        <ol className="divide-y divide-border-subtle">
          {chunks.map((chunk) => (
            <li key={chunk.chunk_index} className="space-y-1.5 py-3" data-chunk>
              <p className="flex items-baseline gap-2 font-sans text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Chunk {chunk.chunk_index + 1}</span>
                <span className="tabular-nums">{chunk.text.length.toLocaleString()} characters</span>
              </p>
              <p className="whitespace-pre-wrap break-words font-body text-[0.8125rem] leading-[1.65]">
                {chunk.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
