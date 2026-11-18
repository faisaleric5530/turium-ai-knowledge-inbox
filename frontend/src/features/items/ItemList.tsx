import { useRef, useState } from 'react'
import { ArrowRight, Library } from 'lucide-react'
import { ITEMS_PAGE_SIZE, useItems } from '@/api/hooks'
import { EmptyState } from '@/components/EmptyState'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Pagination } from '@/components/Pagination'
import { SectionLabel } from '@/components/SectionLabel'
import { Button } from '@/components/ui/button'
import { scrollBehavior } from '@/lib/motion'
import { innerScrollRoot } from '@/lib/scrollRoot'
import { ItemRow } from './ItemRow'
import { ItemViewModal } from './ItemViewModal'

function ItemSkeleton() {
  return (
    <ul aria-hidden className="divide-y divide-border-subtle">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex gap-3 py-3.5">
          <div className="skeleton size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-5 w-20 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  )
}

interface ItemListProps {
  /** True only while the Saved tab is showing; the list is requested and polled only then. */
  active: boolean
  onGoToAdd: () => void
}

/** Everything saved so far, with a View button that opens the item's text and data. */
export function ItemList({ active, onGoToAdd }: ItemListProps) {
  const [page, setPage] = useState(0)
  const { data, isPending, error, refetch, isFetching, isPlaceholderData } = useItems(active, page)
  const [viewingId, setViewingId] = useState<string>()
  const sectionRef = useRef<HTMLElement>(null)

  // Opening the Saved tab always starts on page 1, where the newest items are.
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (active) setPage(0)
  }

  // If the total shrinks below the current page (e.g. after a restart), step back to the last page.
  const lastPage = data ? Math.max(0, Math.ceil(data.total / ITEMS_PAGE_SIZE) - 1) : 0
  if (data && !isPlaceholderData && page > lastPage) setPage(lastPage)

  function changePage(next: number) {
    setPage(next)
    // A new page starts at the top of the card body.
    const root = innerScrollRoot(sectionRef.current)
    if (root) root.scrollTo({ top: 0, behavior: scrollBehavior() })
    else sectionRef.current?.scrollIntoView({ block: 'start', behavior: scrollBehavior() })
  }

  // Look the item up in the live list so the header stays fresh while it is polled.
  const viewing = data?.items.find((item) => item.id === viewingId)

  return (
    <section ref={sectionRef} aria-labelledby="saved-heading" className="space-y-1">
      <SectionLabel
        id="saved-heading"
        aside={data ? `${data.total} ${data.total === 1 ? 'item' : 'items'}` : undefined}
      >
        Saved items
      </SectionLabel>

      {isPending && !error && <ItemSkeleton />}

      {error && (
        <div className="pt-2">
          <ErrorNotice error={error} onRetry={() => refetch()} retrying={isFetching} />
        </div>
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          icon={Library}
          title="Nothing saved yet"
          action={
            <Button onClick={onGoToAdd}>
              Go to Add <ArrowRight aria-hidden />
            </Button>
          }
        >
          Add a note or a web address. Once it shows as Ready, you can ask questions about it.
        </EmptyState>
      )}

      {data && data.items.length > 0 && (
        <ul
          className="divide-y divide-border-subtle transition-opacity duration-150 data-[stale=true]:opacity-60"
          data-stale={isPlaceholderData}
        >
          {data.items.map((item) => (
            <ItemRow key={item.id} item={item} onView={(picked) => setViewingId(picked.id)} />
          ))}
        </ul>
      )}

      {data && (
        <Pagination
          page={page}
          pageSize={ITEMS_PAGE_SIZE}
          total={data.total}
          onPageChange={changePage}
          busy={isPlaceholderData}
          label="Saved items"
        />
      )}

      <ItemViewModal
        target={viewing ? { id: viewing.id, summary: viewing } : undefined}
        onClose={() => setViewingId(undefined)}
      />
    </section>
  )
}
