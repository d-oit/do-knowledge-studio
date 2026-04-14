"""
Budget-aware routing logic for the Web Doc Resolver.
"""

from dataclasses import dataclass
from urllib.parse import urlparse

from .routing_memory import RoutingMemory


@dataclass
class ResolutionBudget:
    max_provider_attempts: int
    max_paid_attempts: int
    max_total_latency_ms: int
    allow_paid: bool = True
    attempts: int = 0
    paid_attempts: int = 0
    elapsed_ms: int = 0
    stop_reason: str | None = None

    def can_try(self, *, is_paid: bool) -> bool:
        if self.attempts >= self.max_provider_attempts:
            self.stop_reason = "max_provider_attempts"
            return False
        if is_paid and not self.allow_paid:
            self.stop_reason = "paid_disabled"
            return False
        if is_paid and self.paid_attempts >= self.max_paid_attempts:
            self.stop_reason = "max_paid_attempts"
            return False
        if self.elapsed_ms >= self.max_total_latency_ms:
            self.stop_reason = "max_total_latency_ms"
            return False
        return True

    def record_attempt(self, *, is_paid: bool, latency_ms: int) -> None:
        self.attempts += 1
        self.elapsed_ms += latency_ms
        if is_paid:
            self.paid_attempts += 1


PROFILE_BUDGETS = {
    "free": {
        "max_provider_attempts": 3,
        "max_paid_attempts": 0,
        "max_total_latency_ms": 6000,
        "allow_paid": False,
    },
    "balanced": {
        "max_provider_attempts": 6,
        "max_paid_attempts": 2,
        "max_total_latency_ms": 12000,
        "allow_paid": True,
    },
    "fast": {
        "max_provider_attempts": 2,
        "max_paid_attempts": 1,
        "max_total_latency_ms": 4000,
        "allow_paid": True,
    },
    "quality": {
        "max_provider_attempts": 10,
        "max_paid_attempts": 5,
        "max_total_latency_ms": 20000,
        "allow_paid": True,
    },
}


def extract_domain(url: str) -> str | None:
    try:
        parsed = urlparse(url)
        return parsed.netloc.lower() or None
    except Exception:
        return None


def detect_doc_platform(url: str) -> str | None:
    """Detect common documentation platforms from URL."""
    try:
        parsed = urlparse(url)
    except Exception:
        return None

    hostname = (parsed.hostname or "").lower()
    path = (parsed.path or "").lower()

    if hostname == "gitbook.io" or hostname.endswith(".gitbook.io"):
        return "gitbook"
    if hostname == "gitbook.com" or hostname.endswith(".gitbook.com"):
        return "gitbook"
    if hostname == "readthedocs.io" or hostname.endswith(".readthedocs.io"):
        return "sphinx"
    if hostname == "rtfd.io" or hostname.endswith(".rtfd.io"):
        return "sphinx"
    if hostname == "www.mkdocs.org" or hostname == "mkdocs.org":
        return "mkdocs"
    if hostname == "notion.so" or hostname.endswith(".notion.so"):
        return "notion"
    if hostname == "notion.site" or hostname.endswith(".notion.site"):
        return "notion"
    if (
        (hostname.endswith(".atlassian.net") and path.startswith("/wiki"))
        or "confluence" in hostname
        or "confluence" in path
    ):
        return "confluence"

    return None


def preflight_route(url: str) -> dict:
    """
    Cheap preflight classifier: inspect URL signals to route to best extraction strategy.

    Returns dict with:
    - platform: detected doc platform or None
    - preferred_strategy: 'direct_fetch', 'llms_txt', 'extraction', 'browser'
    - confidence: 0.0-1.0
    - js_heavy: bool - likely needs JS rendering
    """
    platform = detect_doc_platform(url)
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()
    path = (parsed.path or "").lower()

    # Static doc platforms: prefer llms.txt → direct fetch
    if platform in ("gitbook", "sphinx", "mkdocs"):
        return {
            "platform": platform,
            "preferred_strategy": "llms_txt",
            "confidence": 0.85,
            "js_heavy": False,
        }

    # JS-heavy platforms: need browser or extraction
    if platform in ("notion", "confluence"):
        return {
            "platform": platform,
            "preferred_strategy": "extraction",
            "confidence": 0.8,
            "js_heavy": True,
        }

    # Known doc sites
    doc_signals = ["docs.", "doc.", "documentation", "/docs/", "/doc/", "/api/", "/reference/"]
    if any(s in hostname or s in path for s in doc_signals):
        return {
            "platform": None,
            "preferred_strategy": "llms_txt",
            "confidence": 0.6,
            "js_heavy": False,
        }

    # GitHub/GitLab: direct content
    if any(d in hostname for d in ["github.com", "gitlab.com", "bitbucket.org"]):
        return {
            "platform": None,
            "preferred_strategy": "direct_fetch",
            "confidence": 0.7,
            "js_heavy": False,
        }

    # Default: try llms.txt first, then extraction
    return {
        "platform": None,
        "preferred_strategy": "llms_txt",
        "confidence": 0.4,
        "js_heavy": False,
    }


def plan_provider_order(
    *,
    target: str,
    is_url: bool,
    custom_order: list[str] | None = None,
    skip_providers: set[str] | None = None,
    routing_memory: RoutingMemory | None = None,
) -> list[str]:
    if custom_order:
        base = list(custom_order)
    elif is_url:
        preflight = preflight_route(target)
        platform = preflight.get("platform")
        strategy = preflight.get("preferred_strategy", "llms_txt")

        if platform in ("notion", "confluence") or preflight.get("js_heavy"):
            base = ["firecrawl", "mistral_browser", "jina", "direct_fetch", "duckduckgo"]
        elif strategy == "direct_fetch":
            base = [
                "direct_fetch",
                "llms_txt",
                "jina",
                "firecrawl",
                "mistral_browser",
                "duckduckgo",
            ]
        else:
            base = [
                "llms_txt",
                "jina",
                "firecrawl",
                "direct_fetch",
                "mistral_browser",
                "duckduckgo",
            ]
    else:
        base = ["exa_mcp", "exa", "tavily", "duckduckgo", "mistral_websearch"]

    skip_providers = skip_providers or set()

    domain = extract_domain(target) if is_url else "query"
    if domain and routing_memory:
        base = routing_memory.rank(domain, base)

    return [p for p in base if p not in skip_providers]
