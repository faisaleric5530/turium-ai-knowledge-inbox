import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { ApiError } from './client'
import type {
  IngestRequest,
  IngestResponse,
  ItemDetail,
  ItemList,
  QueryRequest,
  QueryResponse,
} from './types'

const POLL_INTERVAL_MS = 2000

/** Saved items shown per page. */
export const ITEMS_PAGE_SIZE = 4

export const itemsKey = ['items'] as const

function hasActiveItems(data: ItemList | undefined): boolean {
  return (
    data?.items.some(
      (item) => item.status === 'pending' || item.status === 'processing',
    ) ?? false
  )
}

/**
 * The saved items list. `enabled` must be true only while the Saved tab is showing it:
 * a disabled query makes no request, no poll and no refocus/reconnect refetch.
 * Opening the tab turns it on, and because the data is always stale (staleTime 0) it
 * fetches immediately (cached rows show instantly, then update). While enabled it polls
 * every 2s, but only if something is still pending or processing on the visible page.
 * `page` is zero-based; the previous page stays on screen while the next one loads.
 */
export function useItems(enabled: boolean, page = 0) {
  return useQuery<ItemList, ApiError>({
    queryKey: [...itemsKey, { page }],
    queryFn: () => api.listItems(ITEMS_PAGE_SIZE, page * ITEMS_PAGE_SIZE),
    enabled,
    staleTime: 0,
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      enabled && hasActiveItems(query.state.data) ? POLL_INTERVAL_MS : false,
  })
}

/**
 * One item with its text and chunks. Pass undefined to keep the query idle (modal closed).
 * Refetches every 2s while the item is still being processed so the text appears when ready.
 */
export function useItem(id: string | undefined) {
  return useQuery<ItemDetail, ApiError>({
    queryKey: ['item', id],
    queryFn: () => api.getItem(id as string),
    enabled: id !== undefined,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'pending' || status === 'processing' ? POLL_INTERVAL_MS : false
    },
  })
}

export function useIngest() {
  const queryClient = useQueryClient()
  return useMutation<IngestResponse, ApiError, IngestRequest>({
    mutationFn: api.ingest,
    // Marks the list stale. The default refetchType ('active') skips a disabled query, so no
    // request is made while Saved is closed; opening Saved fetches the new item.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: itemsKey }),
  })
}

export function useAsk() {
  return useMutation<QueryResponse, ApiError, QueryRequest>({
    mutationFn: api.query,
  })
}
