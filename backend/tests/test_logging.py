import json
import logging

import pytest
from fastapi.testclient import TestClient

from app.adapters.url_fetcher import UrlFetchError
from app.config import Settings
from app.logging_config import effective_log_level
from app.main import create_app


def build_client(tmp_path, embedder, llm, fetcher, *, api_logging: bool) -> TestClient:
    settings = Settings(
        _env_file=None,
        database_path=str(tmp_path / "log.db"),
        api_logging=api_logging,
        similarity_threshold=0.3,
    )
    return TestClient(create_app(settings, embedder=embedder, llm=llm, fetcher=fetcher))


def log_events(captured: str) -> list[dict]:
    events = []
    for line in captured.splitlines():
        line = line.strip()
        if line.startswith("{"):
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return events


def test_api_logging_defaults_to_off():
    assert Settings(_env_file=None).api_logging is False


@pytest.mark.parametrize(
    "level, api_logging, expected",
    [
        ("INFO", True, logging.INFO),
        ("DEBUG", True, logging.DEBUG),
        ("INFO", False, logging.WARNING),
        ("DEBUG", False, logging.WARNING),
        ("ERROR", False, logging.ERROR),  # never lowers a stricter level
    ],
)
def test_effective_log_level(level, api_logging, expected):
    assert effective_log_level(level, api_logging) == expected


def test_enabled_logs_write_requests_and_processing_steps(tmp_path, embedder, llm, fetcher, capsys):
    with build_client(tmp_path, embedder, llm, fetcher, api_logging=True) as client:
        client.post("/ingest", json={"type": "note", "content": "I prefer dark roast coffee."})
        client.get("/items", params={"limit": 5})
        client.post("/query", json={"question": "what coffee do I like?"})
        client.get("/health")
    events = log_events(capsys.readouterr().out)
    names = {e["event"] for e in events}

    assert {"http_request", "ingest_chunked", "ingest_embedded", "ingest_done", "retrieval_done", "llm_done"} <= names
    requests = [e for e in events if e["event"] == "http_request"]
    assert [(r["method"], r["path"], r["status"]) for r in requests] == [
        ("POST", "/ingest", 202),
        ("POST", "/query", 200),
    ]
    assert requests[0]["endpoint"] == "ingest"
    assert all(r["request_id"] and "duration_ms" in r for r in requests)


def test_read_requests_are_not_logged(tmp_path, embedder, llm, fetcher, capsys):
    with build_client(tmp_path, embedder, llm, fetcher, api_logging=True) as client:
        client.get("/items", params={"limit": 5})
        client.get("/items/does-not-exist")
        client.get("/health")
        client.get("/nope")
    requests = [e for e in log_events(capsys.readouterr().out) if e["event"] == "http_request"]
    assert requests == []


def test_failed_write_requests_are_logged_with_their_status(tmp_path, embedder, llm, fetcher, capsys):
    with build_client(tmp_path, embedder, llm, fetcher, api_logging=True) as client:
        client.post("/ingest", json={"type": "bogus"})
        client.post("/query", json={"question": ""})
    requests = [e for e in log_events(capsys.readouterr().out) if e["event"] == "http_request"]
    assert [(r["path"], r["status"]) for r in requests] == [("/ingest", 422), ("/query", 422)]


def test_request_logs_never_contain_note_content(tmp_path, embedder, llm, fetcher, capsys):
    secret = "my private diary entry xyzzy"
    with build_client(tmp_path, embedder, llm, fetcher, api_logging=True) as client:
        client.post("/ingest", json={"type": "note", "content": secret})
    assert "xyzzy" not in capsys.readouterr().out


def test_disabled_prints_no_info_logs(tmp_path, embedder, llm, fetcher, capsys):
    with build_client(tmp_path, embedder, llm, fetcher, api_logging=False) as client:
        client.post("/ingest", json={"type": "note", "content": "I prefer dark roast coffee."})
        client.get("/items")
        client.post("/query", json={"question": "what coffee do I like?"})
        client.get("/health")
    assert log_events(capsys.readouterr().out) == []


def test_disabled_still_prints_failures(tmp_path, embedder, llm, fetcher, capsys):
    fetcher.error = UrlFetchError("The page did not respond within 10 seconds.")
    with build_client(tmp_path, embedder, llm, fetcher, api_logging=False) as client:
        client.post("/ingest", json={"type": "url", "url": "https://example.com/flaky"})
    events = log_events(capsys.readouterr().out)
    assert [e["event"] for e in events] == ["ingest_failed"]
    assert events[0]["level"] == "warning"
