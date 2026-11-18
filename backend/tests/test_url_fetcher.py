import socket

import httpx
import pytest

from app.adapters import url_fetcher
from app.adapters.url_fetcher import HttpUrlFetcher, UrlFetchError, assert_public_url

PUBLIC_IP = "93.184.216.34"
ARTICLE = "<html><head><title>Hello Page</title></head><body><article>" + (
    "<p>This is a reasonably long paragraph of readable article text for extraction.</p>" * 6
) + "</article></body></html>"


def fake_dns(mapping: dict[str, str]):
    def getaddrinfo(host, port, **_kwargs):
        ip = mapping.get(host, PUBLIC_IP)
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, port))]

    return getaddrinfo


@pytest.fixture
def dns(monkeypatch):
    mapping: dict[str, str] = {}
    monkeypatch.setattr(url_fetcher.socket, "getaddrinfo", fake_dns(mapping))
    return mapping


@pytest.mark.parametrize(
    "url",
    [
        "ftp://example.com/file",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "http://",
    ],
)
def test_non_http_or_hostless_urls_rejected(url, dns):
    with pytest.raises(UrlFetchError):
        assert_public_url(url)


@pytest.mark.parametrize(
    "ip",
    ["127.0.0.1", "10.0.0.5", "192.168.1.10", "172.16.0.1", "169.254.169.254", "0.0.0.0", "::1"],
)
def test_private_and_internal_addresses_blocked(ip, dns):
    dns["internal.test"] = ip
    with pytest.raises(UrlFetchError, match="private or internal"):
        assert_public_url("http://internal.test/")


def test_public_address_allowed(dns):
    assert_public_url("https://example.com/page")  # does not raise


def test_unresolvable_host_gives_readable_error(monkeypatch):
    def boom(*_a, **_k):
        raise socket.gaierror("nope")

    monkeypatch.setattr(url_fetcher.socket, "getaddrinfo", boom)
    with pytest.raises(UrlFetchError, match="Could not resolve"):
        assert_public_url("http://nowhere.invalid/")


def make_fetcher(monkeypatch, handler, **overrides):
    transport = httpx.MockTransport(handler)
    real_client = httpx.Client
    monkeypatch.setattr(
        url_fetcher.httpx, "Client", lambda **kw: real_client(transport=transport, **kw)
    )
    params = dict(timeout_s=5, max_bytes=50_000, max_redirects=3, max_text_chars=10_000, min_text_chars=50)
    params.update(overrides)
    return HttpUrlFetcher(**params)


def test_fetch_extracts_title_and_text(monkeypatch, dns):
    fetcher = make_fetcher(
        monkeypatch,
        lambda req: httpx.Response(200, text=ARTICLE, headers={"content-type": "text/html; charset=utf-8"}),
    )
    page = fetcher.fetch("https://example.com/post")
    assert page.title == "Hello Page"
    assert "readable article text" in page.text


def test_redirect_to_private_address_is_blocked(monkeypatch, dns):
    dns["internal.test"] = "10.0.0.5"

    def handler(request):
        if request.url.host == "example.com":
            return httpx.Response(302, headers={"location": "http://internal.test/admin"})
        return httpx.Response(200, text=ARTICLE, headers={"content-type": "text/html"})

    fetcher = make_fetcher(monkeypatch, handler)
    with pytest.raises(UrlFetchError, match="private or internal"):
        fetcher.fetch("https://example.com/start")


def test_too_many_redirects(monkeypatch, dns):
    fetcher = make_fetcher(
        monkeypatch, lambda req: httpx.Response(302, headers={"location": "https://example.com/loop"})
    )
    with pytest.raises(UrlFetchError, match="Too many redirects"):
        fetcher.fetch("https://example.com/loop")


def test_download_larger_than_cap_is_rejected(monkeypatch, dns):
    fetcher = make_fetcher(
        monkeypatch,
        lambda req: httpx.Response(200, content=b"a" * 200_000, headers={"content-type": "text/html"}),
        max_bytes=10_000,
    )
    with pytest.raises(UrlFetchError, match="larger than"):
        fetcher.fetch("https://example.com/big")


def test_non_html_content_type_rejected(monkeypatch, dns):
    fetcher = make_fetcher(
        monkeypatch, lambda req: httpx.Response(200, content=b"%PDF", headers={"content-type": "application/pdf"})
    )
    with pytest.raises(UrlFetchError, match="Unsupported content type"):
        fetcher.fetch("https://example.com/file.pdf")


def test_http_error_status_reported(monkeypatch, dns):
    fetcher = make_fetcher(monkeypatch, lambda req: httpx.Response(404, text="nope"))
    with pytest.raises(UrlFetchError, match="HTTP 404"):
        fetcher.fetch("https://example.com/missing")


def test_page_without_readable_text_fails_clearly(monkeypatch, dns):
    fetcher = make_fetcher(
        monkeypatch,
        lambda req: httpx.Response(200, text="<html><body><div id='app'></div></body></html>", headers={"content-type": "text/html"}),
    )
    with pytest.raises(UrlFetchError, match="No readable text"):
        fetcher.fetch("https://example.com/spa")
