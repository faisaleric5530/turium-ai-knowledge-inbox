export type ItemType = 'note' | 'url'
export type ItemStatus = 'pending' | 'processing' | 'ready' | 'failed'

export interface Item {
  id: string
  type: ItemType
  title: string | null
  source_url: string | null
  status: ItemStatus
  error: string | null
  preview: string
  chunk_count: number
  created_at: string
}

export interface ItemList {
  items: Item[]
  total: number
}

export interface ItemChunk {
  chunk_index: number
  text: string
}

/** One item with its full saved text and the chunks that make it searchable (GET /items/{id}). */
export interface ItemDetail extends Item {
  raw_content: string | null
  chunks: ItemChunk[]
}

export type IngestRequest =
  | { type: 'note'; content: string; title?: string }
  | { type: 'url'; url: string; title?: string }

export interface IngestResponse {
  id: string
  status: ItemStatus
}

export interface QuerySource {
  index: number
  item_id: string
  title: string | null
  source_url: string | null
  snippet: string
  score: number
}

export interface QueryRequest {
  question: string
  top_k?: number
}

export interface QueryResponse {
  answer: string
  sources: QuerySource[]
  model: string
  answered: boolean
}

/** Standard error body returned by every backend endpoint. */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
    request_id?: string
  }
}
