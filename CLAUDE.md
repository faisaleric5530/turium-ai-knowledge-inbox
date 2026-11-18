# CLAUDE.md - Turium AI Knowledge Inbox

Single-user web app: save notes and URLs, then ask questions answered by an LLM from those saved items, with numbered
source citations. Built as an interview task (brief: "Minimal AI Knowledge Inbox", 6-12h, no auth, no infra theatre).
Companion docs: `README.md` (setup + tradeoffs), `spec/DECISIONS.html` (21 decisions with reasons), `spec/BUILD_PLAN.html`
(original plan).

## Quick facts

| Item | Value |
|---|---|
| Backend | Python 3.11, FastAPI, SQLite, uv, port **5000** (`backend/`) |
| Frontend | Vite, React 19, TypeScript, TanStack Query, Tailwind v4, shadcn/ui, port **3000** (`frontend/`) |
| Embeddings | local `nomic-ai/nomic-embed-text-v1.5` via fastembed (ONNX), 768-dim, ~0.5 GB, cached in `backend/.cache/` |
| Answer LLM | OpenRouter (OpenAI-compatible SDK), model + fallbacks from env vars |
| Tests | `cd backend && uv run pytest -q` -> 82 pass, no network or model download needed |
| Git | `main`, remote `origin` = github.com/faisaleric5530/turium-ai-knowledge-inbox; only the first plan commit exists |

Run: `cd backend && uv run uvicorn app.main:app --reload --port 5000` and `cd frontend && npm run dev`.
Backend config lives in `backend/.env` (git-ignored; copy `.env.example`). Never read or print `.env`: it holds the API key.

## Repository map

```
backend/app/
  main.py          app factory, request-id middleware, write-request logging, CORS, lifespan (wiring only)
  container.py     composition root: builds adapters -> repositories -> services
  config.py        every setting and limit (pydantic-settings, env driven)
  errors.py        AppError family + ONE error body shape for every endpoint
  logging_config.py structlog JSON logs, request id via contextvars, API_LOGGING gating
  db.py            sqlite3: per-call connections, WAL, explicit write transactions, schema
  api/routes/      HTTP only: ingest.py items.py query.py health.py
  schemas/         pydantic request/response models
  services/        ingestion.py retrieval.py answering.py (the logic)
  adapters/        chunker.py embedder.py url_fetcher.py llm.py (everything external)
  repositories/    items_repo.py (SQL) vector_store.py (VectorStore interface + SQLite/NumPy impl)
backend/tests/     conftest fakes (embedder, LLM, fetcher) + api, chunker, vector store, url, logging, llm failover tests
frontend/src/
  api/             client.ts (fetch + ApiError), hooks.ts (TanStack Query), types.ts
  features/        layout (Header, AppTabs, useHashTab), ingest, items (list + view modal), ask
  components/      Modal, PillTabs, Field, ErrorNotice, EmptyState, ui/ (shadcn primitives)
  lib/             small hooks and helpers (useCopy, useAutoGrow, useMediaQuery, motion, time, url)
```

## How the work unfolded

1. **Requirements interview** (3 rounds, run in Lavish review pages): stack, providers, vector store, async ingest, answer
   format, chunking, URL safety, API contract, DB schema, errors, logging, layout, limits. Output: `spec/DECISIONS.html` + `spec/BUILD_PLAN.html`.
2. **Step 0 spike**: scaffolded both apps, proved nomic loads on Windows, measured score spread to seed the threshold.
3. **Backend build**: config, logging, errors, DB, schemas, chunker, embedder, URL fetcher, LLM client, repositories, services, routes, tests.
4. **Frontend v1** (dark grey + teal, two columns) -> **v2** (navy/cream, tabs) -> **v3** (HikmahAI-style single card with
   pill tabs) -> Saved tab + View modal -> master-detail Ask results -> items-API gating -> header simplification.
5. **Hardening from real use**: configurable logging, write-request-only logs, LLM failover, threshold fix, Ask button layout.
6. **Docs**: README (tradeoffs, scale limits, production changes) and spec/DECISIONS.html kept in sync with each change.

## How it works

Ingest (async): `POST /ingest` validates a discriminated body (`note` or `url`), saves the item as `pending`, returns
**202**. A FastAPI background task then: fetches the URL (SSRF-guarded) -> extracts text with trafilatura -> chunks ->
embeds -> stores vectors -> marks `ready`, or `failed` with a human-readable reason. Nothing is lost on failure.

Query: embed the question -> exact cosine search -> drop chunks under `SIMILARITY_THRESHOLD` -> if none remain, answer
"nothing relevant" **without calling the LLM** -> otherwise send numbered context + question to the LLM -> return the
answer with `[n]` citations and a `sources[]` array (item id, title, URL, snippet, score), plus the model that answered.

### Backend features

- **Chunker** (`adapters/chunker.py`): recursive split paragraph -> line -> sentence -> word, then merge small pieces up
  to ~500 tokens (chars/4) with ~50 tokens overlap; hard-cuts only unbroken giant tokens. Adapted from the user's Vizuara
  notebook with fixes: preserve newlines, merge pieces, add overlap, word fallback, regex sentences instead of NLTK.
- **Embedder**: prefixes per model (`search_document:` / `search_query:` for nomic), L2-normalises (fastembed returns
  unnormalised nomic vectors), loads in a background thread so the server starts instantly; ingest/query return 503 until ready.
- **Vector store**: vectors are float32 BLOBs in `chunks`; search is a NumPy dot product over an in-memory matrix that is
  rebuilt lazily after writes. Stores model name + dim per chunk; chunks from another model are ignored with a warning.
- **URL fetcher**: http(s) only, every host AND redirect hop must resolve to public IPs, max 3 redirects, 10 s timeout,
  2 MB cap, HTML/text only, text capped at 100k chars. Known gap: validated before connect, so DNS rebinding can race it.
- **LLM client**: tries `LLM_MODEL` then `LLM_FALLBACK_MODELS`; fails over on 429/5xx/empty/model-specific errors; fails fast
  on 401/402/403 with specific messages; all-throttled gives a clear "rate-limited right now" 502.
- **Recovery**: on startup, items stuck `pending/processing` are marked `failed` ("interrupted by a server restart").
  Re-adding a failed URL retries it; re-adding a live URL returns 409 with the existing id.
- **Logging**: JSON lines. `API_LOGGING=true` prints write requests (POST/PUT/PATCH/DELETE) and processing steps
  (ingest stages, retrieval scores, LLM timing); `false` prints only warnings and errors. Note text is never logged.
- **Errors**: always `{"error": {"code", "message", "details"?, "request_id"}}` with `X-Request-ID` on every response.
  Codes: 202, 200, 404, 409, 413, 422, 502 (LLM upstream), 503 (embedder not ready / LLM not configured), 500.

### Data model (SQLite, `backend/data/inbox.db`)

- `items(id uuid, type note|url, title, source_url UNIQUE, raw_content, status pending|processing|ready|failed, error,
  created_at, updated_at)`: raw content and metadata are stored exactly as the brief requires.
- `chunks(id, item_id -> items ON DELETE CASCADE, chunk_index, text, embedding BLOB float32, embedding_model, embedding_dim)`.
- WAL mode, `busy_timeout`, per-call connections (safe with FastAPI's threadpool), explicit `BEGIN IMMEDIATE` write transactions.
- Only `ready` items are searchable; the vector cache is invalidated whenever an item becomes ready/failed.
- Duplicate URLs are blocked by a partial unique index; a `failed` URL is deleted and re-created on re-add.

### API

| Endpoint | Purpose |
|---|---|
| `POST /ingest` | `{type:"note",content,title?}` or `{type:"url",url,title?}` -> 202 `{id,status}` |
| `GET /items` | newest first; `?limit&offset&status` |
| `GET /items/{id}` | item + `raw_content` + `chunks[]` (used by the View modal) |
| `POST /query` | `{question, top_k?}` -> `{answer, sources[], model, answered}` |
| `GET /health` | db + embedder readiness (503 while the model loads) |

Limits: note 20,000 chars (413 above), question 1,000 chars, `top_k` 1-10.

### Configuration (backend/.env)

`OPENROUTER_API_KEY`, `LLM_MODEL`, `LLM_FALLBACK_MODELS`, `SIMILARITY_THRESHOLD` (**0.55**), `TOP_K_DEFAULT`, `DATABASE_PATH`,
`CORS_ORIGINS` (`http://localhost:3000`), `API_LOGGING`, `LOG_LEVEL`, plus size/timeout limits. `.env` is read at startup only:
**restart the backend after editing it** (uvicorn `--reload` watches `.py` files, not `.env`).

### Decision summary (full reasoning in spec/DECISIONS.html)

| Area | Choice | Why in one line |
|---|---|---|
| Vector store | SQLite + NumPy exact search behind `VectorStore` | one file, exact, explainable; scale path is pgvector |
| Ingest | 202 + background task + polled status | real async without queue infrastructure |
| Embeddings | local nomic via fastembed | high-volume step: no per-call cost, private notes stay local |
| Answers | single JSON with `[n]` citations | simple to validate; streaming deferred |
| Guardrail | similarity threshold, skip LLM when nothing matches | no fabricated citations, saves cost |
| DB access | stdlib sqlite3 + repositories, UUID4 | two tables do not need an ORM |
| Not built | Docker, DELETE endpoint, streaming, chat history, auth | conscious cuts, listed in README |

## Frontend walkthrough

Look: light theme in the user's brand colors navy `#22396F` and cream `#FCF1D0` (derived tints only), copying the
structure of the user's HikmahAI app (`D:\ALGORISM-HACKATHON\HikmahAI_FE`): Montserrat headings, Poppins body, Inter for
UI/forms (self-hosted via fontsource), pill tabs, 1.5px borders, 12-18px radii, soft navy-tinted shadows, hairline rows.
Earlier iterations (dark grey + teal, Fraunces) were replaced at the user's request. Contrast pairs are all >= 4.5:1;
status colors (ready green, processing amber, failed red) always carry an icon and text.

Structure: sticky header (logo + "Turium AI Knowledge Inbox") above ONE centered card with three pill tabs.
- **Add**: Note | Web page form, character counter, loading state, inline errors, "View in Saved" after saving.
- **Saved**: items **5 per page** (Previous/Next, pinned pager; opening the tab starts on page 1) with status badges and a **View** button. View opens a native `<dialog>` modal (`Modal.tsx`: focus trap,
  Esc/backdrop/close, focus returns to the button, scroll lock) loaded from `GET /items/{id}`, with a pinned header and two inner
  tabs, **Text** (full content + Copy) and **Chunks (N)** (exactly what is searchable). Processing items refresh until ready.
- **Ask**: compact question box with the Ask button **below** it; on submit the page scrolls so the answer is under the
  header. Answer text has clickable `[n]` chips; sources are master-detail (a tile per source + one detail panel with
  snippet, link and "Open full item"), so answer + sources fit one 1280x720 screen without page scroll.
- The card has ONE standard height on every tab and data size (`clamp(26rem, 100dvh-7rem, 47rem)`, larger from `sm`); its body
  scrolls inside it (`[data-scroll-root]`, helpers in `lib/scrollRoot.ts`), so scroll logic targets that element, not the window.
- Routing is the URL hash (`#/add`, `#/saved`, `#/ask`; old `#/inbox` redirects). All panels stay mounted (hidden) so
  drafts, the last answer and scroll position survive tab switches. Keyboard: arrows/Home/End on tabs, skip link, aria-live.
- **`GET /items` is called only while the Saved tab is active** (zero calls on load/reload/switching on Add or Ask);
  it polls every 2 s only while Saved is open and an item is pending/processing. The UI makes no `/health` calls.

Component map: `App.tsx` owns the active tab (`useHashTab`) and renders three always-mounted panels. `AppTabs`/`PillTabs`
implement the accessible tablist. Add = `IngestForm` (`NoteForm`, `UrlForm`, `SaveResult`). Saved = `ItemList` -> `ItemRow` +
`StatusBadge` -> `ItemViewModal` -> `ItemViewContent` (`ItemTextPanel`, `ItemChunksPanel`). Ask = `AskPanel` -> `AskForm`,
`AnswerSkeleton`, `AnswerView` -> `AnswerPanel` + `SourcesPanel` (`SourceTile`, `SourceDetail`). Server state lives only in
`api/hooks.ts` (`useItems(enabled)`, `useItem`, `useIngest`, `useAsk`); mutations invalidate `["items"]`, which does not refetch
while Saved is inactive. Errors are parsed once into `ApiError` (message, code, status, request id) and shown by `ErrorNotice`.

## Challenges and how they were solved

1. **Embedding model choice**: user's earlier project used bge-small + Chroma (rebuilds on every start, 512-token cap, torch
   install). Chose nomic via fastembed (8192-token window, no torch); verified it loads on Windows; added query/doc prefixes.
2. **Unnormalised vectors**: fastembed nomic returns norms ~21, so raw dot products are not cosine. Added L2 normalisation.
3. **Similarity threshold**: tuned on real scores (relevant 0.58-0.82, unrelated <= 0.535) -> 0.55. The user's own `.env` had
   0.8, which silently discarded every match ("No relevant context found" for a question their data answers at 0.72).
4. **Free OpenRouter models throttle (HTTP 429)**: both Gemma free models share one Google limit, so a same-provider fallback
   fails too. Built cross-provider failover (Baidu ernie, Nvidia nemotron-ultra); burst test: 12/12 requests answered.
5. **Models that cannot answer**: `perplexity/pplx-decider-*` is a "decisions" model (HTTP 400 on chat); some reasoning models
   return empty content. The client treats empty content as a failure and the docs warn against decision models.
6. **SSRF**: server-side fetching of user URLs is a classic hole; blocked private/loopback/link-local ranges per hop.
7. **Python gotcha**: a repository method named `list` shadowed the builtin inside its class; renamed `list_items`.
8. **structlog caching**: `cache_logger_on_first_use` froze log levels across tests; set to False so config can be re-applied.
9. **UI request noise**: the list was fetched on Add/Ask tabs (badge, empty states). Gated to the Saved tab and verified by
   counting real browser requests (0 on Add/Ask, 1 on Saved).
10. **Scrolling to reach answers**: long stacked source cards forced scrolling; replaced by master-detail sources.
11. **Wrong npm package**: the shadcn CLI wired `cn` to an unrelated npm package; replaced with clsx + tailwind-merge.
12. **Multi-topic questions**: a long document can fill all top-k slots and push out a short note (not yet fixed, see below).

## Verification approach and lessons

- Backend: 82 pytest tests with deterministic fakes (hash-based embedder, scripted LLM, fake fetcher) plus real end-to-end
  runs with the real model and OpenRouter. UI work was delegated to parallel subagents that tested with Playwright against
  throwaway mock APIs on ports 3100/5100; every result was re-verified independently (lint, build, screenshots, request counts).
- Windows lessons: Vite listens on IPv6 (`localhost`/`[::1]` works, `127.0.0.1` does not); a leftover mock on 5100 once
  answered in place of the real backend. Stop test servers by **exact PID after checking the command line**, never by broad
  pattern (a pattern once matched and killed the tool's own shell). The user's servers on 3000/5000 must not be touched.
- Hugging Face symlink warnings on Windows are harmless (suppressed in `embedder.py`).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "No relevant context found" for a question your notes answer | threshold too high (`0.8`); set `SIMILARITY_THRESHOLD=0.55`, restart backend |
| `/query` 502 "rate-limited right now" | free model throttled; wait, set a faster/paid `LLM_MODEL`, or add cross-provider fallbacks |
| 503 "embedding model is still loading" | first start downloads ~0.5 GB; check `GET /health` until `embedder: ready` |
| 503 "answer model is not configured" | missing `OPENROUTER_API_KEY` or `LLM_MODEL` in `backend/.env` |
| URL item `failed` | reason is shown in Saved (private address, timeout, no readable text such as JS/paywalled pages) |
| No logs in the backend terminal | `API_LOGGING` is false (default); set `true` and restart |
| Browser CORS/network error | backend not on 5000, or add the frontend origin to `CORS_ORIGINS` |
| `curl 127.0.0.1:3000` fails but the app works | Vite binds IPv6; use `localhost` |

## Conventions for future work

- Keep layering: routes -> services -> repositories/adapters; no logic in routes or `main.py`; no god files.
- Add behaviour with tests; use the fakes in `tests/conftest.py`. UI: semantic tokens only (no raw hex in components).
- Update `spec/DECISIONS.html` when a decision changes; keep the README config notes in sync with `config.py`.
- Do not commit `.env`, `.cache/`, `.venv/`, `node_modules/`, `*.db` (all git-ignored).
- **Editing this file**: always keep it concise and never exceed **250 lines**. Summarise or merge older material instead of
  appending; check with `wc -l CLAUDE.md` after every update.

## Open items

- Per-item chunk cap (e.g. max 3 chunks per item) so multi-topic questions pull from several sources.
- Faster default model: primary `nvidia/...-ultra` can take ~15 s; `baidu/ernie-5.5-flash-preview:free` is quicker.
- Free models may log prompts and are volatile; a cheap paid model is the reliable choice.
- Commit and push the backend, frontend and docs (only the initial plan commit is on `main`).
- Production path (in README): pgvector + HNSW, durable job queue + worker, auth, IP-pinned or proxied URL fetching.
