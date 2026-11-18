import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PaginationProps {
  /** Zero-based current page. */
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  /** Dim the controls while the next page is loading. */
  busy?: boolean
  /** Accessible name of the list being paged, e.g. "saved items". */
  label: string
}

/** Previous / Next with a "Page 2 of 4" readout. Renders nothing when everything fits on one page. */
export function Pagination({ page, pageSize, total, onPageChange, busy, label }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null

  const first = page * pageSize + 1
  const last = Math.min(total, (page + 1) * pageSize)

  return (
    <nav
      aria-label={`${label} pages`}
      className="sticky -bottom-4 z-10 -mx-4 -mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border-subtle bg-card px-4 pb-4 pt-3 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6"
    >
      <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
        Showing {first}-{last} of {total}
      </p>
      <div className="flex items-center gap-2" aria-busy={busy}>
        <Button
          variant="outline"
          className="min-w-11 px-3"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden /> <span className="hidden sm:inline">Previous</span>
        </Button>
        <span className="min-w-[5.5rem] text-center text-xs font-semibold tabular-nums" aria-current="page">
          Page {page + 1} of {pageCount}
        </span>
        <Button
          variant="outline"
          className="min-w-11 px-3"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span> <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
