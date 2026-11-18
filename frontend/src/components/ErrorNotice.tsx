import { AlertCircle, RefreshCw } from 'lucide-react'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorNoticeProps {
  error: unknown
  /** Overrides the message for known cases (e.g. a friendly 409 text). */
  message?: string
  /** When set, shows a Retry button. */
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

/** Inline error block: what went wrong, the request id for debugging, and an optional retry. */
export function ErrorNotice({ error, message, onRetry, retrying, className }: ErrorNoticeProps) {
  const apiError = error instanceof ApiError ? error : undefined
  const text =
    message ?? (error instanceof Error ? error.message : 'Something went wrong.')

  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-[10px] border-[1.5px] border-destructive/40 bg-destructive-bg p-4 text-sm',
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-semibold text-destructive">{text}</p>
        {apiError?.requestId && (
          <p className="font-mono text-xs text-muted-foreground">
            Request ID: {apiError.requestId}
          </p>
        )}
        {onRetry && (
          <Button variant="outline" onClick={onRetry} disabled={retrying}>
            <RefreshCw aria-hidden /> Try again
          </Button>
        )}
      </div>
    </div>
  )
}
