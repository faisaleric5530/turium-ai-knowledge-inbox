"""SQLite access: connection management, schema, and transactions.

Each call opens its own short-lived connection (safe with FastAPI's threadpool).
WAL mode lets the background ingestion writer coexist with readers.
"""

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS items (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL CHECK (type IN ('note', 'url')),
    title       TEXT,
    source_url  TEXT,
    raw_content TEXT,
    status      TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    error       TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_source_url
    ON items (source_url) WHERE source_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_created ON items (created_at DESC);

CREATE TABLE IF NOT EXISTS chunks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id         TEXT NOT NULL REFERENCES items (id) ON DELETE CASCADE,
    chunk_index     INTEGER NOT NULL,
    text            TEXT NOT NULL,
    embedding       BLOB NOT NULL,
    embedding_model TEXT NOT NULL,
    embedding_dim   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_item ON chunks (item_id);
"""


class Database:
    def __init__(self, path: str) -> None:
        self.path = path

    def init(self) -> None:
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.executescript(SCHEMA)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=10, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=10000")
        return conn

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        """Autocommit connection, for reads and single-statement writes."""
        conn = self._connect()
        try:
            yield conn
        finally:
            conn.close()

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        """Explicit write transaction: commit on success, roll back on error."""
        conn = self._connect()
        try:
            conn.execute("BEGIN IMMEDIATE")
            yield conn
            conn.execute("COMMIT")
        except BaseException:
            conn.execute("ROLLBACK")
            raise
        finally:
            conn.close()

    def ping(self) -> bool:
        try:
            with self.connection() as conn:
                conn.execute("SELECT 1")
            return True
        except sqlite3.Error:
            return False
