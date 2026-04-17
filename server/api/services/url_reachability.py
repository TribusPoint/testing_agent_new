"""Validate that a company URL is reachable over HTTPS (before onboarding / edits)."""

from __future__ import annotations

from urllib.parse import urlparse

import httpx


class UrlReachabilityError(Exception):
    """Raised with a short machine-friendly code and user-facing message."""

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


_TIMEOUT = 18.0
_HEADERS = {
    "User-Agent": "TestingAgentUrlCheck/1.0 (+https://github.com/testing-agent)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def _require_https_url(raw: str) -> str:
    u = (raw or "").strip()
    if not u.lower().startswith("https://"):
        raise UrlReachabilityError(
            "not_https",
            "URL must start with https:// (secure sites only).",
        )
    parsed = urlparse(u)
    if not parsed.netloc or "." not in parsed.netloc:
        raise UrlReachabilityError(
            "invalid_url",
            "That doesn’t look like a valid website address. Check spelling and include https://",
        )
    host = (parsed.hostname or "").lower()
    if host in ("localhost", "127.0.0.1", "::1") or host.endswith(".local"):
        raise UrlReachabilityError(
            "blocked_host",
            "Use a public website URL, not localhost or an internal hostname.",
        )
    return u


async def verify_public_https_url(url: str) -> str:
    """
    Confirm the URL uses https and returns an acceptable HTTP response.
    Returns the final normalized URL string used for the request.
    """
    final = _require_https_url(url)
    try:
        async with httpx.AsyncClient(
            timeout=_TIMEOUT,
            follow_redirects=True,
            headers=_HEADERS,
        ) as client:
            resp = await client.get(final)
    except httpx.InvalidURL as e:
        raise UrlReachabilityError("invalid_url", f"Invalid URL: {e!s}") from e
    except httpx.ConnectError as e:
        err = str(e).lower()
        if (
            "name or service not known" in err
            or "nodename nor servname" in err
            or "getaddrinfo failed" in err
        ):
            raise UrlReachabilityError(
                "dns_failed",
                "We couldn’t reach that domain (DNS lookup failed). Check the hostname spelling.",
            ) from e
        raise UrlReachabilityError(
            "connect_failed",
            "We couldn’t connect to that server. It may be down or blocking automated checks.",
        ) from e
    except httpx.TimeoutException:
        raise UrlReachabilityError(
            "timeout",
            "The site took too long to respond. Try again or confirm the URL loads in your browser.",
        )
    except httpx.HTTPError as e:
        raise UrlReachabilityError(
            "network_error",
            f"Network error while checking the site: {e!s}",
        ) from e

    code = resp.status_code
    if code >= 400:
        raise UrlReachabilityError(
            "http_error",
            f"The website returned HTTP {code}. Use a URL that loads successfully in the browser.",
        )

    ctype = (resp.headers.get("content-type") or "").lower()
    if ctype and "text/html" not in ctype and "application/xhtml" not in ctype:
        # Allow empty or generic responses from CDNs
        if not any(x in ctype for x in ("text/", "application/json", "application/xml")):
            raise UrlReachabilityError(
                "unsupported_content",
                "That URL doesn’t appear to serve a normal web page (unexpected content type).",
            )

    return str(resp.url)

