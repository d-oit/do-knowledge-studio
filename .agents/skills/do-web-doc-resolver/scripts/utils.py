"""
Utility functions for the Web Doc Resolver.
"""

import hashlib
import ipaddress
import logging
import os
import re
import socket
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .models import ErrorType, ResolvedResult, ValidationResult

logger = logging.getLogger(__name__)

MAX_CHARS = int(os.getenv("WEB_RESOLVER_MAX_CHARS", "8000"))
DEFAULT_TIMEOUT = int(os.getenv("WEB_RESOLVER_TIMEOUT", "30"))
CACHE_DIR = os.path.expanduser(os.getenv("WEB_RESOLVER_CACHE_DIR", "~/.cache/do-web-doc-resolver"))
CACHE_TTL = int(os.getenv("WEB_RESOLVER_CACHE_TTL", str(3600 * 24)))

USER_AGENT = (
    "Mozilla/5.0 (compatible; WebDocResolver/2.0; +https://github.com/d-oit/do-web-doc-resolver)"
)

BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

BLOCKED_SCHEMES: set[str] = {"file", "javascript", "data", "vbscript"}

_global_session: requests.Session | None = None
_cache = None


def create_session_with_retry() -> requests.Session:
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        backoff_factor=1.0,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
    )
    return session


def get_session() -> requests.Session:
    global _global_session
    if _global_session is None:
        _global_session = create_session_with_retry()
    return _global_session


def close_session() -> None:
    global _global_session
    if _global_session is not None:
        _global_session.close()
        _global_session = None


def is_safe_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        if parsed.scheme.lower() in BLOCKED_SCHEMES:
            return False
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.netloc.split(":")[0]
        if hostname.lower() in (
            "localhost",
            "localhost.localdomain",
            "127.0.0.1",
            "::1",
            "0.0.0.0",
        ):
            return False
        try:
            ip = ipaddress.ip_address(hostname)
            if any(ip in network for network in BLOCKED_NETWORKS):
                return False
        except ValueError:
            try:
                socket.setdefaulttimeout(5)
                infos = socket.getaddrinfo(hostname, None)
                for _family, _socktype, _proto, _canonname, sockaddr in infos:
                    ip = ipaddress.ip_address(sockaddr[0])
                    if any(ip in network for network in BLOCKED_NETWORKS):
                        return False
            except Exception:
                pass
            finally:
                socket.setdefaulttimeout(None)
        return True
    except Exception:
        return False


def is_url(input_str: str) -> bool:
    if not input_str or not input_str.strip():
        return False
    try:
        result = urlparse(input_str)
        return all([result.scheme in ("http", "https", "ftp", "ftps"), result.netloc])
    except Exception:
        return False


def validate_url(url: str, timeout: int = 10, check_ssrf: bool = True) -> ValidationResult:
    if not url or not url.strip():
        return ValidationResult(is_valid=False, error="Empty URL")
    if not is_url(url):
        return ValidationResult(is_valid=False, error="Invalid URL format")
    if check_ssrf and not is_safe_url(url):
        return ValidationResult(is_valid=False, error="URL blocked (SSRF)")

    session = get_session()
    try:
        response = session.head(url, timeout=timeout, allow_redirects=True, verify=True)
        redirect_chain = [h.url for h in response.history] + [response.url]
        if response.status_code >= 400:
            return ValidationResult(
                is_valid=False,
                status_code=response.status_code,
                error=f"HTTP {response.status_code}",
                final_url=response.url,
                redirect_chain=redirect_chain,
            )
        return ValidationResult(
            is_valid=True,
            status_code=response.status_code,
            final_url=response.url,
            redirect_chain=redirect_chain,
            content_type=response.headers.get("Content-Type", ""),
        )
    except Exception as e:
        return ValidationResult(is_valid=False, error=str(e))


def validate_links(links: list[str], timeout: int = 5) -> list[str]:
    valid_links = []
    session = get_session()
    for link in links:
        try:
            if not is_safe_url(link):
                continue
            response = session.head(link, timeout=timeout, allow_redirects=True)
            if response.status_code < 400:
                valid_links.append(link)
        except Exception:
            pass
    return valid_links


def score_result(url: str | None, content: str) -> float:
    score = 0.5
    if url:
        try:
            domain = urlparse(url).netloc.lower()
            if any(domain.endswith(tld) for tld in [".edu", ".gov", ".org", ".rs", ".io"]):
                score += 0.2
            if any(
                site in domain
                for site in ["github.com", "stackoverflow.com", "docs.rs", "mozilla.org"]
            ):
                score += 0.2
        except Exception:
            pass
    word_count = len(content.split())
    if word_count > 500:
        score += 0.1
    elif word_count < 50:
        score -= 0.2
    return max(0.0, min(1.0, score))


def compact_content(content: str, max_chars: int) -> str:
    lines = content.splitlines()
    unique_lines = set()
    compacted = []
    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            compacted.append("")
            continue
        if trimmed not in unique_lines:
            compacted.append(trimmed)
            unique_lines.add(trimmed)
    return "\n".join(compacted)[:max_chars]


def extract_text_from_html(html: str, base_url: str = "") -> str:
    class ScriptStyleStripper(HTMLParser):
        def __init__(self) -> None:
            super().__init__(convert_charrefs=False)
            self.result: list[str] = []
            self._skip_depth = 0

        def handle_starttag(self, tag, attrs):
            if tag.lower() in ("script", "style"):
                self._skip_depth += 1

        def handle_endtag(self, tag):
            if tag.lower() in ("script", "style") and self._skip_depth > 0:
                self._skip_depth -= 1

        def handle_data(self, data):
            if self._skip_depth == 0:
                self.result.append(data)

    stripper = ScriptStyleStripper()
    stripper.feed(html)
    text = "".join(stripper.result)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


def fetch_url_content(
    url: str, timeout: int = DEFAULT_TIMEOUT, max_chars: int = MAX_CHARS
) -> ResolvedResult | None:
    validation = validate_url(url, timeout=timeout // 2)
    if not validation.is_valid:
        return None
    session = get_session()
    try:
        response = session.get(url, timeout=timeout, allow_redirects=True, verify=True)
        if response.status_code >= 400:
            return None
        content = (
            extract_text_from_html(response.text, url)
            if "text/html" in response.headers.get("Content-Type", "")
            else response.text
        )
        return ResolvedResult(
            source="direct_fetch",
            content=content[:max_chars],
            url=validation.final_url or url,
            metadata={"status_code": response.status_code},
        )
    except Exception:
        return None


def fetch_llms_txt(url: str) -> str | None:
    try:
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        llms_url = f"{base_url}/llms.txt"
        cached = _get_from_cache(base_url, "llms_txt")
        if cached is not None:
            if cached.get("found"):
                return str(cached.get("content", ""))
            return None
        session = get_session()
        response = session.get(llms_url, timeout=10, allow_redirects=True)
        if response.status_code == 200:
            content_type = response.headers.get("Content-Type", "")
            if "text" in content_type or "markdown" in content_type:
                _save_to_cache(
                    base_url, "llms_txt", {"found": True, "content": response.text}, ttl=3600
                )
                return response.text
        _save_to_cache(base_url, "llms_txt", {"found": False}, ttl=3600)
    except Exception:
        pass
    return None


_TRACKING_PARAMS = {
    # UTM parameters
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    # Social/tracking parameters
    "fbclid",
    "gclid",
    "gclsrc",
    "dclid",
    "msclkid",
    "twclid",
    "li_fat_id",
    "mc_cid",
    "mc_eid",
    # Referral/tracking
    "ref",
    "ref_src",
    "ref_url",
    "source",
    "via",
    # Session/tracking
    "session_id",
    "sid",
    "_ga",
    "_gl",
    # Misc tracking
    "hsa_cam",
    "hsa_grp",
    "hsa_mt",
    "hsa_src",
    "hsa_ad",
    "hsa_acc",
    "hsa_net",
    "hsa_kw",
    "hsa_tgt",
    "hsa_ver",
}


def normalize_url(url: str) -> str:
    """Normalize URL by stripping tracking params, anchors, and common aliases."""
    try:
        parsed = urlparse(url)
        # Strip all known tracking params
        if parsed.query:
            from urllib.parse import parse_qs, urlencode

            params = parse_qs(parsed.query)
            filtered_params = {
                k: v
                for k, v in params.items()
                if k.lower() not in _TRACKING_PARAMS and not k.startswith("utm_")
            }
            query = urlencode(filtered_params, doseq=True)
        else:
            query = ""

        # Normalize fragment: strip if empty or just a section ref
        fragment = "" if not parsed.fragment else parsed.fragment

        # Normalize trailing slash (keep for root, strip for paths)
        path = parsed.path
        if path and path != "/" and path.endswith("/"):
            path = path.rstrip("/")

        # Normalize netloc: lowercase, strip default ports
        netloc = parsed.netloc.lower()
        if netloc.endswith(":80") and parsed.scheme == "http":
            netloc = netloc[:-3]
        elif netloc.endswith(":443") and parsed.scheme == "https":
            netloc = netloc[:-4]

        # Reconstruct
        normalized = parsed._replace(
            scheme=parsed.scheme.lower(), netloc=netloc, path=path, query=query, fragment=fragment
        ).geturl()
        return normalized.strip()
    except Exception:
        return url.lower().strip()


def normalize_query(query: str) -> str:
    """Normalize search query."""
    # Lowercase, trim whitespace, and collapse multiple spaces
    normalized = query.lower().strip()
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized


def _cache_key(input_str: str, source: str) -> str:
    # Use normalized input for cache key
    if is_url(input_str):
        normalized = normalize_url(input_str)
    else:
        normalized = normalize_query(input_str)

    hash_input = f"{source}:{normalized}"
    return hashlib.sha256(hash_input.encode()).hexdigest()


def _get_cache_proxy():
    from . import resolve

    if hasattr(resolve, "_cache") and resolve._cache is not None:
        return resolve._cache
    return _cache


def get_cache():
    try:
        import diskcache

        os.makedirs(CACHE_DIR, exist_ok=True)
        return diskcache.Cache(CACHE_DIR)
    except Exception:
        return None


def _get_cache():
    global _cache
    _cache = _get_cache_proxy()
    if _cache is None:
        _cache = get_cache()
    return _cache


def _get_from_cache(input_str: str, source: str) -> dict[str, Any] | None:
    cache = _get_cache()
    if not cache:
        return None
    result = cache.get(_cache_key(input_str, source))
    if result is None:
        return None
    return dict(result)


def _save_to_cache(input_str: str, source: str, result: dict[str, Any], ttl: int | None = None):
    cache = _get_cache()
    if not cache:
        return
    cache.set(_cache_key(input_str, source), result, expire=ttl or CACHE_TTL)


def _detect_error_type(error: Exception) -> ErrorType:
    error_msg = str(error).lower()
    if any(code in error_msg for code in ["429", "rate limit", "too many requests", "rate_limit"]):
        return ErrorType.RATE_LIMIT
    if any(
        code in error_msg
        for code in [
            "401",
            "403",
            "unauthorized",
            "forbidden",
            "invalid api key",
            "invalid_key",
            "authentication",
        ]
    ):
        return ErrorType.AUTH_ERROR
    if any(
        code in error_msg
        for code in [
            "402",
            "payment",
            "credit",
            "quota",
            "insufficient",
            "exhausted",
            "limit exceeded",
        ]
    ):
        return ErrorType.QUOTA_EXHAUSTED
    if any(code in error_msg for code in ["timeout", "timed out"]):
        return ErrorType.TIMEOUT
    if any(code in error_msg for code in ["connection", "network"]):
        return ErrorType.NETWORK_ERROR
    if any(code in error_msg for code in ["not found", "404"]):
        return ErrorType.NOT_FOUND
    if any(code in error_msg for code in ["ssrf", "blocked", "private ip", "localhost"]):
        return ErrorType.SSRF_BLOCKED
    if any(code in error_msg for code in ["too large", "content size", "exceeds"]):
        return ErrorType.CONTENT_TOO_LARGE
    return ErrorType.UNKNOWN
