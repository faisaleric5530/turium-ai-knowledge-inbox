import numpy as np
import pytest

from app.db import Database
from app.repositories.items_repo import ItemsRepository
from app.repositories.vector_store import SqliteVectorStore


@pytest.fixture
def db(tmp_path):
    database = Database(str(tmp_path / "vs.db"))
    database.init()
    return database


@pytest.fixture
def items(db):
    return ItemsRepository(db)


def unit(*values: float) -> np.ndarray:
    v = np.array(values, dtype=np.float32)
    return v / np.linalg.norm(v)


def make_ready_item(items, store, title, texts, vectors, model="m1"):
    item_id = items.create(item_type="note", title=title, source_url=None, raw_content="x")
    store.add_chunks(item_id, texts, np.vstack(vectors), model=model)
    items.set_status(item_id, "ready")
    store.invalidate()
    return item_id


def test_search_ranks_by_cosine_similarity(db, items):
    store = SqliteVectorStore(db, model="m1")
    make_ready_item(items, store, "coffee", ["coffee text"], [unit(1, 0, 0)])
    make_ready_item(items, store, "money", ["money text"], [unit(0, 1, 0)])
    make_ready_item(items, store, "mixed", ["mixed text"], [unit(1, 1, 0)])

    hits = store.search(unit(1, 0.1, 0), top_k=3)

    assert [h.title for h in hits] == ["coffee", "mixed", "money"]
    assert hits[0].score > hits[1].score > hits[2].score
    assert hits[0].text == "coffee text"


def test_top_k_is_respected(db, items):
    store = SqliteVectorStore(db, model="m1")
    for i in range(5):
        make_ready_item(items, store, f"n{i}", ["t"], [unit(1, i, 0)])
    assert len(store.search(unit(1, 0, 0), top_k=2)) == 2


def test_empty_store_returns_no_hits(db):
    assert SqliteVectorStore(db, model="m1").search(unit(1, 0, 0), top_k=5) == []


def test_only_ready_items_are_searchable(db, items):
    store = SqliteVectorStore(db, model="m1")
    pending = items.create(item_type="note", title="p", source_url=None, raw_content="x")
    store.add_chunks(pending, ["t"], np.vstack([unit(1, 0, 0)]), model="m1")
    store.invalidate()
    assert store.search(unit(1, 0, 0), top_k=5) == []


def test_deleted_item_is_excluded_and_chunks_cascade(db, items):
    store = SqliteVectorStore(db, model="m1")
    keep = make_ready_item(items, store, "keep", ["k"], [unit(0, 1, 0)])
    gone = make_ready_item(items, store, "gone", ["g"], [unit(1, 0, 0)])

    items.delete(gone)
    store.invalidate()

    hits = store.search(unit(1, 0, 0), top_k=5)
    assert [h.item_id for h in hits] == [keep]
    assert items.get_chunks(gone) == []


def test_chunks_from_a_different_embedding_model_are_ignored(db, items):
    store = SqliteVectorStore(db, model="m2")
    make_ready_item(items, store, "old-model", ["t"], [unit(1, 0, 0)], model="m1")
    assert store.search(unit(1, 0, 0), top_k=5) == []


def test_fail_stranded_marks_pending_and_processing_failed(db, items):
    pending = items.create(item_type="note", title="a", source_url=None, raw_content="x")
    processing = items.create(item_type="note", title="b", source_url=None, raw_content="x")
    items.set_status(processing, "processing")
    done = items.create(item_type="note", title="c", source_url=None, raw_content="x")
    items.set_status(done, "ready")

    assert items.fail_stranded() == 2

    assert items.get(pending)["status"] == "failed"
    assert "restart" in items.get(processing)["error"]
    assert items.get(done)["status"] == "ready"
