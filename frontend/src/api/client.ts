import type {
  ApiErrorBody,
  IngestRequest,
  IngestResponse,
  ItemDetail,
  ItemList,
  QueryRequest,
  QueryResponse,
} from './types'

const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId?: string
  readonly details?: unknown

  constructor(
    message: string,
    status: number,
    code: string,
    requestId?: string,
    details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
    this.details = details
  }
}

/** Pulls the id of an already-saved item out of a 409 error, if the backend sent one. */
export function existingItemId(error: unknown): string | undefined {
  if (!(error instanceof ApiError) || error.status !== 409) return undefined
  const details = error.details
  if (!details || typeof details !== 'object') return undefined
  const record = details as Record<string, unknown>
  for (const key of ['existing_item_id', 'existing_id', 'item_id', 'id']) {
    if (typeof record[key] === 'string') return record[key]
  }
  return undefined
}

async function parseError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get('X-Request-ID') ?? undefined
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>
    if (body.error) {
      return new ApiError(
        body.error.message,
        response.status,
        body.error.code,
        body.error.request_id ?? requestId,
        body.error.details,
      )
    }
  } catch {
    // Body was not JSON; fall through to the generic message.
  }
  return new ApiError(
    `Request failed (${response.status})`,
    response.status,
    'http_error',
    requestId,
  )
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(
      'Cannot reach the server. Check that the backend is running.',
      0,
      'network_error',
    )
  }
  if (!response.ok) throw await parseError(response)
  return (await response.json()) as T
}

export const api = {
  listItems: (limit = 50, offset = 0) =>
    request<ItemList>(`/items?limit=${limit}&offset=${offset}`),

  getItem: (id: string) => request<ItemDetail>(`/items/${encodeURIComponent(id)}`),

  ingest: (body: IngestRequest) =>
    request<IngestResponse>('/ingest', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  query: (body: QueryRequest) =>
    request<QueryResponse>('/query', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
