from fastapi.testclient import TestClient

from app.adapters.url_fetcher import UrlFetchError
from app.errors import UpstreamError
from app.main import create_app
from app.services.answering import NO_CONTEXT_ANSWER
from tests.conftest import FakeEmbedder

COFFEE = "I prefer dark roast coffee in the morning with oat milk."
FINANCE = "Quarterly revenue grew twelve percent driven by the APAC region."


def ingest_note(client, content=COFFEE, **extra):
    return client.post("/ingest", json={"type": "note", "content": content, **extra})


def items(client, **params):
    return client.get("/items", params=params).json()


# --- ingest ---------------------------------------------------------------


def test_ingest_note_is_accepted_then_processed(client):
    response = ingest_note(client)
    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "pending" and body["id"]

    listing = items(client)
    assert listing["total"] == 1
    item = listing["items"][0]
    assert item["id"] == body["id"]
    assert item["status"] == "ready"
    assert item["chunk_count"] == 1
    assert item["type"] == "note"
    assert item["title"].startswith("I prefer dark roast")
    assert item["preview"].startswith("I prefer")


def test_note_uses_given_title(client):
    ingest_note(client, title="Coffee prefs")
    assert items(client)["items"][0]["title"] == "Coffee prefs"


def test_ingest_url_fetches_and_stores_content(client, fetcher):
    response = client.post("/ingest", json={"type": "url", "url": "https://example.com/k8s"})
    assert response.status_code == 202
    item = items(client)["items"][0]
    assert item["status"] == "ready"
    assert item["type"] == "url"
    assert item["source_url"] == "https://example.com/k8s"
    assert item["title"] == "Example page"

    detail = client.get(f"/items/{item['id']}").json()
    assert "Kubernetes" in detail["raw_content"]
    assert detail["chunks"][0]["chunk_index"] == 0


def test_duplicate_url_returns_409_with_existing_id(client):
    first = client.post("/ingest", json={"type": "url", "url": "https://example.com/a"}).json()
    second = client.post("/ingest", json={"type": "url", "url": "https://example.com/a#section"})
    assert second.status_code == 409
    error = second.json()["error"]
    assert error["code"] == "duplicate_url"
    assert error["details"]["existing_id"] == first["id"]
    assert items(client)["total"] == 1


def test_failed_url_can_be_retried(client, fetcher):
    fetcher.error = UrlFetchError("The page did not respond within 10 seconds.")
    client.post("/ingest", json={"type": "url", "url": "https://example.com/flaky"})
    failed = items(client)["items"][0]
    assert failed["status"] == "failed"
    assert failed["error"] == "The page did not respond within 10 seconds."

    fetcher.error = None
    retry = client.post("/ingest", json={"type": "url", "url": "https://example.com/flaky"})
    assert retry.status_code == 202
    listing = items(client)
    assert listing["total"] == 1 and listing["items"][0]["status"] == "ready"


def test_unexpected_processing_error_marks_item_failed_with_request_id(client, embedder):
    def boom(_texts):
        raise RuntimeError("onnx exploded")

    embedder.embed_documents = boom
    response = ingest_note(client)
    item = items(client)["items"][0]
    assert item["status"] == "failed"
    assert "server logs" in item["error"]
    assert response.headers["X-Request-ID"] in item["error"]


def test_invalid_bodies_return_422_with_field_details(client):
    for body in (
        {"type": "note"},
        {"type": "note", "content": "   "},
        {"type": "url", "url": "not-a-url"},
        {"type": "url", "url": "ftp://example.com/x"},
        {"type": "video", "content": "x"},
        {},
    ):
        response = client.post("/ingest", json=body)
        assert response.status_code == 422, body
        error = response.json()["error"]
        assert error["code"] == "validation_error"
        assert error["details"] and "message" in error["details"][0]


def test_note_over_limit_returns_413(client):
    response = ingest_note(client, content="x" * 301)
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"
    assert items(client)["total"] == 0


# --- items ----------------------------------------------------------------


def test_items_pagination_and_status_filter(client, fetcher):
    for i in range(3):
        ingest_note(client, content=f"note number {i} about topic {i}")
    fetcher.error = UrlFetchError("nope")
    client.post("/ingest", json={"type": "url", "url": "https://example.com/bad"})

    assert items(client)["total"] == 4
    page = items(client, limit=2, offset=0)
    assert len(page["items"]) == 2 and page["total"] == 4
    assert items(client, status="failed")["total"] == 1
    assert items(client, status="ready")["total"] == 3
    assert client.get("/items", params={"limit": 0}).status_code == 422
    assert client.get("/items", params={"status": "bogus"}).status_code == 422


def test_items_listed_newest_first(client):
    ingest_note(client, content="first note here")
    ingest_note(client, content="second note here")
    titles = [i["title"] for i in items(client)["items"]]
    assert titles == ["second note here", "first note here"]


def test_get_unknown_item_returns_404_with_standard_error(client):
    response = client.get("/items/does-not-exist")
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "not_found"
    assert error["request_id"] == response.headers["X-Request-ID"]


# --- query ----------------------------------------------------------------


def test_query_returns_answer_with_cited_sources(client, llm):
    ingest_note(client, content=COFFEE, title="Coffee")
    ingest_note(client, content=FINANCE, title="Finance")

    response = client.post("/query", json={"question": "what coffee do I like to drink?"})

    assert response.status_code == 200
    body = response.json()
    assert body["answered"] is True
    assert body["answer"] == "Based on your notes [1]."
    assert body["model"] == "fake/model"
    assert body["sources"][0]["index"] == 1
    assert body["sources"][0]["title"] == "Coffee"
    assert "dark roast" in body["sources"][0]["snippet"]
    assert 0 < body["sources"][0]["score"] <= 1
    system, user = llm.calls[0]
    assert "untrusted" in system and "[1] (Coffee)" in user and "Question:" in user


def test_irrelevant_question_skips_the_llm(client, llm):
    ingest_note(client, content=COFFEE)
    body = client.post("/query", json={"question": "tell me about volcanic geology"}).json()
    assert body["answered"] is False
    assert body["answer"] == NO_CONTEXT_ANSWER
    assert body["sources"] == []
    assert llm.calls == []


def test_query_with_empty_inbox_is_unanswered(client, llm):
    body = client.post("/query", json={"question": "anything at all?"}).json()
    assert body["answered"] is False and llm.calls == []


def test_query_validation_and_limits(client):
    assert client.post("/query", json={"question": ""}).status_code == 422
    assert client.post("/query", json={"question": "ok", "top_k": 0}).status_code == 422
    assert client.post("/query", json={"question": "ok", "top_k": 11}).status_code == 422
    too_long = client.post("/query", json={"question": "q" * 201})
    assert too_long.status_code == 413


def test_llm_failure_returns_502(client, llm):
    ingest_note(client, content=COFFEE)
    llm.error = UpstreamError("The answer model returned an error (HTTP 429). Try again shortly.")
    response = client.post("/query", json={"question": "what coffee do I like?"})
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "upstream_error"


def test_only_ready_items_are_used_as_sources(client, fetcher):
    fetcher.error = UrlFetchError("down")
    client.post("/ingest", json={"type": "url", "url": "https://example.com/coffee-blog"})
    body = client.post("/query", json={"question": "coffee"}).json()
    assert body["answered"] is False


# --- readiness, request ids, recovery -------------------------------------


def test_health_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok" and body["embedder"] == "ready" and body["db"] == "ok"
    assert body["model"] == "fake-embedder"


def test_embedder_not_ready_returns_503(settings, llm, fetcher):
    app = create_app(settings, embedder=FakeEmbedder(status="error"), llm=llm, fetcher=fetcher)
    with TestClient(app) as client:
        assert client.get("/health").status_code == 503
        assert client.post("/ingest", json={"type": "note", "content": "hello"}).status_code == 503
        response = client.post("/query", json={"question": "hello?"})
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "service_unavailable"


def test_request_id_header_is_echoed_and_generated(client):
    echoed = client.get("/health", headers={"X-Request-ID": "trace-123"})
    assert echoed.headers["X-Request-ID"] == "trace-123"
    generated = client.get("/health")
    assert len(generated.headers["X-Request-ID"]) == 12
    rejected = client.get("/health", headers={"X-Request-ID": "bad id with spaces!"})
    assert rejected.headers["X-Request-ID"] != "bad id with spaces!"


def test_unknown_route_uses_standard_error_shape(client):
    response = client.get("/nope")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_stranded_items_are_failed_on_startup(settings, embedder, llm, fetcher):
    app = create_app(settings, embedder=embedder, llm=llm, fetcher=fetcher)
    with TestClient(app) as first:
        container = first.app.state.container
        stranded = container.items.create(item_type="note", title="x", source_url=None, raw_content="x")
        container.items.set_status(stranded, "processing")

    with TestClient(create_app(settings, embedder=embedder, llm=llm, fetcher=fetcher)) as second:
        item = second.get("/items").json()["items"][0]
        assert item["status"] == "failed" and "restart" in item["error"]
