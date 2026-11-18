"""Server-side URL fetching with an SSRF guard, then readable-text extraction.

Guards: http(s) only, every host (and every redirect hop) must resolve only to
public IPs, bounded redirects, bounded download size and time, HTML/text only.

Known limitation: the host is validated before the request, not pinned for the
connection, so a DNS-rebinding attacker could still race the check. Production
fix: connect to the validated IP (custom transport) or fetch via an egress proxy.
"""

import ipaddress
import socket
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urljoin, urlsplit

import httpx
import structlog
import trafilatura

log = structlog.get_logger(__name__)

_ALLOWED_CONTENT_TYPES = ("text/html", "application/xhtml+xml", "text/plain")
_USER_AGENT = "TuriumInbox/0.1 (+personal knowledge inbox)"


class UrlFetchError(Exception):
    """Raised with a message that is safe to show to the user."""


@dataclass(frozen=True)
class FetchedPage:
    url: str
    title: str | None
    text: str


class UrlFetcher(Protocol):
    def fetch(self, url: str) -> FetchedPage: ...


def assert_public_url(url: str) -> None:
    """Raise UrlFetchError unless url is http(s) and resolves only to public IPs."""
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https"):
        raise UrlFetchError("Only http and https URLs are supported.")
    host = parts.hostname
    if not host:
        raise UrlFetchError("The URL has no host.")
    port = parts.port or (443 if parts.scheme == "https" else 80)
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise UrlFetchError(f"Could not resolve host '{host}'.") from None
    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if not address.is_global or address.is_multicast:
            raise UrlFetchError("That URL points to a private or internal address, which is blocked.")


class HttpUrlFetcher:
    def __init__(
        self,
        *,
        timeout_s: float,
        max_bytes: int,
        max_redirects: int,
        max_text_chars: int,
        min_text_chars: int,
    ) -> None:
        self.timeout_s = timeout_s
        self.max_bytes = max_bytes
        self.max_redirects = max_redirects
        self.max_text_chars = max_text_chars
        self.min_text_chars = min_text_chars

    def fetch(self, url: str) -> FetchedPage:
        html, final_url = self._download(url)
        text = trafilatura.extract(html, include_comments=False, include_tables=True) or ""
        text = text.strip()
        if len(text) < self.min_text_chars:
            raise UrlFetchError(
                "No readable text found on that page (it may be empty, paywalled, or rendered by JavaScript)."
            )
        metadata = trafilatura.extract_metadata(html)
        title = (metadata.title or "").strip() if metadata else ""
        return FetchedPage(
            url=final_url, title=title or None, text=text[: self.max_text_chars]
        )

    def _download(self, url: str) -> tuple[str, str]:
        current = url
        timeout = httpx.Timeout(self.timeout_s)
        with httpx.Client(
            timeout=timeout, follow_redirects=False, headers={"User-Agent": _USER_AGENT}
        ) as client:
            for _ in range(self.max_redirects + 1):
                assert_public_url(current)
                try:
                    with client.stream("GET", current) as response:
                        if response.is_redirect:
                            location = response.headers.get("location")
                            if not location:
                                raise UrlFetchError("The server sent a redirect without a location.")
                            current = urljoin(current, location)
                            continue
                        return self._read_body(response), current
                except httpx.TimeoutException:
                    raise UrlFetchError(
                        f"The page did not respond within {self.timeout_s:g} seconds."
                    ) from None
                except httpx.HTTPError as exc:
                    log.warning("url_fetch_http_error", url=current, error=str(exc))
                    raise UrlFetchError(f"Could not fetch the page ({type(exc).__name__}).") from None
        raise UrlFetchError(f"Too many redirects (limit {self.max_redirects}).")

    def _read_body(self, response: httpx.Response) -> str:
        if response.status_code >= 400:
            raise UrlFetchError(f"The page returned HTTP {response.status_code}.")
        content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
        if content_type and not content_type.startswith(_ALLOWED_CONTENT_TYPES):
            raise UrlFetchError(f"Unsupported content type '{content_type}' (expected an HTML page).")
        declared = response.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > self.max_bytes:
            raise UrlFetchError(f"The page is larger than {self.max_bytes // 1_000_000} MB.")
        body = bytearray()
        for part in response.iter_bytes():
            body.extend(part)
            if len(body) > self.max_bytes:
                raise UrlFetchError(f"The page is larger than {self.max_bytes // 1_000_000} MB.")
        return body.decode(response.encoding or "utf-8", errors="replace")
