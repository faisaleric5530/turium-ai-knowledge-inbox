import { Check, Copy, Loader2 } from 'lucide-react'
import type { ItemStatus } from '@/api/types'
import { Button } from '@/components/ui/button'
import { useCopy } from '@/lib/useCopy'

interface ItemTextPanelProps {
  text: string | null
  status: ItemStatus
}

const NOTICE =
  'rounded-[10px] border-[1.5px] border-border bg-input-bg p-4 font-body text-sm text-muted-foreground'

/** The Text tab: character count and copy button pinned on top, the text scrolling below. */
export function ItemTextPanel({ text, status }: ItemTextPanelProps) {
  const { state, copy } = useCopy()
  const hasText = text !== null && text.length > 0
  const inProgress = status === 'pending' || status === 'processing'

  if (!hasText) {
    return inProgress ? (
      <p className={`${NOTICE} flex items-center gap-2.5`}>
        <Loader2 className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden />
        Still processing — the text will appear here when it is ready.
      </p>
    ) : (
      <p className={NOTICE}>No text was saved for this item.</p>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <span className="font-sans text-xs tabular-nums text-muted-foreground">
          {text.length.toLocaleString()} characters
        </span>
        <Button
          variant="outline"
          className="min-h-11 px-3 text-[0.8125rem] sm:min-h-9"
          onClick={() => copy(text)}
        >
          {state === 'copied' ? <Check aria-hidden /> : <Copy aria-hidden />}
          {state === 'copied' ? 'Copied' : 'Copy text'}
        </Button>
      </div>

      {/* Announces the copy result without moving focus. */}
      <p role="status" aria-live="polite" className="sr-only">
        {state === 'copied' && 'Text copied to the clipboard.'}
        {state === 'failed' && 'Could not copy the text.'}
      </p>
      {state === 'failed' && (
        <p className="shrink-0 text-xs font-medium text-destructive" aria-hidden>
          Could not copy. Select the text and copy it manually.
        </p>
      )}

      <div
        tabIndex={0}
        role="region"
        aria-label="Full text of this item"
        data-item-text
        className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words rounded-[10px] border-[1.5px] border-border bg-input-bg p-4 font-body text-[0.9375rem] leading-[1.7]"
      >
        {text}
      </div>
    </div>
  )
}
