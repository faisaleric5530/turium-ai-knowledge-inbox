# Turium AI Knowledge Inbox

Save short notes and URLs, then ask questions over them. Answers come from a simple RAG pipeline and cite the exact saved snippets they were drawn from.

- **Backend:** Python, FastAPI, SQLite, local embeddings (`nomic-embed-text-v1.5` via fastembed/ONNX), OpenRouter for the answer LLM.
- **Frontend:** Vite, React, TypeScript, TanStack Query, Tailwind, shadcn/ui.

## Quick start

```bash
# terminal 1 - backend (http://localhost:5000)
cd backend
uv sync
cp .env.example .env        # then set OPENROUTER_API_KEY and LLM_MODEL
uv run uvicorn app.main:app --reload --port 5000

# terminal 2 - frontend (http://localhost:3000)
cd frontend
npm install
cp .env.example .env
npm run dev
```

The first backend start downloads the embedding model (~0.5 GB). `/health` shows `embedder: loading` until it is ready; ingest and query return 503 meanwhile.

## How it works

```
POST /ingest ──► save item (pending) ──► 202
                       │  background task
                       ▼
        fetch URL (SSRF-guarded) ─► extract text ─► chunk ─► embed ─► store ─► ready | failed

POST /query ──► embed question ─► cosine search ─► drop chunks below threshold
                       │                                   │ none left → "nothing relevant" (no LLM call)
                       ▼
        numbered context + question ─► LLM ─► answer with [n] citations + sources
```

### API

| Endpoint | Purpose |
|---|---|
| `POST /ingest` | `{type:"note",content,title?}` or `{type:"url",url,title?}` → `202 {id,status}`. Duplicate URL → `409`. |
| `GET /items` | List items, newest first. `?limit=&offset=&status=` |
| `GET /items/{id}` | One item with raw content and its chunks. |
| `POST /query` | `{question,top_k?}` → `{answer, sources[{index,item_id,title,source_url,snippet,score}], model, answered}` |
| `GET /health` | DB and embedder readiness (503 while not ready). |

All errors share one body: `{"error": {"code", "message", "details"?, "request_id"}}`. Every response carries an `X-Request-ID` header, and the JSON logs carry the same id.

| Status | Error code | Meaning |
|---|---|---|
| 200 | - | OK |
| 202 | - | Accepted: item saved and queued for processing |
| 404 | `not_found` | Unknown item or route |
| 409 | `duplicate_url` | URL already saved (response includes the existing item id) |
| 413 | `payload_too_large` | Note or question exceeds its length limit |
| 422 | `validation_error` | Invalid request body or query parameters (per-field `details`) |
| 502 | `upstream_error` | Answer model failed, throttled or rejected the key |
| 503 | `service_unavailable` | Embedding model still loading, or answer model not configured |
| 500 | `internal_error` | Unexpected server error (quote the request id) |

### Code layout

```
backend/app/
  main.py            app factory, middleware, lifespan (wiring only)
  container.py       builds the object graph
  config.py          all settings and limits (env)
  api/routes/        HTTP only: ingest, items, query, health
  schemas/           request/response models
  services/          ingestion, retrieval, answering (the logic)
  adapters/          chunker, embedder, url_fetcher, llm (external concerns)
  repositories/      items_repo (SQL), vector_store (VectorStore interface + SQLite impl)
backend/tests/       82 tests; fakes for embedder, LLM and URL fetcher
frontend/src/        api/ (client + hooks), features/{ingest,items,ask}, components/
```

## Tradeoffs

**Chunking.** Recursive splitter: paragraph, then line, then sentence, then word, merged up to ~500 tokens with ~50 tokens of overlap. It respects natural boundaries so chunks stay coherent, overlap protects facts that straddle a boundary, and a short note stays one chunk. Fixed windows cut mid-sentence; semantic chunking costs extra embedding calls for little gain at this scale. Token counts are estimated as characters / 4.

**Embeddings.** A local open-weight model (`nomic-embed-text-v1.5`, 768-dim, 8192-token window) instead of a hosted API. Embedding is the high-volume step (every chunk and every question), so local means no per-call cost or rate limits, and private notes never leave the machine. The hosted LLM is used only for answer generation. The embedder sits behind an interface, and each vector is stored with its model name and dimension, so a model swap is detectable (old vectors are ignored with a logged warning until re-embedded).

**Vector store.** SQLite holds items, chunks and float32 vectors; search is an exact cosine scan with NumPy over an in-memory matrix (vectors are L2-normalised, so cosine is a dot product). One file, one source of truth, no extra service, and results are exact. It sits behind a `VectorStore` interface.

**Async ingestion.** `POST /ingest` returns 202 immediately; a FastAPI background task does the slow work. Items move `pending → processing → ready | failed`, and failures keep a human-readable reason. No queue infrastructure.

**Answer quality guardrail.** Chunks below a similarity threshold are discarded; if none remain the app says it found nothing relevant and does not call the LLM (saves cost, prevents fabricated citations). The prompt restricts the model to the numbered context and tells it to treat that context as untrusted data. The default threshold (0.55) was tuned on a small sample: relevant questions scored 0.58-0.82, unrelated ones topped out at 0.535. Re-tune it on your own data.

**URL fetching safety.** http(s) only; every host and every redirect hop must resolve only to public IPs; max 3 redirects, 10 s timeout, 2 MB download, HTML/text only; extracted text capped at 100,000 characters.

## What breaks at scale

- **Search is O(n)** and all vectors live in RAM. Fine to roughly 50-100k chunks; beyond that the scan and memory become the bottleneck.
- **SQLite has one writer.** Fine for a single user; concurrent ingest from many users would contend.
- **Background tasks run in the API process.** They are lost on restart (stranded items are marked failed on startup) and embedding competes with request handling for CPU.
- **Embedding on CPU inside the API** is slow for large documents and bursts of ingest.
- **No re-embed workflow.** Changing the embedding model requires re-adding items.
- **URL extraction is naive.** JavaScript-rendered and paywalled pages yield little text and fail with a clear message; no robots.txt handling, no refresh/re-crawl.
- **SSRF guard has a known gap:** the host is validated before the request, not pinned for the connection, so a DNS-rebinding attacker could race the check.
- **Prompt injection is mitigated, not solved.** Fetched page text goes into the prompt.
- **Single user, no auth,** no per-user isolation.

## What I would change for production

- Postgres with **pgvector** (HNSW index) behind the existing `VectorStore` / repository interfaces.
- A **durable job queue and separate worker** (e.g. Redis-backed) for ingestion, with retries and a refresh path; embedding as its own service or on GPU.
- Object storage for raw content; auth and per-user data isolation; rate limiting.
- Egress proxy or IP-pinned connections for URL fetching; headless rendering for JS pages.
- Hybrid search (BM25 + vectors) with re-ranking; streaming answers; conversation history.
- Metrics and tracing on top of the structured logs; containerised deployment.

## Tests

```bash
cd backend && uv run pytest -q     # 82 tests, no network or model download needed
cd frontend && npm run lint && npm run build
```
