"""SQL for the items table (and read access to an item's chunks)."""

import sqlite3
import uuid
from datetime import datetime, timezone

from app.db import Database

_ITEM_COLUMNS = """
    i.id, i.type, i.title, i.source_url, i.status, i.error, i.created_at,
    COALESCE(substr(i.raw_content, 1, 200), '') AS preview,
    (SELECT COUNT(*) FROM chunks c WHERE c.item_id = i.id) AS chunk_count
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ItemsRepository:
    def __init__(self, db: Database) -> None:
        self._db = db

    def create(
        self,
        *,
        item_type: str,
        title: str | None,
        source_url: str | None,
        raw_content: str | None,
    ) -> str:
        """Insert a pending item. Raises sqlite3.IntegrityError on a duplicate URL."""
        item_id = str(uuid.uuid4())
        now = _now()
        with self._db.transaction() as conn:
            conn.execute(
                "INSERT INTO items (id, type, title, source_url, raw_content, status, created_at, updated_at)"
                " VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
                (item_id, item_type, title, source_url, raw_content, now, now),
            )
        return item_id

    def get(self, item_id: str) -> sqlite3.Row | None:
        with self._db.connection() as conn:
            return conn.execute(
                f"SELECT {_ITEM_COLUMNS}, i.raw_content FROM items i WHERE i.id = ?", (item_id,)
            ).fetchone()

    def find_by_url(self, source_url: str) -> sqlite3.Row | None:
        with self._db.connection() as conn:
            return conn.execute(
                f"SELECT {_ITEM_COLUMNS} FROM items i WHERE i.source_url = ?", (source_url,)
            ).fetchone()

    def list_items(
        self, *, limit: int, offset: int, status: str | None
    ) -> tuple[list[sqlite3.Row], int]:
        where, params = ("WHERE i.status = ?", [status]) if status else ("", [])
        with self._db.connection() as conn:
            total = conn.execute(f"SELECT COUNT(*) FROM items i {where}", params).fetchone()[0]
            rows = conn.execute(
                f"SELECT {_ITEM_COLUMNS} FROM items i {where}"
                " ORDER BY i.created_at DESC, i.id LIMIT ? OFFSET ?",
                [*params, limit, offset],
            ).fetchall()
        return rows, total

    def get_chunks(self, item_id: str) -> list[sqlite3.Row]:
        with self._db.connection() as conn:
            return conn.execute(
                "SELECT chunk_index, text FROM chunks WHERE item_id = ? ORDER BY chunk_index",
                (item_id,),
            ).fetchall()

    def set_status(self, item_id: str, status: str, error: str | None = None) -> None:
        with self._db.transaction() as conn:
            conn.execute(
                "UPDATE items SET status = ?, error = ?, updated_at = ? WHERE id = ?",
                (status, error, _now(), item_id),
            )

    def set_content(self, item_id: str, raw_content: str, title: str | None) -> None:
        with self._db.transaction() as conn:
            conn.execute(
                "UPDATE items SET raw_content = ?, title = COALESCE(title, ?), updated_at = ? WHERE id = ?",
                (raw_content, title, _now(), item_id),
            )

    def delete(self, item_id: str) -> None:
        """Delete an item; its chunks go with it (ON DELETE CASCADE)."""
        with self._db.transaction() as conn:
            conn.execute("DELETE FROM items WHERE id = ?", (item_id,))

    def fail_stranded(self) -> int:
        """Startup recovery: items left pending/processing by a restart become failed."""
        with self._db.transaction() as conn:
            cursor = conn.execute(
                "UPDATE items SET status = 'failed', updated_at = ?,"
                " error = 'Processing was interrupted by a server restart. Add it again to retry.'"
                " WHERE status IN ('pending', 'processing')",
                (_now(),),
            )
            conn.execute(
                "DELETE FROM chunks WHERE item_id IN (SELECT id FROM items WHERE status = 'failed')"
            )
            return cursor.rowcount
